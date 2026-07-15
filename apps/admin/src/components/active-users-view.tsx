"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getAuditAccounts, type AuditAccounts } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";

const num = (n: number) => n.toLocaleString("en-US");

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

  const s = data?.stats;

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

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">Active users over time</h2>
        <p className="mt-1 text-sm text-gray-500">
          Monthly, weekly, and daily active users with growth rates.
        </p>
        <div className="mt-5 flex h-[220px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-6 text-center text-sm text-gray-400">
          Historical active-user trend is being wired from features-service and will appear here.
        </div>
      </section>
    </>
  );
}
