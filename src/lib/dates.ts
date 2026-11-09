/**
 * Calendar-date helpers. Dates are plain `YYYY-MM-DD` strings in local time and
 * months are `YYYY-MM` keys, so nothing here depends on time zones.
 */

export const pad = (n: number): string => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = (): string => toISO(new Date());

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const currentMonth = (): string => monthKey(todayISO());

export function parseISO(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addMonths(key: string, n: number): string {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Month keys from oldest to newest, ending at `endKey`. */
export function monthRange(endKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(endKey, i - (count - 1)));
}

export function daysInMonth(key: string): number {
  const [y = 1970, m = 1] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function daysBetween(fromISO: string, toISO_: string): number {
  const ms = parseISO(toISO_).getTime() - parseISO(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Converts whatever a spreadsheet cell holds into `YYYY-MM-DD` (or "" if it is
 * not a date). Handles ISO text, day-first text such as 05/11/2026, and Sheets
 * serial numbers.
 */
export function normalizeDate(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "";
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(raw) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(raw).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return validDate(+iso[1]!, +iso[2]!, +iso[3]!);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) return validDate(+dmy[3]!, +dmy[2]!, +dmy[1]!);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : toISO(new Date(t));
}

function validDate(y: number, m: number, d: number): string {
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}
