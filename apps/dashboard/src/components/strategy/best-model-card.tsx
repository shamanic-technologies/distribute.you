"use client";

import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { WORKFLOW_GRAIN_LABEL } from "@/lib/strategy-model";
import { stepsFor, type GoalStep } from "@/lib/goal-steps";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";
import type { WorkflowProjectionResolved, WorkflowProjectionRow } from "@/lib/api";
import { formatRoi } from "@/lib/format-roi";

type Grain = WorkflowProjectionResolved["grain"];

/** Cost per sales interest at a row's server-resolved grain — read VERBATIM from the
 *  floor-filled unit-costs block (never null when the block exists), mirroring the
 *  ladder→item adapter in api.ts. `null` when the row / grain block is absent. No
 *  client-side math — same feature-service field the audiences page renders. */
export function cpprFromRow(row: WorkflowProjectionRow | null | undefined): number | null {
  if (!row) return null;
  const block = row.estimatesByGrain[row.resolved.grain];
  return block?.unitCosts.costPerPositiveReplyUsd ?? null;
}

/**
 * USD render for a resolved cost-per-X tile — whole dollars, no cents ("$39"). When
 * `floored` the grain observed zero clicks/outcomes, so the number is a floor
 * (spentUsd / max(1)); we render it plain (no ">" prefix) because the ">" read as
 * confusing on a not-yet-realized outcome. `floored` is kept for callers that still
 * distinguish the grain elsewhere.
 */
export function formatUsdFloor(usd: number | null | undefined, _floored: boolean): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** USD render for cost-per-click — adaptive "$X.XX" (<$10) / "$X" (≥$10) / "$0.00" / "-".
 *  CPC is usually a small figure ($1–$7) where the cents matter. */
export function formatUsdCents(usd: number | null | undefined): string {
  if (usd == null) return "-";
  if (usd <= 0) return "$0.00";
  const decimals = Math.abs(usd) < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** A percentage in % units rendered as a whole number → "39%" / "—". For headline cost-of-
 *  acquisition tiles where the decimal reads as noise (conversion rates keep `formatPct`). */
export function formatPctWhole(pct: number | null | undefined): string {
  if (pct == null) return "-";
  return `${pct.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
}

/** Which population produced a resolved number → a short "based on …" hint that
 *  labels the number honestly (fleet benchmark vs this brand vs this audience). */
export function grainHint(grain: Grain | null | undefined): string {
  switch (grain) {
    case "brand":
      return "From this brand's own results";
    case "audience":
      return "From this audience's own results";
    case "crossOrg":
      return "Fleet benchmark across every brand we run this for";
    default:
      return "";
  }
}

export function Stat({
  label,
  value,
  pending,
  hint,
  tooltip,
}: {
  label: string;
  value: string;
  pending?: boolean;
  hint?: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
        {label}
        {tooltip ? <InfoTooltip tip={tooltip} placement="top" /> : null}
      </p>
      {pending ? (
        <Skeleton className="mt-1.5 h-6 w-20" />
      ) : (
        <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
      )}
      {hint ? <p className="mt-1 text-[11px] leading-4 text-gray-400">{hint}</p> : null}
    </div>
  );
}

/**
 * The "Your best model" identity row + projected-economics stat grid — the SINGLE
 * renderer shared by the Strategy page and the onboarding best-model step, so the two
 * surfaces show byte-identical numbers (same `getWorkflowProjectionLadder` +
 * `pickBestBrandRow` upstream). Every value is read VERBATIM from the server-resolved
 * grain — no client-side cost/ROI/CAC math. Assumes `resolved` is non-null; the caller
 * owns the pending / no-data states around it. The per-audience "Estimates by audience"
 * table stays on the Strategy page only.
 */
export function BestModelStats({
  resolved,
  bestName,
  brandGrain,
  avatar,
  roiMultiple,
  floored,
  cppr,
  funnelKey,
}: {
  resolved: WorkflowProjectionResolved;
  bestName: string;
  brandGrain: Grain | null;
  avatar: { emoji: string; color: string };
  roiMultiple: number | null;
  floored: boolean;
  cppr: number | null;
  /** The SALES FUNNEL these numbers were priced on. Null states no funnel. */
  funnelKey: SalesFunnelKeyWire | null;
}) {
  // Every tile is gated on the FUNNEL's own steps, never on a goal. `sales_meetings`
  // covers BOTH meeting funnels, so a goal-gated grid put "Cost per website visit"
  // beside a reply→meeting funnel that has no visit leg — a step the brand does not buy,
  // on the card that prices what it does. A null funnel states no steps (`[Outreach]`),
  // so only the funnel-independent tiles render rather than a borrowed set.
  const steps = stepsFor(null, funnelKey);
  const hasStep = (key: GoalStep["key"]) => steps.some((s) => s.key === key);
  const showVisitStat = hasStep("website_visits");
  const showReplyStat = hasStep("positive_replies");
  // The funnel's terminal step, and the only honest source for the outcome's name here.
  const outcomeStep = steps.find((s) => s.outcome) ?? null;
  // The step's own singular noun, not its label: a label is a column heading ("Sales
  // Meetings") and this prices ONE of them.
  const noun = outcomeStep?.outcome?.noun ?? null;
  // A reply that is TERMINAL is the outcome itself, so it needs no second tile above it.
  const showOutcomeStat = outcomeStep !== null;
  // Whole class strings, never a column count interpolated into one: a class assembled
  // at runtime is invisible to the Tailwind compiler, so it would silently not apply.
  const tileCount =
    (showVisitStat ? 1 : 0) + (showReplyStat ? 1 : 0) + (showOutcomeStat ? 1 : 0) + 3;
  const gridCols =
    tileCount >= 6
      ? "lg:grid-cols-6"
      : tileCount === 5
        ? "lg:grid-cols-5"
        : tileCount === 4
          ? "lg:grid-cols-4"
          : "lg:grid-cols-3";

  return (
    <>
      {/* Identity row */}
      <div className="flex items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl"
          style={{ backgroundColor: `${avatar.color}1a`, border: `2px solid ${avatar.color}` }}
          aria-hidden
        >
          {avatar.emoji}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-lg font-semibold text-gray-900">{bestName}</p>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Best
            </span>
            {brandGrain ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Based on {WORKFLOW_GRAIN_LABEL[brandGrain]}
                <InfoTooltip
                  tip="Which population these numbers are based on: the finest grain with real data (this audience, then this brand, then the fleet benchmark)."
                  placement="top"
                />
              </span>
            ) : null}
          </div>
          <p className="text-xs text-gray-500">
            {roiMultiple != null
              ? `Projected ${formatRoi(roiMultiple)} lifetime return on each dollar`
              : "Selected automatically on each run from live performance"}
          </p>
        </div>
      </div>

      {/* Projected economics — all read VERBATIM from the resolved grain. Labelled by
          grain (hint) so a fleet-benchmark or per-audience number is never mislabelled
          "this brand". */}
      <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${gridCols}`}>
        {showVisitStat && (
          <Stat
            label="Cost per website visit"
            value={formatUsdCents(resolved.costPerClickUsd)}
            tooltip="Cost per website visit - what we pay on average for one prospect to visit your site."
            hint={grainHint(brandGrain)}
          />
        )}
        {showReplyStat && (
          <Stat
            label="Cost / sales interest"
            value={formatUsdFloor(cppr, floored)}
            tooltip="Cost per sales interest - what we pay on average for one prospect to reply with genuine buying interest."
            hint={grainHint(brandGrain)}
          />
        )}
        {showOutcomeStat && noun && (
          <Stat
            label={`Cost / ${noun}`}
            value={formatUsdFloor(resolved.costPerOutcomeUsd, floored)}
            tooltip={`Cost per ${noun} - what we pay on average for one ${noun}.`}
            hint={grainHint(brandGrain)}
          />
        )}
        <Stat
          label="Cost / paid client"
          value={formatUsdFloor(resolved.costPerPaidClientUsd, floored)}
          tooltip="Cost per paid client - what we pay on average to win one paying client."
          hint={grainHint(brandGrain)}
        />
        <Stat
          label="Lifetime revenue on each dollar spent"
          value={
            roiMultiple != null
              ? formatRoi(roiMultiple)
              : "-"
          }
          hint="Lifetime revenue of a paid client per dollar of outreach spend"
        />
        <Stat
          label="Cost of acquisition"
          value={formatPctWhole(resolved.cacPct)}
          tooltip="Cost to acquire a paid client divided by the lifetime revenue of a paid client"
          hint="Share of a client's lifetime revenue spent to acquire them"
        />
      </div>
    </>
  );
}
