"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getOfferFunnelRevenue, getOfferFunnelPipelineActivity } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { CampaignsTable, useCampaignRows } from "@/components/campaigns/campaigns-table";
import { LearningToneProvider } from "@/components/learning-tag";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";

/**
 * ONE sales funnel, answered the way its offer is answered.
 *
 * The same `RevenueOverviewSection` and `OutreachStatCards` the offer Overview
 * renders, on the funnel's OWN money: features-service answers this grain in full
 * (its #852), so the spend breakdown, the return over the brand's life and the dated
 * series are this funnel's rather than a wider scope's borrowed under its name.
 *
 * Two deliberate differences from the offer, and neither is an omission:
 *
 *   - it charts the RETURN, not the per-day outreach bars. Outreach is what a CHANNEL
 *     does and a funnel carries several, so the bars would describe one of its legs;
 *     the return is what the whole funnel is judged on.
 *   - it claims no per-day OUTREACH, for the same reason: outreach is what a channel
 *     does and a funnel carries several.
 *
 * It DOES state a daily budget, and that is the one figure here the producer does not
 * total: money is funded per (funnel, channel, offer), so a funnel's ceiling is the sum
 * of the campaigns selling it, which `useRunningDailyBudgetCents` narrows from the rows
 * campaign-service already served. `RUNNING` rather than configured, like every other
 * grain — a paused channel's ceiling is not money this funnel may spend today, and the
 * numerator beside it is what it actually spent.
 *
 * A funnel this offer does not sell answers 404 upstream rather than handing back the
 * offer's numbers under a funnel's name, and this states that rather than a zero.
 */
export function FunnelOverviewPage() {
  const params = useParams<{ orgId: string; brandId: string; offerId: string; funnelKey: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const rawKey = params?.funnelKey ? decodeURIComponent(params.funnelKey) : "";
  const featureSlug = useSoleFeatureSlug();
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;
  const wanted = rawKey ? normalizeSalesFunnelKey(rawKey as SalesFunnelKeyWire) : null;
  const enabled = Boolean(brandId && offerId && rawKey);

  // What this funnel may spend TODAY: the running ceilings of the campaigns selling it,
  // narrowed to THIS offer — billing keys a ceiling on the triple, so a bare funnel
  // would carry a sibling offer's money under this one's name. Null while the read is in
  // flight or has failed, which the card renders as no denominator rather than as a zero
  // ceiling.
  const { cents: funnelDailyBudgetCents } = useRunningDailyBudgetCents(brandId, {
    offerId,
    funnelKey: rawKey || null,
    enabled,
  });

  const revenue = useAuthQuery(
    ["offerFunnelRevenue", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelRevenue(offerId, rawKey, brandId),
    { enabled, ...pollOptions },
  );

  const activity = useAuthQuery(
    ["offerFunnelPipelineActivity", brandId, offerId, wanted ?? "none"],
    () => getOfferFunnelPipelineActivity(offerId, rawKey, { brandId }),
    { enabled, ...pollOptions },
  );

  // This funnel's campaigns, collapsed on the campaign IDENTITY by the same hook the
  // Campaigns table uses — so the rows below and the gate above cannot disagree about
  // how many campaigns there are or whether they have been measured.
  const { rows: allRows } = useCampaignRows(brandId, featureSlug, offerId);
  const funnelRows = useMemo(
    () =>
      wanted
        ? allRows.filter(
            (r) =>
              r.campaign.funnelKey != null &&
              normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
          )
        : [],
    [allRows, wanted],
  );
  // The ratios state `Learning` while every campaign carrying this funnel still is,
  // and clear the moment one is measured. The totals beside them are never gated:
  // money already spent and pipeline already earned are facts, not prices.
  const economicsLearning = scopeIsLearning(funnelRows);

  // Reveal on SETTLE, never on success: a read that errors falls through to a stated
  // page rather than holding it in a skeleton forever.
  const revenuePending = revenue.isPending && !revenue.isError;
  const activityPending = activity.isPending && !activity.isError;
  const data = revenue.data;

  // A funnel's page reads in the brand's PRIMARY: it states the funnel the offer sells,
  // not one campaign's surface, so the accent the campaign pages own would name the wrong
  // scope. The Campaigns table below pins itself back to the tertiary — it states
  // campaigns, and it does so identically wherever it is mounted.
  return (
    <LearningToneProvider tone="primary">
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <RevenueOverviewSection
        // What is running here and what it may spend in a day, read-only, and the way
        // into the modal that changes it — the SAME trigger the brand and offer
        // Overviews render, narrowed to this funnel of this offer. It rides the section
        // heading rather than standing as a band above it: a full-width line over the
        // title reads as a second heading, and this is an attribute of what the heading
        // names.
        //
        // The money is the SERVED running figure the cost card below already divides
        // by, passed as the override rather than summed from the trigger's own rows —
        // one number on one screen, so the header and the card cannot disagree about
        // what this funnel may spend today.
        headerAction={
          <CampaignControlsTrigger
            brandId={brandId}
            offerId={offerId}
            funnelKey={rawKey || null}
            totalCentsOverride={funnelDailyBudgetCents}
          />
        }
        data={revenuePending ? undefined : data}
        pipelineActivity={activityPending ? undefined : activity.data}
        revenuePending={revenuePending}
        costPending={revenuePending}
        todayCostPending={revenuePending}
        activityPending={activityPending}
        economicsLearning={economicsLearning}
        funnelKey={rawKey ? (rawKey as SalesFunnelKeyWire) : null}
        // The per-day bars describe a CHANNEL and a funnel carries several. What a
        // funnel is judged on is the return, which is the call the offer and the brand
        // make one level up.
        showActivityChart={false}
        showRoiTrend
        // Every other Overview states a ceiling beside today's spend; this one used to
        // claim none, on the reasoning that money is funded per channel. That is why the
        // figure has to be SUMMED rather than read, not a reason to withhold it: the
        // funnel's ceiling is exactly the channels selling it, and a bare number with no
        // denominator reads as a total on a card whose neighbour really is one.
        dailyBudgetCents={funnelDailyBudgetCents}
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        topRow={
          <OutreachStatCards
            // The legacy /stats counts are per CHANNEL; everything this row states
            // comes off the funnel's own money below.
            stats={{}}
            spend={revenuePending ? null : data?.spend}
            economics={revenuePending ? null : data?.costEconomics}
            totalPipelineUsd={revenuePending ? null : (data?.totalPipelineUsd ?? null)}
            pending={revenuePending}
            showEconomics
            economicsLearning={economicsLearning}
            // Outreach is what a CHANNEL does, counted per channel and per brand. A
            // funnel carrying several has none of its own, and a zero would read as
            // "nobody was contacted".
            showOutreach={false}
            showFunnelMetrics={false}
          />
        }
      />

      {/* The funnel walked arrow by arrow, full width UNDER the chart. The four figures
          above say what the whole funnel returned; this says WHERE people fall out of it
          and WHO works each arrow, which is the question this page exists for.

          ONE table, not two. A separate "Step by step" band stated the same rung's
          conversion and cost beside this list, under its own learning gate — two places
          for one statement, which is how a screen comes to contradict itself. The rungs
          moved into the row that names who performs them.

          `funnelSteps` is passed from here rather than re-read inside the table: this
          page already holds it for the cards above, and a second read is how two parts of
          one screen come to state different counts. */}
      <div className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-bold text-gray-800">Campaigns</h2>
        <CampaignsTable
          brandId={brandId}
          featureSlug={featureSlug}
          basePath={basePath}
          offerId={offerId}
          funnelKey={rawKey}
          funnelSteps={revenuePending ? null : (data?.funnelSteps ?? null)}
        />
        {/* The table above walks the funnel ARROW by arrow, so a campaign appears under
            the leg it performs and the reader follows the funnel top to bottom. That is
            the right shape for this page and the wrong one for "what am I running": a
            campaign carries a return, a status and a budget the walk has no column for.
            This is the way over to that list, narrowed to this funnel — the SAME
            `CampaignsPage` every other campaign surface renders, never a second copy. */}
        {rawKey && (
          <div className="flex justify-end">
            <Link
              href={`${basePath}/funnels/${encodeURIComponent(rawKey)}/campaigns`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              See more
            </Link>
          </div>
        )}
      </div>

      {!revenuePending && revenue.isError && (
        <p className="text-sm text-gray-500">
          Couldn&rsquo;t read this funnel&rsquo;s money. A funnel this offer does not
          sell answers with nothing rather than with the offer&rsquo;s own numbers under
          its name.
        </p>
      )}
    </div>
    </LearningToneProvider>
  );
}
