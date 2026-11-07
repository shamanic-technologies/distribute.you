"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { AwaitingReplyPerson, Lead } from "@/lib/api";
import { formatCount, formatUsdAdaptive, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDate, friendlyTime } from "@/lib/friendly-datetime";
import { utcDay } from "@/lib/v2/series";
import { SINCE_INCEPTION } from "@/lib/revenue-window";
import { v2CampaignHref, v2Href } from "@/lib/v2/routes";
import { useClientClock } from "@/lib/use-client-clock";
import { OfferPlanBanner } from "@/components/v2/choose-plan";
import { useSelectedOfferIfAny } from "@/components/v2/selected-offer";
import {
  BarSpark,
  SparkLine,
  EmptyNote,
  Figure,
  HoverScroll,
  KeyHint,
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
import { awaitingReason } from "@/lib/awaiting-reason";
import { EnginePicksSection } from "@/components/v2/engine-picks-section";
import { useCampaigns, type V2Campaign } from "@/components/v2/use-campaigns";
import {
  useNeedsYourCall,
  useBrandInfo,
  useBrandRevenue,
  useBrandRevenueWindow,
  useTheirLastWords,
} from "@/components/v2/data";
import { TodayTargets } from "@/components/v2/today-targets";
import { OfferSpendChartsSection } from "@/components/v2/spend-charts";
import {
  CompanyMark,
  PersonAvatar,
  leadCompany,
  leadCompanyDomain,
  leadName,
  leadTitle,
  personHref,
} from "@/components/v2/people-bits";
import { RoiLabel } from "@/components/v2/roi-label";
import { expectedReasonWords } from "@/lib/expected-return";
import { expectedBasisWord } from "@/lib/realized-return";
import { RealizedReturnLine } from "@/components/v2/return-figures";

/** Bars for a short window, a line for a long one (30 bars do not fit a tile). */
function Trend({ values, line = false, className = "" }: { values: number[] | null; line?: boolean; className?: string }) {
  if (line || (values && values.length > 14)) return <SparkLine className={`h-8 ${className}`} values={values} />;
  return <BarSpark className={className} values={values} />;
}
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
  const router = useRouter();
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
  // Runs today: runs-service's own roll-up, kept to the selected offer's campaigns.
  const { runsToday, settled: runsSettled } = useCampaignRunsToday(brandId, campaignById);
  // "Needs your call" opens the Inbox, where those replies are answered.
  const callHref = `${v2Href(orgId, brandId, "people")}?tab=positive-replies`;
  const selectedOfferId = useSelectedOfferIfAny()?.offerId ?? null;
  // The offer's ON campaigns, and the steps their legs touch: a step no ON campaign
  // works (owner 2026-10-05) is not stated here, so Today never shows a stage at zero
  // that nothing aims at.
  const ongoing = useOngoingCampaigns(orgId, brandId, selectedOfferId);
  // ROI and Spent: every outcome lives in its campaign's Target row below (owner 2026-11-06, LEAD-GENERIC-1106).
  const statTiles = 2 as const;

  const winSpend = w?.spend ?? null;
  // The only two returns a screen shows (owner 2026-11-03, ROI-CONSISTENCY-1103): the
  // EXPECTED return (the offer's Target value over the cost to make one from Start) and the
  // REALIZED one (Paid clients our outreach caused over money actually spent). Both served.
  const expected = data?.expectedReturn ?? null;
  const realized = data?.costEconomics.realizedReturn ?? null;

  // Needs your call: people who REPLIED with interest and whom nobody has closed or
  // disqualified yet. `total` is lead-service's count of that set.
  const callQ = useNeedsYourCall(brandId, 5);
  const needsCall = callQ.data?.total ?? null;
  const callLeads = callQ.data?.leads ?? [];
  const [cursor, setCursor] = useState(0);

  // Keel's J / K / Enter on the cards that need a call.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey || callLeads.length === 0) return;
      if (e.key === "j") setCursor((c) => Math.min(callLeads.length - 1, c + 1));
      else if (e.key === "k") setCursor((c) => Math.max(0, c - 1));
      else if (e.key === "Enter") {
        const lead = callLeads[Math.min(cursor, callLeads.length - 1)];
        if (lead) router.push(personHref(orgId, brandId, lead));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callLeads, cursor, router, orgId, brandId]);

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
        <OfferPlanBanner brandId={brandId} offerId={selectedOfferId} />
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
                  {needsCall != null && needsCall > 0 && (
                    <>
                      {" "}
                      <Link href={callHref} className="k-fg hover:underline">
                        {formatCount(needsCall)} {needsCall === 1 ? "needs" : "need"} your call.
                      </Link>
                    </>
                  )}
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
              <StatTile label="Spent" href={`${v2Href(orgId, brandId, "billing")}#usage`}>
                {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={winSpend ? formatCentsAsUsdAdaptive(winSpend.actualSpentCents) : "—"} />}
                {winSpend && winSpend.totalSpentCents > winSpend.actualSpentCents && (
                  <p className="k-fg3 mt-1 text-[12px] leading-4">{formatCentsAsUsdAdaptive(winSpend.totalSpentCents)} with provisioned costs</p>
                )}
                <Trend className="mt-auto pt-2" values={winSpend ? winSpend.daily.map((d) => d.actualSpentCents) : null} />
              </StatTile>
            </div>

            {/* One row of cards per campaign Target (owner 2026-11-06, LEAD-GENERIC-1106): names served. */}
            <div className="mt-8">
              <TodayTargets orgId={orgId} brandId={brandId} offerId={selectedOfferId} />
            </div>
            {/* Why each day costs what it costs, and where the cost is heading (owner 2026-10-19). */}
            <div className="mt-6">
              <OfferSpendChartsSection brandId={brandId} offerId={selectedOfferId} billed={{ pending: win.pending, spend: winSpend }} />
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section>
                <SectionTitle
                  count={needsCall}
                  right={
                    callLeads.length > 1 ? (
                      <span className="hidden items-center gap-3 md:flex">
                        <KeyHint keys={["J", "K"]} label="to move" />
                        <KeyHint keys={["↵"]} label="to open" />
                      </span>
                    ) : (
                      <Link href={v2Href(orgId, brandId, "deals")} className="hover:text-[var(--fg-1)]">
                        All deals →
                      </Link>
                    )
                  }
                >
                  Needs your call
                </SectionTitle>
                <div className="space-y-3">
                  {callQ.isPending && !callQ.isError ? (
                    [0, 1].map((i) => <Shimmer key={i} className="h-36 w-full rounded-xl" />)
                  ) : callLeads.length === 0 ? (
                    <div className="k-card">
                      <EmptyNote>Nobody is waiting on you. People who write back and wait on you land here.</EmptyNote>
                    </div>
                  ) : (
                    callLeads.map((lead, i) => (
                      <CallCard
                        key={lead.id}
                        brandId={brandId}
                        lead={lead}
                        waiting={callQ.data?.waiting[lead.id] ?? null}
                        campaign={campaignById.get(lead.campaignId) ?? null}
                        highlight={i === Math.min(cursor, callLeads.length - 1)}
                        href={personHref(orgId, brandId, lead)}
                        onFocus={() => setCursor(i)}
                        onSkip={() => setCursor(Math.min(callLeads.length - 1, i + 1))}
                        isLast={i === callLeads.length - 1}
                      />
                    ))
                  )}
                  {needsCall != null && needsCall > callLeads.length && (
                    <Link href={callHref} className="k-btn-ghost w-full justify-center">
                      {formatCount(needsCall - callLeads.length)} more in Inbox →
                    </Link>
                  )}
                </div>
                {/* The GTM Factory Today feed (FACTORY-USER-DASHBOARD-1102): what each Engine picked and why. */}
                <div className="mt-8">
                  <EnginePicksSection orgId={orgId} brandId={brandId} offerId={selectedOfferId} />
                </div>
              </section>

              <aside className="space-y-6">
                {/* The offer's ON campaigns, named and ordered as the sidebar. Budgets opens the
                    campaign's own page (its max budget and volume, owner 2026-10-10), or the
                    Campaigns overview when the offer runs several. */}
                <section>
                  <SectionTitle
                    count={ongoing.settled ? ongoing.campaigns.length + ongoing.funnelCampaigns.length : null}
                    right={selectedOfferId ? (
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

function CampaignLead({ campaign }: { campaign: V2Campaign | null }) {
  if (!campaign) return <span className="k-fg font-medium">Your campaign</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ServedPipeMark pipeId={campaign.pipe.id} />
      <span className="k-fg font-medium">{campaign.pipe.name}</span>
    </span>
  );
}

function CallCard({
  brandId,
  lead,
  waiting,
  campaign,
  highlight,
  href,
  onFocus,
  onSkip,
  isLast,
}: {
  brandId: string;
  lead: Lead;
  waiting: AwaitingReplyPerson | null;
  campaign: V2Campaign | null;
  highlight: boolean;
  href: string;
  onFocus: () => void;
  onSkip: () => void;
  isLast: boolean;
}) {
  const name = leadName(lead);
  const company = leadCompany(lead);
  const title = leadTitle(lead);
  const at = lead.firstRepliedAt ?? lead.firstClickedAt ?? null;
  const { inbound, settled } = useTheirLastWords(lead.id, brandId);
  const body = inbound?.bodyText?.trim() ?? "";
  return (
    <div
      onMouseEnter={onFocus}
      className={`${highlight ? "k-card-accent" : "k-card"} grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_300px]`}
    >
      <div className="min-w-0">
        <p className="k-fg3 flex flex-wrap items-center gap-1.5 text-[13px]">
          <CampaignLead campaign={campaign} />
          {waiting ? <span>· {awaitingReason(waiting.lastMessage.kind, waiting.waitingSince)}</span> : null}
        </p>
        <p className="mt-2 text-[17px] font-medium leading-6 tracking-[-0.01em]">Follow up with {name}?</p>
        <p className="k-fg2 mt-1 flex min-w-0 items-center gap-1.5 text-[13px]">
          {company && <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={16} />}
          <span className="truncate">{[company, title].filter(Boolean).join(" · ") || lead.email}</span>
        </p>
        <p className="k-fg3 mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px]">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden="true">
            <path d="M4 2.5h5.5L12 5v8.5H4zM6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          <span className="truncate">
            {[at ? `Replied ${friendlyDate(at)}` : null, campaign?.offerName ? `${campaign.pipe.name} · ${campaign.offerName}` : campaign?.pipe.name].filter(Boolean).join(" · ")}
          </span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link href={href} className={highlight ? "k-btn-accent" : "k-btn-strong"}>
            Open conversation
            {highlight && <span className="k-keys rounded-[4px] bg-white/20 px-1 text-[10px]">↵</span>}
          </Link>
          <a href={`mailto:${lead.email}`} className="k-btn">
            Email
          </a>
          {!isLast && (
            <button type="button" onClick={onSkip} className="k-btn-ghost">
              Skip
            </button>
          )}
        </div>
      </div>
      <Link
        href={href}
        className="k-inset hidden min-w-0 flex-col gap-1 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--line-subtle)] md:flex"
      >
        <p className="k-fg3 flex min-w-0 items-center gap-1.5 text-[12px]">
          <PersonAvatar lead={lead} size={16} />
          <span className="truncate">From {name}</span>
        </p>
        {!settled ? (
          <Shimmer className="mt-1 h-16 w-full" />
        ) : inbound ? (
          <>
            {inbound.subject ? <p className="truncate text-[13px] font-medium">{inbound.subject}</p> : null}
            <p className="k-fg2 line-clamp-4 whitespace-pre-line text-[12px] leading-[18px]">
              {body || (inbound.bodyStatus === "unavailable" ? "We hold this reply and could not read it." : "The reply says nothing.")}
            </p>
          </>
        ) : (
          <p className="k-fg3 text-[12px]">Open the conversation to read the reply.</p>
        )}
      </Link>
    </div>
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
