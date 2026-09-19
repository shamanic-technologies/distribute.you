"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getInstantlyReconcile, type InstantlyReconcile } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Section, utc } from "@/components/cold-email/primitives";

/**
 * Our local count against Instantly's, per countable fact. Moved verbatim from
 * the old `/audit/instantly` page; the legacy `reconcile` read is unchanged.
 */
function fmtDelta(delta: number): string {
  const abs = String(Math.round(Math.abs(delta)));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `-${abs}`;
  return "0";
}

export function ReconcileSection() {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyReconcile>(
    ["instantlyReconcile"],
    () => getInstantlyReconcile(),
    pollOptionsSlower,
  );

  const driftCount = data?.metrics.filter((m) => m.delta !== 0).length ?? 0;
  const num = (n: number) => String(Math.round(n));

  return (
    <Section
      title="Reconciliation vs Instantly"
      blurb="Our local count against Instantly's count for each fact. Instantly is the source of truth, so any non-zero delta is drift to investigate (lost webhook, lagging reconcile, missed pause)."
      isPending={isPending}
      isError={isError}
      error={error}
      action={
        !isPending && !isError ? (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
              driftCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {driftCount > 0
              ? `${num(driftCount)} metric${driftCount === 1 ? "" : "s"} drifting`
              : "All in sync"}
          </span>
        ) : undefined
      }
    >
      {data && (
        <div className="overflow-x-auto">
          <table className="min-w-[480px] w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 px-4 text-right font-medium">Local</th>
                <th className="py-2 px-4 text-right font-medium">Instantly</th>
                <th className="py-2 pl-4 text-right font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m) => {
                const drift = m.delta !== 0;
                return (
                  <tr
                    key={m.key}
                    className={`border-b border-gray-100 last:border-0 ${drift ? "bg-amber-50" : ""}`}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{m.label}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{num(m.local)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                      {num(m.instantly)}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          drift ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {fmtDelta(m.delta)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-400">
            As of {utc(data.asOf)}. Delta is local minus Instantly.
          </p>
        </div>
      )}
    </Section>
  );
}
