import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Tracks an element's content size so charts redraw crisply at any window width. */
export function useSize<T extends HTMLElement>(): [RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

/** Round axis values (0, 1k, 2k, ...) covering `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1, 2, 3, 4];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  const n = Math.ceil(max / step - 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => i * step);
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface AxisChartProps {
  labels: string[];
  series: Series[];
  /** Short axis labels, e.g. ₹12K. */
  compact(n: number): string;
  /** Full amounts for the tooltip. */
  money(n: number): string;
  height?: number;
  title: string;
}

function useAxis({ series, compact, w, height, labels }: { series: Series[]; compact(n: number): string; w: number; height: number; labels: string[] }) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] ?? 1;
  const left = Math.max(...ticks.map((t) => compact(t).length)) * 6.8 + 16;
  const m = { t: 12, r: 12, b: 28, l: left };
  const iw = Math.max(0, w - m.l - m.r);
  const ih = Math.max(0, height - m.t - m.b);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  // Skip alternate labels when the months would collide.
  const every = iw / Math.max(1, labels.length) < 46 ? 2 : 1;
  return { ticks, m, iw, ih, y, every };
}

function Grid({ ticks, m, iw, y, compact, w }: { ticks: number[]; m: { l: number; r: number }; iw: number; y(v: number): number; compact(n: number): string; w: number }) {
  return (
    <g className="chart-grid">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "3 5"} className={t === 0 ? "axis-zero" : "grid-line"} />
          <text x={m.l - 10} y={y(t)} textAnchor="end" dominantBaseline="middle" className="axis-text">
            {compact(t)}
          </text>
        </g>
      ))}
      <rect x={0} y={0} width={w} height={0} fill="none" />
    </g>
  );
}

function Tooltip({ x, y, title, rows, width }: { x: number; y: number; title: string; rows: { label: string; value: string; color: string }[]; width: number }) {
  const flip = x > width - 190;
  return (
    <div className="tooltip" style={{ left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined, top: Math.max(4, y) }}>
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="tooltip-row">
          <span className="dot" style={{ background: r.color }} />
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- LineChart */

export function LineChart({ labels, series, compact, money, height = 260, title }: AxisChartProps) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { ticks, m, iw, y, every } = useAxis({ series, compact, w, height, labels });
  const inset = 14;
  const x = (i: number) => m.l + inset + (labels.length <= 1 ? (iw - inset * 2) / 2 : (i / (labels.length - 1)) * (iw - inset * 2));

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    labels.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={title}
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
        >
          <Grid ticks={ticks} m={m} iw={iw} y={y} compact={compact} w={w} />
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={y(0)} className="hover-line" />}
          {series.map((s) => (
            <g key={s.key}>
              <path
                d={s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")}
                fill="none"
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: s.color }}
              />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} style={{ fill: s.color }} className="chart-dot" />
              ))}
            </g>
          ))}
          {labels.map((l, i) =>
            i % every === (labels.length - 1) % every ? (
              <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="axis-text">
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip
          x={x(hover)}
          y={m.t}
          width={w}
          title={labels[hover] ?? ""}
          rows={series.map((s) => ({ label: s.label, value: money(s.values[hover] ?? 0), color: s.color }))}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- BarChart */

export function BarChart({ labels, series, compact, money, height = 260, title }: AxisChartProps) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const { ticks, m, iw, y, every } = useAxis({ series, compact, w, height, labels });
  const band = labels.length ? iw / labels.length : 0;
  const group = Math.min(band * 0.7, 18 * series.length + 4 * (series.length - 1));
  const barW = series.length ? (group - 4 * (series.length - 1)) / series.length : 0;
  const cx = (i: number) => m.l + band * i + band / 2;

  return (
    <div ref={ref} className="chart" style={{ height }}>
      {w > 0 && (
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={title}
          onPointerMove={(e) => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left - m.l;
            setHover(px < 0 || px > iw ? null : Math.min(labels.length - 1, Math.floor(px / band)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          <Grid ticks={ticks} m={m} iw={iw} y={y} compact={compact} w={w} />
          {hover !== null && <rect x={m.l + band * hover} y={m.t} width={band} height={y(0) - m.t} className="hover-band" />}
          {series.map((s, si) =>
            s.values.map((v, i) => {
              const h = Math.max(v > 0 ? 2 : 0, y(0) - y(v));
              return (
                <rect
                  key={`${s.key}${i}`}
                  x={cx(i) - group / 2 + si * (barW + 4)}
                  y={y(0) - h}
                  width={Math.max(0, barW)}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  style={{ fill: s.color }}
                />
              );
            }),
          )}
          {labels.map((l, i) =>
            i % every === (labels.length - 1) % every ? (
              <text key={l + i} x={cx(i)} y={height - 8} textAnchor="middle" className="axis-text">
                {l}
              </text>
            ) : null,
          )}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip
          x={cx(hover)}
          y={m.t}
          width={w}
          title={labels[hover] ?? ""}
          rows={series.map((s) => ({ label: s.label, value: money(s.values[hover] ?? 0), color: s.color }))}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Donut */

export interface DonutSlice {
  label: string;
  amount: number;
  color: string;
}

export function Donut({
  slices,
  centerTop,
  centerBottom,
  active,
  onActive,
  size = 190,
  title,
}: {
  slices: DonutSlice[];
  centerTop: string;
  centerBottom: string;
  active: number | null;
  onActive(i: number | null): void;
  size?: number;
  title: string;
}) {
  const stroke = 24;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.amount, 0);
  let offset = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="donut-track" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {total > 0 &&
            slices.map((s, i) => {
              const len = (s.amount / total) * C;
              const gap = slices.length > 1 ? Math.min(3, len * 0.3) : 0;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  strokeWidth={active === i ? stroke + 4 : stroke}
                  strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`}
                  strokeDashoffset={-offset}
                  style={{ stroke: s.color, opacity: active === null || active === i ? 1 : 0.35, transition: "opacity .15s, stroke-width .15s" }}
                  onPointerEnter={() => onActive(i)}
                  onPointerLeave={() => onActive(null)}
                />
              );
              offset += len;
              return el;
            })}
        </g>
      </svg>
      <div className="donut-center">
        <span className="donut-top">{centerTop}</span>
        <span className="donut-bottom">{centerBottom}</span>
      </div>
    </div>
  );
}
