/**
 * Google sign-in for a desktop app: OAuth 2.0 authorization code + PKCE with a
 * loopback redirect. The system browser handles the consent screen; the Rust
 * side only catches the redirect (see src-tauri/src/oauth.rs).
 */
import { getPlatform } from "../platform";
import { AuthError } from "./errors";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
// Google issues a "secret" to Desktop-app clients, but it is not confidential
// (installed apps cannot keep secrets), so it is fine to ship in the build.
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "";

const SCOPES = "openid email https://www.googleapis.com/auth/spreadsheets";
const REFRESH_KEY = "google_refresh_token";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let access: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;
let emailCache: string | null = null;

export const authConfigured = (): boolean => CLIENT_ID.length > 0;

export async function hasSession(): Promise<boolean> {
  return (await getPlatform().secrets.get(REFRESH_KEY)) !== null;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const body = new URLSearchParams({ client_id: CLIENT_ID, ...params });
  if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET);
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new Error("Network error while contacting Google. Check your connection.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) {
    if (json.error === "invalid_grant") throw new AuthError("Your Google session expired. Please sign in again.");
    throw new Error(json.error_description ?? json.error ?? `Google returned an error (${res.status}).`);
  }
  return json as unknown as TokenResponse;
}

async function refresh(): Promise<string> {
  const platform = getPlatform();
  const refreshToken = await platform.secrets.get(REFRESH_KEY);
  if (!refreshToken) throw new AuthError("Please sign in with Google.");
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
    access = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
    return t.access_token;
  } catch (e) {
    if (e instanceof AuthError) {
      access = null;
      await platform.secrets.delete(REFRESH_KEY).catch(() => undefined);
    }
    throw e;
  }
}

/** A valid access token, refreshed on demand. Concurrent callers share one refresh. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && access && access.expiresAt - 60_000 > Date.now()) return access.token;
  inflight ??= refresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

/* ------------------------------------------------------------------- PKCE */

function randomString(bytes: number): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(a);
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<{ challenge: string; method: "S256" | "plain" }> {
  if (!crypto.subtle) return { challenge: verifier, method: "plain" };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { challenge: base64url(new Uint8Array(digest)), method: "S256" };
}

export async function signIn(): Promise<void> {
  const platform = getPlatform();
  if (!CLIENT_ID) throw new Error("Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID (see the README).");

  const verifier = randomString(48);
  const state = randomString(24);
  const { challenge, method } = await challengeFor(verifier);
  const port = await platform.oauth.begin();
  const redirectUri = `http://127.0.0.1:${port}`;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: method,
    state,
    access_type: "offline",
    prompt: "consent",
  });
  const code = await platform.oauth.wait(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, state);
  const t = await tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });
  if (!t.refresh_token) throw new Error("Google did not return a refresh token. Please try signing in again.");
  await platform.secrets.set(REFRESH_KEY, t.refresh_token);
  access = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  emailCache = null;
}

export async function signOut(): Promise<void> {
  const platform = getPlatform();
  const refreshToken = await platform.secrets.get(REFRESH_KEY).catch(() => null);
  if (refreshToken) {
    // Best effort: revoking is polite, but signing out must work offline too.
    fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    }).catch(() => undefined);
  }
  await platform.secrets.delete(REFRESH_KEY).catch(() => undefined);
  access = null;
  emailCache = null;
}

export async function getUserEmail(): Promise<string | null> {
  if (emailCache) return emailCache;
  try {
    const token = await getAccessToken();
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    emailCache = ((await res.json()) as { email?: string }).email ?? null;
    return emailCache;
  } catch {
    return null;
  }
}
