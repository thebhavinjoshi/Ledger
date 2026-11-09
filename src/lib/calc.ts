import { METHODS } from "./constants";
import { monthKey, monthRange } from "./dates";
import type { Budget, Transaction, TxType } from "./types";

/* ---------------------------------------------------------------- accounts */

export const UNASSIGNED = "Unassigned";

/** Maps a stored method ("Other: Paytm", "upi", "") to one of the account names. */
export function accountOf(method: string): string {
  const m = method.trim();
  if (!m) return UNASSIGNED;
  const known = METHODS.find((k) => k.toLowerCase() === m.toLowerCase());
  return known ?? "Other";
}

/** Human label for a stored method: "Other: Paytm" shows as "Paytm". */
export function methodLabel(method: string): string {
  const m = method.trim();
  const other = /^other\s*:\s*(.+)$/i.exec(m);
  return other?.[1]?.trim() || m || UNASSIGNED;
}

/** Splits a stored method back into the dropdown choice and the "other" text. */
export function parseMethod(method: string): { choice: string; other: string } {
  const m = method.trim();
  if (!m) return { choice: "UPI", other: "" };
  const other = /^other\s*(?::\s*(.*))?$/i.exec(m);
  if (other) return { choice: "Other", other: (other[1] ?? "").trim() };
  const known = METHODS.find((k) => k.toLowerCase() === m.toLowerCase());
  return known ? { choice: known, other: "" } : { choice: "Other", other: m };
}

/** Builds the stored value for a method dropdown plus its "other" text field. */
export function buildMethod(choice: string, otherText: string): string {
  if (choice !== "Other") return choice;
  const t = otherText.trim();
  return t ? `Other: ${t}` : "Other";
}

/** Net movement per account. Transfers move money between accounts only. */
export function accountBalances(txs: Transaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (account: string, delta: number) => {
    out[account] = (out[account] ?? 0) + delta;
  };
  for (const t of txs) {
    if (t.type === "income") add(accountOf(t.method), t.amount);
    else if (t.type === "expense") add(accountOf(t.method), -t.amount);
    else {
      add(accountOf(t.from), -t.amount);
      add(accountOf(t.to), t.amount);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ totals */

/** Transfers are excluded: moving your own money changes neither income nor spending. */
export function totalBalance(txs: Transaction[]): number {
  let total = 0;
  for (const t of txs) {
    if (t.type === "income") total += t.amount;
    else if (t.type === "expense") total -= t.amount;
  }
  return total;
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  /** Percentage of income kept; 0 when there is no income. */
  savingsRate: number;
}

export function summarize(txs: Transaction[], from: string, to: string = from): Summary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    const m = monthKey(t.date);
    if (m < from || m > to) continue;
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  const net = income - expense;
  return { income, expense, net, savingsRate: income > 0 ? (net / income) * 100 : 0 };
}

export interface FlowPoint {
  month: string;
  income: number;
  expense: number;
}

/** Income and expense per month for the `count` months ending at `endMonth`. */
export function cashflow(txs: Transaction[], endMonth: string, count: number): FlowPoint[] {
  const points = monthRange(endMonth, count).map((month) => ({ month, income: 0, expense: 0 }));
  const byMonth = new Map(points.map((p) => [p.month, p]));
  for (const t of txs) {
    const p = byMonth.get(monthKey(t.date));
    if (!p) continue;
    if (t.type === "income") p.income += t.amount;
    else if (t.type === "expense") p.expense += t.amount;
  }
  return points;
}

export interface Slice {
  label: string;
  amount: number;
}

function groupBy(txs: Transaction[], type: TxType, from: string, to: string, key: (t: Transaction) => string): Slice[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const m = monthKey(t.date);
    if (m < from || m > to) continue;
    const k = key(t);
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount);
}

export const spendByCategory = (txs: Transaction[], from: string, to: string = from): Slice[] =>
  groupBy(txs, "expense", from, to, (t) => t.category || "Uncategorised");

export const spendByMethod = (txs: Transaction[], from: string, to: string = from): Slice[] =>
  groupBy(txs, "expense", from, to, (t) => accountOf(t.method));

export interface BudgetUsage extends Budget {
  spent: number;
  /** spent / limit as a percentage (can exceed 100). */
  pct: number;
}

export function budgetUsage(budgets: Budget[], txs: Transaction[], month: string): BudgetUsage[] {
  const spent = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || monthKey(t.date) !== month) continue;
    const k = t.category.toLowerCase();
    spent.set(k, (spent.get(k) ?? 0) + t.amount);
  }
  return budgets
    .map((b) => {
      const s = spent.get(b.category.toLowerCase()) ?? 0;
      return { ...b, spent: s, pct: b.limit > 0 ? (s / b.limit) * 100 : s > 0 ? 100 : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.limit - a.limit);
}

/* ----------------------------------------------------------------- filters */

export type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export interface TxFilters {
  search: string;
  type: "all" | TxType;
  category: string;
  method: string;
  /** Inclusive YYYY-MM-DD bounds, or "". */
  from: string;
  to: string;
  sort: SortKey;
}

export const emptyFilters: TxFilters = {
  search: "",
  type: "all",
  category: "",
  method: "",
  from: "",
  to: "",
  sort: "date-desc",
};

/** Number of narrowing filters in use (search and sort are not counted). */
export function activeFilterCount(f: TxFilters): number {
  return [f.type !== "all", f.category, f.method, f.from, f.to].filter(Boolean).length;
}

export function applyFilters(txs: Transaction[], f: TxFilters): Transaction[] {
  const q = f.search.trim().toLowerCase();
  const rows: { t: Transaction; i: number }[] = [];
  txs.forEach((t, i) => {
    if (f.type !== "all" && t.type !== f.type) return;
    if (f.category && t.category.toLowerCase() !== f.category.toLowerCase()) return;
    if (f.from && t.date < f.from) return;
    if (f.to && t.date > f.to) return;
    if (f.method) {
      const hit = t.type === "transfer" ? accountOf(t.from) === f.method || accountOf(t.to) === f.method : accountOf(t.method) === f.method;
      if (!hit) return;
    }
    if (q) {
      const hay = `${t.note} ${t.description} ${t.category} ${methodLabel(t.method)} ${t.from} ${t.to} ${t.amount}`.toLowerCase();
      if (!hay.includes(q)) return;
    }
    rows.push({ t, i });
  });

  const dir = f.sort.endsWith("asc") ? 1 : -1;
  const byAmount = f.sort.startsWith("amount");
  rows.sort((a, b) => {
    const primary = byAmount ? a.t.amount - b.t.amount : a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : 0;
    // Ties: later sheet rows count as newer.
    return primary !== 0 ? primary * dir : (a.i - b.i) * dir;
  });
  return rows.map((r) => r.t);
}

/** Distinct categories in use plus the given defaults, sorted. */
export function categoryOptions(txs: Transaction[], defaults: string[]): string[] {
  const seen = new Map<string, string>();
  for (const c of [...defaults, ...txs.map((t) => t.category)]) {
    const k = c.trim();
    if (k && !seen.has(k.toLowerCase())) seen.set(k.toLowerCase(), k);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
