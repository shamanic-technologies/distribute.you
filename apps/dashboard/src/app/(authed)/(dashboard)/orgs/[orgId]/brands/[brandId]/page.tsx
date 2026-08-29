"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getOfferRevenue,
  getBrandRevenue,
  fetchFeatureStats,
  getBrandConversionToken,
  getFeaturePipelineActivity,
  fetchFeatureAudienceStats,
  listAudiences,
  keepLastGoodFeatureRevenue,
  type PipelineActivityMetric,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { ScopeLearningBand } from "@/components/campaigns/scope-learning-band";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { OfferFunnelsPage } from "@/components/funnels/offer-funnels-page";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { OffersTable } from "@/components/offers/offers-table";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { useAudienceLearning } from "@/lib/use-audience-learning";
import { TopAudiencesCard } from "@/components/revenue/top-audiences-card";
import { DashboardPage } from "@/components/dashboard-page";
import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";
import { useLandingDrilldown } from "@/lib/use-landing-drilldown";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

function countByDay(series: RevenueOverview["outreachContacted"]): Map<string, number> | null {
  if (!series) return null;
  return new Map(series.daily.map((d) => [d.date, d.count] as const));
}

function actualFrom(
  byDay: Map<string, number> | null,
  date: string,
  fallback: number | null,
): number | null {
  return byDay ? byDay.get(date) ?? 0 : fallback;
}

function withActual(metric: PipelineActivityMetric, actual: number | null): PipelineActivityMetric {
  return { ...metric, actual };
}

/**
 * Brand overview AND offer overview — ONE component, scoped by the route.
 *
 * A BRAND is an identity (a name, a domain, a logo, a tracking snippet); an OFFER
 * is a proposition (what it promises, and the funnels it is sold through). So the
 * two levels answer different questions with the same numbers, and this file is
 * mounted at both: `.../brands/[brandId]` with no `offerId`, and
 * `.../brands/[brandId]/offers/[offerId]`, which re-exports it. That is the repo's
 * scope-PROP pattern (`CustomerAudiencesPage({ campaignId })`) read off the route
 * instead of a prop, and it is deliberately not a second copy — two copies is how
 * one brand comes to read one way here and another way one click down.
 *
 * What the scope changes, and nothing else:
 *  - every features-service read carries `offerId`, so the money is the offer's;
 *  - the audiences list and the Top-audiences card are the offer's, because an
 *    audience belongs to a proposition, not to an identity;
 *  - the bottom table lists the offer's CAMPAIGNS; at brand level it lists the
 *    brand's OFFERS instead, since a campaign sells one offer and naming them on
 *    the brand would skip the level that owns them.
 *
 * Neither level renders the per-day Outreach-activity bars: that chart labels the
 * steps of ONE sales funnel on ONE channel, and an offer, exactly like the brand
 * above it, is sold through several funnels and several channels at once. It is
 * the campaign Overview that names one of each. That is also why no
 * pipeline-activity read is made at offer scope at all: features-service serves it
 * with a null expected series (the daily budget is funded per brand, and there is
 * no per-offer ceiling to divide) and null signup / form-submission actuals (the
 * conversion tracker is keyed to the brand's domain, so its outcomes are the
 * brand's) — and drawing the brand's budget beside offer-only bars, or a share of
 * it, would state a figure of a different scope than the bars beside it.
 */
export default function BrandOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // Present only on the offer route. `undefined` IS the brand level — a first-class
  // scope, not a missing value.
  const offerId = params.offerId as string | undefined;
  // A sign-in landing is still being RESOLVED down the hierarchy while its marker is on
  // the URL: this brand hands it to its offer if it sells exactly one, and that offer to
  // its funnel if it is sold through exactly one. Gated on the marker, so every ordinary
  // link into a brand or an offer lands where it points — see `lib/landing-drilldown.ts`.
  const { holding: landingHolding } = useLandingDrilldown({ orgId, brandId, offerId });
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);
  // Whether this scope's RATIOS rest on enough evidence to state: a scope's money is its
  // campaigns' money combined, so one measured campaign is enough and none is not. Read
  // through the same hook the Campaigns table below uses, on the same keys, so it costs
  // no network — and the cards above cannot state a return every row beneath them is
  // declining to state. Gates ROI / $ CAC / % CAC and the return line; Pipeline revenue
  // is a total and keeps its figure.
  const { rows: campaignRows } = useCampaignRows(brandId, featureSlug, offerId);
  const economicsLearning = scopeIsLearning(campaignRows);
  // ...and the same question one audience at a time, for the Top-3 card: an audience
  // states its return once one of the scope's campaigns has priced IT. Same map the
  // Audiences table reads, so the card and the table cannot disagree about a row.
  const { learningByAudienceId, settled: audienceLearningSettled } = useAudienceLearning(
    brandId,
    featureSlug,
    offerId,
  );
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  // isPending (not isLoading): a query suspended by the org-consistency gate
  // reports isLoading:false while still unresolved, which would flash "Brand
  // not found" during the org-settle window.
  const { data: brandData, isPending: brandLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  // The money on this page is asked at the grain the page IS — the offer when one
  // is open, the brand otherwise — never of a single acquisition channel.
  //
  // A feature IS a channel here, so the per-feature read answers "what did this
  // return THROUGH THIS ONE CHANNEL" while the page presents it as the offer's or
  // the brand's. That was invisible while a brand ran one channel and stopped being
  // so the day a second was funded: the page paired one channel's spend with
  // billing's brand-wide ceiling and read `$40 / 50`, for a brand whose two channels
  // had spent $40.07 and $10.32 against their own $40 and $10. Both halves real,
  // about different things, and nothing erroring.
  //
  // features-service combines the parts, because most of them do not add — a lead
  // worked through two channels is one lead, and a ratio of sums is neither the sum
  // nor the average of ratios. Asking N per-channel reads and adding them here would
  // be wrong on top of being the browser-computed metric this repo forbids.
  //
  // Keys carry the grain, so the offer's entry and the brand's can never collide.
  const { data, isError: revenueIsError } = useAuthQuery(
    offerId
      ? ["offerRevenue", brandId, offerId]
      : ["brandRevenue", brandId],
    () => (offerId ? getOfferRevenue(offerId, brandId) : getBrandRevenue(brandId)),
    {
      enabled,
      ...pollOptions,
      // Keep the last-good `outreachContacted` (Outreach card + graph-actual source)
      // across a transient degenerate refetch that drops it on a valid 200.
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(
          prev as RevenueOverview | undefined,
          next as RevenueOverview,
        ),
    },
  );

  // NOT read at offer scope, and the reason is the same one that keeps the chart
  // off this page at both levels: its forecast is `daily budget / cost per
  // outreach`, and a budget is funded per BRAND — there is no per-offer ceiling to
  // divide, so features-service serves a null expected series and a null daily
  // budget for an offer. Its signup / form-submission actuals are null there too,
  // because the conversion tracker is keyed to the brand's own domain. Reading it
  // anyway would put brand-wide numbers on an offer-scoped page.
  const { data: pipelineActivity, isError: pipelineIsError } = useAuthQuery(
    ["featurePipelineActivity", brandId, featureSlug, timezone],
    () => getFeaturePipelineActivity(featureSlug, { brandId, days: 7, timezone }),
    { enabled: enabled && !offerId, ...pollOptions },
  );

  // ── Single-source graph ACTUALS (features-service#371/#372/#377) ───────────
  // The stat cards, graph actual bars and conversions table now read the SAME
  // `/revenue` snapshot aggregates. Forecast/expected values stay from
  // pipeline-activity. Each server series is optional during backend rollout:
  // absent series keep the legacy pipeline-activity actual for that metric.
  // The Outreach stat card + graph "Outreach" bars = total email SEQUENCES sent
  // (per-day volume, UNDEDUPED by lead — features-service#416 `sequences`), which
  // matches "budget spent today". This is NOT the deduped distinct-lead
  // `outreachContacted`. Fallback order renders correctly on BOTH current prod
  // features (no `sequences` → `outreachContacted`, itself already normalized to
  // prefer `recipientsContacted`) and post-#416; `sequences.total >=
  // outreachContacted.total` is expected (different grain, not reconciled).
  const outreachSeries = data?.sequences ?? data?.outreachContacted;
  const outreachTotal = outreachSeries?.total ?? null;
  const mergedPipelineActivity = useMemo(() => {
    if (!pipelineActivity) return undefined;
    const outreachByDay = countByDay(data?.sequences ?? data?.outreachContacted);
    const clickedByDay = countByDay(data?.clicked);
    const meetingsByDay = countByDay(data?.meetingsBooked);
    if (!outreachByDay && !clickedByDay && !meetingsByDay) {
      return pipelineActivity;
    }
    return {
      ...pipelineActivity,
      days: pipelineActivity.days.map((day) => ({
        ...day,
        metrics: {
          ...day.metrics,
          outreach: withActual(
            day.metrics.outreach,
            actualFrom(outreachByDay, day.date, day.metrics.outreach.actual),
          ),
          clicks: withActual(
            day.metrics.clicks,
            actualFrom(clickedByDay, day.date, day.metrics.clicks.actual),
          ),
          signups: withActual(
            day.metrics.signups,
            actualFrom(clickedByDay, day.date, day.metrics.signups.actual),
          ),
          salesMeetings: withActual(
            { actual: null, expected: null, conversionPct: null },
            actualFrom(meetingsByDay, day.date, null),
          ),
        },
      })),
    };
  }, [pipelineActivity, data]);
  const pipelineActualSeries = useMemo(() => ({
    outreach: data?.sequences ?? data?.outreachContacted,
    clicks: data?.clicked,
    signups: data?.clicked,
    repliedPositive: data?.repliedPositive,
    salesMeetings: data?.meetingsBooked,
  }), [data]);

  // Total spent + today + top-3 cost sources now come VERBATIM from the
  // features-service `/revenue` `spend` block (above), reconciled to runs ACTUAL
  // spend — the dashboard no longer fetches + sums the runs cost breakdown here.

  // Feature-level stats (Impressions / Clicks / CPC cards). Shares the Campaigns
  // page's query key + 5s cadence so both observers refetch one cache entry.
  const { data: featureStatsData, isError: featureStatsIsError } = useAuthQuery(
    offerId
      ? ["featureStats", featureSlug, brandId, "offer", offerId]
      : ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId, offerId }),
    { enabled, ...pollOptions },
  );
  const featureStats = featureStatsData?.stats ?? {};
  const totalWebsiteClicks = featureStats.recipientsClicked ?? 0;

  // NO sales-economics read here. It resolved the brand goal — a retired,
  // server-defaulted column — plus the two conversion rates the Outreach-activity
  // chart labels its bars with, and this level renders neither.

  // What this brand may spend TODAY — its RUNNING campaigns' ceilings, joined
  // from the two keys the page's controls trigger already polls. billing's own
  // `GET /brands/:id/daily-budget` used to answer this and it is status-BLIND:
  // billing keys ceilings on (funnel x channel x offer) and stores no status, so
  // a brand running one campaign at $50 beside one paused at $10 answered $60,
  // and both the cost card's denominator and the monthly projection below
  // inherited the overstatement.
  const { cents: runningDailyBudgetCents } = useRunningDailyBudgetCents(brandId, { enabled });

  // Conversion-tracker liveness (lead-service pixel). Shares the outreach-stat-cards
  // + settings-card query key → one cache entry, no extra network. The Outreach-
  // activity graph's Form-submissions bar is hidden until the tracker is live
  // (live_waiting/live), mirroring the audiences column gate (#2646). Undefined
  // (unresolved) → not set up → hidden.
  const { data: conversionTokenData } = useAuthQuery(
    ["brandConversionToken", brandId],
    () => getBrandConversionToken(brandId),
    { enabled, ...pollOptions },
  );
  const trackerSetUp =
    conversionTokenData?.status === "live" ||
    conversionTokenData?.status === "live_waiting";
  // The Top-3-audiences card's cost column — the SAME choice the Audiences table leads
  // with, so the two pages cannot state different economics for one brand at one moment.
  //
  // It is a month of what may be spent TODAY, so it rides the running-only total
  // rather than billing's status-blind one: projecting a month from a figure that
  // counts paused campaigns promises outcomes the money will not buy.
  const monthlyBudgetUsd =
    runningDailyBudgetCents != null && runningDailyBudgetCents > 0
      ? (runningDailyBudgetCents / 100) * 30
      : null;

  // NO workflow-projection here any more. It resolved a WORKFLOW for the brand's goal,
  // and it fed exactly two things: the Outcome line's forward projection, which the
  // Return-on-spend chart replaced, and a spend cap that priced the reassurance banner's
  // learning window in that goal's outcome. A brand has no goal — it runs several
  // funnels at once — so the objective it was asked for came off the retired,
  // server-defaulted brand column. The banner is held to its own claim in TIME instead.

  // Real audience-level cost evidence from features-service. This replaces the
  // old provider-cost-source list; no dashboard-side mock/hash audience split.
  const { data: audienceStatsData, isError: audienceStatsIsError } = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, "brand-return", offerId ?? "brand"],
    // No `limit` — features-service would pre-pick the top 3 by ITS OWN sortMetric, which
    // is a different column than the one this card shows for a sale-terminating goal. The
    // card sorts and slices on the brand's metric instead (a brand has a handful of active
    // audiences, so the full list is cheap).
    // NEITHER goal nor funnel: the brand-level read. features-service then prices every
    // audience through the best-returning funnel the brand declared and sorts on return
    // descending, which is the only honest answer here — a brand runs several funnels at
    // once, so naming one would denominate the card in a single funnel's terms.
    // `offerId` is a SCOPE, not a funnel or a goal: it narrows which audiences are
    // priced, never the funnel they are priced through.
    () => fetchFeatureAudienceStats(featureSlug, { brandId, offerId }),
    { enabled: enabled && !!offerId, ...pollOptions },
  );

  const { data: audiencesData, isError: audiencesIsError } = useAuthQuery(
    offerId ? ["audiences", brandId, "offer", offerId] : ["audiences", brandId],
    () => listAudiences(brandId, { offerId }),
    { enabled: enabled && !!offerId, ...pollOptions },
  );
  const activeAudiences = audiencesData?.audiences.filter((a) => a.status === "active");

  // Per-card reveal (NOT one page-wide barrier): revenue (features-service) and
  // total/today spend (runs-service) are separate cold paths — gate each on its
  // own query so the fast cost figures aren't held by the slower revenue call.
  //
  // Reveal on SETTLE (resolved OR errored), never success-only. `/revenue` is the
  // slowest cold path and intermittently FAILS on a cold backend (features →
  // downstream Neon scale-to-zero). Gating on `data !== undefined` alone left the
  // whole section skeletoned FOREVER after a transient error — no error UI, no
  // recovery. Settling on `isError` paints "—"/stale instead; the error still logs
  // loud (React Query + the revenue reader's safeParse throw), and the monotonic
  // latch keeps the section revealed while the next 30s poll recovers real data.
  // A query disabled by the org-consistency gate has isError:false → NOT settled,
  // so cross-org isolation is unchanged (reseed-from-disk covers that case).
  const revenueSettled = data !== undefined || revenueIsError;
  const revenueRevealed = useCoordinatedReveal([revenueSettled]);
  // Graph reveals with revenue too — its actual outreach series is sourced from
  // `/revenue` (mergedPipelineActivity), which cleanly falls back to the
  // pipeline-activity actuals when `data` is absent, so an errored `/revenue`
  // must not hold the chart.
  // At offer scope the activity query is switched off for good (see its comment),
  // so there is nothing to wait for — it counts as settled rather than pending, or
  // the group would sit unrevealed forever.
  const activityRevealed = useCoordinatedReveal([
    pipelineActivity !== undefined || pipelineIsError || !!offerId,
    revenueSettled,
  ]);
  // The cost card's spend block rides the `/revenue` payload now → it reveals
  // with revenue (was its own runs-service cost-breakdown path).
  const costRevealed = revenueRevealed;
  const statsRevealed = useCoordinatedReveal([
    featureStatsData !== undefined || featureStatsIsError,
  ]);
  const audienceStatsRevealed = useCoordinatedReveal([
    audienceStatsData !== undefined || audienceStatsIsError || !offerId,
    audiencesData !== undefined || audiencesIsError || !offerId,
  ]);
  // How long before this scope's figures can be priced — the SAME band every campaign
  // surface renders, through the one derivation that decides which campaign it speaks
  // for. It replaced a reassurance banner that promised "2 to 4 weeks" on a window it
  // was not counting: one state, two boxes, and only one of them a countdown.
  //
  // At OFFER grain it answers for the offer's campaigns, at brand grain for the brand's;
  // either way the subject is the campaign that finishes SOONEST, because the scope
  // clears the moment one of them is measured.
  const brandPath = `/orgs/${orgId}/brands/${brandId}`;
  const basePath = offerId ? `${brandPath}/offers/${offerId}` : brandPath;

  // Still walking down to the scope this landing belongs in. The route's own transition
  // skeleton, so the walk looks like the navigation it is rather than a blank — and it is
  // bounded, so a cold read renders this page instead of holding (see the hook).
  if (landingHolding) {
    return <DashboardPageSkeleton />;
  }

  if (!brandLoading && !brand) {
    // Reached e.g. via a stale last-brand cookie pointing at a deleted brand.
    return (
      <DashboardPage width="wide">
        <p className="text-gray-500 mb-3">Brand not found</p>
        <Link
          href={`/orgs/${orgId}/brands`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Back to brands
        </Link>
      </DashboardPage>
    );
  }

  if (!enabled) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  // What is running here, and what it may spend in a day — read-only, and the way
  // into the modal that changes it.
  //
  // It rides the section heading through `RevenueOverviewSection`'s `headerAction`
  // slot, on the same row and to its right, rather than standing as a band of its
  // own above it: a full-width line over the title reads as a second heading, and
  // this is an attribute of what the heading names rather than a statement one
  // level up from it. The empty-state branch has no heading to sit beside, so
  // there and only there it stands alone. The rows it controls
  // are this scope's CAMPAIGNS whatever the grain, because a campaign is the only
  // thing billing and campaign-service actually fund.
  //
  // The money is the same question at both grains — what may be spent TODAY —
  // so both read the trigger's own rows and no override is passed. billing's
  // served brand total used to fill the brand grain and it is status-BLIND:
  // billing keys a ceiling on the triple and stores no status, so a brand
  // running one campaign at $50 beside one paused at $10 read `$60 / day`.
  const ControlsLine = <CampaignControlsTrigger brandId={brandId} offerId={offerId} />;

  // Only once revenue resolves do we know the brand has no pipeline yet.
  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <DashboardPage width="wide" className="space-y-4">
      <ScopeLearningBand brandId={brandId} featureSlug={featureSlug} offerId={offerId} />
        {/* No section header on this branch to sit beside, so the line stands
            on its own here — everywhere else it rides the Outreach heading. */}
        {ControlsLine}
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      <ScopeLearningBand brandId={brandId} featureSlug={featureSlug} offerId={offerId} />
      {/* No `expectedOutcome`: it fed the Outcome line's dashed forecast, and this level
          charts the return instead. */}
      <RevenueOverviewSection
        headerAction={ControlsLine}
        economicsLearning={economicsLearning}
        data={revenueRevealed ? data : undefined}
        pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}
        pipelineActualSeries={activityRevealed ? pipelineActualSeries : undefined}
        trackerSetUp={trackerSetUp}
        revenuePending={!revenueRevealed}
        activityPending={!activityRevealed}
        costPending={!costRevealed}
        todayCostPending={!costRevealed}
        // NULL at offer scope, deliberately. The daily budget is funded per BRAND,
        // so there is no per-offer ceiling; printing the brand's beside this
        // offer's spend would state a denominator of a wider scope than the
        // numerator, and dividing it across the offers would invent a share
        // nobody configured. The card then states what was spent and claims no
        // ceiling, and the tip below says why.
        dailyBudgetCents={offerId ? null : runningDailyBudgetCents}
        budgetNote={
          offerId
            ? "There is no daily budget for a single offer: the budget is funded for the whole brand, so this figure is what this offer spent today, with no ceiling of its own to compare it against."
            : undefined
        }
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        // Per-day outreach bars describe the cold-email channel, not the brand.
        // A brand runs several channels and several funnels at once, so its
        // Overview answers what the whole thing returned; the campaign Overview
        // keeps the chart for the one channel it runs.
        showActivityChart={false}
        // Chart what came back per dollar, not the cumulative count of one funnel's
        // signal — a brand runs several funnels and is judged on the return.
        showRoiTrend
        // The Top-3 audiences card is OFFER-level only. An audience is a set of
        // people picked for a proposition, so at brand level it would rank the
        // audiences of several offers against each other under one heading — the
        // same reason the funnel step pairs are off this page.
        costBottomCard={
          offerId ? (
            <TopAudiencesCard
            learningByAudienceId={learningByAudienceId}
            learningSettled={audienceLearningSettled}
              data={audienceStatsRevealed ? audienceStatsData : undefined}
              audiences={audienceStatsRevealed ? activeAudiences : undefined}
              pending={!audienceStatsRevealed}
            />
          ) : undefined
        }
        topRow={
          /* Brand-level stat row: what we sent, what the pipeline is worth, and
             what it cost to produce one customer. The funnel-specific pairs
             (Website Visits / cost per visit, and the goal's outcome pair) name
             the steps of ONE sales funnel, so they live on the campaign Overview
             — a brand sells through several funnels at once and the row above
             them sums every one. */
          <OutreachStatCards
            stats={featureStats}
            spend={revenueRevealed ? data?.spend : null}
            pending={!(statsRevealed && revenueRevealed)}
                outreachOverride={outreachTotal}
            economics={revenueRevealed ? data?.costEconomics : null}
            totalPipelineUsd={revenueRevealed ? data?.totalPipelineUsd : null}
            showEconomics
            economicsLearning={economicsLearning}
            showFunnelMetrics={false}
          />
        }
      />

      {/* What is behind the numbers above, full width under the chart — and what
          that is depends on the level. An OFFER is sold by campaigns, so its page
          lists them (the SAME table the Campaigns page renders — one component, so
          a campaign cannot read one way here and another way one click over). A
          BRAND is an identity that sells one or more PROPOSITIONS, and a campaign
          belongs to one of those, so naming campaigns here would skip the level
          that owns them. Both are ordered by the return the headline above is
          stated in. */}
      <div className="space-y-3 pt-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-gray-800">
            {offerId ? "Sales funnels" : "Offers"}
          </h2>
        </div>
        {offerId ? (
          /* An offer sells through FUNNELS, and a campaign buys one LEG of one of
             them — so a campaign has a cost per step and no return of its own, and
             listing campaigns here would skip the level where a return exists. The
             offer level names no campaign at all now; a funnel row walks down to
             the campaigns carrying it. */
          <OfferFunnelsPage embedded />
        ) : (
          <OffersTable brandId={brandId} featureSlug={featureSlug} basePath={brandPath} />
        )}
      </div>
    </DashboardPage>
  );
}
