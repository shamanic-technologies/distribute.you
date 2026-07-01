"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getAuditAccounts, type AuditAccounts, type AuditAccountRow } from "@/lib/api";
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
  return clerk || row.brandDomain || row.ownerEmail || "—";
}

function StatusCell({ row }: { row: AuditAccountRow }) {
  if (row.status === "active" && row.dailyBudgetUsd != null) {
    return (
      <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700">
        {usd2(row.dailyBudgetUsd)}/day
      </span>
    );
  }
  if (row.status === "paused") {
    // Paused keeps a budget but isn't spending — show the held amount for context.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        Paused
        {row.dailyBudgetUsd != null && row.dailyBudgetUsd > 0 && (
          <span className="font-medium tabular-nums text-amber-600">· {usd2(row.dailyBudgetUsd)}/day</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      Inactive
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

  // Rank active → paused → inactive; within a bucket by daily budget desc — the
  // money-carrying accounts lead, paused (held budget) next, inactive last.
  const rows = useMemo(() => {
    const rank = (s: AuditAccountRow["status"]) => (s === "active" ? 0 : s === "paused" ? 1 : 2);
    const list = [...(data?.rows ?? [])];
    list.sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return (b.dailyBudgetUsd ?? 0) - (a.dailyBudgetUsd ?? 0);
    });
    return list;
  }, [data]);

  const s = data?.stats;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Accounts</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every customer account across the fleet, cross-org. Active means the brand isn&apos;t
          paused, has a daily budget, and the org holds enough credit to fund at least one more
          day. Paused is a brand explicitly held (keeps its budget, not spending). Unbudgeted or
          short on credit shows as inactive. Total daily budget, MRR, and ARR count active
          accounts only.
        </p>
      </div>

      {isError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load accounts.</p>
          <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="Total daily budget"
              value={s ? usd0(s.totalDailyBudgetUsd) : "—"}
              sub="active accounts"
              pending={isPending}
            />
            <StatCard
              label="MRR"
              value={s ? usd0(s.mrrUsd) : "—"}
              sub="daily budget × 30"
              pending={isPending}
            />
            <StatCard
              label="ARR"
              value={s ? usd0(s.arrUsd) : "—"}
              sub="daily budget × 365"
              pending={isPending}
            />
            <StatCard
              label="Active accounts"
              value={s ? num(s.activeCount) : "—"}
              sub="sending now"
              pending={isPending}
            />
            <StatCard
              label="Paused"
              value={s?.pausedCount != null ? num(s.pausedCount) : "—"}
              sub="held, not spending"
              pending={isPending}
            />
            <StatCard
              label="Total accounts"
              value={s ? num(s.totalCount) : "—"}
              sub={s ? `${num(s.inactiveCount)} inactive` : undefined}
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
                        <th className="py-2 pl-4 text-right font-medium">Brand status</th>
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
                          <td className="py-2.5 pr-4 text-gray-700">{r.ownerEmail ?? "—"}</td>
                          <td className="py-2.5 px-4 text-gray-700">{orgLabel(r, names)}</td>
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-gray-900">{r.brandName ?? r.brandDomain ?? "—"}</div>
                            {r.brandName && r.brandDomain && (
                              <div className="text-xs text-gray-400">{r.brandDomain}</div>
                            )}
                          </td>
                          <td className="py-2.5 pl-4 text-right">
                            <StatusCell row={r} />
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
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
