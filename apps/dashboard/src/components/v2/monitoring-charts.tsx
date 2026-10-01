"use client";

import { useState } from "react";
import { EmptyNote } from "@/components/v2/ui";

/**
 * Charts and formatting shared by the Monitoring pages that draw a producer's daily and monthly
 * series (Email sending, Subscriptions, New pricing, Pricing comparison). They draw what they are
 * handed: geometry only, never a figure shown that the producer did not serve.
 */

export const SERIES_COLORS = ["var(--accent)", "var(--data-violet)", "var(--data-amber)", "var(--data-teal)", "var(--data-rose)", "var(--data-sky)", "var(--data-lime)"];

export const n = (v: number) => v.toLocaleString("en-US");
export const dollars = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
export const dollarsExact = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** A unit price in US cents: "3.06¢", or "$7.81" once it is a dollar or more; tiny prices keep 3 significant digits. */
export function cents(v: number | null | undefined): string | null {
  if (v == null) return null;
  if (Math.abs(v) >= 100) return `$${(v / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v !== 0 && Math.abs(v) < 0.1) return `${v.toLocaleString("en-US", { maximumSignificantDigits: 3 })}¢`;
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}¢`;
}
export const pct = (v: number | null | undefined) => (v == null ? null : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`);
export const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export const monthLabel = (m: string, short = false) =>
  new Date(`${m.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: short ? "2-digit" : "numeric", timeZone: "UTC" });

export function Dash() {
  return <span className="k-fg4">{"—"}</span>;
}

export const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
export const THR = `${TH} text-right`;
export const TD = "px-3 py-2.5 first:pl-4 last:pr-4";
export const TDR = `${TD} text-right tabular-nums`;

/** Round axis ticks (0 and up to four steps) over the drawn range, negatives included. */
export function niceTicks(min: number, max: number): number[] {
  const span = Math.max(max - Math.min(0, min), 1e-9);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  const lo = Math.floor(Math.min(0, min) / step) * step;
  for (let v = lo; v < max + step * 0.999; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}

export interface Line<P> {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  get: (p: P) => number | null;
}

export type Window = { key: string; label: string; days: number | null };
export const DEFAULT_WINDOWS: Window[] = [
  { key: "90", label: "90 days", days: 90 },
  { key: "180", label: "180 days", days: 180 },
  { key: "all", label: "All", days: null },
];

/**
 * Daily lines with a window switch, an axis in the series' unit, and a hover that reads the
 * served values of one day. `points` must be in day order (the producer's).
 */
export function DailyLines<P extends { day: string }>({
  points,
  lines,
  caption,
  format,
  windows = DEFAULT_WINDOWS,
  empty,
  label,
}: {
  points: P[];
  lines: Line<P>[];
  caption?: (p: P) => React.ReactNode;
  format: (v: number) => string | null;
  windows?: Window[];
  empty: string;
  label: string;
}) {
  const [win, setWin] = useState(windows[0].key);
  const [hover, setHover] = useState<number | null>(null);
  const w = windows.find((x) => x.key === win) ?? windows[0];
  const shown = w.days == null ? points : points.slice(-w.days);

  if (shown.length < 2) {
    return (
      <div className="k-card">
        <EmptyNote>{empty}</EmptyNote>
      </div>
    );
  }

  // Geometry only: pixel positions of served values.
  const W = 800;
  const H = 220;
  const T = 8;
  const B = 4;
  const vals = shown.flatMap((d) => lines.map((l) => l.get(d)).filter((v): v is number => v != null));
  const ticks = niceTicks(Math.min(...vals, 0), Math.max(...vals, 0.01));
  const lo = ticks[0];
  const top = ticks[ticks.length - 1];
  const x = (i: number) => (i / (shown.length - 1)) * W;
  const y = (v: number) => T + (1 - (v - lo) / (top - lo)) * (H - T - B);
  const path = (l: Line<P>) => {
    let d = "";
    let pen = false;
    shown.forEach((p, i) => {
      const v = l.get(p);
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const at = shown[hover ?? shown.length - 1];
  const every = Math.ceil(shown.length / 6);
  const slot = W / shown.length;

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="k-fg2 text-[12px]">
          {dayLabel(at.day)}
          {caption && <> · {caption(at)}</>}
        </span>
        {windows.length > 1 && (
          <span className="inline-flex items-center gap-1.5" role="group" aria-label="Window">
            {windows.map((x) => (
              <button key={x.key} type="button" aria-pressed={win === x.key} onClick={() => setWin(x.key)} className={win === x.key ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
                {x.label}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        {lines.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-3" style={{ background: l.color, opacity: l.dashed ? 0.7 : 1 }} aria-hidden="true" />
            <span className="k-fg3">{l.label}</span>
            <span className="tabular-nums">{(() => {
              const v = l.get(at);
              return v == null ? "—" : format(v) ?? "—";
            })()}</span>
          </span>
        ))}
      </div>
      <div className="relative mt-3 pl-[52px]" style={{ height: H }}>
        {ticks.map((t) => (
          <span key={t} className="k-fg3 absolute left-0 w-[46px] -translate-y-1/2 text-right text-[11px] tabular-nums" style={{ top: y(t) }}>
            {format(t)}
          </span>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line)" : "var(--line-subtle)"} vectorEffect="non-scaling-stroke" />
          ))}
          {lines.map((l, i) => (
            <path key={l.key} d={path(l)} fill="none" stroke={l.color} strokeWidth={i === 0 ? 2 : 1.5} strokeDasharray={l.dashed ? "4 3" : undefined} vectorEffect="non-scaling-stroke" opacity={l.dashed ? 0.7 : 1} />
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--line)" vectorEffect="non-scaling-stroke" />}
          {shown.map((d, i) => (
            <rect key={d.day} x={x(i) - slot / 2} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      </div>
      <div className="k-line-subtle ml-[52px] flex border-t pt-1.5">
        {shown.map((d, i) => (
          <span key={d.day} className="k-fg3 w-0 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
            {i % every === 0 ? dayLabel(d.day, { month: "short", day: "numeric" }) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarSeries<M> {
  key: string;
  label: string;
  color: string;
  get: (m: M) => number;
}

/**
 * Bars per period, stacked by series when there are several, side by side when `grouped`.
 * A negative value (a refund month) is drawn at zero height and still read in the legend.
 */
export function PeriodBars<M extends { period: string }>({
  periods,
  series,
  caption,
  format,
  label,
  grouped = false,
  initial,
  empty,
}: {
  periods: M[];
  series: BarSeries<M>[];
  caption?: (m: M) => React.ReactNode;
  format: (v: number) => string;
  label: (period: string, short?: boolean) => string;
  grouped?: boolean;
  initial?: M | null;
  empty: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (!periods.length) {
    return (
      <div className="k-card">
        <EmptyNote>{empty}</EmptyNote>
      </div>
    );
  }
  const H = 140;
  // Bar height only.
  const height = (m: M) => (grouped ? Math.max(...series.map((s) => Math.max(0, s.get(m)))) : series.reduce((t, s) => t + Math.max(0, s.get(m)), 0));
  const max = Math.max(1e-9, ...periods.map(height));
  const shown = periods.find((m) => m.period === hover) ?? initial ?? periods[periods.length - 1];
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="k-fg2 text-[12px]">
          {label(shown.period)}
          {caption && <> · {caption(shown)}</>}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
              <span className="k-fg3">{s.label}</span>
              <span className="tabular-nums">{format(s.get(shown))}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {periods.map((m) => (
          <button
            key={m.period}
            type="button"
            aria-label={`${label(m.period)}: ${series.map((s) => `${s.label} ${format(s.get(m))}`).join(", ")}`}
            onMouseEnter={() => setHover(m.period)}
            onFocus={() => setHover(m.period)}
            className={`flex h-full min-w-0 flex-1 ${grouped ? "items-end gap-[2px]" : "flex-col-reverse"}`}
            style={{ opacity: hover && hover !== m.period ? 0.5 : 1 }}
          >
            {series.map((s) => {
              const v = s.get(m);
              if (v <= 0) return grouped ? <span key={s.key} className="block min-w-0 flex-1" /> : null;
              return (
                <span
                  key={s.key}
                  className={grouped ? "block min-w-0 flex-1 rounded-t-[2px]" : "block w-full first:rounded-b-[1px] last:rounded-t-[2px]"}
                  style={{ height: Math.max(1, (v / max) * H), background: s.color }}
                />
              );
            })}
          </button>
        ))}
      </div>
      <div className="k-line-subtle flex gap-2 border-t pt-1.5">
        {periods.map((m, i) => (
          <span key={m.period} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10.5px]">
            {periods.length <= 14 || i % Math.ceil(periods.length / 12) === 0 ? label(m.period, true) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
