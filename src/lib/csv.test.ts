import { describe, expect, it } from "vitest";
import { transactionsToCSV } from "./csv";

describe("csv export", () => {
  const base = { id: "1", type: "expense" as const, amount: 10, category: "Food", note: "", description: "", date: "2026-11-05", method: "UPI", from: "", to: "" };

  it("quotes commas and quotes", () => {
    expect(transactionsToCSV([{ ...base, note: 'say "hi", ok' }])).toContain('"say ""hi"", ok"');
  });
  it("neutralises formulas", () => {
    expect(transactionsToCSV([{ ...base, note: "=SUM(A1)" }])).toContain("'=SUM(A1)");
  });
});
