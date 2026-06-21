"use client";

import { Skeleton } from "@/components/skeleton";
import type {
  FeatureAudienceStatsResponse,
  FeatureAudienceStatsSortMetric,
  FeatureAudienceStatsRow,
  AudienceWire,
} from "@/lib/api";

function formatCents(cents: number | null): string {
  if (cents == null) return "-";
  if (cents <= 0) return "<$0.01";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function metricLabel(metric: FeatureAudienceStatsSortMetric): string {
  return metric === "cpc" ? "CPC" : "CPPR";
}

function metricInfo(metric: FeatureAudienceStatsSortMetric): string {
  return metric === "cpc"
    ? "Cost per click — audience-scoped spend divided by website clicks. Lower is better."
    : "Cost per positive reply — audience-scoped spend divided by positive replies. Lower is better.";
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

function audienceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

function TopAudienceAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full border border-gray-200 bg-white object-cover"
      />
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-100 bg-brand-50 text-[10px] font-semibold text-brand-700">
      {audienceInitials(name)}
    </span>
  );
}

export function TopAudiencesCard({
  data,
  audiences = [],
  pending = false,
  metric,
}: {
  data?: FeatureAudienceStatsResponse;
  audiences?: AudienceWire[];
  pending?: boolean;
  metric: FeatureAudienceStatsSortMetric;
}) {
  const statsRows = (data?.audiences ?? []).slice(0, 3);
  const seenAudienceIds = new Set(
    statsRows.flatMap((row) => [row.audienceId, row.audience.id]),
  );
  const fallbackRows = audiences
    .filter((audience) => !seenAudienceIds.has(audience.id))
    .slice(0, Math.max(0, 3 - statsRows.length));
  const rows: Array<
    | { kind: "stats"; row: FeatureAudienceStatsRow }
    | { kind: "audience"; audience: AudienceWire }
  > = [
    ...statsRows.map((row) => ({ kind: "stats" as const, row })),
    ...fallbackRows.map((audience) => ({ kind: "audience" as const, audience })),
  ];
  const activeMetric = data?.sortMetric ?? metric;
  const label = metricLabel(activeMetric);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 audiences</p>
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
        rows.map((item) => {
          const isStats = item.kind === "stats";
          const name = isStats ? item.row.audience.name : item.audience.name;
          const key = isStats ? item.row.audienceId : item.audience.id;
          const avatarUrl = isStats ? item.row.audience.avatarUrl : item.audience.avatarUrl;
          const value = isStats
            ? activeMetric === "cpc"
              ? item.row.metrics.cpcCents
              : item.row.metrics.cpprCents
            : null;
          const count = isStats
            ? activeMetric === "cpc"
              ? `${item.row.evidence.websiteClicks.toLocaleString("en-US")} clicks`
              : `${item.row.evidence.positiveReplies.toLocaleString("en-US")} replies`
            : null;
          return (
            <div key={key} className="flex items-center gap-2">
              <TopAudienceAvatar name={name} avatarUrl={avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700">{name}</span>
                {count && (
                  <span className="block truncate text-[11px] text-gray-400">{count}</span>
                )}
              </span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">{formatCents(value)}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
