"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
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
  // The audience-stats endpoint's nested `audience` object does not carry
  // avatarUrl, so resolve it from the AudienceWire list (which does) by id.
  const avatarById = new Map(audiences.map((audience) => [audience.id, audience.avatarUrl]));
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

  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 audiences</p>
        <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
          {label}
          <InfoTooltip tip={metricInfo(activeMetric)} placement="bottom" />
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
          const avatarUrl = isStats
            ? item.row.audience.avatarUrl ?? avatarById.get(item.row.audience.id) ?? null
            : item.audience.avatarUrl;
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
            <Link
              key={key}
              href={`/orgs/${orgId}/brands/${brandId}/audiences?audienceId=${key}`}
              className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50"
            >
              <TopAudienceAvatar name={name} avatarUrl={avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700">{name}</span>
                {count && (
                  <span className="block truncate text-[11px] text-gray-400">{count}</span>
                )}
              </span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">{formatCents(value)}</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
