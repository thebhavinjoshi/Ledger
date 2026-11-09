export const METHODS = ["UPI", "Cash", "Card", "Netbanking", "Bank", "Other"] as const;

export const EXPENSE_CATEGORIES = [
  "Food",
  "Groceries",
  "Travel",
  "Shopping",
  "Bills",
  "Rent",
  "Health",
  "Entertainment",
  "Education",
  "Other",
];

export const INCOME_CATEGORIES = ["Salary", "Freelance", "Interest", "Gift", "Refund", "Other"];

export const TRANSFER_CATEGORY = "Transfer";

export interface CurrencyInfo {
  code: string;
  label: string;
  locale: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "INR", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", label: "Euro (€)", locale: "de-DE" },
  { code: "GBP", label: "British Pound (£)", locale: "en-GB" },
  { code: "AED", label: "UAE Dirham (AED)", locale: "en-AE" },
  { code: "SGD", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "AUD", label: "Australian Dollar (A$)", locale: "en-AU" },
  { code: "CAD", label: "Canadian Dollar (C$)", locale: "en-CA" },
  { code: "JPY", label: "Japanese Yen (¥)", locale: "ja-JP" },
];

/** Category / goal swatches. They read well on both the dark and light themes. */
export const PALETTE = [
  "#e5604d",
  "#5b8fe0",
  "#d9a441",
  "#7a73d6",
  "#4bb286",
  "#d96ba0",
  "#3fb5c4",
  "#a3b34a",
  "#e08a4b",
  "#8f98a3",
];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#e5604d",
  Travel: "#5b8fe0",
  Shopping: "#d9a441",
  Bills: "#7a73d6",
  Groceries: "#4bb286",
  Rent: "#d96ba0",
  Health: "#3fb5c4",
  Entertainment: "#e08a4b",
  Education: "#a3b34a",
  Other: "#8f98a3",
  Salary: "#4bb286",
  Freelance: "#5b8fe0",
  Interest: "#3fb5c4",
  Gift: "#d96ba0",
  Refund: "#a3b34a",
  Transfer: "#8f98a3",
};

export function categoryColor(name: string): string {
  const known = CATEGORY_COLORS[name];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] ?? "#8f98a3";
}

export const DEFAULT_GOAL_COLOR = PALETTE[4] ?? "#4bb286";
