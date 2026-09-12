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
import type { ClientEconomics, FunnelStep } from "@/lib/funnel-overview";

function usdFull(n: number): string {
  return formatUsd(n, Math.abs(n) < 10 ? 2 : 0);
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
      <p className="mt-1 text-sm text-gray-500">
        {step.pctOfPrevious === null || step.previousLabel === null
          ? "Top of the funnel"
          : `${step.pctOfPrevious}% of ${step.previousLabel.toLowerCase()}`}
      </p>
    </div>
  );
}

/**
 * Where people drop out: the NUMBER is the stage indexed on unique visitors at 100,
 * the BAR is what survived from the stage directly above it.
 *
 * The two are deliberately different quantities, and the card says which is which.
 * Drawing the bar at the index instead is the obvious thing and it is unreadable on a
 * real funnel: 12,400 visitors against 71 signups puts every stage after the first at
 * an index under 1, so all three render as a sliver and the drops — the only thing
 * this row exists to show — are invisible. Every analytics tool resolves that the
 * same way, by making the step conversion the readable shape and leaving the absolute
 * figure as text. So the bar answers "what share of the stage above got here" and the
 * number answers "how far from the top are we", and both are labelled.
 *
 * A stage we could not measure draws NO bar and says so — a zero-width bar reads as
 * nobody reaching that stage, which is the one thing this must not say by accident.
 */
export function FunnelIndexChart({ title, steps }: { title: string; steps: FunnelStep[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">
        Bar is what survived from the stage above. The number is the stage indexed on unique
        visitors at 100.
      </p>
      <div className="mt-5 space-y-4">
        {steps.map((step, i) => {
          // The first stage has nothing above it, so it IS the whole bar — it is the
          // base every number to its right is measured against.
          const survived = i === 0 ? (step.value === null ? null : 100) : step.pctOfPrevious;
          return (
            <div key={step.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-gray-900">{step.label}</p>
                <p className="shrink-0 text-sm font-semibold text-gray-950">
                  {step.index === null ? "—" : step.index}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                {survived !== null && (
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(survived, 100)}%` }}
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {step.value === null
                  ? "Not measured"
                  : `${formatCount(step.value)} reached${
                      step.pctOfPrevious === null || step.previousLabel === null
                        ? ""
                        : ` · ${step.pctOfPrevious}% of ${step.previousLabel.toLowerCase()}`
                    }`}
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
  economics,
  pending,
}: {
  title: string;
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
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
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
