import { useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Target } from "lucide-react";
import { Button, Card, ConfirmDeleteButton, EmptyState, Field, Modal, PageHeader } from "../components/ui";
import { DEFAULT_GOAL_COLOR, PALETTE } from "../lib/constants";
import { cx } from "../lib/cx";
import { daysBetween, todayISO } from "../lib/dates";
import { formatDate } from "../lib/format";
import type { Goal } from "../lib/types";
import { useLedger } from "../state/ledger";
import { useMoney } from "../state/prefs";

function deadlineText(g: Goal, done: boolean): { text: string; late: boolean } {
  if (done) return { text: "Goal reached", late: false };
  if (!g.deadline) return { text: "No deadline", late: false };
  const days = daysBetween(todayISO(), g.deadline);
  if (days < 0) return { text: `Overdue by ${-days} ${days === -1 ? "day" : "days"}`, late: true };
  if (days === 0) return { text: "Due today", late: false };
  return { text: `${days} ${days === 1 ? "day" : "days"} left · ${formatDate(g.deadline)}`, late: false };
}

function Ring({ pct, color }: { pct: number; color: string }) {
  const size = 64;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, pct) / 100) * C} ${C}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ stroke: color }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-text">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function Goals() {
  const { data } = useLedger();
  const { money } = useMoney();
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [funding, setFunding] = useState<Goal | null>(null);

  const goals = useMemo(() => {
    const done = (g: Goal) => g.target > 0 && g.saved >= g.target;
    return [...data.goals].sort((a, b) => {
      if (done(a) !== done(b)) return done(a) ? 1 : -1;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      return a.deadline ? -1 : b.deadline ? 1 : a.name.localeCompare(b.name);
    });
  }, [data.goals]);

  const totals = useMemo(() => ({ saved: data.goals.reduce((s, g) => s + g.saved, 0), target: data.goals.reduce((s, g) => s + g.target, 0) }), [data.goals]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Planning"
        title="Goals"
        subtitle={goals.length ? `${money(totals.saved)} saved of ${money(totals.target)} across ${goals.length} ${goals.length === 1 ? "goal" : "goals"}` : "Save towards the things that matter."}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ goal: null })}>
            Add goal
          </Button>
        }
      />

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target size={22} />}
            title="No goals yet"
            text="Set a target and a deadline, then add money as you save."
            action={
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing({ goal: null })}>
                Add goal
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="cards-grid">
          {goals.map((g) => {
            const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
            const done = g.target > 0 && g.saved >= g.target;
            const d = deadlineText(g, done);
            return (
              <article key={g.id} className="card goal-card">
                <div className="goal-top">
                  <Ring pct={pct} color={g.color} />
                  <div className="goal-head">
                    <h3 className="goal-name">{g.name}</h3>
                    <p className={cx("goal-deadline", d.late && "neg")}>{d.text}</p>
                  </div>
                </div>
                <div className="goal-figures">
                  <span className="mono goal-saved">{money(g.saved)}</span>
                  <span className="muted mono">of {money(g.target)}</span>
                </div>
                <div className="goal-actions">
                  <Button size="sm" variant={done ? "secondary" : "primary"} icon={done ? <Check size={14} /> : <Plus size={14} />} onClick={() => setFunding(g)}>
                    {done ? "Add more" : "Add funds"}
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing({ goal: g })}>
                    Edit
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && <GoalModal goal={editing.goal} onClose={() => setEditing(null)} />}
      {funding && <FundsModal goal={funding} onClose={() => setFunding(null)} />}
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: Goal | null; onClose(): void }) {
  const { addGoal, updateGoal, deleteGoal } = useLedger();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target) : "");
  const [saved, setSaved] = useState(goal ? String(goal.saved) : "0");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [color, setColor] = useState(goal?.color ?? DEFAULT_GOAL_COLOR);
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = Math.round(Number(target) * 100) / 100;
    const s = Math.round(Number(saved || 0) * 100) / 100;
    if (!name.trim()) return setError("Give the goal a name.");
    if (!(t > 0)) return setError("Enter a target greater than zero.");
    if (!(s >= 0)) return setError("Saved amount can’t be negative.");
    const next = { name: name.trim(), target: t, saved: s, color, deadline };
    onClose();
    if (goal) void updateGoal({ ...next, id: goal.id });
    else void addGoal(next);
  };

  return (
    <Modal
      title={goal ? "Edit goal" : "Add goal"}
      onClose={onClose}
      width={460}
      footer={
        <>
          {goal && (
            <ConfirmDeleteButton
              onConfirm={() => {
                onClose();
                void deleteGoal(goal.id);
              }}
            />
          )}
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="goal-form">
            Save
          </Button>
        </>
      }
    >
      <form id="goal-form" className="form" onSubmit={submit} noValidate>
        <Field label="Name">
          <input className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund" />
        </Field>
        <div className="row-2">
          <Field label="Target">
            <input className="input input-mono" type="number" inputMode="decimal" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Saved so far">
            <input className="input input-mono" type="number" inputMode="decimal" min="0" step="any" value={saved} onChange={(e) => setSaved(e.target.value)} />
          </Field>
        </div>
        <Field label="Deadline (optional)">
          <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Colour</span>
          <div className="swatches" role="radiogroup" aria-label="Goal colour">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                className={cx("swatch", c === color && "active")}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function FundsModal({ goal, onClose }: { goal: Goal; onClose(): void }) {
  const { updateGoal } = useLedger();
  const { money } = useMoney();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const remaining = Math.max(0, goal.target - goal.saved);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = Math.round(Number(amount) * 100) / 100;
    if (!(a > 0)) return setError("Enter an amount greater than zero.");
    onClose();
    void updateGoal({ ...goal, saved: Math.round((goal.saved + a) * 100) / 100 });
  };

  return (
    <Modal
      title={`Add funds to ${goal.name}`}
      onClose={onClose}
      width={400}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="funds-form">
            Add
          </Button>
        </>
      }
    >
      <form id="funds-form" className="form" onSubmit={submit} noValidate>
        <Field label="Amount" hint={remaining > 0 ? `${money(remaining)} to go` : "Target already reached"}>
          <input className="input input-mono" data-autofocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
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
