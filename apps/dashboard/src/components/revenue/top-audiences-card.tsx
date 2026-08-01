"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { costSoFarFloorCents } from "@/lib/cost-so-far-floor";
import { useSharePathPrefix } from "@/components/share/share-mode-context";
import {
  AUDIENCE_RANK_METRIC_INFO,
  AUDIENCE_RANK_METRIC_LABEL,
  AUDIENCE_RANK_METRIC_OUTCOME_NOUN,
  type AudienceRankMetric,
} from "@/lib/strategy-model";
import type {
  FeatureAudienceStatsResponse,
  FeatureAudienceStatsRow,
  AudienceWire,
} from "@/lib/api";

function formatCents(cents: number | null): string {
  if (cents == null) return "-";
  if (cents <= 0) return "<$0.01";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  // <$10 → cents ($X.XX), ≥$10 → whole dollars ($X). Dashboard-wide rule.
  const decimals = usd < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** The row's cost under the brand's own metric. Mirrors the Audiences table's `sortValue`,
 *  floor included — a 0-reply audience with real spend shows what it has cost so far rather
 *  than a blank that hides money. Every value is read verbatim from a server field. */
function metricCents(metric: AudienceRankMetric, row: FeatureAudienceStatsRow): number | null {
  switch (metric) {
    case "cppr":
      return costSoFarFloorCents(
        row.metrics.cpprCents,
        row.evidence.totalCostInUsdCents,
        row.evidence.positiveReplies,
      );
    case "cps":
      return row.metrics.cpsCents ?? null;
    case "cpfs":
      return row.metrics.cpfsCents ?? null;
    case "cpsale":
      return row.metrics.cpsaleCents ?? null;
    case "cpc":
      return row.metrics.cpcCents;
  }
}

/** The outcome count the metric divides by. Absent on the wire (the producer omits an
 *  outcome that is not this goal's) → null, so the line is dropped rather than faked as 0. */
function metricCount(metric: AudienceRankMetric, row: FeatureAudienceStatsRow): number | null {
  switch (metric) {
    case "cppr":
      return row.evidence.positiveReplies;
    case "cps":
      return row.evidence.signups ?? null;
    case "cpfs":
      return row.evidence.formSubmissions ?? null;
    case "cpsale":
      return row.evidence.sales ?? null;
    case "cpc":
      return row.evidence.websiteClicks;
  }
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
  metric: AudienceRankMetric;
}) {
  // The column is the brand's own — NOT `data.sortMetric`. features-service classes
  // websitePurchase / sales as reply-driven and returns `cppr` for them, which printed
  // "CPPR / 0 replies" on a goal whose funnel has no reply step, next to an Audiences page
  // that hides the reply columns for that same brand. The dashboard decides here, and the
  // rows are re-sorted below so the card never shows one field while ordering by another.
  const statsRows = [...(data?.audiences ?? [])]
    .sort((a, b) => {
      const av = metricCents(metric, a);
      const bv = metricCents(metric, b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv;
    })
    .slice(0, 3);
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
  const label = AUDIENCE_RANK_METRIC_LABEL[metric];

  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // Keeps in-app links inside the public share tree; empty in the dashboard.
  const pathPrefix = useSharePathPrefix();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 audiences</p>
        <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
          {label}
          <InfoTooltip tip={AUDIENCE_RANK_METRIC_INFO[metric]} placement="bottom" />
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
          const value = isStats ? metricCents(metric, item.row) : null;
          const outcomes = isStats ? metricCount(metric, item.row) : null;
          const count =
            outcomes == null
              ? null
              : `${outcomes.toLocaleString("en-US")} ${AUDIENCE_RANK_METRIC_OUTCOME_NOUN[metric]}`;
          return (
            <Link
              key={key}
              href={`${pathPrefix}/orgs/${orgId}/brands/${brandId}/audiences?audienceId=${key}`}
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
