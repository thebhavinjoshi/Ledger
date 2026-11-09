import { useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { BarChart, Donut, type DonutSlice } from "../components/charts";
import type { PageProps } from "../components/Shell";
import { TransactionRow } from "../components/TransactionRow";
import { Card, EmptyState, PageHeader, ProgressBar } from "../components/ui";
import { cashflow, spendByCategory, spendByMethod, summarize } from "../lib/calc";
import { categoryColor, PALETTE } from "../lib/constants";
import { cx } from "../lib/cx";
import { addMonths, currentMonth, daysBetween, daysInMonth, monthKey, monthRange, todayISO } from "../lib/dates";
import { monthLabel, percent } from "../lib/format";
import { useLedger } from "../state/ledger";
import { useMoney } from "../state/prefs";

type RangeId = "this" | "last" | "3" | "6" | "12" | "all";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "this", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "3", label: "Last 3 months" },
  { id: "6", label: "Last 6 months" },
  { id: "12", label: "Last 12 months" },
  { id: "all", label: "All time" },
];

export default function Analytics({ onOpen }: PageProps) {
  const { data } = useLedger();
  const { money, compact } = useMoney();
  const [range, setRange] = useState<RangeId>("this");
  const [active, setActive] = useState<number | null>(null);
  const now = currentMonth();

  const { from, to } = useMemo(() => {
    if (range === "this") return { from: now, to: now };
    if (range === "last") return { from: addMonths(now, -1), to: addMonths(now, -1) };
    if (range === "all") {
      const earliest = data.transactions.reduce((m, t) => (monthKey(t.date) < m ? monthKey(t.date) : m), now);
      return { from: earliest, to: now };
    }
    return { from: addMonths(now, -(Number(range) - 1)), to: now };
  }, [range, now, data.transactions]);

  const summary = useMemo(() => summarize(data.transactions, from, to), [data.transactions, from, to]);

  const avgDaily = useMemo(() => {
    const start = `${from}-01`;
    const endOfRange = `${to}-${String(daysInMonth(to)).padStart(2, "0")}`;
    const end = endOfRange < todayISO() ? endOfRange : todayISO();
    const days = Math.max(1, daysBetween(start, end) + 1);
    return summary.expense / days;
  }, [from, to, summary.expense]);

  const flow = useMemo(() => {
    const count = monthRange(to, 240).filter((m) => m >= from).length;
    return cashflow(data.transactions, to, Math.min(24, Math.max(6, count)));
  }, [data.transactions, from, to]);

  const categories = useMemo(() => {
    const all = spendByCategory(data.transactions, from, to);
    const top = all.slice(0, 7);
    const rest = all.slice(7).reduce((s, x) => s + x.amount, 0);
    const slices: DonutSlice[] = top.map((s) => ({ label: s.label, amount: s.amount, color: categoryColor(s.label) }));
    if (rest > 0) slices.push({ label: "Others", amount: rest, color: PALETTE[9] ?? "#8f98a3" });
    return slices;
  }, [data.transactions, from, to]);

  const methods = useMemo(() => spendByMethod(data.transactions, from, to), [data.transactions, from, to]);
  const biggest = useMemo(
    () =>
      data.transactions
        .filter((t) => t.type === "expense" && monthKey(t.date) >= from && monthKey(t.date) <= to)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [data.transactions, from, to],
  );

  const hasData = summary.income > 0 || summary.expense > 0;
  const catTotal = categories.reduce((s, c) => s + c.amount, 0);
  const methodMax = Math.max(1, ...methods.map((m) => m.amount));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        subtitle={from === to ? monthLabel(from, "long") : `${monthLabel(from, "long")} to ${monthLabel(to, "long")}`}
        actions={
          <select className="input range-select" aria-label="Time range" value={range} onChange={(e) => setRange(e.target.value as RangeId)}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="stats">
        <div className="card stat">
          <div className="stat-label">Income</div>
          <div className="stat-value mono">{money(summary.income)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Expenses</div>
          <div className="stat-value mono">{money(summary.expense)}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Net</div>
          <div className={cx("stat-value mono", summary.net < 0 && "neg")}>{money(summary.net)}</div>
          <div className="stat-sub">{summary.income > 0 ? `${percent(summary.savingsRate)} of income saved` : "No income recorded"}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Average per day</div>
          <div className="stat-value mono">{money(avgDaily)}</div>
          <div className="stat-sub">Spending</div>
        </div>
      </div>

      {!hasData ? (
        <Card>
          <EmptyState icon={<ChartPie size={22} />} title="Nothing to analyse yet" text="There are no income or expense transactions in this period." />
        </Card>
      ) : (
        <>
          <Card title="Income vs expenses">
            <div className="legend legend-inline">
              <span>
                <i className="dot" style={{ background: "var(--accent)" }} /> Income
              </span>
              <span>
                <i className="dot" style={{ background: "var(--danger)" }} /> Expenses
              </span>
            </div>
            <BarChart
              title="Income and expenses by month"
              labels={flow.map((p) => monthLabel(p.month))}
              compact={compact}
              money={money}
              series={[
                { key: "income", label: "Income", color: "var(--accent)", values: flow.map((p) => p.income) },
                { key: "expense", label: "Expenses", color: "var(--danger)", values: flow.map((p) => p.expense) },
              ]}
            />
          </Card>

          <div className="grid-halves">
            <Card title="Where your money goes">
              {categories.length === 0 ? (
                <EmptyState title="No expenses in this period" />
              ) : (
                <div className="donut-wrap">
                  <Donut
                    title="Expenses by category"
                    slices={categories}
                    active={active}
                    onActive={setActive}
                    centerTop={money(active === null ? catTotal : (categories[active]?.amount ?? 0))}
                    centerBottom={active === null ? "Total spent" : (categories[active]?.label ?? "")}
                  />
                  <ul className="legend-list" onPointerLeave={() => setActive(null)}>
                    {categories.map((c, i) => (
                      <li key={c.label} className={cx("legend-row", active === i && "active")} onPointerEnter={() => setActive(i)}>
                        <span className="bud-name">
                          <i className="dot" style={{ background: c.color }} />
                          {c.label}
                        </span>
                        <span className="legend-values">
                          <span className="mono">{money(c.amount)}</span>
                          <span className="muted mono">{Math.round((c.amount / catTotal) * 100)}%</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="By payment method">
              {methods.length === 0 ? (
                <EmptyState title="No expenses in this period" />
              ) : (
                <ul className="bud-list">
                  {methods.map((m) => (
                    <li key={m.label} className="bud-row">
                      <div className="bud-top">
                        <span className="bud-name">{m.label}</span>
                        <span className="mono bud-amt">{money(m.amount)}</span>
                      </div>
                      <ProgressBar pct={(m.amount / methodMax) * 100} color="var(--accent)" label={`${m.label} share of spending`} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Largest expenses">
            {biggest.length === 0 ? (
              <EmptyState title="No expenses in this period" />
            ) : (
              <div className="tx-list">
                {biggest.map((t) => (
                  <TransactionRow key={t.id} t={t} onOpen={onOpen} showDate />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
