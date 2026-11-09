import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { newId, type DataSource } from "../lib/data";
import { AuthError, errorMessage } from "../lib/errors";
import { loadCache, saveCache } from "../lib/prefs";
import type { Budget, Goal, LedgerData, NewTransaction, Transaction } from "../lib/types";
import { useToast } from "./toast";

type Status = "loading" | "ready" | "error";

interface LedgerContextValue {
  data: LedgerData;
  status: Status;
  /** Last sync error, if any. Data on screen may then be out of date. */
  error: string | null;
  syncing: boolean;
  refresh(): Promise<void>;
  addTransaction(t: NewTransaction): Promise<boolean>;
  updateTransaction(t: Transaction): Promise<boolean>;
  deleteTransaction(id: string): Promise<boolean>;
  saveBudget(b: Budget, previousCategory?: string): Promise<boolean>;
  deleteBudget(category: string): Promise<boolean>;
  addGoal(g: Omit<Goal, "id">): Promise<boolean>;
  updateGoal(g: Goal): Promise<boolean>;
  deleteGoal(id: string): Promise<boolean>;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);
const empty: LedgerData = { transactions: [], budgets: [], goals: [] };

interface Props {
  source: DataSource;
  spreadsheetId: string;
  /** Called when Google rejects the saved session; the app returns to sign-in. */
  onAuthLost(): void;
  children: ReactNode;
}

export function LedgerProvider({ source, spreadsheetId, onAuthLost, children }: Props) {
  const toast = useToast();
  const [cached] = useState(() => loadCache(spreadsheetId));
  const [data, setData] = useState<LedgerData>(cached ?? empty);
  const [status, setStatus] = useState<Status>(cached ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const load = useCallback(async () => {
    setPending((p) => p + 1);
    try {
      setData(await source.load());
      setStatus("ready");
      setError(null);
    } catch (e) {
      if (e instanceof AuthError) return onAuthLost();
      setError(errorMessage(e));
      setStatus((s) => (s === "ready" ? s : "error"));
    } finally {
      setPending((p) => p - 1);
    }
  }, [source, onAuthLost]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status === "ready") saveCache(spreadsheetId, data);
  }, [data, status, spreadsheetId]);

  /**
   * Updates the screen immediately, then performs the change in the sheet.
   * Changes run one at a time so row lookups never race each other. If one
   * fails, the sheet is reloaded so the screen shows the truth.
   */
  const run = useCallback(
    async (apply: (d: LedgerData) => LedgerData, remote: () => Promise<void>, failure: string): Promise<boolean> => {
      setData(apply);
      setPending((p) => p + 1);
      const job = queue.current.then(remote);
      queue.current = job.catch(() => undefined);
      try {
        await job;
        return true;
      } catch (e) {
        if (e instanceof AuthError) onAuthLost();
        else {
          toast.show(`${failure} ${errorMessage(e)}`, "error");
          void load();
        }
        return false;
      } finally {
        setPending((p) => p - 1);
      }
    },
    [load, onAuthLost, toast],
  );

  const value = useMemo<LedgerContextValue>(
    () => ({
      data,
      status,
      error,
      syncing: pending > 0,
      refresh: load,

      addTransaction: (input) => {
        const t: Transaction = { ...input, id: newId() };
        return run((d) => ({ ...d, transactions: [...d.transactions, t] }), () => source.addTransaction(t), "Couldn't save the transaction.");
      },
      updateTransaction: (t) =>
        run((d) => ({ ...d, transactions: d.transactions.map((x) => (x.id === t.id ? t : x)) }), () => source.updateTransaction(t), "Couldn't update the transaction."),
      deleteTransaction: (id) =>
        run((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== id) }), () => source.deleteTransaction(id), "Couldn't delete the transaction."),

      saveBudget: (b, previous) =>
        run(
          (d) => {
            const key = (previous ?? b.category).toLowerCase();
            const exists = d.budgets.some((x) => x.category.toLowerCase() === key);
            return {
              ...d,
              budgets: exists ? d.budgets.map((x) => (x.category.toLowerCase() === key ? b : x)) : [...d.budgets, b],
            };
          },
          () => source.saveBudget(b, previous),
          "Couldn't save the budget.",
        ),
      deleteBudget: (category) =>
        run(
          (d) => ({ ...d, budgets: d.budgets.filter((x) => x.category.toLowerCase() !== category.toLowerCase()) }),
          () => source.deleteBudget(category),
          "Couldn't delete the budget.",
        ),

      addGoal: (input) => {
        const g: Goal = { ...input, id: newId() };
        return run((d) => ({ ...d, goals: [...d.goals, g] }), () => source.addGoal(g), "Couldn't save the goal.");
      },
      updateGoal: (g) =>
        run((d) => ({ ...d, goals: d.goals.map((x) => (x.id === g.id ? g : x)) }), () => source.updateGoal(g), "Couldn't update the goal."),
      deleteGoal: (id) =>
        run((d) => ({ ...d, goals: d.goals.filter((x) => x.id !== id) }), () => source.deleteGoal(id), "Couldn't delete the goal."),
    }),
    [data, status, error, pending, load, run, source],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used inside <LedgerProvider>");
  return ctx;
}
