import { newId, type DataSource } from "./data";
import { DEFAULT_GOAL_COLOR } from "./constants";
import { normalizeDate } from "./dates";
import { SheetsError } from "./errors";
import type { Budget, Goal, LedgerData, Transaction } from "./types";

/** Returns a valid access token; `forceRefresh` is set after a 401. */
export type TokenProvider = (forceRefresh?: boolean) => Promise<string>;

export const TABS = { tx: "Transactions", budget: "Budget", goals: "Goals" } as const;
export const TX_HEADERS = ["id", "type", "amount", "category", "note", "description", "date", "method", "from", "to"];
export const BUDGET_HEADERS = ["category", "limit"];
export const GOAL_HEADERS = ["id", "name", "target", "saved", "color", "deadline"];

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const COLS = "ABCDEFGHIJ";
const enc = encodeURIComponent;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ row mapping */

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s₹$€£]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Returns null for rows that are blank or not valid transactions. */
export function rowToTransaction(row: unknown[]): Transaction | null {
  const type = str(row[1]).toLowerCase();
  if (type !== "income" && type !== "expense" && type !== "transfer") return null;
  const amount = num(row[2]);
  const date = normalizeDate(row[6]);
  if (amount === null || !date) return null;
  return {
    id: str(row[0]),
    type,
    amount: Math.abs(amount),
    category: str(row[3]),
    note: str(row[4]),
    description: str(row[5]),
    date,
    method: str(row[7]),
    from: str(row[8]),
    to: str(row[9]),
  };
}

export const transactionToRow = (t: Transaction): (string | number)[] => [
  t.id,
  t.type,
  t.amount,
  t.category,
  t.note,
  t.description,
  t.date,
  t.method,
  t.from,
  t.to,
];

export function rowToBudget(row: unknown[]): Budget | null {
  const category = str(row[0]);
  const limit = num(row[1]);
  return category && limit !== null ? { category, limit: Math.abs(limit) } : null;
}

export const budgetToRow = (b: Budget): (string | number)[] => [b.category, b.limit];

export function rowToGoal(row: unknown[]): Goal | null {
  const name = str(row[1]);
  const target = num(row[2]);
  if (!name || target === null) return null;
  return {
    id: str(row[0]),
    name,
    target: Math.abs(target),
    saved: Math.max(0, num(row[3]) ?? 0),
    color: str(row[4]) || DEFAULT_GOAL_COLOR,
    deadline: normalizeDate(row[5]),
  };
}

export const goalToRow = (g: Goal): (string | number)[] => [g.id, g.name, g.target, g.saved, g.color, g.deadline];

/** Accepts a full spreadsheet URL or a bare ID. */
export function parseSpreadsheetId(input: string): string | null {
  const s = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(s);
  if (fromUrl?.[1]) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : null;
}

/* ------------------------------------------------------------ HTTP client */

function friendly(status: number, message: string): string {
  if (status === 403) return "Ledger can't edit this spreadsheet. Make sure the signed-in Google account has edit access.";
  if (status === 404) return "That spreadsheet could not be found. Check the link and try again.";
  if (status === 429) return "Google is rate-limiting requests. Wait a moment and try again.";
  return message;
}

async function request<T>(
  getToken: TokenProvider,
  path: string,
  init: { method?: string; body?: unknown; idempotent?: boolean } = {},
): Promise<T> {
  const idempotent = init.idempotent ?? true;
  let attempts = 0;
  let forced = false;
  for (;;) {
    const token = await getToken(forced);
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: init.method ?? (init.body === undefined ? "GET" : "POST"),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      // The request may or may not have reached Google; only repeat it if that is harmless.
      if (idempotent && attempts++ < 2) {
        await sleep(400 * 2 ** attempts);
        continue;
      }
      throw new SheetsError(0, "Network error. Check your connection and try again.");
    }
    if (res.ok) return (await res.json().catch(() => ({}))) as T;
    if (res.status === 401 && !forced) {
      forced = true;
      continue;
    }
    const retryable = res.status === 429 || (idempotent && res.status >= 500);
    if (retryable && attempts++ < 3) {
      await sleep(500 * 2 ** attempts);
      continue;
    }
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      /* keep the status text */
    }
    throw new SheetsError(res.status, friendly(res.status, message));
  }
}

interface ValueRanges {
  valueRanges?: { values?: unknown[][] }[];
}

/* ----------------------------------------------------------- spreadsheets */

export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
}

export async function getSpreadsheetInfo(getToken: TokenProvider, id: string): Promise<SpreadsheetInfo> {
  const r = await request<{ properties?: { title?: string }; spreadsheetUrl?: string }>(
    getToken,
    `/${id}?fields=properties.title,spreadsheetUrl`,
  );
  return {
    id,
    title: r.properties?.title ?? "Spreadsheet",
    url: r.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${id}`,
  };
}

/** Creates a new spreadsheet containing the three Ledger tabs. */
export async function createSpreadsheet(getToken: TokenProvider, title = "Ledger"): Promise<SpreadsheetInfo> {
  const r = await request<{ spreadsheetId: string; spreadsheetUrl?: string }>(getToken, "", {
    idempotent: false,
    body: {
      properties: { title },
      sheets: Object.values(TABS).map((t) => ({ properties: { title: t, gridProperties: { frozenRowCount: 1 } } })),
    },
  });
  return {
    id: r.spreadsheetId,
    title,
    url: r.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${r.spreadsheetId}`,
  };
}

/* ------------------------------------------------------------ data source */

export interface SheetsSource extends DataSource {
  /** Creates missing tabs and header cells. Safe to call repeatedly. */
  init(): Promise<void>;
}

export function createSheetsSource(spreadsheetId: string, getToken: TokenProvider): SheetsSource {
  const call = <T>(path: string, init?: { method?: string; body?: unknown; idempotent?: boolean }) =>
    request<T>(getToken, `/${spreadsheetId}${path}`, init);

  let sheetIds: Record<string, number> = {};
  let schema: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    const meta = await call<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
      "?fields=sheets.properties(sheetId,title)",
    );
    const ids: Record<string, number> = {};
    for (const s of meta.sheets ?? []) ids[s.properties.title] = s.properties.sheetId;

    const missing = Object.values(TABS).filter((t) => !(t in ids));
    if (missing.length) {
      const res = await call<{ replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }>(
        ":batchUpdate",
        {
          idempotent: false,
          body: {
            requests: missing.map((title) => ({
              addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
            })),
          },
        },
      );
      for (const r of res.replies) ids[r.addSheet.properties.title] = r.addSheet.properties.sheetId;
    }
    sheetIds = ids;

    const headers = await call<ValueRanges>(
      `/values:batchGet?ranges=${enc(`${TABS.tx}!A1:J1`)}&ranges=${enc(`${TABS.budget}!A1:B1`)}&ranges=${enc(`${TABS.goals}!A1:F1`)}`,
    );
    const [tx, budget, goals] = (headers.valueRanges ?? []).map((v) => v.values?.[0]?.length ?? 0);
    const data: { range: string; values: string[][] }[] = [];
    const fill = (tab: string, have: number, wanted: string[]) => {
      if (have >= wanted.length) return;
      const last = COLS[wanted.length - 1];
      data.push({ range: `${tab}!${COLS[have]}1:${last}1`, values: [wanted.slice(have)] });
    };
    fill(TABS.tx, tx ?? 0, TX_HEADERS);
    fill(TABS.budget, budget ?? 0, BUDGET_HEADERS);
    fill(TABS.goals, goals ?? 0, GOAL_HEADERS);
    if (data.length) {
      await call("/values:batchUpdate", { body: { valueInputOption: "RAW", data } });
    }
  }

  const init = (): Promise<void> => {
    schema ??= ensureSchema().catch((e) => {
      schema = null;
      throw e;
    });
    return schema;
  };

  /** 1-based sheet row whose first cell equals `key`, or a 404 SheetsError. */
  async function findRow(tab: string, key: string, ignoreCase = false): Promise<number> {
    const r = await call<{ values?: unknown[][] }>(`/values/${enc(`${tab}!A2:A`)}?valueRenderOption=UNFORMATTED_VALUE`);
    const norm = (s: unknown) => (ignoreCase ? str(s).toLowerCase() : str(s));
    const wanted = norm(key);
    const i = (r.values ?? []).findIndex((row) => norm(row[0]) === wanted);
    if (i < 0) throw new SheetsError(404, "That entry is no longer in the sheet. Refresh to sync.");
    return i + 2;
  }

  const findRowOrNull = async (tab: string, key: string, ignoreCase = false): Promise<number | null> => {
    try {
      return await findRow(tab, key, ignoreCase);
    } catch (e) {
      if (e instanceof SheetsError && e.status === 404) return null;
      throw e;
    }
  };

  const lastCol = (n: number) => COLS[n - 1]!;

  async function append(tab: string, width: number, row: (string | number)[]): Promise<void> {
    await init();
    await call(
      `/values/${enc(`${tab}!A:${lastCol(width)}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { idempotent: false, body: { values: [row] } },
    );
  }

  async function overwrite(tab: string, width: number, rowNumber: number, row: (string | number)[]): Promise<void> {
    await call(`/values/${enc(`${tab}!A${rowNumber}:${lastCol(width)}${rowNumber}`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: { values: [row] },
    });
  }

  async function removeRow(tab: string, rowNumber: number): Promise<void> {
    const sheetId = sheetIds[tab];
    if (sheetId === undefined) throw new SheetsError(404, `The "${tab}" tab is missing.`);
    await call(":batchUpdate", {
      idempotent: false,
      body: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber } } }],
      },
    });
  }

  return {
    init,

    async load(): Promise<LedgerData> {
      await init();
      const r = await call<ValueRanges>(
        `/values:batchGet?ranges=${enc(`${TABS.tx}!A2:J`)}&ranges=${enc(`${TABS.budget}!A2:B`)}&ranges=${enc(`${TABS.goals}!A2:F`)}&valueRenderOption=UNFORMATTED_VALUE`,
      );
      const [txRows = [], budgetRows = [], goalRows = []] = (r.valueRanges ?? []).map((v) => v.values ?? []);

      const backfill: { range: string; values: string[][] }[] = [];
      const transactions: Transaction[] = [];
      txRows.forEach((row, i) => {
        const t = rowToTransaction(row);
        if (!t) return;
        if (!t.id) {
          t.id = newId();
          backfill.push({ range: `${TABS.tx}!A${i + 2}`, values: [[t.id]] });
        }
        transactions.push(t);
      });
      const goals: Goal[] = [];
      goalRows.forEach((row, i) => {
        const g = rowToGoal(row);
        if (!g) return;
        if (!g.id) {
          g.id = newId();
          backfill.push({ range: `${TABS.goals}!A${i + 2}`, values: [[g.id]] });
        }
        goals.push(g);
      });
      // Rows created before ids existed get one now, so edits can find them later.
      if (backfill.length) {
        await call("/values:batchUpdate", { body: { valueInputOption: "RAW", data: backfill } }).catch(() => undefined);
      }
      const budgets = budgetRows.map(rowToBudget).filter((b): b is Budget => b !== null);
      return { transactions, budgets, goals };
    },

    addTransaction: (t) => append(TABS.tx, TX_HEADERS.length, transactionToRow(t)),

    async updateTransaction(t) {
      await init();
      await overwrite(TABS.tx, TX_HEADERS.length, await findRow(TABS.tx, t.id), transactionToRow(t));
    },

    async deleteTransaction(id) {
      await init();
      await removeRow(TABS.tx, await findRow(TABS.tx, id));
    },

    async saveBudget(b, previousCategory) {
      await init();
      const row = await findRowOrNull(TABS.budget, previousCategory ?? b.category, true);
      if (row) await overwrite(TABS.budget, BUDGET_HEADERS.length, row, budgetToRow(b));
      else await append(TABS.budget, BUDGET_HEADERS.length, budgetToRow(b));
    },

    async deleteBudget(category) {
      await init();
      await removeRow(TABS.budget, await findRow(TABS.budget, category, true));
    },

    addGoal: (g) => append(TABS.goals, GOAL_HEADERS.length, goalToRow(g)),

    async updateGoal(g) {
      await init();
      await overwrite(TABS.goals, GOAL_HEADERS.length, await findRow(TABS.goals, g.id), goalToRow(g));
    },

    async deleteGoal(id) {
      await init();
      await removeRow(TABS.goals, await findRow(TABS.goals, id));
    },
  };
}
