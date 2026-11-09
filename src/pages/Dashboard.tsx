import { useMemo } from "react";
import { ArrowRight, TrendingDown, TrendingUp, Wallet, Plus, Percent, Inbox } from "lucide-react";
import { Card, EmptyState, PageHeader, ProgressBar, Button } from "../components/ui";
import { LineChart } from "../components/charts";
import { TransactionRow } from "../components/TransactionRow";
import type { PageProps } from "../components/Shell";
import { accountBalances, budgetUsage, cashflow, summarize, totalBalance, UNASSIGNED } from "../lib/calc";
import { categoryColor } from "../lib/constants";
import { cx } from "../lib/cx";
import { currentMonth } from "../lib/dates";
import { monthLabel, percent } from "../lib/format";
import { applyFilters, emptyFilters } from "../lib/calc";
import { useLedger } from "../state/ledger";
import { useMoney } from "../state/prefs";

function savingsNote(income: number, rate: number): string {
  if (income <= 0) return "Room to grow";
  if (rate < 0) return "Spending exceeds income";
  if (rate >= 30) return "Strong month";
  if (rate >= 10) return "On track";
  return "Room to grow";
}

export default function Dashboard({ onAdd, onOpen, onNavigate }: PageProps) {
  const { data } = useLedger();
  const { money, compact } = useMoney();
  const month = currentMonth();

  const summary = useMemo(() => summarize(data.transactions, month), [data.transactions, month]);
  const balance = useMemo(() => totalBalance(data.transactions), [data.transactions]);
  const flow = useMemo(() => cashflow(data.transactions, month, 6), [data.transactions, month]);
  const budgets = useMemo(() => budgetUsage(data.budgets, data.transactions, month).slice(0, 4), [data.budgets, data.transactions, month]);
  const recent = useMemo(() => applyFilters(data.transactions, emptyFilters).slice(0, 6), [data.transactions]);
  const accounts = useMemo(
    () =>
      Object.entries(accountBalances(data.transactions))
        .filter(([name, v]) => Math.abs(v) > 0.004 || name !== UNASSIGNED)
        .filter(([, v]) => Math.abs(v) > 0.004)
        .sort((a, b) => b[1] - a[1]),
    [data.transactions],
  );

  return (
    <div className="page">
      <PageHeader
        eyebrow="Overview"
        title="Good to see you"
        subtitle="Here’s what’s happening with your money this month."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={onAdd}>
            Add transaction
          </Button>
        }
      />

      <div className="stats">
        <Stat label="Total balance" value={money(balance)} icon={<Wallet size={16} />} tone="info" />
        <Stat label="Income this month" value={money(summary.income)} icon={<TrendingUp size={16} />} tone="good" />
        <Stat label="Expenses this month" value={money(summary.expense)} icon={<TrendingDown size={16} />} tone="bad" />
        <Stat
          label="Savings rate"
          value={percent(summary.savingsRate)}
          sub={savingsNote(summary.income, summary.savingsRate)}
          icon={<Percent size={16} />}
          tone="warn"
        />
      </div>

      <div className="grid-main">
        <Card
          title="Cash flow, last 6 months"
          action={
            <button type="button" className="link-btn" onClick={() => onNavigate("analytics")}>
              Full analytics <ArrowRight size={14} />
            </button>
          }
        >
          <div className="legend legend-inline">
            <span>
              <i className="dot" style={{ background: "var(--accent)" }} /> Income
            </span>
            <span>
              <i className="dot" style={{ background: "var(--danger)" }} /> Expenses
            </span>
          </div>
          <LineChart
            title="Income and expenses for the last six months"
            labels={flow.map((p) => monthLabel(p.month))}
            compact={compact}
            money={money}
            series={[
              { key: "income", label: "Income", color: "var(--accent)", values: flow.map((p) => p.income) },
              { key: "expense", label: "Expenses", color: "var(--danger)", values: flow.map((p) => p.expense) },
            ]}
          />
        </Card>

        <Card
          title="Top budgets"
          action={
            <button type="button" className="link-btn" onClick={() => onNavigate("budgets")}>
              Manage <ArrowRight size={14} />
            </button>
          }
        >
          {budgets.length === 0 ? (
            <EmptyState title="No budgets yet" text="Set a monthly limit for a category to track it here." />
          ) : (
            <ul className="bud-list">
              {budgets.map((b) => (
                <li key={b.category} className="bud-row">
                  <div className="bud-top">
                    <span className="bud-name">
                      <i className="dot" style={{ background: categoryColor(b.category) }} />
                      {b.category}
                    </span>
                    <span className={cx("mono bud-amt", b.pct > 100 && "over")}>
                      {money(b.spent)} / {money(b.limit)}
                    </span>
                  </div>
                  <ProgressBar pct={b.pct} color={b.pct > 100 ? "var(--danger)" : b.pct >= 80 ? "var(--warn)" : categoryColor(b.category)} label={`${b.category} budget used`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid-main grid-main-even">
        <Card
          title="Recent transactions"
          action={
            <button type="button" className="link-btn" onClick={() => onNavigate("transactions")}>
              View all <ArrowRight size={14} />
            </button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState icon={<Inbox size={22} />} title="No transactions yet." text="Add your first one to see it here." />
          ) : (
            <div className="tx-list">
              {recent.map((t) => (
                <TransactionRow key={t.id} t={t} onOpen={onOpen} showDate />
              ))}
            </div>
          )}
        </Card>

        <Card title="Accounts">
          {accounts.length === 0 ? (
            <EmptyState title="No account activity" text="Balances by payment method appear here." />
          ) : (
            <ul className="acct-list">
              {accounts.map(([name, value]) => (
                <li key={name} className="acct-row">
                  <span>{name}</span>
                  <span className={cx("mono", value < 0 && "neg")}>{money(value)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="card-note">Net of income, spending and transfers per payment method.</p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone: "info" | "good" | "bad" | "warn" }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={cx("stat-icon", tone)}>{icon}</span>
      </div>
      <div className="stat-value mono">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
