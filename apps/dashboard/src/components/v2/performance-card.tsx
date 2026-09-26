"use client";

import { Skeleton } from "@/components/skeleton";

/**
 * A 30-day line under a card's figure. It states SHAPE only — no axis, no points, no
 * tooltip — because the figure above it is the number; the line says whether it is
 * moving. Coloured off `currentColor`, so the wrapper's text class decides the tone.
 */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 240;
  const h = 44;
  const max = Math.max(...values, 0);
  if (values.length < 2 || max === 0) {
    return (
      <div className="flex h-11 items-end" aria-label={`${label}: nothing in the last 30 days`}>
        <div className="h-px w-full bg-gray-200" />
      </div>
    );
  }
  const step = w / (values.length - 1);
  const y = (v: number) => h - 2 - (v / max) * (h - 6);
  const line = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-11 w-full"
      role="img"
      aria-label={`${label}, last 30 days`}
    >
      <polygon points={area} fill="currentColor" fillOpacity={0.08} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * One performance card, Keel's shape: a small-caps label with its context on the
 * right, the figure, a quiet line under it, and a 30-day spark. The frame renders on
 * the first paint; only the figure and the line wait for their read.
 */
export function PerformanceCard({
  label,
  context,
  value,
  sub,
  spark,
  tone,
  pending,
}: {
  label: string;
  context?: string;
  value: string;
  sub?: string | null;
  spark: number[] | null;
  /** Tailwind text class driving the spark colour. */
  tone: string;
  pending: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-500">{label}</span>
        {context && <span className="truncate text-[11px] text-gray-400">{context}</span>}
      </div>
      {pending ? (
        <>
          <Skeleton className="mt-2 h-8 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
          <Skeleton className="mt-3 h-11 w-full" />
        </>
      ) : (
        <>
          <span className="mt-1.5 text-[28px] font-semibold leading-9 tracking-tight tabular-nums text-gray-900">
            {value}
          </span>
          <span className="mt-0.5 h-4 truncate text-xs text-gray-500">{sub ?? ""}</span>
          <div className={`mt-3 ${tone}`}>{spark && <Sparkline values={spark} label={label} />}</div>
        </>
      )}
    </div>
  );
}
