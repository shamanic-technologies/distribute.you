"use client";

import { Skeleton } from "@/components/skeleton";
import type {
  FeaturePersonaStatsResponse,
  FeaturePersonaStatsSortMetric,
  FeaturePersonaStatsRow,
  PersonaWire,
} from "@/lib/api";

function formatCents(cents: number | null): string {
  if (cents == null) return "-";
  if (cents <= 0) return "$0.00";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function metricLabel(metric: FeaturePersonaStatsSortMetric): string {
  return metric === "cpc" ? "CPC" : "CPPR";
}

function metricInfo(metric: FeaturePersonaStatsSortMetric): string {
  return metric === "cpc"
    ? "Cost per click — persona-scoped spend divided by website clicks. Lower is better."
    : "Cost per positive reply — persona-scoped spend divided by positive replies. Lower is better.";
}

function InfoHint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center align-middle">
      <svg
        className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 w-56 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function TopPersonasCard({
  data,
  personas = [],
  pending = false,
  metric,
}: {
  data?: FeaturePersonaStatsResponse;
  personas?: PersonaWire[];
  pending?: boolean;
  metric: FeaturePersonaStatsSortMetric;
}) {
  const statsRows = (data?.personas ?? []).slice(0, 3);
  const seenPersonaIds = new Set(
    statsRows.flatMap((row) => [row.customerProfileId, row.persona.id]),
  );
  const fallbackRows = personas
    .filter((persona) => !seenPersonaIds.has(persona.id))
    .slice(0, Math.max(0, 3 - statsRows.length));
  const rows: Array<
    | { kind: "stats"; row: FeaturePersonaStatsRow }
    | { kind: "persona"; persona: PersonaWire }
  > = [
    ...statsRows.map((row) => ({ kind: "stats" as const, row })),
    ...fallbackRows.map((persona) => ({ kind: "persona" as const, persona })),
  ];
  const activeMetric = data?.sortMetric ?? metric;
  const label = metricLabel(activeMetric);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 personas</p>
        <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
          {label}
          <InfoHint text={metricInfo(activeMetric)} />
        </p>
      </div>

      {pending ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))
      ) : (
        rows.map((item, index) => {
          const isStats = item.kind === "stats";
          const name = isStats ? item.row.persona.name : item.persona.name;
          const key = isStats ? item.row.customerProfileId : item.persona.id;
          const value = isStats
            ? activeMetric === "cpc"
              ? item.row.metrics.cpcCents
              : item.row.metrics.cpprCents
            : null;
          const count = isStats
            ? activeMetric === "cpc"
              ? `${item.row.evidence.websiteClicks.toLocaleString("en-US")} clicks`
              : `${item.row.evidence.positiveReplies.toLocaleString("en-US")} replies`
            : "-";
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700">{name}</span>
                <span className="block truncate text-[11px] text-gray-400">{count}</span>
              </span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">{formatCents(value)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
