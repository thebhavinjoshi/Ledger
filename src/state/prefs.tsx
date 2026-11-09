import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFormatter, type Formatter } from "../lib/format";
import { loadPrefs, savePrefs, type Prefs } from "../lib/prefs";
import { getPlatform } from "../platform";

interface PrefsContextValue {
  prefs: Prefs;
  update(patch: Partial<Prefs>): void;
  /** The theme actually shown: "system" resolves to dark or light. */
  resolvedTheme: "dark" | "light";
  fmt: Formatter;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [resolvedTheme, setResolved] = useState<"dark" | "light">("dark");

  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);

  useEffect(() => savePrefs(prefs), [prefs]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = prefs.theme === "dark" || (prefs.theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      setResolved(dark ? "dark" : "light");
    };
    apply();
    // Keep the native title bar in step with the app. `null` follows Windows.
    getPlatform()
      .setWindowTheme(prefs.theme === "system" ? null : prefs.theme)
      .catch(() => undefined);
    if (prefs.theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefs.theme]);

  const fmt = useMemo(() => createFormatter(prefs.currency), [prefs.currency]);
  const value = useMemo(() => ({ prefs, update, resolvedTheme, fmt }), [prefs, update, resolvedTheme, fmt]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}

export const useMoney = (): Formatter => usePrefs().fmt;
