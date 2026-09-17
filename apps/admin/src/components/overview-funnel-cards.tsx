"use client";

/**
 * The three PURE cards the Overview's funnel summary is made of: a stage total, the
 * base-100 drop chart, and the client-economics row.
 *
 * They live apart from the view because they take plain props and call no hook, which
 * is what lets them be bundled and RENDERED in a probe — a class name is a spelling,
 * and only a render says whether the bar has a width and the row fits a phone.
 */

import { Skeleton } from "@/components/skeleton";
import { formatCount, formatUsd } from "@/lib/format-number";
import { columnHeightPct, type ClientEconomics, type FunnelStep } from "@/lib/funnel-overview";

function usdFull(n: number): string {
  return formatUsd(n, Math.abs(n) < 10 ? 2 : 0);
}

/**
 * Where a rolling window's edge sits, beside the window's own name.
 *
 * A rolling window MOVES under the reader, so its counts fall with no churn behind
 * them: the 90-day paid-users stage read 23 on 2026-09-15 and 20 two days later,
 * purely because a dense cluster of June first-payments rolled out of the window.
 * Every figure in that drop was correct and it reads as a collapse. Naming the edge is
 * what makes it legible as the clock.
 *
 * Quiet and inline on purpose: this is a clarification of the title beside it, not a
 * figure of its own. A window with no edge (since inception) renders nothing at all.
 */
function WindowEdge({ edgeLabel }: { edgeLabel?: string | null }) {
  if (!edgeLabel) return null;
  return (
    <span className="ml-2 text-xs font-normal text-gray-400">since {edgeLabel}</span>
  );
}

/** A figure we could not measure states a dash, never a zero. */
function countOrDash(value: number | null): string {
  return value === null ? "—" : formatCount(value);
}

/** One funnel stage: its total, and what share of the stage above it that is. */
/** One accent per stage, so the row reads as a funnel rather than four of one card. */
const STEP_ACCENT: Record<FunnelStep["key"], string> = {
  visitors: "bg-sky-500",
  signups: "bg-brand-500",
  paidUsers: "bg-emerald-500",
  activeUsers: "bg-amber-500",
};

export function FunnelStatCard({ step }: { step: FunnelStep }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${STEP_ACCENT[step.key]}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{step.label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{countOrDash(step.value)}</p>
      {/*
        A stage we could not measure SAYS SO. Without this branch a null value fell to
        "Top of the funnel" (the caption for a null `pctOfPrevious`), so an unavailable
        Paid users stage read as the head of the funnel with a dash under it, which is
        the same misreading as a zero wearing a different hat.
      */}
      <p className={`mt-1 text-sm ${step.value === null ? "text-amber-600" : "text-gray-500"}`}>
        {step.value === null
          ? "Not measured, not zero"
          : step.pctOfPrevious === null || step.previousLabel === null
            ? "Top of the funnel"
            : `${step.pctOfPrevious}% of ${step.previousLabel.toLowerCase()}`}
      </p>
    </div>
  );
}

/** How tall a full column is. Fixed, so the three windows read against one scale. */
const COLUMN_TRACK_PX = 128;

/**
 * Where people drop out, as a CASCADE: one column per stage, left to right in funnel
 * order, each column's HEIGHT falling away from the stage before it.
 *
 * The height is HOW MANY REACHED the stage, log-scaled against the top of the funnel —
 * see `columnHeightPct` for why both obvious alternatives were built, rendered and
 * rejected. Short version: a step conversion does not descend, so it draws a bar chart
 * rather than a cascade; a linear index descends and then collapses, because this
 * funnel drops 2,215 visitors to 10 signups and puts every later stage on the floor.
 *
 * A stage we could not measure draws NO column and says so. A zero-height column reads
 * as nobody reaching that stage, which is the one thing this must not say by accident —
 * it is the exact misreading that made a dash on Paid users report a month with three
 * new paying customers as a month with none.
 *
 * A stage can legitimately EXCEED the one before it: the stages are not a cohort, so an
 * org that signed up in June and first paid in September is in this month's payers and
 * in no earlier stage of this window. That is rare and it is real, so its column MARKS
 * ITS TOP rather than passing unremarked, and the percentage under it states the true
 * figure.
 */
export function FunnelIndexChart({
  title,
  edgeLabel,
  steps,
}: {
  title: string;
  /** Where the window's edge sits, or null for a window that has none. See `WindowEdge`. */
  edgeLabel?: string | null;
  steps: FunnelStep[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">
        {title}
        <WindowEdge edgeLabel={edgeLabel} />
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Log scale of how many reached each stage, so a 200x drop still reads. The number above
        each column is that stage indexed on unique visitors at 100.
      </p>
      <div className="mt-5 flex items-stretch gap-2">
        {/* The first stage is the top of the funnel and the base every column is drawn against. */}
        {steps.map((step, i) => {
          const survived = i === 0 ? (step.value === null ? null : 100) : step.pctOfPrevious;
          const exceedsPrevious = survived !== null && survived > 100;
          const base = steps[0].value;
          return (
            <div key={step.key} className="flex min-w-0 flex-1 flex-col">
              <p className="text-center text-sm font-semibold text-gray-950">
                {step.index === null ? "—" : step.index}
              </p>
              <div
                className="mt-2 flex flex-col justify-end overflow-hidden rounded-md bg-gray-100"
                style={{ height: COLUMN_TRACK_PX }}
              >
                {step.value !== null && base !== null && (
                  <div
                    className={`w-full rounded-md ${STEP_ACCENT[step.key]} ${
                      exceedsPrevious ? "border-t-4 border-gray-900" : ""
                    }`}
                    style={{ height: `${columnHeightPct(step.value, base)}%` }}
                  />
                )}
              </div>
              <p className="mt-2 h-8 text-center text-[11px] font-medium leading-tight text-gray-900">
                {step.label}
              </p>
              <p className="text-center text-xs font-semibold text-gray-800">
                {countOrDash(step.value)}
              </p>
              <p
                className="text-center text-[11px] leading-tight text-gray-400"
                title={
                  step.previousLabel === null
                    ? "The base every other stage is measured against"
                    : `Of ${step.previousLabel.toLowerCase()}`
                }
              >
                {step.value === null
                  ? "Not measured, not zero"
                  : survived === null
                    ? "—"
                    : i === 0
                      ? "Top of the funnel"
                      : `${survived}% of prev.`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What the customers active in this window are worth. The window selects the
 * POPULATION; each figure is the per-customer one the producer already serves, so
 * "Avg LTR, last 30 days" reads as the average LTR of the customers active in the
 * last 30 days — never an LTR somehow measured over 30 days, which is not a thing.
 */
export function EconomicsCard({
  title,
  edgeLabel,
  economics,
  pending,
}: {
  title: string;
  /** Where the window's edge sits, or null for a window that has none. See `WindowEdge`. */
  edgeLabel?: string | null;
  economics: ClientEconomics;
  pending: boolean;
}) {
  const rows: Array<{ label: string; value: string; detail: string }> = [
    {
      label: "Avg LTR",
      value: economics.avgLtrUsd === null ? "—" : usdFull(economics.avgLtrUsd),
      detail:
        economics.avgLtrUsd === null
          ? "No customer here states a lifetime revenue"
          : `Over ${formatCount(economics.ltrCustomers)} that state one`,
    },
    {
      label: "Avg daily budget",
      value: economics.avgDailyBudgetUsd === null ? "—" : usdFull(economics.avgDailyBudgetUsd),
      detail: "Self-serve and agency together, running budget",
    },
    {
      label: "Avg retention",
      value:
        economics.avgRetentionMonths === null ? "—" : `${economics.avgRetentionMonths.toFixed(1)} mo`,
      detail: "First to last active week, in months",
    },
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">
        {title}
        <WindowEdge edgeLabel={edgeLabel} />
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {pending ? "Reading the customer board…" : `${formatCount(economics.customers)} customers active in this window.`}
      </p>
      <div className="mt-5 divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{row.label}</p>
              <p className="mt-0.5 text-xs text-gray-400">{row.detail}</p>
            </div>
            {pending ? (
              <Skeleton className="h-7 w-20 shrink-0 rounded" />
            ) : (
              <p className="shrink-0 text-xl font-semibold text-gray-950">{row.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
