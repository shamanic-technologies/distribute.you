"use client";

/**
 * Presentational primitives shared by every `/feature-stats/<slug>` sub-page.
 *
 * The surface is three pages that all print the same money in the same table
 * chrome; each one importing from here is what keeps a cost-change badge
 * cost-semantic (falling = green) on all three at once.
 */
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/skeleton";
import {
  formatDateShort,
  fmtUsd,
  num,
  usd2,
  type Sort,
} from "@/lib/feature-stats-format";
import type { CrossOrgTrendPoint } from "@/lib/api";

/** Clickable table header — click to sort by this column, click again to flip direction. */
export function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  sortKey: string;
  sort: Sort | null;
  onSort: (key: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const isActive = sort?.key === sortKey;
  const arrow = !isActive ? "↕" : sort!.dir === "asc" ? "▲" : "▼";
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 select-none hover:text-gray-700 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${isActive ? "text-brand-600" : "text-gray-300"}`}>{arrow}</span>
      </button>
    </th>
  );
}

/**
 * Cost-change badge: arrow shows direction (▲ up / ▼ down); color is
 * cost-semantic — a rising cost is bad (red), a falling cost is good (green).
 */
export function GrowthBadge({ growth }: { growth: number | null }) {
  if (growth === null || growth === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const up = growth > 0;
  const cls = up ? "text-red-600" : "text-green-600";
  const arrow = up ? "▲" : "▼";
  const pct = (Math.abs(growth) * 100).toFixed(1);
  return (
    <span className={`text-xs font-medium ${cls}`} title={`${up ? "+" : "-"}${pct}% vs last week`}>
      {arrow} {pct}% <span className="text-gray-400 font-normal">wk</span>
    </span>
  );
}

/** Minimal sparkline — the moving-average series shape, no axes/grid/tooltip. */
export function Sparkline({ points, growth }: { points: CrossOrgTrendPoint[]; growth: number | null }) {
  const data = points.filter((p) => p.costPerOutcomeUsd !== null);
  if (data.length < 2) {
    return <div className="h-10 flex items-center text-[10px] text-gray-300">no trend yet</div>;
  }
  // Cost-semantic: rising cost red, falling cost green.
  const stroke = growth === null || growth === 0 ? "#94a3b8" : growth > 0 ? "#dc2626" : "#16a34a";
  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="costPerOutcomeUsd"
            dot={false}
            stroke={stroke}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stock-ticker card: label, big price (100-avg), weekly change, sparkline. */
export function OutcomeCard({
  label,
  price,
  growth,
  points,
  pending,
}: {
  label: string;
  price: number | null;
  growth: number | null;
  points: CrossOrgTrendPoint[];
  pending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {pending ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-gray-800">{fmtUsd(price)}</p>
          <GrowthBadge growth={growth} />
        </div>
      )}
      <div className="mt-2">
        {pending ? <Skeleton className="h-10 w-full rounded" /> : <Sparkline points={points} growth={growth} />}
      </div>
    </div>
  );
}

export function TrendTooltip({
  active,
  payload,
  noun,
}: {
  active?: boolean;
  payload?: Array<{ payload: CrossOrgTrendPoint; value: number }>;
  noun: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(p.date)}</p>
      <p className="mt-1 font-semibold text-gray-900">
        {p.costPerOutcomeUsd === null ? "—" : usd2(p.costPerOutcomeUsd)} / {noun}
      </p>
      <p className="mt-0.5 text-gray-400">
        {num(p.windowOutcomeCount)} outcomes · {usd2(p.windowSpentUsd)} spend
      </p>
    </div>
  );
}
