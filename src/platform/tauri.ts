import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Platform } from "./types";

/** Rust commands reject with plain strings; turn them into real Errors. */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw e instanceof Error ? e : new Error(typeof e === "string" ? e : "Something went wrong.");
  }
}

export const tauriPlatform: Platform = {
  lock: {
    status: () => call("lock_status"),
    setup: (username, password) => call("lock_setup", { username, password }),
    verify: (username, password) => call("lock_verify", { username, password }),
    change: (current, next) => call("lock_change", { current, new: next }),
  },
  secrets: {
    get: (key) => call("secret_get", { key }),
    set: (key, value) => call("secret_set", { key, value }),
    delete: (key) => call("secret_delete", { key }),
  },
  oauth: {
    begin: () => call("oauth_begin"),
    wait: (authUrl, state) => call("oauth_wait", { authUrl, expectedState: state }),
  },
  openUrl: (url) => call("open_url", { url }),
  setWindowTheme: (theme) => getCurrentWindow().setTheme(theme),
  showWindow: () => getCurrentWindow().show(),
};
