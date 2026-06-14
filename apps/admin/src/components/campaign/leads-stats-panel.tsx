"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchFeatureStats,
  type BreakdownSegment,
  type StatsRegistry,
} from "@/lib/api";
import { formatStatValue } from "@/lib/format-stat";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { Skeleton } from "@/components/skeleton";

const PIPELINE_KEYS = ["leadsClaimed", "leadsBuffered", "leadsSkipped"] as const;

const OUTREACH_KEYS = [
  "leadsContacted",
  "leadsDelivered",
  "leadsOpened",
  "leadsClicked",
  "leadsBounced",
  "leadsUnsubscribed",
] as const;

const RATE_KEYS = ["leadOpenRate", "leadClickRate", "leadPositiveReplyRate"] as const;

const COST_KEYS = [
  "costPerLeadOpenCents",
  "costPerLeadClickCents",
  "costPerLeadPositiveReplyCents",
] as const;

const REPLY_AGGREGATE_SEGMENTS: BreakdownSegment[] = [
  { key: "leadsRepliesPositive", color: "green", sentiment: "positive" },
  { key: "leadsRepliesNeutral", color: "gray", sentiment: "neutral" },
  { key: "leadsRepliesNegative", color: "red", sentiment: "negative" },
  { key: "leadsRepliesAutoReply", color: "blue", sentiment: "neutral" },
];

const REPLY_DETAIL_KEYS = [
  "leadsRepliesInterested",
  "leadsRepliesMeetingBooked",
  "leadsRepliesClosed",
  "leadsRepliesNotInterested",
  "leadsRepliesWrongPerson",
  "leadsRepliesUnsubscribeDetail",
  "leadsRepliesNeutralDetail",
  "leadsRepliesAutoReplyDetail",
  "leadsRepliesOutOfOffice",
] as const;

interface LeadsStatsPanelProps {
  featureSlug: string;
  campaignId: string;
  pending?: boolean;
}

export function LeadsStatsPanel({
  featureSlug,
  campaignId,
  pending = false,
}: LeadsStatsPanelProps) {
  const { registry } = useFeatures();

  const { data, isPending } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId, "leads-panel"],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    {
      refetchInterval: 5_000,
      placeholderData: keepPreviousData,
    },
  );

  const stats: Record<string, number> = data?.stats ?? {};
  const loading = pending || (isPending && !data);

  return (
    <div data-testid="leads-stats-panel" className="space-y-4">
      <Section title="Pipeline" keys={PIPELINE_KEYS} stats={stats} registry={registry} pending={loading} />
      <Section title="Outreach" keys={OUTREACH_KEYS} stats={stats} registry={registry} pending={loading} />
      <Section title="Rates" keys={RATE_KEYS} stats={stats} registry={registry} pending={loading} />

      <ReplyBreakdown
        segments={REPLY_AGGREGATE_SEGMENTS}
        stats={stats}
        registry={registry}
        pending={loading}
      />

      <details className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <summary className="font-medium text-gray-800 cursor-pointer">
          Replies — granular
        </summary>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {REPLY_DETAIL_KEYS.map((k) => (
            <Tile key={k} statKey={k} stats={stats} registry={registry} pending={loading} />
          ))}
        </div>
      </details>

      <Section
        title="Cost per outcome"
        keys={COST_KEYS}
        stats={stats}
        registry={registry}
        pending={loading}
      />
    </div>
  );
}

function Section({
  title,
  keys,
  stats,
  registry,
  pending,
}: {
  title: string;
  keys: readonly string[];
  stats: Record<string, number>;
  registry: StatsRegistry;
  pending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="font-medium text-gray-800 mb-4">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {keys.map((k) => (
          <Tile key={k} statKey={k} stats={stats} registry={registry} pending={pending} />
        ))}
      </div>
    </div>
  );
}

function Tile({
  statKey,
  stats,
  registry,
  pending,
}: {
  statKey: string;
  stats: Record<string, number>;
  registry: StatsRegistry;
  pending?: boolean;
}) {
  const entry = registry[statKey];
  const label = entry?.label ?? statKey;
  const value = stats[statKey];

  if (!entry && !pending) {
    console.error(
      `[dashboard] LeadsStatsPanel: stats key "${statKey}" missing from features-service registry; rendering raw key. Add it to STATS_REGISTRY.`,
    );
  }

  const display = formatStatValue(typeof value === "number" ? value : 0, entry);

  return (
    <div
      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
      data-testid={`stat-${statKey}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      {pending ? (
        <Skeleton className="h-6 w-12" />
      ) : (
        <p className="text-lg font-semibold text-gray-800">{display}</p>
      )}
    </div>
  );
}
