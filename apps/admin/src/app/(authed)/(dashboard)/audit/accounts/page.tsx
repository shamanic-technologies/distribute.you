"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getAuditAccounts,
  type AuditAccounts,
  type AuditAccountRow,
  type AuditAccountStatus,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";

function StatCard({
  label,
  value,
  sub,
  pending,
}: {
  label: string;
  value: string;
  sub?: string;
  pending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-24 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      )}
      {sub && !pending && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

const usd0 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US");

/**
 * Resolve the Clerk display name for every org referenced by the rows. Org names
 * live only in Clerk (client-service `orgs.name` is null), so the accounts payload
 * carries `orgExternalId` and we batch-resolve the names here. Small N (active
 * fleet). Falls back to the brand domain / owner email when a name is absent.
 */
function useOrgNames(rows: AuditAccountRow[] | undefined) {
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) if (r.orgExternalId) set.add(r.orgExternalId);
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

function orgLabel(row: AuditAccountRow, names: Record<string, string>): string {
  const clerk = row.orgExternalId ? names[row.orgExternalId] : undefined;
  return clerk || row.brandDomain || row.ownerEmail || "-";
}

const STATUS_LABEL: Record<AuditAccountStatus, string> = {
  active: "Active",
  payment_declined: "Payment declined",
  no_payment_method: "No card",
  reactive_only: "Reactive only",
  paused: "Paused",
  inactive: "Inactive",
};

const STATUS_PILL: Record<AuditAccountStatus, string> = {
  active: "bg-emerald-50 text-emerald-700",
  payment_declined: "bg-red-50 text-red-700",
  no_payment_method: "bg-red-50 text-red-700",
  reactive_only: "bg-sky-50 text-sky-700",
  paused: "bg-amber-50 text-amber-700",
  inactive: "bg-gray-100 text-gray-500",
};

function StatusCell({ row }: { row: AuditAccountRow }) {
  // Label read straight off the served status: the verdict is features-service's, never re-derived here.
  const reason = row.status === "payment_declined" ? row.paymentDeclinedReason : null;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_PILL[row.status] ?? STATUS_PILL.inactive}`}
      title={reason ? reason.replace(/_/g, " ") : undefined}
    >
      {STATUS_LABEL[row.status] ?? row.status}
    </span>
  );
}

/** A daily figure; zero is drawn muted so the running money reads first. */
function PerDay({ usd, sub }: { usd: number; sub?: string }) {
  return (
    <span className={`tabular-nums ${usd > 0 ? "font-medium text-gray-900" : "text-gray-400"}`}>
      {usd2(usd)}/day
      {sub && <span className="block text-xs font-normal text-gray-400">{sub}</span>}
    </span>
  );
}

export default function AuditAccountsPage() {
  const { data, isPending, isError, error } = useAuthQuery<AuditAccounts>(
    ["auditAccounts"],
    () => getAuditAccounts(),
    pollOptionsSlower,
  );

  const names = useOrgNames(data?.rows);

  // Rows render in the SERVED order (active, payment declined, no card, reactive only, paused,
  // inactive, then running budget desc): features-service owns it, the page never re-sorts.
  const rows = data?.rows ?? [];

  const s = data?.stats;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every customer account across the fleet, cross-org. Proactive campaigns (cold email)
          start conversations and spend the daily budget. Reactive campaigns (AI meeting booking)
          only act on a conversation that already exists, so they carry a cap that is rarely spent.
          Active means a proactive campaign is running and the org can fund another day of it.
          Reactive only means every proactive campaign is stopped and a reactive one is still on.
          Paused means money is posted with nothing running. Running budget, MRR and ARR count
          proactive money on active accounts only.
        </p>
      </div>

      {isError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load accounts.</p>
          <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Proactive running / day"
              value={s ? usd0(s.totalRunningDailyBudgetUsd) : "-"}
              sub={
                s && s.totalConfiguredDailyBudgetUsd > s.totalRunningDailyBudgetUsd
                  ? `active accounts, ${usd0(s.totalConfiguredDailyBudgetUsd)} posted`
                  : "active accounts"
              }
              pending={isPending}
            />
            <StatCard
              label="Reactive cap / day"
              value={s ? usd0(s.totalReactiveRunningDailyCapUsd) : "-"}
              sub="a cap, rarely spent, not in running"
              pending={isPending}
            />
            <StatCard
              label="MRR"
              value={s ? (s.mrrUsd === null ? "Not measured" : usd0(s.mrrUsd)) : "-"}
              sub="recurring customers, from billing"
              pending={isPending}
            />
            <StatCard
              label="ARR"
              value={s ? (s.arrUsd === null ? "Not measured" : usd0(s.arrUsd)) : "-"}
              sub="MRR × 12"
              pending={isPending}
            />
            <StatCard
              label="Active accounts"
              value={s ? num(s.activeCount) : "-"}
              sub="proactive running now"
              pending={isPending}
            />
            <StatCard
              label="Reactive only"
              value={s ? num(s.reactiveOnlyCount) : "-"}
              sub="no proactive campaign on"
              pending={isPending}
            />
            <StatCard
              label="Paused"
              value={s?.pausedCount != null ? num(s.pausedCount) : "-"}
              sub="held, not spending"
              pending={isPending}
            />
            <StatCard
              label="Total accounts"
              value={s ? num(s.totalCount) : "-"}
              sub={
                s
                  ? `${num(s.paymentDeclinedCount + s.noPaymentMethodCount)} payment issue, ${num(s.inactiveCount)} inactive`
                  : undefined
              }
              pending={isPending}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Accounts</h2>
            <div className="mt-4">
              {isPending ? (
                <Skeleton className="h-64 w-full rounded" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[640px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-4 font-medium">User</th>
                        <th className="py-2 px-4 font-medium">Org</th>
                        <th className="py-2 px-4 font-medium">Brand</th>
                        <th className="py-2 px-4 text-right font-medium">Proactive / day</th>
                        <th className="py-2 px-4 text-right font-medium">Reactive cap / day</th>
                        <th className="py-2 pl-4 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={`${r.orgId}:${r.brandId}`}
                          className={`border-b border-gray-100 last:border-0 ${
                            r.status === "inactive" ? "text-gray-400" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-4 text-gray-700">{r.ownerEmail ?? "-"}</td>
                          <td className="py-2.5 px-4 text-gray-700">{orgLabel(r, names)}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-gray-900">{r.brandName ?? r.brandDomain ?? "-"}</div>
                            {r.brandName && r.brandDomain && (
                              <div className="text-xs text-gray-400">{r.brandDomain}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <PerDay
                              usd={r.proactiveRunningDailyBudgetUsd}
                              sub={
                                r.configuredDailyBudgetUsd > r.proactiveRunningDailyBudgetUsd
                                  ? `${usd2(r.configuredDailyBudgetUsd)} posted`
                                  : undefined
                              }
                            />
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <PerDay usd={r.reactiveRunningDailyCapUsd} />
                          </td>
                          <td className="py-2.5 pl-4 text-right">
                            <StatusCell row={r} />
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-sm text-gray-400">
                            No accounts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {data && (
                    <p className="mt-3 text-xs text-gray-400">
                      As of {new Date(data.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
