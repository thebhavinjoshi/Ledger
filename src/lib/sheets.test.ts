import { describe, expect, it } from "vitest";
import { parseSpreadsheetId, rowToBudget, rowToGoal, rowToTransaction, transactionToRow } from "./sheets";

describe("sheet parsing", () => {
  it("extracts the id from a link or a bare id", () => {
    const id = "1AbC_dEf-1234567890abcdefghij";
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(parseSpreadsheetId(id)).toBe(id);
    expect(parseSpreadsheetId("hello")).toBeNull();
  });

  it("reads legacy 7-column transaction rows", () => {
    const t = rowToTransaction(["a1", "expense", 120, "Food", "Lunch", "", "2026-11-05"]);
    expect(t).toMatchObject({ id: "a1", type: "expense", amount: 120, method: "", from: "", to: "" });
  });

  it("round-trips a transfer", () => {
    const row = ["t1", "transfer", 50, "Transfer", "", "", "2026-11-05", "", "Bank", "Cash"];
    const t = rowToTransaction(row);
    expect(t?.from).toBe("Bank");
    expect(t && transactionToRow(t)).toEqual(row);
  });

  it("skips blank rows", () => {
    expect(rowToTransaction([])).toBeNull();
    expect(rowToBudget([])).toBeNull();
    expect(rowToGoal([])).toBeNull();
  });
});
