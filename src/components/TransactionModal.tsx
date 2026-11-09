import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { buildMethod, categoryOptions, parseMethod, accountOf } from "../lib/calc";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, METHODS, TRANSFER_CATEGORY } from "../lib/constants";
import { todayISO } from "../lib/dates";
import type { NewTransaction, Transaction, TxType } from "../lib/types";
import { useLedger } from "../state/ledger";
import { Button, ConfirmDeleteButton, Field, Modal, Segmented } from "./ui";

const ACCOUNTS = METHODS.map((m) => m as string);

interface FormState {
  type: TxType;
  amount: string;
  date: string;
  category: string;
  note: string;
  description: string;
  method: string;
  other: string;
  from: string;
  to: string;
}

function initialForm(t: Transaction | null | undefined): FormState {
  const m = parseMethod(t?.method ?? "");
  return {
    type: t?.type ?? "expense",
    amount: t ? String(t.amount) : "",
    date: t?.date ?? todayISO(),
    category: t && t.type !== "transfer" ? t.category : "Food",
    note: t?.note ?? "",
    description: t?.description ?? "",
    method: m.choice,
    other: m.other,
    from: t?.type === "transfer" ? accountOf(t.from) : "Bank",
    to: t?.type === "transfer" ? accountOf(t.to) : "Cash",
  };
}

export function TransactionModal({ editing, onClose }: { editing?: Transaction | null; onClose(): void }) {
  const { data, addTransaction, updateTransaction, deleteTransaction } = useLedger();
  const [f, setF] = useState<FormState>(() => initialForm(editing));
  const [error, setError] = useState("");
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const categories = useMemo(
    () =>
      categoryOptions(
        data.transactions.filter((t) => t.type === f.type),
        f.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES,
      ),
    [data.transactions, f.type],
  );

  const changeType = (type: TxType) => {
    setF((s) => {
      const defaults = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const fits = s.type !== "transfer" && type === s.type;
      return { ...s, type, category: type === "transfer" || fits ? s.category : (defaults[0] ?? "") };
    });
    setError("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Math.round(Number(f.amount) * 100) / 100;
    if (!(amount > 0)) return setError("Enter an amount greater than zero.");
    if (!f.date) return setError("Pick a date.");
    const transfer = f.type === "transfer";
    if (transfer && f.from === f.to) return setError("Choose two different accounts.");
    if (!transfer && !f.category.trim()) return setError("Choose or type a category.");

    const base: NewTransaction = {
      type: f.type,
      amount,
      category: transfer ? TRANSFER_CATEGORY : f.category.trim(),
      note: f.note.trim(),
      description: f.description.trim(),
      date: f.date,
      method: transfer ? "" : buildMethod(f.method, f.other),
      from: transfer ? f.from : "",
      to: transfer ? f.to : "",
    };
    onClose();
    if (editing) void updateTransaction({ ...base, id: editing.id });
    else void addTransaction(base);
  };

  const transfer = f.type === "transfer";
  return (
    <Modal
      title={editing ? "Edit transaction" : "Add transaction"}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <ConfirmDeleteButton
              onConfirm={() => {
                onClose();
                void deleteTransaction(editing.id);
              }}
            />
          )}
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="tx-form">
            {editing ? "Save changes" : "Add"}
          </Button>
        </>
      }
    >
      <form id="tx-form" className="form" onSubmit={submit} noValidate>
        <Segmented<TxType>
          label="Transaction type"
          value={f.type}
          onChange={changeType}
          className="seg-block"
          options={[
            { value: "expense", label: "Expense", icon: <ArrowUpRight size={15} /> },
            { value: "income", label: "Income", icon: <ArrowDownLeft size={15} /> },
            { value: "transfer", label: "Transfer", icon: <ArrowLeftRight size={15} /> },
          ]}
        />

        <div className="row-2">
          <Field label="Amount">
            <input
              className="input input-mono"
              data-autofocus
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
        </div>

        {transfer ? (
          <div className="row-2">
            <Field label="From">
              <select className="input" value={f.from} onChange={(e) => set("from", e.target.value)}>
                {ACCOUNTS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select className="input" value={f.to} onChange={(e) => set("to", e.target.value)}>
                {ACCOUNTS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <>
            <div className="row-2">
              <Field label="Category">
                <input className="input" list="tx-categories" value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Type or pick" />
                <datalist id="tx-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Payment method">
                <select className="input" value={f.method} onChange={(e) => set("method", e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m === "Other" ? "Other (specify)" : m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {f.method === "Other" && (
              <Field label="Specify method">
                <input className="input" value={f.other} maxLength={40} onChange={(e) => set("other", e.target.value)} placeholder="e.g. Paytm wallet" />
              </Field>
            )}
          </>
        )}

        <Field label="Note">
          <input className="input" value={f.note} maxLength={120} onChange={(e) => set("note", e.target.value)} placeholder="What was it for?" />
        </Field>
        <Field label="Description (optional)">
          <textarea className="input textarea" rows={2} value={f.description} maxLength={500} onChange={(e) => set("description", e.target.value)} />
        </Field>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
