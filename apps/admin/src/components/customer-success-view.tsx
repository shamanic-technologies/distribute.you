"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getCustomerSuccess,
  type CustomerSuccessBoard,
  type CustomerRow,
  type CustomerOptimizationGoal,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";

// ── Formatters (render only; never compute a metric) ─────────────────────────

const DASH = "-";

/** USD amount: null/undefined -> "-"; adaptive decimals (< $10 keeps cents). */
function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const decimals = Math.abs(value) < 10 ? 2 : 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Percent with one decimal: null/undefined -> "-". */
function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${value.toFixed(1)}%`;
}

/** ROI multiple, e.g. "2.3x": null/undefined -> "-". */
function roi(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${value.toFixed(1)}x`;
}

function count(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return value.toLocaleString("en-US");
}

const GOAL_LABEL: Record<CustomerOptimizationGoal, string> = {
  signup: "Signups",
  meetingBooked: "Meetings booked",
  purchase: "Purchases",
  websiteVisit: "Website visits",
  positiveReply: "Positive replies",
  formSubmission: "Form submissions",
};

function goalLabel(goal: CustomerOptimizationGoal | null): string {
  return goal ? GOAL_LABEL[goal] : DASH;
}

const GRAIN_LABEL: Record<"crossOrg" | "brand" | "audience", string> = {
  crossOrg: "Cross-org",
  brand: "Brand",
  audience: "Audience",
};

// ── Health badge ─────────────────────────────────────────────────────────────

const HEALTH_DOT: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

const HEALTH_TEXT: Record<"green" | "yellow" | "red", string> = {
  green: "text-emerald-700",
  yellow: "text-amber-700",
  red: "text-red-700",
};

function HealthDot({ badge }: { badge: "green" | "yellow" | "red" }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${HEALTH_DOT[badge]}`} title={badge} />;
}

function HealthBadge({ badge }: { badge: "green" | "yellow" | "red" }) {
  const label = badge === "green" ? "Healthy" : badge === "yellow" ? "At risk" : "Not active";
  return (
    <span className="inline-flex items-center gap-1.5">
      <HealthDot badge={badge} />
      <span className={`text-xs font-medium ${HEALTH_TEXT[badge]}`}>{label}</span>
    </span>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────

const STATUS_PILL: Record<"active" | "paused" | "inactive", string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  inactive: "bg-gray-50 text-gray-500 border-gray-200",
};

function StatusPill({ status }: { status: "active" | "paused" | "inactive" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_PILL[status]}`}>
      {status}
    </span>
  );
}

// ── Org name resolution (Clerk names live only in Clerk) ─────────────────────

function useOrgNames(rows: CustomerRow[]) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.orgExternalId) set.add(r.orgExternalId);
    return [...set].sort();
  }, [rows]);

  const { data } = useQuery<Record<string, string>>({
    queryKey: ["adminOrgNames", ids],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orgs/names?ids=${encodeURIComponent(ids.join(","))}`);
      if (!res.ok) throw new Error(`org name resolve failed (${res.status})`);
      const json = (await res.json()) as { names: Record<string, string> };
      return json.names;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });

  return data ?? {};
}

function customerLabel(row: CustomerRow, names: Record<string, string>): string {
  return row.brandName || row.brandDomain || (row.orgExternalId ? names[row.orgExternalId] : undefined) || row.ownerEmail || row.brandId.slice(0, 8);
}

// ── Fleet stat cards ─────────────────────────────────────────────────────────

function StatCard({ label, value, detail, accent, pending }: { label: string; value: string; detail: string; accent: string; pending: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-16 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

function HealthCountCard({
  green,
  yellow,
  red,
  pending,
}: {
  green: number;
  yellow: number;
  red: number;
  pending: boolean;
}) {
  const rows: Array<{ badge: "green" | "yellow" | "red"; label: string; value: number }> = [
    { badge: "green", label: "Healthy", value: green },
    { badge: "yellow", label: "At risk", value: yellow },
    { badge: "red", label: "Not active", value: red },
  ];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Health mix</p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.badge} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm text-gray-600">
              <HealthDot badge={r.badge} />
              {r.label}
            </span>
            {pending ? (
              <Skeleton className="h-4 w-8 rounded" />
            ) : (
              <span className="text-sm font-semibold tabular-nums text-gray-950">{count(r.value)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Right-panel drilldown ────────────────────────────────────────────────────

function PanelRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${muted ? "text-gray-400" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function RightPanel({ row, names, onClose }: { row: CustomerRow; names: Record<string, string>; onClose: () => void }) {
  const e = row.economics;
  const tracker = row.conversionTracker;
  const trackerText = !tracker.needed
    ? "Not needed for this goal"
    : tracker.firing === null
      ? "Unknown (inferred)"
      : tracker.firing
        ? "Firing (inferred)"
        : "Not firing (inferred)";

  return (
    <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-5 lg:w-[28rem]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HealthDot badge={row.health.badge} />
            <p className="truncate text-sm font-semibold text-gray-950">{customerLabel(row, names)}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {row.brandDomain || row.ownerEmail || row.orgId.slice(0, 8)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-950"
        >
          Close
        </button>
      </div>

      <PanelSection title="Health">
        <HealthBadge badge={row.health.badge} />
        <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <PanelRow label="Active" value={row.health.inputs.active ? "Yes" : "No"} />
          <PanelRow label="Has budget" value={row.health.inputs.hasBudget ? "Yes" : "No"} />
          <PanelRow label="ROI healthy (>= 1x)" value={row.health.inputs.roiHealthy ? "Yes" : "No"} />
          <PanelRow label="ROI multiple" value={roi(row.health.inputs.roiMultiple)} />
          <PanelRow label="Audience % used" value={pct(row.health.inputs.audiencePctUsed)} />
          <PanelRow
            label={`Audience near exhausted (>= ${pct(row.health.inputs.audienceNearExhaustedThresholdPct)})`}
            value={row.health.inputs.audienceNearExhausted ? "Yes" : "No"}
          />
        </div>
      </PanelSection>

      <PanelSection title="Realized economics">
        <PanelRow label="Realized spend" value={usd(row.currentEconomics.realizedSpendUsd)} />
        <PanelRow label="Expected pipeline" value={usd(row.currentEconomics.expectedPipelineUsd)} />
        <PanelRow label="Current CAC" value={usd(row.currentEconomics.currentCacUsd)} />
        <PanelRow label="Breakeven CAC (LTR)" value={usd(row.breakevenCacUsd)} />
        <PanelRow label="ROI multiple" value={roi(row.currentEconomics.roiMultiple)} />
        <PanelRow label="CAC % of LTR" value={pct(row.currentEconomics.cacPct)} />
      </PanelSection>

      <PanelSection title="Conversion economics">
        {e ? (
          <>
            <PanelRow label="Lifetime revenue (LTR)" value={usd(e.lifetimeRevenueUsd)} />
            <PanelRow label="Visit to signup" value={pct(e.visitToSignupPct)} />
            <PanelRow label="Signup to paid" value={pct(e.signupToPaidClientPct)} />
            <PanelRow label="Reply to meeting" value={pct(e.replyToMeetingPct)} />
            <PanelRow label="Visit to meeting" value={pct(e.visitToMeetingPct)} />
            <PanelRow label="Meeting to close" value={pct(e.meetingToClosePct)} />
            <PanelRow label="Visit to close" value={pct(e.visitToClosePct)} />
            {e.visitToPaidClientPct !== undefined && <PanelRow label="Visit to paid" value={pct(e.visitToPaidClientPct)} />}
            {e.replyToPaidClientPct !== undefined && <PanelRow label="Reply to paid" value={pct(e.replyToPaidClientPct)} />}
            {e.visitToFormSubmissionPct !== undefined && (
              <PanelRow label="Visit to form submission" value={pct(e.visitToFormSubmissionPct)} />
            )}
            {e.formSubmissionToPaidClientPct !== undefined && (
              <PanelRow label="Form submission to paid" value={pct(e.formSubmissionToPaidClientPct)} />
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No saved economics.</p>
        )}
      </PanelSection>

      <PanelSection title="Best audience">
        {row.bestAudience ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="truncate text-sm font-medium text-gray-900">{row.bestAudience.name}</p>
            <div className="mt-1">
              <PanelRow label="CAC" value={usd(row.bestAudience.cacUsd)} />
              <PanelRow label="Size" value={count(row.bestAudience.size)} />
              <PanelRow label="Remaining" value={count(row.bestAudience.remaining)} />
              <PanelRow label="% remaining" value={pct(row.bestAudience.pctRemaining)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No ranked audience.</p>
        )}
      </PanelSection>

      <PanelSection title="Best workflow">
        {row.bestWorkflow ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-gray-900">
                {row.bestWorkflow.name || row.bestWorkflow.workflowDynastySlug}
              </p>
              <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                {GRAIN_LABEL[row.bestWorkflow.grain]}
              </span>
            </div>
            <div className="mt-1">
              <PanelRow label="CAC" value={usd(row.bestWorkflow.cacUsd)} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No ranked workflow.</p>
        )}
      </PanelSection>

      <PanelSection title="Conversion tracker">
        <PanelRow label="Needed for goal" value={tracker.needed ? "Yes" : "No"} />
        <PanelRow label="Observed conversions" value={count(tracker.observedConversions)} />
        <PanelRow label="Status" value={trackerText} muted={!tracker.needed} />
      </PanelSection>

      <PanelSection title="Audiences">
        <PanelRow label="Active audiences" value={count(row.audiences.count)} />
        <PanelRow label="Total size" value={count(row.audiences.totalSize)} />
        <PanelRow label="Remaining" value={count(row.audiences.totalRemaining)} />
        <PanelRow label="% used" value={pct(row.audiences.pctUsed)} />
      </PanelSection>

      <PanelSection title="Budget and balance">
        <PanelRow label="Status" value={row.status} />
        <PanelRow label="Daily budget" value={usd(row.dailyBudgetUsd)} />
        <PanelRow label="Org balance (spendable)" value={usd(row.orgBalanceUsd)} />
        <PanelRow label="Org balance (actual)" value={usd(row.orgActualBalanceUsd)} />
        <PanelRow label="Auto-topup" value={row.autoTopupEnabled ? "On" : "Off"} />
      </PanelSection>

      <PanelSection title="Activity">
        <PanelRow label="Goal" value={goalLabel(row.optimizationGoal)} />
        <PanelRow label="Active days" value={count(row.activeDays.length)} />
        <PanelRow label="First active" value={row.firstActiveDay || DASH} />
        <PanelRow label="Last active" value={row.lastActiveDay || DASH} />
        <PanelRow
          label="Retention"
          value={row.retentionWeeks === null ? DASH : `${row.retentionWeeks} week${row.retentionWeeks === 1 ? "" : "s"}`}
        />
        <PanelRow label="Active this week" value={row.activeThisWeek ? "Yes" : "No"} />
        <PanelRow label="Active this month" value={row.activeThisMonth ? "Yes" : "No"} />
      </PanelSection>

      <PanelSection title="Not tracked yet">
        <div className="space-y-1">
          <PanelRow label="Dashboard return frequency" value="Not tracked yet" muted />
          <PanelRow label="Daily-budget history" value="Not tracked yet" muted />
          <PanelRow label="Pause history" value="Not tracked yet" muted />
        </div>
      </PanelSection>
    </aside>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

function CustomerTable({ data }: { data: CustomerSuccessBoard }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const names = useOrgNames(data.customers);

  const rowKey = (r: CustomerRow) => `${r.orgId}:${r.brandId}`;
  const selected = selectedKey ? data.customers.find((r) => rowKey(r) === selectedKey) ?? null : null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">Customers</h2>
      <p className="mt-1 text-sm text-gray-500">
        Every customer that was ever active, currently-active first. Click a row for full economics and health.
      </p>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">Health</th>
                <th className="py-2 px-3 font-medium">Customer</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium">Goal</th>
                <th className="py-2 px-3 text-right font-medium">Current CAC</th>
                <th className="py-2 px-3 text-right font-medium">Breakeven CAC</th>
                <th className="py-2 px-3 text-right font-medium">ROI</th>
                <th className="py-2 px-3 text-right font-medium">% CAC</th>
                <th className="py-2 px-3 text-right font-medium">Aud. % used</th>
                <th className="py-2 px-3 text-right font-medium">Aud. remaining</th>
                <th className="py-2 pl-3 text-right font-medium">Retention</th>
              </tr>
            </thead>
            <tbody>
              {data.customers.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    className={`cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
                      key === selectedKey ? "bg-gray-50" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-3">
                      <HealthDot badge={row.health.badge} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-gray-900">{customerLabel(row, names)}</div>
                      {row.ownerEmail && <div className="text-xs text-gray-400">{row.ownerEmail}</div>}
                      {row.brandDomain && <div className="text-xs text-gray-400">{row.brandDomain}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">{goalLabel(row.optimizationGoal)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{usd(row.currentEconomics.currentCacUsd)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{usd(row.breakevenCacUsd)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-900">{roi(row.currentEconomics.roiMultiple)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{pct(row.currentEconomics.cacPct)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{pct(row.audiences.pctUsed)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{count(row.audiences.totalRemaining)}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-gray-950">
                      {row.retentionWeeks === null ? DASH : `${row.retentionWeeks}w`}
                    </td>
                  </tr>
                );
              })}
              {data.customers.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-sm text-gray-400">
                    No customers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selected && <RightPanel row={selected} names={names} onClose={() => setSelectedKey(null)} />}
      </div>
    </section>
  );
}

// ── View ─────────────────────────────────────────────────────────────────────

export function CustomerSuccessView() {
  const { data, isPending, isError, error } = useAuthQuery<CustomerSuccessBoard>(
    ["customerSuccess"],
    () => getCustomerSuccess(),
    pollOptionsSlower,
  );

  const s = data?.stats;

  if (isError) {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm font-medium text-red-700">Couldn&apos;t load the customer success board.</p>
        <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Customers" value={s ? count(s.totalCustomers) : DASH} detail="Ever-active org x brand" accent="bg-brand-500" pending={isPending} />
        <StatCard label="Active" value={s ? count(s.activeCount) : DASH} detail="Budgeted, funded, not paused" accent="bg-emerald-500" pending={isPending} />
        <StatCard label="Paused" value={s ? count(s.pausedCount) : DASH} detail="Held, not spending" accent="bg-amber-500" pending={isPending} />
        <StatCard label="Inactive" value={s ? count(s.inactiveCount) : DASH} detail="No budget or funds" accent="bg-gray-500" pending={isPending} />
        <HealthCountCard green={s?.greenCount ?? 0} yellow={s?.yellowCount ?? 0} red={s?.redCount ?? 0} pending={isPending} />
      </section>

      {isPending ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton className="h-64 w-full rounded" />
        </section>
      ) : data ? (
        <CustomerTable data={data} />
      ) : null}
    </>
  );
}
