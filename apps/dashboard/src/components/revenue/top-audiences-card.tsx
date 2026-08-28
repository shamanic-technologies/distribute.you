"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { tenantBasePath } from "@/lib/offer-path";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { costSoFarFloorCents } from "@/lib/cost-so-far-floor";
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
import { formatRoi } from "@/lib/format-roi";
import { LearningTag } from "@/components/learning-tag";
import { isLearning, LEARNING_NOTE } from "@/lib/learning-threshold";
import { audienceLearningFor } from "@/lib/use-audience-learning";

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

/**
 * What an audience RETURNS per dollar, when features-service can project it.
 *
 * This is what a BRAND-scoped card leads with, and it is a different question from the
 * cost column it replaced: cost per outcome ranks audiences by CHEAPNESS, so an audience
 * that converts to nothing outranks an expensive one that pays. At brand level, rank on
 * the return; null (unmeasurable, or a producer that predates it) prints "-", since a
 * brand runs several funnels and has no single step to fall back to.
 *
 * A CAMPAIGN-scoped card never reads it: a campaign buys one outcome and is judged on
 * what that outcome costs.
 */
function returnPerDollar(row: FeatureAudienceStatsRow): number | null {
  return row.projection?.returnPerDollar ?? null;
}

const RETURN_INFO =
  "Dollars of customer lifetime revenue projected per dollar spent on this audience, using the conversion rates and lifetime revenue set in Brand Settings. Ranked highest first: this is where more budget is worth putting. It is a projection from what each audience has produced so far, not money already collected.";

function formatReturn(multiple: number | null): string {
  return formatRoi(multiple, "-");
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
  campaignScoped = false,
  campaignId,
  learningByAudienceId,
  learningSettled = false,
}: {
  data?: FeatureAudienceStatsResponse;
  audiences?: AudienceWire[];
  pending?: boolean;
  /**
   * The cost column a CAMPAIGN-scoped card LEADS with — its own funnel's outcome, which
   * is the thing the campaign is run to make cheaper.
   *
   * Absent at BRAND level: there is no goal there to derive one from, and it would be one
   * funnel's step on a surface that sums several anyway. Without it the card ranks on the
   * return and prints "-" for a row that has none.
   */
  metric?: AudienceRankMetric;
  /** Set on the campaign Overview, which sells exactly one funnel. */
  campaignScoped?: boolean;
  /**
   * The campaign a row belongs to, when this card is on one. A row opens the audience
   * where the reader is standing: from a campaign, the campaign's own Audiences page,
   * so drilling into a row does not silently leave the campaign for the offer.
   * Absent at brand/offer grain, where the offer page is the audience's home.
   */
  campaignId?: string;
  /**
   * Which of the scope's audiences its campaigns have priced. An audience absent from the
   * map — the fan-out has not settled, or the scope runs no campaign — is "cannot tell"
   * and states its return as before.
   */
  learningByAudienceId?: Map<string, boolean>;
  learningSettled?: boolean;
}) {
  // The card answers "where should the money go", so it leads with RETURN per dollar —
  // highest first — whenever features-service can project it. Cost per outcome is the
  // fallback for a payload that carries no projection, and there the order flips to
  // cheapest-first. A card that displays one field while ordering by another reads as
  // unordered, so the sort and the value are the same expression in both branches.
  //
  // The cost column is the brand's own metric, NOT `data.sortMetric`: features-service
  // classes websitePurchase / sales as reply-driven and returns `cppr` for them, which
  // printed "CPPR / 0 replies" on a goal whose funnel has no reply step, next to an
  // Audiences page that hides the reply columns for that same brand.
  //
  // A cost per outcome (cost per sales interest, cost per visit) names ONE funnel's step,
  // and a brand runs several funnels at once — so on a BRAND surface it labels a sum with
  // one member's vocabulary. At brand level the card therefore states the return and
  // nothing else, even when the projection is missing (that row prints "-"). The campaign
  // Overview sells exactly one funnel, so its own step IS what it buys and the cost leads.
  const brandLevelMoney = !campaignScoped;
  // A RETURN answers a brand's question, not a campaign's. A campaign buys ONE outcome
  // and is run to make that outcome cheaper, so the number it is judged on is its cost
  // per outcome — the same column the Audiences table beneath it leads with. Ranking a
  // campaign's audiences on a projected return states a figure the campaign is not
  // optimizing for, beside a table that is. So the return leads at BRAND level and
  // nowhere else; a campaign card is cost-led even when every row carries a projection.
  const ranksByReturn = brandLevelMoney;
  const statsRows = [...(data?.audiences ?? [])]
    .sort((a, b) => {
      if (ranksByReturn || !metric) {
        const ar = returnPerDollar(a);
        const br = returnPerDollar(b);
        if (ar == null && br == null) return 0;
        if (ar == null) return 1;
        if (br == null) return -1;
        return br - ar;
      }
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
  const label = ranksByReturn || !metric ? "Return" : AUDIENCE_RANK_METRIC_LABEL[metric];
  const baseTip = ranksByReturn || !metric ? RETURN_INFO : AUDIENCE_RANK_METRIC_INFO[metric];
  // A row's own tag carries no (i): it sits inside the row's Link, and nesting an
  // interactive tooltip trigger there is both invalid-feeling and one more thing to
  // mis-tap. The header's existing (i) explains it instead, and only when a listed row
  // is actually learning.
  const anyLearning =
    !!metric && statsRows.some((row) => isLearning(metricCount(metric, row)));
  const tip = anyLearning ? `${baseTip} ${LEARNING_NOTE}` : baseTip;

  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // Present on the offer route, absent elsewhere — the link then stays the
  // brand-level one.
  const offerId = params.offerId as string | undefined;
  // Where an audience opens from HERE. A campaign-scoped card keeps the reader in the
  // campaign (its Audiences page states the same rows, narrowed to what this campaign
  // targets); everywhere else the offer's page is the audience's home.
  const tenantPath = tenantBasePath(orgId, brandId, offerId);
  const audiencesBasePath =
    campaignScoped && campaignId ? `${tenantPath}/campaigns/${campaignId}` : tenantPath;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 audiences</p>
        <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
          {label}
          <InfoTooltip tip={tip} placement="bottom" />
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
          const costCents = isStats && metric ? metricCents(metric, item.row) : null;
          const rowReturn = isStats ? returnPerDollar(item.row) : null;
          const outcomes = isStats && metric ? metricCount(metric, item.row) : null;
          // Too few outcomes behind this row's money to state either number: the return
          // and the cost are both that outcome count divided into things, so at one or
          // two replies they swing on the next one. The row says `Learning` in the value
          // slot and drops its cost subtitle entirely rather than printing a price with
          // a caveat. Only where there IS a metric to count (the campaign card) — at
          // brand level there is no single funnel whose outcomes to count.
          const rowLearning = isStats && !!metric && isLearning(outcomes);
          // The scope's own rule, one audience at a time: its return reads `Learning`
          // until one of the scope's campaigns has priced THIS audience. Same answer the
          // Audiences table gives for the same row, from the same map.
          const scopeLearning =
            !campaignScoped &&
            audienceLearningFor(learningByAudienceId ?? new Map(), key, learningSettled);
          // The second line carries what the headline cost DIVIDES BY, so a reader can see
          // how much evidence is behind the price. Never a value the row does not have —
          // and never at BRAND level, where the count is one funnel's vocabulary on a
          // surface that sums several.
          const subtitle =
            brandLevelMoney || !metric || rowLearning || outcomes == null
              ? null
              : `${outcomes.toLocaleString("en-US")} ${AUDIENCE_RANK_METRIC_OUTCOME_NOUN[metric]}`;
          return (
            <Link
              key={key}
              href={`${audiencesBasePath}/audiences?audienceId=${key}`}
              className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-gray-50"
            >
              <TopAudienceAvatar name={name} avatarUrl={avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700">{name}</span>
                {subtitle && (
                  <span className="block truncate text-[11px] text-gray-400">{subtitle}</span>
                )}
              </span>
              {rowLearning || scopeLearning ? (
                <LearningTag withInfo={false} />
              ) : (
                <span className="text-sm font-medium text-gray-800 tabular-nums">
                  {ranksByReturn ? formatReturn(rowReturn) : formatCents(costCents)}
                </span>
              )}
            </Link>
          );
        })
      )}
    </div>
  );
}
