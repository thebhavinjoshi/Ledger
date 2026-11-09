import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { accountOf, methodLabel } from "../lib/calc";
import { categoryColor } from "../lib/constants";
import { cx } from "../lib/cx";
import { formatShortDay } from "../lib/format";
import type { Transaction } from "../lib/types";
import { useMoney } from "../state/prefs";

export function TransactionRow({ t, onOpen, showDate = false }: { t: Transaction; onOpen(t: Transaction): void; showDate?: boolean }) {
  const { money } = useMoney();
  const transfer = t.type === "transfer";
  const color = transfer ? "#5b8fe0" : categoryColor(t.category);
  const Icon = transfer ? ArrowLeftRight : t.type === "income" ? ArrowDownLeft : ArrowUpRight;
  const title = t.note || (transfer ? "Transfer" : t.category || "Untitled");
  const sub = transfer
    ? `${accountOf(t.from)} → ${accountOf(t.to)}`
    : [t.category, t.method ? methodLabel(t.method) : ""].filter(Boolean).join(" · ");
  return (
    <button type="button" className="tx-row" onClick={() => onOpen(t)}>
      <span className="tx-icon" style={{ color, background: `${color}26` }}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="tx-main">
        <span className="tx-title">{title}</span>
        <span className="tx-sub">
          {sub}
          {showDate && ` · ${formatShortDay(t.date)}`}
        </span>
      </span>
      <span className={cx("tx-amount", t.type)}>
        {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
        {money(t.amount)}
      </span>
    </button>
  );
}
