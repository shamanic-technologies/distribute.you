"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyNote } from "@/components/v2/ui";
import { runUsdText, type ResearchRunCost } from "@/lib/research/research";

/** Why a model has no cost per run on this pipe, in plain words (features-service `unavailableReason`). */
const RUN_COST_GAP: Record<string, string> = {
  no_run_on_pipe: "It wrote nothing on this pipe yet.",
  no_run_cost_known: "None of its runs here has a known cost yet.",
  not_on_vendor_basis: "Its run costs are not on the vendor basis in this view.",
  run_costs_unreadable: "Its run costs could not be read for this build.",
};

export function runCostGap(c: ResearchRunCost | null | undefined): string {
  if (!c) return "Not served for this build yet.";
  return (c.unavailableReason && RUN_COST_GAP[c.unavailableReason]) ?? c.unavailableReason ?? "Not served.";
}

const tokensText = (n: number | null) => (n == null ? null : `${Math.round(n).toLocaleString("en-US")} tokens`);

/**
 * A model's cost per writing run on this pipe (owner 2026-10-24): the average, its input and output halves
 * (cache folded into input), each as served. Nothing divided here.
 */
export function RunCostFigures({ c }: { c: ResearchRunCost | null | undefined }) {
  const cell = (k: string, v: string | null, sub: string | null) => (
    <div className="min-w-0">
      <dt className="k-label truncate">{k}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-medium tabular-nums">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
      {sub && <dd className="k-fg3 truncate text-[11.5px] tabular-nums">{sub}</dd>}
    </div>
  );
  return (
    <dl className="grid grid-cols-3 gap-x-3 text-[12px]">
      {cell("$ / run", c?.averageDisplay ?? null, c && c.runs ? `${c.runs.toLocaleString("en-US")} ${c.runs === 1 ? "run" : "runs"}` : null)}
      {cell("Input / run", runUsdText(c?.averageInputUsd ?? null), tokensText(c?.averageInputTokens ?? null))}
      {cell("Output / run", runUsdText(c?.averageOutputUsd ?? null), tokensText(c?.averageOutputTokens ?? null))}
    </dl>
  );
}

/**
 * The average cost per run since inception, one served point per day a priced run was written (cumulative,
 * last point = the $ / run figure), on a time axis: quiet days are absent on the wire.
 */
export function RunCostChart({ c, height = 140 }: { c: ResearchRunCost | null | undefined; height?: number }) {
  const points = (c?.history ?? []).map((d) => ({ t: Date.parse(`${d.day}T00:00:00Z`), day: d.day, usd: d.averageUsd, runs: d.runs }));
  if (points.length === 0) return <EmptyNote>{runCostGap(c)}</EmptyNote>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: 11, fill: "var(--fg-3)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            tickFormatter={(t: number) => new Date(t).toISOString().slice(5, 10)}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--fg-3)" }} tickLine={false} axisLine={false} width={56} tickCount={4} tickFormatter={(v: number) => runUsdText(v) ?? ""} />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && payload?.length ? (payload[0].payload as (typeof points)[number]) : null;
              return p ? (
                <div className="k-popover px-2.5 py-1.5 text-[12px]">
                  <p className="k-fg3 k-mono">{p.day}</p>
                  <p className="tabular-nums">
                    {runUsdText(p.usd)} / run, over {p.runs.toLocaleString("en-US")} {p.runs === 1 ? "run" : "runs"}
                  </p>
                </div>
              ) : null;
            }}
          />
          <Line type="stepAfter" dataKey="usd" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
