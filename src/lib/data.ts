import type { Budget, Goal, LedgerData, Transaction } from "./types";

/**
 * Everything the UI needs from a backend. The Google Sheets implementation
 * lives in `sheets.ts`. A future
 * mobile app can reuse `sheets.ts` as-is.
 */
export interface DataSource {
  load(): Promise<LedgerData>;
  addTransaction(t: Transaction): Promise<void>;
  updateTransaction(t: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  /** `previousCategory` is passed when a budget is renamed. */
  saveBudget(b: Budget, previousCategory?: string): Promise<void>;
  deleteBudget(category: string): Promise<void>;
  addGoal(g: Goal): Promise<void>;
  updateGoal(g: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;
}

export const newId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
