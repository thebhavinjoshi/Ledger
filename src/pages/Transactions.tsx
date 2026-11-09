import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Inbox, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { PageProps } from "../components/Shell";
import { TransactionRow } from "../components/TransactionRow";
import { Button, Card, EmptyState, Field, PageHeader } from "../components/ui";
import {
  activeFilterCount,
  applyFilters,
  categoryOptions,
  emptyFilters,
  type SortKey,
  type TxFilters,
} from "../lib/calc";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, METHODS } from "../lib/constants";
import { addMonths, currentMonth, daysInMonth } from "../lib/dates";
import { formatDayHeading } from "../lib/format";
import type { TxType } from "../lib/types";
import { useLedger } from "../state/ledger";
import { useMoney } from "../state/prefs";

const PAGE_SIZE = 50;

export default function Transactions({ onAdd, onOpen }: PageProps) {
  const { data } = useLedger();
  const { money } = useMoney();
  const [filters, setFilters] = useState<TxFilters>(emptyFilters);
  const [panel, setPanel] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const set = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const deferred = useDeferredValue(filters);
  const rows = useMemo(() => applyFilters(data.transactions, deferred), [data.transactions, deferred]);
  const categories = useMemo(() => categoryOptions(data.transactions, [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]), [data.transactions]);
  const active = activeFilterCount(filters);

  useEffect(() => setLimit(PAGE_SIZE), [deferred]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of rows) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    return { income, expense };
  }, [rows]);

  const visible = rows.slice(0, limit);
  const grouped = filters.sort.startsWith("date");

  // Month shortcut: sets the date range to a whole calendar month.
  const monthValue = filters.from && filters.from.slice(0, 7) === filters.to.slice(0, 7) && filters.from.endsWith("-01") ? filters.from.slice(0, 7) : "";
  const setMonth = (key: string) => {
    if (!key) return setFilters((f) => ({ ...f, from: "", to: "" }));
    setFilters((f) => ({ ...f, from: `${key}-01`, to: `${key}-${String(daysInMonth(key)).padStart(2, "0")}` }));
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Activity"
        title="Transactions"
        subtitle={`${data.transactions.length} in total`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={onAdd}>
            Add transaction
          </Button>
        }
      />

      <Card className="toolbar-card">
        <div className="toolbar">
          <label className="search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Search notes, categories, amounts…"
              value={filters.search}
              onChange={(e) => set("search", e.target.value)}
              aria-label="Search transactions"
            />
          </label>
          <select className="input sort" aria-label="Sort by" value={filters.sort} onChange={(e) => set("sort", e.target.value as SortKey)}>
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Largest amount</option>
            <option value="amount-asc">Smallest amount</option>
          </select>
          <Button
            icon={<SlidersHorizontal size={16} />}
            onClick={() => setPanel((p) => !p)}
            aria-expanded={panel}
            className={active > 0 ? "has-filters" : undefined}
          >
            Filters{active > 0 && <span className="count-badge">{active}</span>}
          </Button>
        </div>

        {panel && (
          <div className="filter-panel">
            <Field label="Type">
              <select className="input" value={filters.type} onChange={(e) => set("type", e.target.value as "all" | TxType)}>
                <option value="all">All types</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
                <option value="transfer">Transfers</option>
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={filters.category} onChange={(e) => set("category", e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Payment method">
              <select className="input" value={filters.method} onChange={(e) => set("method", e.target.value)}>
                <option value="">All methods</option>
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Month">
              <input className="input" type="month" value={monthValue} max={addMonths(currentMonth(), 1)} onChange={(e) => setMonth(e.target.value)} />
            </Field>
            <Field label="From">
              <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} />
            </Field>
            <Field label="To">
              <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} />
            </Field>
            <div className="filter-actions">
              <Button size="sm" variant="ghost" icon={<X size={14} />} disabled={active === 0} onClick={() => setFilters((f) => ({ ...emptyFilters, search: f.search, sort: f.sort }))}>
                Clear filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={data.transactions.length === 0 ? "No transactions yet" : "Nothing matches these filters"}
            text={data.transactions.length === 0 ? "Add your first transaction to get started." : "Try widening the dates or clearing a filter."}
            action={
              data.transactions.length === 0 ? (
                <Button variant="primary" icon={<Plus size={16} />} onClick={onAdd}>
                  Add transaction
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="result-summary">
              <strong>{rows.length}</strong> {rows.length === 1 ? "transaction" : "transactions"}
              <span className="sep">·</span>
              <span className="pos mono">+{money(totals.income)}</span>
              <span className="sep">·</span>
              <span className="neg mono">−{money(totals.expense)}</span>
            </p>
            <div className="tx-list">
              {visible.map((t, i) => (
                <Fragment key={t.id}>
                  {grouped && (i === 0 || visible[i - 1]?.date !== t.date) && <div className="day-head">{formatDayHeading(t.date)}</div>}
                  <TransactionRow t={t} onOpen={onOpen} showDate={!grouped} />
                </Fragment>
              ))}
            </div>
            {rows.length > limit && (
              <div className="more">
                <Button onClick={() => setLimit((l) => l + PAGE_SIZE)}>Show more ({rows.length - limit} remaining)</Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
