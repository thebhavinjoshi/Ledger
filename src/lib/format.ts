import { CURRENCIES } from "./constants";
import { parseISO, todayISO, addDays } from "./dates";

export interface Formatter {
  /** ₹1,234 or ₹1,234.50 */
  money(n: number): string;
  /** ₹1.2K, ₹12L: for chart axes. */
  compact(n: number): string;
}

export function createFormatter(code: string): Formatter {
  const info = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;
  const digits = info.code === "JPY" ? 0 : 2;
  const whole = new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    maximumFractionDigits: 0,
  });
  const exact = new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const short = new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return {
    money: (n) => (Number.isInteger(n) || digits === 0 ? whole : exact).format(n),
    compact: (n) => short.format(n),
  };
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const shortDayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const monthShortFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });
const monthLongFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

export const formatDate = (iso: string): string => (iso ? dateFmt.format(parseISO(iso)) : "");
export const formatShortDay = (iso: string): string => (iso ? shortDayFmt.format(parseISO(iso)) : "");

/** "Today", "Yesterday", or "Thu, 5 Nov". */
export function formatDayHeading(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return dayFmt.format(parseISO(iso));
}

export function monthLabel(key: string, style: "short" | "long" = "short"): string {
  const d = parseISO(`${key}-01`);
  return (style === "short" ? monthShortFmt : monthLongFmt).format(d);
}

export const percent = (n: number, digits = 1): string => `${n.toFixed(digits)}%`;
