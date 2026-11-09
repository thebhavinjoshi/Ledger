import type { DataSource } from "../lib/data";
import { createSheetsSource, type TokenProvider } from "../lib/sheets";
import type { Platform } from "./types";

export type { Platform } from "./types";

let current: Platform | null = null;

export function getPlatform(): Platform {
  if (!current) throw new Error("The platform has not been initialised.");
  return current;
}

export async function initPlatform(): Promise<void> {
  if ("__TAURI_INTERNALS__" in window) {
    current = (await import("./tauri")).tauriPlatform;
  } else {
    throw new Error("Ledger runs inside its desktop app. Open the installed app instead of this page.");
  }
}

export async function createSource(spreadsheetId: string, getToken: TokenProvider): Promise<DataSource> {
  return createSheetsSource(spreadsheetId, getToken);
}
