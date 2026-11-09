//! Local lock screen credentials.
//!
//! The username and an Argon2id hash of the password live in `lock.json` inside
//! the app data directory. The password itself is never stored.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, thread, time::Duration};

const MIN_PASSWORD_CHARS: usize = 6;
const MAX_FIELD_CHARS: usize = 128;
const FAILURE_DELAY: Duration = Duration::from_millis(600);

#[derive(Serialize, Deserialize)]
struct Stored {
    username: String,
    hash: String,
}

#[derive(Serialize)]
pub struct LockStatus {
    pub configured: bool,
    pub username: Option<String>,
}

fn read(path: &Path) -> Option<Stored> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write(path: &Path, stored: &Stored) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(stored).map_err(|e| e.to_string())?;
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn hash(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

fn password_matches(stored_hash: &str, password: &str) -> bool {
    PasswordHash::new(stored_hash)
        .map(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

fn validate_password(password: &str) -> Result<(), String> {
    let n = password.chars().count();
    if n < MIN_PASSWORD_CHARS {
        return Err(format!("Password must be at least {MIN_PASSWORD_CHARS} characters."));
    }
    if n > MAX_FIELD_CHARS {
        return Err("Password is too long.".into());
    }
    Ok(())
}

pub fn status(path: &Path) -> LockStatus {
    match read(path) {
        Some(s) => LockStatus { configured: true, username: Some(s.username) },
        None => LockStatus { configured: false, username: None },
    }
}

pub fn setup(path: &Path, username: &str, password: &str) -> Result<(), String> {
    let username = username.trim();
    if username.is_empty() || username.chars().count() > MAX_FIELD_CHARS {
        return Err("Enter a username.".into());
    }
    validate_password(password)?;
    if read(path).is_some() {
        return Err("A login already exists.".into());
    }
    write(path, &Stored { username: username.to_string(), hash: hash(password)? })
}

pub fn verify(path: &Path, username: &str, password: &str) -> bool {
    let ok = match read(path) {
        Some(s) => {
            // Evaluate both so timing does not reveal which field was wrong.
            let pw = password_matches(&s.hash, password);
            let user = s.username.trim().to_lowercase() == username.trim().to_lowercase();
            pw && user
        }
        None => false,
    };
    if !ok {
        thread::sleep(FAILURE_DELAY);
    }
    ok
}

pub fn change(path: &Path, current: &str, new: &str) -> Result<(), String> {
    let stored = read(path).ok_or_else(|| "No login is configured.".to_string())?;
    validate_password(new)?;
    if !password_matches(&stored.hash, current) {
        thread::sleep(FAILURE_DELAY);
        return Err("Current password is incorrect.".into());
    }
    write(path, &Stored { username: stored.username, hash: hash(new)? })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("ledger-lock-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir.join("lock.json")
    }

    #[test]
    fn setup_verify_change_roundtrip() {
        let path = temp_file("roundtrip");
        assert!(!status(&path).configured);
        setup(&path, "  Bee ", "secret1").unwrap();
        assert_eq!(status(&path).username.as_deref(), Some("Bee"));
        assert!(verify(&path, "bee", "secret1"));
        assert!(!verify(&path, "bee", "wrong"));
        assert!(!verify(&path, "someone", "secret1"));
        assert!(change(&path, "nope", "another1").is_err());
        change(&path, "secret1", "another1").unwrap();
        assert!(verify(&path, "Bee", "another1"));
        assert!(!verify(&path, "Bee", "secret1"));
        let raw = fs::read_to_string(&path).unwrap();
        assert!(!raw.contains("secret1") && raw.contains("$argon2id$"));
    }

    #[test]
    fn rejects_weak_input_and_second_setup() {
        let path = temp_file("weak");
        assert!(setup(&path, "", "secret1").is_err());
        assert!(setup(&path, "bee", "123").is_err());
        setup(&path, "bee", "secret1").unwrap();
        assert!(setup(&path, "bee", "secret2").is_err());
    }
}
