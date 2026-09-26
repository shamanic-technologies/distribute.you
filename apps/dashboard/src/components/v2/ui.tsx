"use client";

import Link from "next/link";
import { useId } from "react";
import { useOpenV2Nav } from "@/components/v2/nav-context";

/** Keel's primitives, drawn with the tokens in `keel.css`. Presentation only. */

export function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--data-track)] ${className}`} />;
}

export interface Crumb {
  label: React.ReactNode;
  href?: string;
}

/** The 48px bar at the top of the panel: breadcrumbs left, actions right. */
export function TopBar({ crumbs, actions }: { crumbs: Crumb[]; actions?: React.ReactNode }) {
  const openNav = useOpenV2Nav();
  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 bg-[var(--bg-surface)]/90 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={openNav}
        aria-label="Open navigation"
        className="k-btn-ghost -ml-2 h-8 w-8 justify-center px-0 lg:hidden"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2.5" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 2.5v11" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={i} className="flex min-w-0 items-center gap-2">
              {i > 0 && (
                <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg4 shrink-0" aria-hidden="true">
                  <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {c.href && !last ? (
                <Link href={c.href} className="k-fg2 truncate hover:text-[var(--fg-1)]">
                  {c.label}
                </Link>
              ) : (
                <span className={`truncate ${last ? "k-fg font-medium" : "k-fg2"}`}>{c.label}</span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

/** A Keel stat tile: mono label + right note, a figure, and a visual under it. */
export function StatTile({
  label,
  note,
  children,
  href,
  className = "",
}: {
  label: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label truncate">{label}</span>
        {note != null && <span className="k-fg3 shrink-0 truncate text-[12px]">{note}</span>}
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  );
  const cls = `k-card flex min-w-0 flex-col px-4 pb-3.5 pt-3 ${className}`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A big figure with an optional unit/sub beside it. */
export function Figure({ value, unit, sub }: { value: React.ReactNode; unit?: string; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{value}</span>
      {unit && <span className="k-fg2 text-[13px]">{unit}</span>}
      {sub != null && <span className="k-fg3 ml-1 truncate text-[12px]">{sub}</span>}
    </div>
  );
}

/** A served series as a soft line. Draws what it is handed; computes nothing. */
export function SparkLine({ values, className = "h-8" }: { values: number[] | null; className?: string }) {
  const id = useId();
  if (!values || values.length < 2) return <div className={className} />;
  const w = 200;
  const h = 40;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={`w-full text-[var(--accent)] ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Keel's vertical "run" bars: one per day, the last ones strongest. */
export function BarSpark({ values, className = "" }: { values: number[] | null; className?: string }) {
  if (!values || values.length === 0) return <div className={`h-6 ${className}`} />;
  const max = Math.max(...values, 1);
  return (
    <div className={`flex h-6 items-end gap-[3px] ${className}`} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className="w-[5px] rounded-[2px]"
          style={{
            height: `${Math.max(3, (v / max) * 24)}px`,
            background: v > 0 ? "var(--accent)" : "var(--data-track)",
            opacity: v > 0 ? 0.35 + 0.65 * (i / Math.max(1, values.length - 1)) : 1,
          }}
        />
      ))}
    </div>
  );
}

/** A horizontal meter: `value` of `max`. Colour is the accent unless stated. */
export function Meter({ value, max, className = "" }: { value: number | null; max: number | null; className?: string }) {
  const pct = value != null && max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-[var(--data-track)] ${className}`}>
      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A square initials tile, the way Keel draws a company or a person. */
export function Initials({ name, size = 20, round = false }: { name: string; size?: number; round?: boolean }) {
  const letters = name
    .split(/[\s&.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-[var(--bg-inset)] font-medium text-[var(--fg-2)] shadow-[inset_0_0_0_1px_var(--line)] ${round ? "rounded-full" : "rounded-[5px]"}`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}
    >
      {letters}
    </span>
  );
}

/** "Label  N" — Keel's section heading with a quiet count. */
export function SectionTitle({ children, count, right }: { children: React.ReactNode; count?: number | null; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[14px] font-medium">
        {children}
        {count != null && <span className="k-fg3 ml-1.5 font-normal tabular-nums">{count}</span>}
      </h2>
      {right && <div className="k-fg3 flex items-center gap-2 text-[12px]">{right}</div>}
    </div>
  );
}

/** Running / paused as Keel draws an agent's state. */
export function StateDot({ running, label }: { running: boolean; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      {running ? (
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--accent)] text-[var(--accent)]" />
      ) : (
        <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--fg-2)]" />
      )}
      {label ?? (running ? "Running" : "Paused")}
    </span>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="k-fg3 px-4 py-8 text-center text-[13px]">{children}</p>;
}
