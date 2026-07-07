"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCrossOrgCostProjection,
  getCrossOrgWorkflowStats,
  type CrossOrgRankedWorkflow,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { ScoreCard } from "@/components/visibility/score-card";
import { Skeleton } from "@/components/skeleton";

const FEATURE_SLUG = "sales-cold-email-outreach";

// The cross-org per-workflow "value" columns. Each is a features-service
// `costPer*Cents` field (CENTS) — the cost-per-outcome for one maximization
// objective. The value is a ready backend field; we only format it (cents→USD),
// never compute the ratio in the browser. `null` renders as "—", never $0.
const OBJECTIVES = [
  { key: "costPerRecipientClickCents", label: "Cost per click (CPC)", noun: "click" },
  { key: "costPerRecipientPositiveReplyCents", label: "Cost per positive reply", noun: "reply" },
  { key: "costPerRecipientOpenCents", label: "Cost per open", noun: "open" },
] as const;

type ObjectiveKey = (typeof OBJECTIVES)[number]["key"];

const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** USD from a backend USD number; "—" when null. */
function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usd2(value);
}

/** USD from a backend CENTS field; "—" when null (never a false $0). */
function fmtCentsUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usd2(value / 100);
}

function stat(row: CrossOrgRankedWorkflow, key: string): number | null {
  const v = row.stats[key];
  return v === undefined ? null : v;
}

export default function SalesColdEmailOutreachStatsPage() {
  const [objective, setObjective] = useState<ObjectiveKey>("costPerRecipientClickCents");

  const projection = useQuery({
    queryKey: ["crossOrgCostProjection", FEATURE_SLUG],
    queryFn: () => getCrossOrgCostProjection(FEATURE_SLUG),
    ...pollOptionsSlower,
  });

  const workflows = useQuery({
    queryKey: ["crossOrgWorkflowStats", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgWorkflowStats(FEATURE_SLUG, objective, 50),
    ...pollOptionsSlower,
  });

  const projPending = projection.isPending;
  const rows = workflows.data?.results ?? [];
  const activeObjective = OBJECTIVES.find((o) => o.key === objective)!;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Sales Cold Emails Outreach</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cross-org economics — averaged across every client brand running this feature.
          {projection.data ? ` ${num(projection.data.brandCount)} brands with usable economics.` : ""}
        </p>
      </header>

      {/* Cross-org expected cost per outcome (the maximization objectives that
          have a fleet-wide average today: meeting-booked + purchase). */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreCard
          label="Cost per meeting booked"
          value={fmtUsd(projection.data?.avgCostPerMeetingBooked)}
          subtitle="Expected, cross-org avg"
          tooltip="Feature-wide expected USD cost to book one meeting: each brand's best workflow projection, meaned (unweighted) across all client brands."
          pending={projPending}
        />
        <ScoreCard
          label="Cost per purchase"
          value={fmtUsd(projection.data?.avgCostPerPurchase)}
          subtitle="Expected, cross-org avg"
          tooltip="Feature-wide expected USD cost per purchase/close, meaned across all client brands."
          pending={projPending}
        />
        <ScoreCard
          label="Client brands"
          value={projection.data ? num(projection.data.brandCount) : "—"}
          subtitle="Contributing to the averages"
          pending={projPending}
        />
      </section>

      {/* Trend chart — Wave 2. The moving-average-of-last-100-outcomes series
          needs a new features-service endpoint (no cost-per-outcome time-series
          exists yet); we render an honest placeholder rather than fake a curve
          from client-side math. */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900">Cost-per-outcome trend</h2>
        <p className="mt-1 text-xs text-gray-500">
          Moving average of the last 100 outcomes, per objective, cross-org.
        </p>
        <div className="mt-4 flex h-[220px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center">
          <div className="px-6">
            <p className="text-sm font-medium text-gray-600">Trend series in progress</p>
            <p className="mt-1 text-xs text-gray-400">
              Needs a features-service time-series endpoint (dated spend joined to dated
              outcomes). Shipping next — no client-side estimate is shown in the meantime.
            </p>
          </div>
        </div>
      </section>

      {/* Per-workflow cross-org split for the selected objective. */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Per-workflow split (cross-org)</h2>
          <div className="inline-flex rounded-lg border border-brand-200 bg-brand-50 p-0.5">
            {OBJECTIVES.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setObjective(o.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition ${
                  o.key === objective
                    ? "bg-white text-brand-700 font-medium shadow-sm"
                    : "text-brand-600 hover:text-brand-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-4 py-3 font-medium text-right">{activeObjective.label}</th>
                <th className="px-4 py-3 font-medium text-right">Total spend</th>
                <th className="px-4 py-3 font-medium text-right">Contacted</th>
                <th className="px-4 py-3 font-medium text-right">Delivered</th>
                <th className="px-4 py-3 font-medium text-right">Opened</th>
                <th className="px-4 py-3 font-medium text-right">Open rate</th>
                <th className="px-4 py-3 font-medium text-right">Runs</th>
              </tr>
            </thead>
            <tbody>
              {workflows.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={8}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={8}>
                    No workflow data yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const openRate = stat(row, "recipientOpenRate");
                  return (
                    <tr
                      key={row.workflow?.workflowSlug ?? i}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-800">
                        {row.workflow?.workflowDynastyName ??
                          row.workflow?.workflowName ??
                          row.workflow?.workflowSlug ??
                          "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {fmtCentsUsd(stat(row, objective))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {fmtCentsUsd(stat(row, "totalCostInUsdCents"))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {num(stat(row, "recipientsContacted") ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {num(stat(row, "recipientsDelivered") ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {num(stat(row, "recipientsOpened") ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {openRate === null ? "—" : `${(openRate * 100).toFixed(1)}%`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {num(stat(row, "completedRuns") ?? 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          Cost-per-outcome comes straight from features-service. A workflow reads blank until
          enough cross-org outcomes of that type exist to compute it.
        </p>
      </section>
    </div>
  );
}
