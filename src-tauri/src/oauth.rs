//! Google OAuth for desktop apps: PKCE with a loopback redirect.
//!
//! The frontend builds the authorization URL (it owns the PKCE verifier).
//! This module only (1) reserves a free loopback port, (2) opens the system
//! browser, and (3) waits for Google to redirect back with the code.

use std::{sync::Mutex, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    time::timeout,
};

const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);
const AUTH_URL_PREFIX: &str = "https://accounts.google.com/";

const PAGE_OK: &str = "<!doctype html><meta charset=utf-8><title>Ledger</title>\
<body style=\"font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0a0e13;color:#e9edf1\">\
<div style=\"text-align:center\"><h1 style=\"font-weight:600\">You're signed in</h1>\
<p style=\"color:#8793a0\">You can close this tab and return to Ledger.</p></div>";

const PAGE_ERR: &str = "<!doctype html><meta charset=utf-8><title>Ledger</title>\
<body style=\"font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#0a0e13;color:#e9edf1\">\
<div style=\"text-align:center\"><h1 style=\"font-weight:600\">Sign-in didn't complete</h1>\
<p style=\"color:#8793a0\">Return to Ledger and try again.</p></div>";

#[derive(Default)]
pub struct OAuthState(Mutex<Option<TcpListener>>);

#[derive(Debug, PartialEq)]
pub enum Callback {
    Code(String),
    Error(String),
    Ignore,
}

/// Interprets the request line of an incoming loopback connection.
pub fn parse_request(head: &str, expected_state: &str) -> Callback {
    let line = head.lines().next().unwrap_or("");
    let mut parts = line.split_whitespace();
    if parts.next() != Some("GET") {
        return Callback::Ignore;
    }
    let Some(target) = parts.next() else { return Callback::Ignore };
    let Ok(url) = url::Url::parse(&format!("http://127.0.0.1{target}")) else {
        return Callback::Ignore;
    };
    if url.path() != "/" {
        return Callback::Ignore; // favicon.ico and friends
    }
    let (mut code, mut state, mut error) = (None, None, None);
    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "code" => code = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            "error" => error = Some(v.into_owned()),
            _ => {}
        }
    }
    if let Some(e) = error {
        return Callback::Error(e);
    }
    match (code, state) {
        (Some(c), Some(s)) if s == expected_state => Callback::Code(c),
        (Some(_), _) => Callback::Error("state mismatch".into()),
        _ => Callback::Ignore,
    }
}

async fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let msg = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(msg.as_bytes()).await;
    let _ = stream.shutdown().await;
}

async fn accept_code(listener: &TcpListener, expected_state: &str) -> Result<String, String> {
    loop {
        let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 8192];
        let n = match timeout(Duration::from_secs(5), stream.read(&mut buf)).await {
            Ok(Ok(n)) if n > 0 => n,
            _ => continue,
        };
        let head = String::from_utf8_lossy(&buf[..n]).into_owned();
        match parse_request(&head, expected_state) {
            Callback::Code(code) => {
                respond(&mut stream, "200 OK", PAGE_OK).await;
                return Ok(code);
            }
            Callback::Error(e) => {
                respond(&mut stream, "400 Bad Request", PAGE_ERR).await;
                return Err(format!("Google sign-in failed: {e}"));
            }
            Callback::Ignore => respond(&mut stream, "404 Not Found", "Not found").await,
        }
    }
}

/// Reserves a loopback port and returns it.
pub async fn begin(state: &OAuthState) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    *state.0.lock().map_err(|e| e.to_string())? = Some(listener);
    Ok(port)
}

/// Opens `auth_url` in the system browser and waits for the redirect.
pub async fn wait(state: &OAuthState, auth_url: &str, expected_state: &str) -> Result<String, String> {
    if !auth_url.starts_with(AUTH_URL_PREFIX) {
        return Err("Refusing to open an unexpected sign-in address.".into());
    }
    let listener = state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "No sign-in is in progress.".to_string())?;
    open::that(auth_url).map_err(|e| format!("Could not open the browser: {e}"))?;
    match timeout(SIGN_IN_TIMEOUT, accept_code(&listener, expected_state)).await {
        Ok(result) => result,
        Err(_) => Err("Sign-in timed out. Please try again.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_matching_state() {
        let r = parse_request("GET /?state=abc&code=4%2F0AX HTTP/1.1\r\nHost: x", "abc");
        assert_eq!(r, Callback::Code("4/0AX".into()));
    }

    #[test]
    fn rejects_bad_state_and_surfaces_errors() {
        assert!(matches!(parse_request("GET /?state=zzz&code=1 HTTP/1.1", "abc"), Callback::Error(_)));
        assert!(matches!(parse_request("GET /?error=access_denied&state=abc HTTP/1.1", "abc"), Callback::Error(_)));
    }

    #[test]
    fn ignores_noise() {
        assert_eq!(parse_request("GET /favicon.ico HTTP/1.1", "abc"), Callback::Ignore);
        assert_eq!(parse_request("POST / HTTP/1.1", "abc"), Callback::Ignore);
        assert_eq!(parse_request("", "abc"), Callback::Ignore);
        assert_eq!(parse_request("GET /?foo=bar HTTP/1.1", "abc"), Callback::Ignore);
    }

    #[tokio::test]
    async fn full_loopback_roundtrip() {
        let state = OAuthState::default();
        let port = begin(&state).await.unwrap();
        let listener = state.0.lock().unwrap().take().unwrap();
        let server = tokio::spawn(async move { accept_code(&listener, "s1").await });
        let mut c = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        c.write_all(b"GET /?code=hello&state=s1 HTTP/1.1\r\nHost: localhost\r\n\r\n").await.unwrap();
        let mut out = String::new();
        let mut reader = tokio::io::BufReader::new(c);
        let _ = tokio::io::AsyncReadExt::read_to_string(&mut reader, &mut out).await;
        assert!(out.starts_with("HTTP/1.1 200"));
        assert_eq!(server.await.unwrap().unwrap(), "hello");
    }
}
