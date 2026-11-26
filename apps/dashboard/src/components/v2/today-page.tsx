"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { formatCount, formatUsdAdaptive, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { utcDay } from "@/lib/v2/series";
import { SINCE_INCEPTION } from "@/lib/revenue-window";
import { v2CampaignHref, v2Href } from "@/lib/v2/routes";
import { useClientClock } from "@/lib/use-client-clock";
import { OfferPlanBanner } from "@/components/v2/choose-plan";
import { useBrandScope } from "@/components/v2/brand-scope";
import {
  EmptyNote,
  Figure,
  HoverScroll,
  MarkLines,
  SectionTitle,
  Shimmer,
  StateDot,
  StatTile,
  TickGauge,
  TopBar,
} from "@/components/v2/ui";
import { useCampaignRunsToday } from "@/components/v2/runs";
import { useOngoingCampaigns, type OngoingCampaign } from "@/components/v2/ongoing-campaigns";
import { FunnelCampaignLine } from "@/components/v2/funnel-campaigns";
import { CampaignLeg } from "@/components/v2/offer-campaigns";
import { campaignTag } from "@/lib/offer-campaigns";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAuthQuery } from "@/lib/use-auth-query";
import { STEP_KEY_FOR_LEAD_STAGE } from "@/lib/step-marks";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { EnginePicksSection } from "@/components/v2/engine-picks-section";
import { useCampaigns } from "@/components/v2/use-campaigns";
import {
  useBrandInfo,
  useBrandRevenue,
  useBrandRevenueWindow,
} from "@/components/v2/data";
import { TodayTargets } from "@/components/v2/today-targets";
import { OfferSpendChartsSection } from "@/components/v2/spend-charts";
import { RevenueGeneratedTile } from "@/components/v2/revenue-generated-tile";
import { RoiLabel } from "@/components/v2/roi-label";
import { expectedReasonWords } from "@/lib/expected-return";
import { expectedBasisWord } from "@/lib/realized-return";
import { RealizedReturnLine } from "@/components/v2/return-figures";

/** One column per stat tile on a wide screen, so the row always spans the full width. */
const STAT_GRID_COLS = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-3 xl:grid-cols-5",
  6: "md:grid-cols-3 xl:grid-cols-6",
} as const;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * v2 "Today" — Keel's home, stating our brand. Every figure is a served field
 * on v1's own query keys; the only arithmetic is choosing which served bucket is today.
 */
export function TodayPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { user } = useUser();
  const now = useMemo(() => new Date(), []);
  // The printed greeting, date and time read the browser clock after mount only: the
  // server renders in UTC, which broke hydration (React #418) outside UTC.
  const clock = useClientClock();
  const today = utcDay(now);
  const brand = useBrandInfo(brandId).data?.brand ?? null;
  const rev = useBrandRevenue(brandId);
  // One window for the whole stat row: since inception (owner 2026-10-04, no 7 / 30 day
  // toggle), every figure and curve served whole by features-service (never summed here).
  const win = useBrandRevenueWindow(brandId, SINCE_INCEPTION);
  const w = win.data ?? null;
  const data = rev.data;
  const { campaignById } = useCampaigns(orgId, brandId);
  // Runs today: runs-service's own roll-up, kept to the brand's campaigns.
  const { runsToday, settled: runsSettled } = useCampaignRunsToday(brandId, campaignById);
  const scope = useBrandScope();
  // The brand's ON campaigns, every offer, and the steps their legs touch: a step no ON campaign
  // works (owner 2026-10-05) is not stated here, so Today never shows a stage at zero
  // that nothing aims at.
  const ongoing = useOngoingCampaigns(orgId, brandId);
  // ROI, Revenue generated (the main chart, two columns wide) and Spent: every outcome lives in its
  // campaign's Target row below (owner 2026-11-06, LEAD-GENERIC-1106).
  const statTiles = 4 as const;

  const winSpend = w?.spend ?? null;
  // The only two returns a screen shows (owner 2026-11-03, ROI-CONSISTENCY-1103): the
  // EXPECTED return (the offer's Target value over the cost to make one from Start) and the
  // REALIZED one (Paid clients our outreach caused over money actually spent). Both served.
  const expected = data?.expectedReturn ?? null;
  const realized = data?.costEconomics.realizedReturn ?? null;

  const first = user?.firstName ?? null;
  const dateLine = clock?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeLine = clock?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const roi = expected?.roiMultiple ?? null;
  const gaugeMax = Math.max(3, Math.ceil((roi ?? 0) + 0.5));

  return (
    <>
      <TopBar
        crumbs={[{ label: "Today" }]}
        // No campaign on/off switch here: cancelling lives in Billing (owner 2026-10-05).
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {/* One banner per offer with no plan (plan orgs only), each naming its offer. */}
        {scope.offers.map((o) => (
          <OfferPlanBanner key={o.offerId} brandId={brandId} offerId={o.offerId} offerName={scope.offers.length > 1 ? (o.name ?? null) : null} />
        ))}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {clock ? greeting(clock) : "\u00a0"}
              {clock && first ? `, ${first}` : ""}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {!runsSettled ? (
                " "
              ) : (
                <>
                  Your campaigns finished{" "}
                  <span className="k-fg">
                    {formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"}
                  </span>{" "}
                  today.
                </>
              )}
            </p>
          </div>
          <p className="k-fg3 text-[13px]">
            {clock ? `${dateLine} · ${timeLine}` : "\u00a0"}
          </p>
        </div>

        {!rev.enabled && !rev.pending ? (
          <div className="k-card">
            <EmptyNote>This view isn&apos;t available yet.</EmptyNote>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="k-label">Performance</span>
              <span className="k-fg3 text-[12px]">Since you started</span>
            </div>
            <div className={`grid grid-cols-2 gap-3 ${STAT_GRID_COLS[statTiles]}`}>
              <StatTile label={<RoiLabel />} note="Break-even 1×">
                {rev.pending ? (
                  <Shimmer className="h-16 w-full" />
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="relative w-full max-w-[124px]">
                      <TickGauge value={roi} max={gaugeMax} marker={1} />
                      <span className={`absolute inset-x-0 bottom-0 text-center font-medium tabular-nums ${roi == null ? "k-fg3 text-[14px]" : "text-[18px]"}`}>
                        {roi == null ? expectedReasonWords(expected?.unavailableReason ?? null) : formatRoi(roi)}
                      </span>
                    </div>
                    <p className="k-fg3 mt-1 truncate text-[11px]">
                      Expected{roi != null ? ` (${expectedBasisWord(expected?.basis)})` : ""}
                    </p>
                    <RealizedReturnLine realized={realized} className="max-w-full" />
                  </div>
                )}
              </StatTile>
              {/* Spent = billed, setup included. The total with provisioned costs stands under it on its own
                  line (owner 2026-11-07: one main figure on the page, the $ Spent chart reads the same). */}
              {/* The main chart is REAL revenue generated, expected beside it (owner 2026-11-07, REVENUE-GENERATED-1107). */}
              <RevenueGeneratedTile pending={rev.pending} data={data?.revenueGenerated ?? null} className="col-span-2" />
              <StatTile label="Spent" href={`${v2Href(orgId, brandId, "billing")}#usage`}>
                {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={winSpend ? formatCentsAsUsdAdaptive(winSpend.actualSpentCents) : "—"} />}
                {winSpend && winSpend.totalSpentCents > winSpend.actualSpentCents && (
                  <p className="k-fg3 mt-1 text-[12px] leading-4">{formatCentsAsUsdAdaptive(winSpend.totalSpentCents)} with provisioned costs</p>
                )}
              </StatTile>
            </div>

            {/* One row of cards per campaign Target (owner 2026-11-06, LEAD-GENERIC-1106): names served. */}
            <div className="mt-8">
              <TodayTargets orgId={orgId} brandId={brandId} />
            </div>
            {/* Why each day costs what it costs, and where the cost is heading (owner 2026-10-19). */}
            <div className="mt-6">
              <OfferSpendChartsSection brandId={brandId} offerId={scope.soleOfferId} billed={{ pending: win.pending, spend: winSpend }} />
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section>
                {/* The GTM Factory Today feed (FACTORY-USER-DASHBOARD-1102): what each Engine picked and why. */}
                <EnginePicksSection orgId={orgId} brandId={brandId} offerIds={scope.campaignOfferIds} />
              </section>

              <aside className="space-y-6">
                {/* The brand's ON campaigns, named and ordered as the sidebar. Budgets opens the
                    campaign's own page (its max budget and volume, owner 2026-10-10), or the
                    Campaigns overview when the brand runs several. */}
                <section>
                  <SectionTitle
                    count={ongoing.settled ? ongoing.campaigns.length + ongoing.funnelCampaigns.length : null}
                    right={scope.offers.length > 0 ? (
                      <Link
                        href={
                          ongoing.funnelCampaigns.length === 1
                            ? v2CampaignHref(orgId, brandId, ongoing.funnelCampaigns[0].id)
                            : v2Href(orgId, brandId, "campaigns")
                        }
                        className="hover:text-[var(--fg-1)]"
                      >
                        Budgets →
                      </Link>
                    ) : null}
                  >Campaigns</SectionTitle>
                  <div className="k-card divide-y divide-[var(--line-subtle)]">
                    {!ongoing.settled ? (
                      <div className="p-4"><Shimmer className="h-10 w-full" /></div>
                    ) : ongoing.campaigns.length + ongoing.funnelCampaigns.length === 0 ? (
                      <EmptyNote>No campaign is on.</EmptyNote>
                    ) : (
                      <>
                        {/* A sales-funnel campaign is ONE line (face + name), never its parts (owner 2026-10-10). */}
                        {ongoing.funnelCampaigns.map((f) => (
                          <FunnelCampaignLine key={f.id} orgId={orgId} campaign={f} />
                        ))}
                        {ongoing.campaigns.map((c) => (
                          <CampaignLine key={c.m.row.campaign.id} c={c} />
                        ))}
                      </>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CampaignLine({ c }: { c: OngoingCampaign }) {
  const { m, name, campaign } = c;
  const catalogue = useLegCatalogue();
  const invested = m.row.revenue?.committedCostUsd ?? null;
  return (
    <Link href={m.href} className="k-hover block px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]">
      {/* The mark is as tall as the name and definition lines beside it (owner 2026-10-11). */}
      <MarkLines
        gap="gap-3"
        mark={(px) => <ServedPipeMark pipeId={m.pipe.id} size={px} />}
      >
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name ?? m.pipe.name}</span>
          <StateDot running={m.running} hold={m.paymentHold} />
        </span>
        {/* The full definition on its own line, as the Sales path page reads it: [Channel] → outcome. */}
        <HoverScroll className="mt-1.5">
          {campaign ? <CampaignLeg campaign={campaign} compact /> : <span className="k-fg4 text-[12px]">{"—"}</span>}
        </HoverScroll>
      </MarkLines>
      {/* Its type, then what it has spent so far. A campaign started before sales funnel
          campaigns has no caps: its money is what it spent. */}
      <span className="k-fg3 mt-1.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
        <span className="truncate">
          {campaign ? campaignTag(campaign, catalogue) : "—"}
        </span>
        <span className="shrink-0">{invested != null ? `${formatUsdAdaptive(invested)} spent` : "—"}</span>
      </span>
    </Link>
  );
}
