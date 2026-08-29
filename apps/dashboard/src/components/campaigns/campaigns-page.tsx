"use client";

import type { ReactNode } from "react";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { tenantBasePath } from "@/lib/offer-path";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  getOfferRevenue,
  getBrandRevenue,
  getOfferFunnelRevenue,
  keepLastGoodFeatureRevenue,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { pollOptions } from "@/lib/query-options";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { Skeleton } from "@/components/skeleton";
import { CampaignsTable, useCampaignRows, fmtUsd } from "@/components/campaigns/campaigns-table";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { LearningTag } from "@/components/learning-tag";
import { ScopeLearningBand } from "@/components/campaigns/scope-learning-band";

// The table, its columns and the vocabulary behind them live in `campaigns-table.tsx`
// — the brand Overview renders the same one under its chart, and two copies is how a
// campaign comes to read one way here and another way there. What stays on this page
// is the header the table does not answer: the brand's blended pipeline and $ CAC, and
// which channel is currently winning.

function StatTile({
  label,
  value,
  pending,
  action,
}: {
  label: string;
  value: string;
  pending: boolean;
  /** Rendered in the VALUE's place (a `Learning` tag), never beside it: a figure printed
   *  next to a caveat reads as a figure with a footnote. */
  action?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Card label in the dashboard's own eyebrow: `text-xs font-medium
          text-gray-400 uppercase tracking-wide`, the same one `top-audiences-card`
          and `revenue-cost-summary` use. */}
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      {pending ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : action ? (
        <div className="mt-2">{action}</div>
      ) : (
        <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  );
}

export function CampaignsPage() {
  const params = useParams();
  const orgId = String(params.orgId);
  const brandId = String(params.brandId);
  // The Campaigns list lives UNDER an offer: a campaign sells one proposition.
  const offerId = params.offerId ? String(params.offerId) : undefined;
  const featureSlug = useSoleFeatureSlug();
  const revenueEnabled = isRevenueFeature(featureSlug);
  const basePath = tenantBasePath(orgId, brandId, offerId);
  // Arrived from a sales funnel? Narrow to the campaigns carrying that funnel. A
  // display filter over rows the hook already fetched, so the walk down costs no
  // request; the header says which funnel, because a list silently showing a third
  // of itself reads as an offer with fewer campaigns than it has.
  // The funnel comes from the ROUTE (`.../funnels/[funnelKey]`), which is the only
  // way in: an offer names no campaign of its own, so this page is always reached
  // through the funnel whose campaigns it lists.
  const funnelKey = params.funnelKey ? decodeURIComponent(String(params.funnelKey)) : null;
  const narrowedFunnel = funnelKey ? campaignFunnel(funnelKey as never) : null;
  const narrowedKey = funnelKey
    ? normalizeSalesFunnelKey(funnelKey as SalesFunnelKeyWire)
    : null;

  // The funnel walked arrow by arrow, so this page lists what the funnel Overview
  // lists: every arrow, whoever performs it. Without it the page rendered the plain
  // campaign list — the two arrows we sell out of four — so walking down from the
  // Overview showed FEWER rows than the section it was reached from, and named each
  // one after the whole funnel instead of the leg it buys.
  //
  // The key is byte-equal to the one `FunnelOverviewPage` already polls, so arriving
  // here costs no request and the two surfaces cannot state different rungs. Read only
  // under a funnel: the brand and offer Campaigns pages span several and have no walk.
  const funnelRevenue = useAuthQuery(
    ["offerFunnelRevenue", brandId, offerId ?? "", narrowedKey ?? "none"],
    () => getOfferFunnelRevenue(offerId ?? "", funnelKey ?? "", brandId),
    { enabled: Boolean(offerId && funnelKey), ...pollOptions },
  );
  // Reveal on SETTLE: a read that errors hands the table `null` — the producer stating
  // no walk — so the arrows still render with no figures rather than the page falling
  // back to a shorter list.
  const funnelStepsPending = funnelRevenue.isPending && !funnelRevenue.isError;

  // The rows the table renders, read through the SAME hook the table uses — so the
  // "#1 acquisition channel" tile and the first row of the table can never name two
  // different campaigns. Both queries dedupe on their keys, so this costs no network.
  const { rows, activeRows, settled: tableSettled } = useCampaignRows(brandId, featureSlug, offerId);
  // This header answers for the whole scope, and the scope's money is its campaigns'
  // money combined — so it is readable exactly when ONE of them has produced enough
  // outcomes to price. Read off the SAME rows the table renders, so a header cannot
  // state a figure the rows beneath it are all declining to state.
  const scopeLearning = scopeIsLearning(rows);

  // The rows the TABLE shows, which under a funnel is a subset of the offer's. The
  // learning band speaks for what is on screen, so it reads these: on a funnel page a
  // lead picked from the offer's other funnels would count days for a campaign this
  // page never lists.
  const scopedRows = useMemo(
    () =>
      narrowedKey
        ? rows.filter(
            (r) =>
              r.campaign.funnelKey != null &&
              normalizeSalesFunnelKey(r.campaign.funnelKey) === narrowedKey,
          )
        : rows,
    [rows, narrowedKey],
  );
  // The band says when the withheld figures become readable, and the scope's figures
  // clear the moment ONE of its campaigns is measured — so a scope that already
  // cleared must not carry a countdown. It did: this brand's cold email had 18 sales
  // interests (measured) beside a stopped feedback-request campaign at 0, and the band
  // counted days for the second while the first had already priced the funnel.
  const scopedLearning = scopeIsLearning(scopedRows);

  const channels = useAcquisitionChannels();

  // The header's money is asked at the grain this page IS — the offer when one is
  // open, the brand otherwise — never of a single acquisition channel. Same reads,
  // same keys and the same reason as the brand Overview, so the two surfaces cannot
  // print different money for one subject.
  //
  // This header said "brand-level" while asking the per-feature read, and a feature
  // IS a channel here. Measured on the brand that surfaced it, whose one offer runs
  // four channels: the channel answers $2,625.44 / 2.67x, the brand and its offer
  // both answer $2,668.47 / 2.62x. Both real, about different things.
  //
  // features-service combines the parts, because most of them do not add — a lead
  // worked through two channels is one lead, and a ratio of sums is neither the sum
  // nor the average of ratios. Never a client sum or average of the table's groups.
  const brandRevenueQ = useAuthQuery(
    offerId ? ["offerRevenue", brandId, offerId] : ["brandRevenue", brandId],
    () => (offerId ? getOfferRevenue(offerId, brandId) : getBrandRevenue(brandId)),
    {
      enabled: revenueEnabled,
      refetchInterval: POLL_INTERVAL,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
    },
  );

  // #1 acquisition channel = the channel of the best-ROI RUNNING campaign, named as the
  // brand Settings catalogue names it (display argmax over already-fetched rows, not a
  // hidden metric). It reads the SAME ordering the table is sorted by, so the tile names
  // a channel that is actually live rather than one that stopped months ago.
  //
  // `activeRows`, not `rows`: the table lists paused campaigns too (a campaign the
  // customer paused is still one of theirs), and this tile answers a narrower
  // question — which channel is winning RIGHT NOW. Reading `rows` would let a
  // stopped campaign's old return name the brand's live #1.
  const topChannel = useMemo(() => {
    const top = activeRows.find((r) => r.revenue?.roiMultiple != null);
    if (!top) return "—";
    const def = acquisitionChannelForFeatureSlug(top.campaign.featureSlug, channels);
    return def ? def.name : channelSlugLabel(top.campaign.featureSlug);
  }, [activeRows, channels]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate
  // query (CLAUDE.md: reveal-on-settle).
  const headerSettled = brandRevenueQ.data !== undefined || brandRevenueQ.isError;

  const globalPipeline = brandRevenueQ.data?.totalPipelineUsd ?? null;
  // The dollar cost of winning one customer, read off the DEFAULT un-lensed brand read.
  // It used to read the lens-only `costPerConversionUsd`, which this call never carries,
  // so the tile sat on a dash. features-service pins the two equal for the same scope.
  const globalCac = brandRevenueQ.data?.costEconomics.costPerAcquisitionUsd ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full p-4 md:p-8">
        {/* The band speaks for the campaign that finishes SOONEST in this scope, which
            is the same subject and the same date every other surface states — one
            derivation, in `use-scope-learning-lead`. */}
        <ScopeLearningBand
          brandId={brandId}
          featureSlug={featureSlug}
          offerId={offerId}
          funnelKey={narrowedKey}
        />
        {/* No create control here: a campaign is set up with us, not spun up from
            a table row, so the page reads this brand's campaigns and nothing more. */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-xl font-bold text-gray-800">Campaigns</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Campaign-by-campaign view of this brand&apos;s pipeline, cost, and return.
        </p>

        {/* Global stats header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatTile label="Pipeline generated" value={fmtUsd(globalPipeline)} pending={!headerSettled} />
          {/* A price and a ranking BY that price. Pipeline generated above is a total,
              so it stays: it grows with each outcome rather than being decided by one. */}
          <StatTile
            label="Cost per acquisition"
            value={fmtUsd(globalCac)}
            pending={!headerSettled}
            action={scopeLearning ? <LearningTag withInfo={false} /> : undefined}
          />
          <StatTile
            label="#1 acquisition channel"
            value={topChannel}
            pending={!tableSettled}
            action={scopeLearning ? <LearningTag withInfo={false} /> : undefined}
          />
        </div>

        {funnelKey && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">
              Showing the campaigns carrying{" "}
              <span className="font-medium text-gray-900">
                {narrowedFunnel?.name ?? funnelKey}
              </span>
              .
            </span>
            <Link href={basePath} className="text-brand-600 hover:underline">
              All sales funnels
            </Link>
          </div>
        )}
        <CampaignsTable
          brandId={brandId}
          featureSlug={featureSlug}
          basePath={basePath}
          offerId={offerId}
          funnelKey={funnelKey}
          // `undefined` off a funnel — the brand and offer lists span several and have
          // no single walk. Under one, the SAME walk the funnel Overview renders.
          funnelSteps={
            funnelKey
              ? funnelStepsPending
                ? null
                : (funnelRevenue.data?.funnelSteps ?? null)
              : undefined
          }
        />
      </div>
    </div>
  );
}
