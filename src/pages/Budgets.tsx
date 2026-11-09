import { useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, PiggyBank, Plus, TriangleAlert } from "lucide-react";
import { Button, Card, ConfirmDeleteButton, EmptyState, Field, Modal, PageHeader, ProgressBar } from "../components/ui";
import { budgetUsage, categoryOptions, spendByCategory } from "../lib/calc";
import { categoryColor, EXPENSE_CATEGORIES } from "../lib/constants";
import { addMonths, currentMonth } from "../lib/dates";
import { monthLabel } from "../lib/format";
import { cx } from "../lib/cx";
import type { Budget } from "../lib/types";
import { useLedger } from "../state/ledger";
import { useMoney } from "../state/prefs";

interface Editing {
  budget: Budget | null;
  category?: string;
}

export default function Budgets() {
  const { data } = useLedger();
  const { money } = useMoney();
  const now = currentMonth();
  const [month, setMonth] = useState(now);
  const [editing, setEditing] = useState<Editing | null>(null);

  const usage = useMemo(() => budgetUsage(data.budgets, data.transactions, month), [data.budgets, data.transactions, month]);
  const totals = useMemo(() => {
    const limit = usage.reduce((s, b) => s + b.limit, 0);
    const spent = usage.reduce((s, b) => s + b.spent, 0);
    return { limit, spent, left: limit - spent };
  }, [usage]);
  const unbudgeted = useMemo(() => {
    const budgeted = new Set(data.budgets.map((b) => b.category.toLowerCase()));
    return spendByCategory(data.transactions, month).filter((s) => !budgeted.has(s.label.toLowerCase()));
  }, [data.budgets, data.transactions, month]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Planning"
        title="Budgets"
        subtitle="Monthly limits per category."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ budget: null })}>
            Add budget
          </Button>
        }
      />

      <div className="month-switch" role="group" aria-label="Month">
        <button type="button" className="btn-icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft size={18} />
        </button>
        <span className="month-name">{monthLabel(month, "long")}</span>
        <button type="button" className="btn-icon" aria-label="Next month" disabled={month >= now} onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {usage.length > 0 && (
        <div className="stats stats-3">
          <div className="card stat">
            <div className="stat-label">Budgeted</div>
            <div className="stat-value mono">{money(totals.limit)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Spent</div>
            <div className="stat-value mono">{money(totals.spent)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{totals.left >= 0 ? "Remaining" : "Over budget"}</div>
            <div className={cx("stat-value mono", totals.left < 0 && "neg")}>{money(Math.abs(totals.left))}</div>
          </div>
        </div>
      )}

      {usage.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank size={22} />}
            title="No budgets yet"
            text="Pick a category and a monthly limit. Ledger shows how much of it you’ve used."
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ budget: null })}>
                Add budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="cards-grid">
          {usage.map((b) => {
            const over = b.pct > 100;
            const warn = !over && b.pct >= 80;
            return (
              <button key={b.category} type="button" className="card budget-card" onClick={() => setEditing({ budget: { category: b.category, limit: b.limit } })}>
                <div className="bud-top">
                  <span className="bud-name">
                    <i className="dot" style={{ background: categoryColor(b.category) }} />
                    {b.category}
                  </span>
                  {(over || warn) && (
                    <span className={cx("pill", over ? "pill-bad" : "pill-warn")}>
                      <TriangleAlert size={12} /> {over ? "Over" : "Close"}
                    </span>
                  )}
                </div>
                <div className="budget-figures">
                  <span className="mono budget-spent">{money(b.spent)}</span>
                  <span className="muted mono">of {money(b.limit)}</span>
                </div>
                <ProgressBar pct={b.pct} color={over ? "var(--danger)" : warn ? "var(--warn)" : categoryColor(b.category)} label={`${b.category} budget used`} />
                <div className={cx("budget-left", over && "neg")}>
                  {over ? `${money(b.spent - b.limit)} over` : `${money(b.limit - b.spent)} left`} · {Math.round(b.pct)}%
                </div>
              </button>
            );
          })}
        </div>
      )}

      {unbudgeted.length > 0 && (
        <Card title="Spending without a budget">
          <ul className="acct-list">
            {unbudgeted.slice(0, 6).map((s) => (
              <li key={s.label} className="acct-row">
                <span className="bud-name">
                  <i className="dot" style={{ background: categoryColor(s.label) }} />
                  {s.label}
                </span>
                <span className="row-end">
                  <span className="mono">{money(s.amount)}</span>
                  <Button size="sm" onClick={() => setEditing({ budget: null, category: s.label })}>
                    Set budget
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {editing && <BudgetModal editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BudgetModal({ editing, onClose }: { editing: Editing; onClose(): void }) {
  const { data, saveBudget, deleteBudget } = useLedger();
  const original = editing.budget;
  const [category, setCategory] = useState(original?.category ?? editing.category ?? "");
  const [limit, setLimit] = useState(original ? String(original.limit) : "");
  const [error, setError] = useState("");
  const options = useMemo(() => categoryOptions(data.transactions.filter((t) => t.type === "expense"), EXPENSE_CATEGORIES), [data.transactions]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = category.trim();
    const value = Math.round(Number(limit) * 100) / 100;
    if (!name) return setError("Choose or type a category.");
    if (!(value > 0)) return setError("Enter a limit greater than zero.");
    const clash = data.budgets.some((b) => b.category.toLowerCase() === name.toLowerCase() && b.category.toLowerCase() !== original?.category.toLowerCase());
    if (clash) return setError(`There is already a budget for ${name}.`);
    onClose();
    void saveBudget({ category: name, limit: value }, original?.category);
  };

  return (
    <Modal
      title={original ? "Edit budget" : "Add budget"}
      onClose={onClose}
      width={440}
      footer={
        <>
          {original && (
            <ConfirmDeleteButton
              onConfirm={() => {
                onClose();
                void deleteBudget(original.category);
              }}
            />
          )}
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="budget-form">
            Save
          </Button>
        </>
      }
    >
      <form id="budget-form" className="form" onSubmit={submit} noValidate>
        <Field label="Category">
          <input className="input" data-autofocus list="budget-categories" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Type or pick" />
          <datalist id="budget-categories">
            {options.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Monthly limit">
          <input className="input input-mono" type="number" inputMode="decimal" min="0" step="any" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0" />
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
