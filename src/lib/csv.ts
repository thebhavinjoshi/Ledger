import type { Transaction } from "./types";

const HEADERS = ["id", "type", "amount", "category", "note", "description", "date", "method", "from", "to"];

/** Quotes a cell and neutralises spreadsheet formulas (CSV injection). */
function cell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 CSV with a BOM so Excel shows ₹ and other symbols correctly. */
export function transactionsToCSV(txs: Transaction[]): string {
  const rows = txs.map((t) =>
    [t.id, t.type, t.amount, t.category, t.note, t.description, t.date, t.method, t.from, t.to].map(cell).join(","),
  );
  return `\uFEFF${[HEADERS.join(","), ...rows].join("\r\n")}\r\n`;
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
