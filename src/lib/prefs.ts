import type { LedgerData, ThemeMode } from "./types";

const PREFS_KEY = "ledger.prefs.v1";
/** Also read by the inline script in index.html so the theme applies before first paint. */
const THEME_KEY = "ledger.theme";
const CACHE_PREFIX = "ledger.cache.v1.";

export interface Prefs {
  theme: ThemeMode;
  currency: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  email: string;
}

const defaults: Prefs = { theme: "system", currency: "INR", spreadsheetId: "", spreadsheetTitle: "", email: "" };

const isTheme = (v: unknown): v is ThemeMode => v === "dark" || v === "light" || v === "system";

export function loadPrefs(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    const theme = isTheme(stored.theme) ? stored.theme : isTheme(localStorage.getItem(THEME_KEY)) ? (localStorage.getItem(THEME_KEY) as ThemeMode) : defaults.theme;
    return {
      theme,
      currency: typeof stored.currency === "string" ? stored.currency : defaults.currency,
      spreadsheetId: typeof stored.spreadsheetId === "string" ? stored.spreadsheetId : "",
      spreadsheetTitle: typeof stored.spreadsheetTitle === "string" ? stored.spreadsheetTitle : "",
      email: typeof stored.email === "string" ? stored.email : "",
    };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    localStorage.setItem(THEME_KEY, p.theme);
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

/** Last synced data, shown instantly on launch while a fresh copy loads. */
export function loadCache(spreadsheetId: string): LedgerData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + spreadsheetId);
    if (!raw) return null;
    const d = JSON.parse(raw) as LedgerData;
    return Array.isArray(d.transactions) && Array.isArray(d.budgets) && Array.isArray(d.goals) ? d : null;
  } catch {
    return null;
  }
}

export function saveCache(spreadsheetId: string, data: LedgerData): void {
  try {
    localStorage.setItem(CACHE_PREFIX + spreadsheetId, JSON.stringify(data));
  } catch {
    /* quota exceeded or unavailable: skip caching */
  }
}

export function clearCache(spreadsheetId: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + spreadsheetId);
  } catch {
    /* ignore */
  }
}
