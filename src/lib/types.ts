export type TxType = "income" | "expense" | "transfer";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  description: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Payment method / account: UPI, Cash, Card, Netbanking, Bank or "Other: <text>". */
  method: string;
  /** Transfers only: source account. */
  from: string;
  /** Transfers only: destination account. */
  to: string;
}

export type NewTransaction = Omit<Transaction, "id">;

export interface Budget {
  category: string;
  /** Monthly limit. */
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  color: string;
  /** YYYY-MM-DD or empty. */
  deadline: string;
}

export interface LedgerData {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
}

export type ThemeMode = "dark" | "light" | "system";

export type PageId = "dashboard" | "transactions" | "budgets" | "analytics" | "goals" | "settings";
