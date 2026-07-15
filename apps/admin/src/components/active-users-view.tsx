"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getAuditAccounts,
  getActiveUsersHistory,
  getActiveUsersByUser,
  type AuditAccounts,
  type ActiveUsersBucket,
  type ActiveUsersHistory,
  type ActiveUsersByUser,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { PeriodCompoundChart, type PeriodCompoundPoint } from "@/components/period-compound-chart";
import { CmgrStat } from "@/components/cmgr-stat";
import { compoundGrowthSeries, compoundGrowthSummary } from "@/lib/compound-growth";
import { ActiveUsersTable } from "@/components/active-users-table";

const num = (n: number) => n.toLocaleString("en-US");

function bucketLabel(periodStart: string, granularity: "month" | "week"): string {
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    ...(granularity === "month"
      ? { month: "short", year: "numeric" }
      : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  });
}

/**
 * Map active-user buckets to compound-growth points. CMGR/CWGR is computed
 * client-side from the served per-period `activeUsers` values (mirrors the
 * signups view; no backend change).
 */
function toCompoundPoints(buckets: ActiveUsersBucket[], granularity: "month" | "week"): PeriodCompoundPoint[] {
  const cmgr = compoundGrowthSeries(buckets.map((b) => b.activeUsers));
  return buckets.map((b, i) => ({
    label: bucketLabel(b.periodStart, granularity),
    value: b.activeUsers,
    cmgrPct: cmgr[i],
  }));
}

function StatCard({
  label,
  value,
  detail,
  accent,
  pending,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-20 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

export function ActiveUsersView() {
  const { data, isPending, isError, error } = useAuthQuery<AuditAccounts>(
    ["auditAccounts"],
    () => getAuditAccounts(),
    pollOptionsSlower,
  );

  // An active user = a distinct org with at least one ACTIVE brand (not paused,
  // budget > 0, org credit funds the next day — the existing accounts verdict).
  const derived = useMemo(() => {
    const rows = data?.rows ?? [];
    const activeOrgs = new Set<string>();
    const allOrgs = new Set<string>();
    for (const row of rows) {
      allOrgs.add(row.orgId);
      if (row.status === "active") activeOrgs.add(row.orgId);
    }
    return { activeUsers: activeOrgs.size, totalOrgs: allOrgs.size };
  }, [data]);

  const {
    data: history,
    isPending: historyPending,
    isError: historyError,
    error: historyErr,
  } = useAuthQuery<ActiveUsersHistory>(["activeUsersHistory"], () => getActiveUsersHistory(), pollOptionsSlower);

  const {
    data: byUser,
    isPending: byUserPending,
    isError: byUserError,
    error: byUserErr,
  } = useAuthQuery<ActiveUsersByUser>(["activeUsersByUser"], () => getActiveUsersByUser(), pollOptionsSlower);

  const s = data?.stats;

  const monthlyPoints = toCompoundPoints(history?.monthly ?? [], "month");
  const weeklyPoints = toCompoundPoints(history?.weekly ?? [], "week");
  const monthlyCmgr = compoundGrowthSummary(monthlyPoints.map((p) => p.cmgrPct));
  const weeklyCmgr = compoundGrowthSummary(weeklyPoints.map((p) => p.cmgrPct));

  if (isError) {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm font-medium text-red-700">Couldn&apos;t load active users.</p>
        <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Active users"
          value={num(derived.activeUsers)}
          detail="Orgs with ≥1 active brand"
          accent="bg-brand-500"
          pending={isPending}
        />
        <StatCard
          label="Active brands"
          value={s ? num(s.activeCount) : "—"}
          detail="Not paused, budgeted, funded"
          accent="bg-emerald-500"
          pending={isPending}
        />
        <StatCard
          label="Paused brands"
          value={s ? num(s.pausedCount) : "—"}
          detail="Held, not spending"
          accent="bg-amber-500"
          pending={isPending}
        />
        <StatCard
          label="Total orgs"
          value={num(derived.totalOrgs)}
          detail={s ? `${num(s.inactiveCount)} inactive brands` : "Across the fleet"}
          accent="bg-gray-500"
          pending={isPending}
        />
      </section>

      {historyError ? (
        <section className="rounded-lg border border-red-200 bg-white p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load active-user history.</p>
          <p className="mt-1 text-xs text-red-500">{historyErr?.message ?? "Unknown error"}</p>
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-950">Monthly active users</h2>
            <p className="mt-1 text-sm text-gray-500">Active users per month with compound monthly growth since inception.</p>
            {!historyPending && (
              <div className="mt-4">
                <CmgrStat latestPct={monthlyCmgr.latestPct} avgPct={monthlyCmgr.avgPct} label="CMGR" unit="monthly" />
              </div>
            )}
            <div className="mt-5">
              {historyPending ? (
                <Skeleton className="h-[280px] w-full rounded" />
              ) : (
                <PeriodCompoundChart data={monthlyPoints} valueLabel="active users" growthLabel="CMGR since inception" />
              )}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-950">Weekly active users</h2>
            <p className="mt-1 text-sm text-gray-500">Active users per week with compound weekly growth since inception.</p>
            {!historyPending && (
              <div className="mt-4">
                <CmgrStat latestPct={weeklyCmgr.latestPct} avgPct={weeklyCmgr.avgPct} label="CWGR" unit="weekly" />
              </div>
            )}
            <div className="mt-5">
              {historyPending ? (
                <Skeleton className="h-[280px] w-full rounded" />
              ) : (
                <PeriodCompoundChart data={weeklyPoints} valueLabel="active users" growthLabel="CWGR since inception" />
              )}
            </div>
          </div>
        </section>
      )}

      {byUserError ? (
        <section className="rounded-lg border border-red-200 bg-white p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load users.</p>
          <p className="mt-1 text-xs text-red-500">{byUserErr?.message ?? "Unknown error"}</p>
        </section>
      ) : byUserPending ? (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <Skeleton className="h-64 w-full rounded" />
        </section>
      ) : byUser ? (
        <ActiveUsersTable data={byUser} accounts={data ?? null} />
      ) : null}
    </>
  );
}
