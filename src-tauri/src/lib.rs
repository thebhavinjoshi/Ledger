mod lock;
mod oauth;
mod secrets;

use std::{path::PathBuf, time::Duration};
use tauri::{AppHandle, Manager, State};

fn lock_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("lock.json"))
        .map_err(|e| e.to_string())
}

// ---- Lock screen -----------------------------------------------------------

#[tauri::command]
fn lock_status(app: AppHandle) -> Result<lock::LockStatus, String> {
    Ok(lock::status(&lock_path(&app)?))
}

#[tauri::command]
async fn lock_setup(app: AppHandle, username: String, password: String) -> Result<(), String> {
    let path = lock_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || lock::setup(&path, &username, &password))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn lock_verify(app: AppHandle, username: String, password: String) -> Result<bool, String> {
    let path = lock_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || lock::verify(&path, &username, &password))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn lock_change(app: AppHandle, current: String, new: String) -> Result<(), String> {
    let path = lock_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || lock::change(&path, &current, &new))
        .await
        .map_err(|e| e.to_string())?
}

// ---- Google OAuth (loopback) -----------------------------------------------

#[tauri::command]
async fn oauth_begin(state: State<'_, oauth::OAuthState>) -> Result<u16, String> {
    oauth::begin(&state).await
}

#[tauri::command]
async fn oauth_wait(
    state: State<'_, oauth::OAuthState>,
    auth_url: String,
    expected_state: String,
) -> Result<String, String> {
    oauth::wait(&state, &auth_url, &expected_state).await
}

// ---- Secrets and misc -------------------------------------------------------

#[tauri::command]
fn secret_get(key: String) -> Result<Option<String>, String> {
    secrets::get(&key)
}

#[tauri::command]
fn secret_set(key: String, value: String) -> Result<(), String> {
    secrets::set(&key, &value)
}

#[tauri::command]
fn secret_delete(key: String) -> Result<(), String> {
    secrets::delete(&key)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") {
        return Err("Only https links can be opened.".into());
    }
    open::that(url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(oauth::OAuthState::default())
        .setup(|app| {
            // The window starts hidden and the frontend shows it after its first
            // paint (no white flash). This is a safety net in case that never happens.
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(4));
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            lock_status,
            lock_setup,
            lock_verify,
            lock_change,
            oauth_begin,
            oauth_wait,
            secret_get,
            secret_set,
            secret_delete,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ledger");
}
