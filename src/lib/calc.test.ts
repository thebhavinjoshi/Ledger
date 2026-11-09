import { describe, expect, it } from "vitest";
import { accountBalances, accountOf, applyFilters, buildMethod, budgetUsage, emptyFilters, parseMethod, summarize, totalBalance } from "./calc";
import type { Transaction } from "./types";

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++n),
  type: "expense",
  amount: 0,
  category: "Food",
  note: "",
  description: "",
  date: "2026-11-05",
  method: "UPI",
  from: "",
  to: "",
  ...p,
});

describe("transfers", () => {
  const data = [
    tx({ type: "income", amount: 1000, method: "Bank", category: "Salary" }),
    tx({ type: "expense", amount: 200, method: "Bank" }),
    tx({ type: "transfer", amount: 300, from: "Bank", to: "Cash", category: "Transfer", method: "" }),
  ];

  it("do not change the total balance", () => {
    expect(totalBalance(data)).toBe(800);
  });

  it("do not count as income or spending", () => {
    expect(summarize(data, "2026-11")).toMatchObject({ income: 1000, expense: 200 });
  });

  it("move money between accounts", () => {
    expect(accountBalances(data)).toEqual({ Bank: 500, Cash: 300 });
  });
});

describe("payment methods", () => {
  it("round-trips the Other option", () => {
    expect(buildMethod("Other", " Paytm ")).toBe("Other: Paytm");
    expect(parseMethod("Other: Paytm")).toEqual({ choice: "Other", other: "Paytm" });
    expect(parseMethod("upi")).toEqual({ choice: "UPI", other: "" });
  });
  it("maps stored values to accounts", () => {
    expect(accountOf("other: Wallet")).toBe("Other");
    expect(accountOf("")).toBe("Unassigned");
  });
});

describe("filters", () => {
  const data = [
    tx({ amount: 50, date: "2026-10-30", category: "Travel", note: "Cab" }),
    tx({ amount: 400, date: "2026-11-02", category: "Food", method: "Cash" }),
    tx({ type: "transfer", amount: 90, date: "2026-11-03", from: "Bank", to: "Cash", category: "Transfer", method: "" }),
  ];

  it("filters by date range and type", () => {
    const r = applyFilters(data, { ...emptyFilters, from: "2026-11-01", to: "2026-11-30", type: "expense" });
    expect(r.map((t) => t.amount)).toEqual([400]);
  });
  it("searches notes and categories", () => {
    expect(applyFilters(data, { ...emptyFilters, search: "cab" })).toHaveLength(1);
  });
  it("sorts by amount", () => {
    expect(applyFilters(data, { ...emptyFilters, sort: "amount-desc" })[0]?.amount).toBe(400);
  });
});

describe("budgets", () => {
  it("measures spending in the chosen month only", () => {
    const usage = budgetUsage(
      [{ category: "Food", limit: 500 }],
      [tx({ amount: 250 }), tx({ amount: 999, date: "2026-10-01" })],
      "2026-11",
    );
    expect(usage[0]).toMatchObject({ spent: 250, pct: 50 });
  });
});
