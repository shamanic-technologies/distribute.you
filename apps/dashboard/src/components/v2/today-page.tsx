"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { Lead } from "@/lib/api";
import type { LeadOutcome } from "@/lib/revenue-view";
import { formatCount, formatUsdAdaptive, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDate, friendlyTime, timeAgo } from "@/lib/friendly-datetime";
import { utcDay } from "@/lib/v2/series";
import { SINCE_INCEPTION } from "@/lib/revenue-window";
import { v2Href, v2OfferHref } from "@/lib/v2/routes";
import { shownReturn, shownReturnHalf } from "@/lib/maturity";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useClientClock } from "@/lib/use-client-clock";
import { StatBasisSwitch } from "@/components/v2/stat-basis-switch";
import { OfferPlanBanner } from "@/components/v2/choose-plan";
import { useSelectedOfferIfAny } from "@/components/v2/selected-offer";
import {
  BarSpark,
  SparkLine,
  EmptyNote,
  Figure,
  KeyHint,
  SectionTitle,
  Shimmer,
  StateDot,
  StatTile,
  TickGauge,
  TopBar,
} from "@/components/v2/ui";
import { useCrewRuns } from "@/components/v2/runs";
import { useOngoingCampaigns, type OngoingCampaign } from "@/components/v2/ongoing-campaigns";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { CampaignLeg, budgetLabel } from "@/components/v2/offer-campaigns";
import { campaignKey, campaignTag } from "@/lib/offer-campaigns";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferCampaignBudgets, type OfferCampaignBudgets } from "@/lib/api";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { STEP_KEY_FOR_LEAD_STAGE } from "@/lib/step-marks";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import {
  useNeedsYourCall,
  useBrandInfo,
  useBrandRevenue,
  useBrandRevenueWindow,
  useBucketCounts,
  useLatestInBucket,
  useTheirLastWords,
  useStandingCounts,
  useOfferOutcomes,
  useOfferContactedValue,
} from "@/components/v2/data";
import { EarnedStrip, HotLeads, LostLeads, OfferOutcomesTable } from "@/components/v2/today-roi";
import { RoiHistoryCard } from "@/components/v2/campaign-roi-chart";
import {
  CompanyMark,
  PersonAvatar,
  leadCompany,
  leadCompanyDomain,
  leadName,
  leadTitle,
  personHref,
} from "@/components/v2/people-bits";

/** Bars for a short window, a line for a long one (30 bars do not fit a tile). */
function Trend({ values, line = false, className = "" }: { values: number[] | null; line?: boolean; className?: string }) {
  if (line || (values && values.length > 14)) return <SparkLine className={`h-8 ${className}`} values={values} />;
  return <BarSpark className={className} values={values} />;
}
/**
 * The outcome tiles draw the served running total (owner 2026-10-07: "compounded over time"),
 * so the curve ends on the printed figure. A day missing it is a producer gap: no curve, logged.
 */
function cumulative(daily: { date: string; cumulativeCount?: number }[]): number[] | null {
  const out = daily.map((d) => d.cumulativeCount);
  if (out.some((v) => v == null)) {
    console.error("[dashboard] today-page: window series without cumulativeCount", { days: daily.length });
    return null;
  }
  return out as number[];
}
const pct = (v: number) => `${v < 10 || v > 99 ? v.toFixed(1) : Math.round(v)}%`;
/** One column per stat tile on a wide screen, so the row always spans the full width. */
const STAT_GRID_COLS = {
  4: "md:grid-cols-4",
  5: "md:grid-cols-3 xl:grid-cols-5",
  6: "md:grid-cols-3 xl:grid-cols-6",
} as const;
/** Meetings shown on Today, and how many are read to pick them by booking date. */
const MEETINGS_SHOWN = 3;
const MEETINGS_READ_LIMIT = 100;

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
  const standings = useStandingCounts(brandId).data;
  const outcomesQ = useOfferOutcomes(brandId);
  const outcomesAnswered = outcomesQ.data !== undefined;
  // Not served before features-service v0.179.81: the sections then say they cannot read it.
  const pipeline = outcomesQ.data?.pipeline ?? null;
  const contactedQ = useOfferContactedValue(brandId);
  const buckets = useBucketCounts(brandId).data;
  const { missions, missionByCampaignId } = useMissions(orgId, brandId);
  const { byCrew, settled: runsSettled } = useCrewRuns(brandId, missionByCampaignId);
  // Work, Crew and Missions pages are staff mode only: a customer gets the figures, no
  // link to them, and "needs your call" opens the Inbox instead of Work.
  const { staffMode } = useStaffMode();
  const callHref = staffMode ? v2Href(orgId, brandId, "work") : `${v2Href(orgId, brandId, "people")}?tab=positive-replies`;
  const selectedOfferId = useSelectedOfferIfAny()?.offerId ?? null;
  // The offer's ON campaigns, and the steps their legs touch: a step no ON campaign
  // works (owner 2026-10-05) is not stated here, so Today never shows a stage at zero
  // that nothing aims at.
  const ongoing = useOngoingCampaigns(orgId, brandId, selectedOfferId);
  // Each ON campaign's budget, billing's own figure in the period it was stated in: what
  // goes to proactive outreach, and the most each reactive one may spend (owner 2026-10-08).
  const budgetsQ = useAuthQuery(
    ["offerCampaignBudgets", brandId, selectedOfferId],
    () => getOfferCampaignBudgets(brandId, selectedOfferId as string),
    { enabled: !!selectedOfferId },
  );
  const budgetOf = (c: OngoingCampaign): string | null => {
    if (!budgetsQ.data) return null;
    const rc = c.m.row.campaign;
    const item = budgetsQ.data.items.find((i) => campaignKey(i.featureSlug, i.legKey) === campaignKey(rc.featureSlug ?? "", rc.legKey ?? ""));
    return budgetLabel({ reactive: c.campaign?.reactive ?? false }, item?.budgetCents ?? null, item?.period ?? budgetsQ.data.period);
  };
  const works = (stage: string) => ongoing.settled && ongoing.steps.has(STEP_KEY_FOR_LEAD_STAGE[stage]);
  const showReplies = works("positive_reply");
  const showVisits = works("website_visit");
  const showMeetings = works("meeting_booked");
  // Return, Pipeline, Delivered and Spent always; the two step tiles only when worked.
  const statTiles = (4 + (showReplies ? 1 : 0) + (showVisits ? 1 : 0)) as 4 | 5 | 6;

  const emails = w?.emails ?? null;
  const winSpend = w?.spend ?? null;
  const { basis } = useStatBasis();
  // The brand's return is the MATURE half of the served pair, and it reads Learning
  // exactly where the producer says the brand is not mature (lib/maturity.ts).
  const shownRoi = shownReturn(data?.costEconomics.maturity, basis);
  const learning = shownRoi.learning;
  const roiHalf = shownReturnHalf(data?.costEconomics.maturity, basis);
  const roiCurve = !data?.roiHistory ? null : roiHalf === "flash" ? data.roiHistory.flash ?? null : data.roiHistory;
  const interestedStanding = standings?.counts.sales_interest ?? null;

  // Runs today, per crew: runs-service's own roll-up filed under each crew.
  let runsToday = 0;
  for (const r of byCrew.values()) runsToday += r.runsToday;

  // Needs your call: people who REPLIED with interest and whom nobody has closed or
  // disqualified yet. `total` is lead-service's count of that set.
  const callQ = useNeedsYourCall(brandId, 5);
  const needsCall = callQ.data?.total ?? null;
  const callLeads = callQ.data?.leads ?? [];
  const [cursor, setCursor] = useState(0);
  // lead-service orders a bucket by activity only, so the meetings are read wide
  // and ordered here on the date each meeting was booked, newest first.
  const meetingsQ = useLatestInBucket(brandId, "meeting_booked", MEETINGS_READ_LIMIT);
  const outcomeByLeadId = useMemo(() => {
    const m = new Map<string, LeadOutcome>();
    for (const l of data?.leadOutcomes ?? []) m.set(l.leadId, l);
    return m;
  }, [data]);
  const meetingAt = (lead: Lead) => (lead.leadId ? outcomeByLeadId.get(lead.leadId)?.meetingBookedAt ?? null : null);
  const latestMeetings = useMemo(() => {
    // Wait for the dates too, or the list paints in activity order and then reshuffles.
    if (!meetingsQ.data || (data === undefined && !rev.isError)) return undefined;
    return [...meetingsQ.data.leads]
      .sort((a, b) => (meetingAt(b) ?? "").localeCompare(meetingAt(a) ?? ""))
      .slice(0, MEETINGS_SHOWN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingsQ.data, outcomeByLeadId, data, rev.isError]);

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
  const roi = shownRoi.value;
  const gaugeMax = Math.max(3, Math.ceil((roi ?? 0) + 0.5));

  return (
    <>
      <TopBar
        crumbs={[{ label: "Today" }]}
        // No campaign on/off switch here: cancelling lives in Billing (owner 2026-10-05).
        actions={<StatBasisSwitch />}
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <OfferPlanBanner brandId={brandId} offerId={selectedOfferId} missions={missions} />
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
                  Your crew finished{" "}
                  {staffMode ? (
                    <Link
                      href={v2Href(orgId, brandId, "crew")}
                      className="k-fg underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--fg-2)]"
                    >
                      {formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"}
                    </Link>
                  ) : (
                    <span className="k-fg">
                      {formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"}
                    </span>
                  )}{" "}
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
              <StatTile label="Return" note="Break-even 1×">
                {rev.pending ? (
                  <Shimmer className="h-16 w-full" />
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="relative w-full max-w-[124px]">
                      <TickGauge value={learning ? null : roi} max={gaugeMax} marker={1} />
                      <span className={`absolute inset-x-0 bottom-0 text-center font-medium tabular-nums ${learning ? "text-[14px]" : "text-[18px]"}`}>
                        {learning ? "Learning" : formatRoi(roi)}
                      </span>
                    </div>
                    <p className="k-fg3 mt-1 truncate text-[11px]">
                      {data?.totalPipelineUsd != null ? formatUsdAdaptive(data.totalPipelineUsd) : "—"} pipeline
                    </p>
                  </div>
                )}
              </StatTile>
              {/* Expected pipeline, the headline's own basis: the curve ends at the figure. */}
              <StatTile label="Pipeline" note={brand?.name ? "expected" : undefined}>
                {rev.pending ? <Shimmer className="h-7 w-20" /> : <Figure value={data?.totalPipelineUsd != null ? formatUsdAdaptive(data.totalPipelineUsd) : "—"} />}
                <Trend className="mt-auto pt-2" line values={w?.expectedPipeline ? w.expectedPipeline.daily.map((d) => d.cumulativePipelineUsd) : null} />
              </StatTile>
              {showReplies && (
                <StatTile label="Positive replies" href={`${v2Href(orgId, brandId, "people")}?tab=positive-replies`}>
                  {win.pending ? <Shimmer className="h-7 w-12" /> : <Figure value={w ? formatCount(w.recipientsRepliesPositive.total) : "—"} />}
                  <Trend className="mt-auto pt-2" line values={w ? cumulative(w.recipientsRepliesPositive.daily) : null} />
                </StatTile>
              )}
              {showVisits && (
                <StatTile label="Website visits" href={`${v2Href(orgId, brandId, "people")}?tab=website-visits`}>
                  {win.pending ? <Shimmer className="h-7 w-12" /> : <Figure value={w ? formatCount(w.recipientsClicked.total) : "—"} />}
                  <Trend className="mt-auto pt-2" line values={w ? cumulative(w.recipientsClicked.daily) : null} />
                </StatTile>
              )}
              <StatTile label="Delivered" note={emails ? `${formatCount(emails.bounced)} bounced` : undefined}>
                {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={emails?.deliveryRatePct != null ? pct(emails.deliveryRatePct) : "—"} />}
                <p className="k-fg3 mt-auto pt-2 text-[12px] tabular-nums">
                  {emails ? `${formatCount(emails.delivered)} of ${formatCount(emails.sent)} emails` : "\u00a0"}
                </p>
              </StatTile>
              {/* Spent = billed, setup included. The total with follow-ups reserved and not sent yet
                  stands under it on its own line, never under the Spent label (2026-10-06, Legistai). */}
              <StatTile label="Spent" href={`${v2Href(orgId, brandId, "billing")}#usage`}>
                {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={winSpend ? formatCentsAsUsdAdaptive(winSpend.actualSpentCents) : "—"} />}
                {winSpend && winSpend.totalSpentCents > winSpend.actualSpentCents && (
                  <p className="k-fg3 mt-1 text-[12px] leading-4">{formatCentsAsUsdAdaptive(winSpend.totalSpentCents)} with follow-ups reserved</p>
                )}
                <Trend className="mt-auto pt-2" values={winSpend ? winSpend.daily.map((d) => d.actualSpentCents) : null} />
              </StatTile>
            </div>

            {/* What working with us earned: customers won, hot and lost leads, the pipeline
                step by step and why, the return to date (owner 2026-10-08). */}
            <div className="mt-8">
              <EarnedStrip pipeline={pipeline} answered={outcomesAnswered} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <OfferOutcomesTable
                orgId={orgId}
                brandId={brandId}
                offerId={selectedOfferId}
                rows={outcomesQ.data?.outcomes ?? null}
                pipeline={pipeline}
                contacted={contactedQ.data ? { perLeadUsd: contactedQ.data.perLeadExpectedValueUsd, totalUsd: contactedQ.data.totalExpectedValueUsd } : null}
                answered={outcomesAnswered}
                failed={outcomesQ.data === undefined && outcomesQ.isFetchedAfterMount && outcomesQ.isError}
              />
              <RoiHistoryCard
                // The curve whose last point IS the return the Return tile states.
                history={roiCurve}
                answered={data !== undefined}
                failed={data === undefined && rev.isError}
                right="Since you started"
                sub="What the people we reached are worth, divided by what it cost, to date."
                failedCopy="Could not read your return. Retrying."
                emptyCopy="No return to show yet: nothing has been spent."
              />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <HotLeads pipeline={pipeline} answered={outcomesAnswered} />
              <LostLeads pipeline={pipeline} answered={outcomesAnswered} />
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
                        {interestedStanding != null ? `All ${formatCount(interestedStanding)} interested →` : "All deals →"}
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
                      <EmptyNote>Nobody is waiting on you. People who reply with interest land here.</EmptyNote>
                    </div>
                  ) : (
                    callLeads.map((lead, i) => (
                      <CallCard
                        key={lead.id}
                        brandId={brandId}
                        lead={lead}
                        mission={missionByCampaignId.get(lead.campaignId) ?? null}
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
                      {formatCount(needsCall - callLeads.length)} more in {staffMode ? "Work" : "Inbox"} →
                    </Link>
                  )}
                </div>
              </section>

              <aside className="space-y-6">
                {showMeetings && (
                  <section>
                    <SectionTitle
                      count={buckets ? buckets.counts.meeting_booked : null}
                      right={
                        <Link href={`${v2Href(orgId, brandId, "people")}?tab=meetings`} className="hover:text-[var(--fg-1)]">
                          All meetings →
                        </Link>
                      }
                    >
                      Meetings
                    </SectionTitle>
                    <div className="k-card">
                      {latestMeetings === undefined ? (
                        <div className="p-4"><Shimmer className="h-16 w-full" /></div>
                      ) : latestMeetings.length === 0 ? (
                        <EmptyNote>No meeting booked yet. Booked meetings land here.</EmptyNote>
                      ) : (
                        <ul className="divide-y divide-[var(--line-subtle)]">
                          {latestMeetings.map((lead) => (
                            <MeetingLine
                              key={lead.id}
                              lead={lead}
                              at={meetingAt(lead)}
                              mission={missionByCampaignId.get(lead.campaignId) ?? null}
                              href={personHref(orgId, brandId, lead)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                )}
                {/* The offer's ON campaigns, named and ordered as the sidebar and the Sales path page. */}
                <section>
                  <SectionTitle
                    count={ongoing.settled ? ongoing.campaigns.length : null}
                    right={selectedOfferId ? (
                      <Link href={v2OfferHref(orgId, brandId, selectedOfferId, "sales-path")} className="hover:text-[var(--fg-1)]">
                        Budgets →
                      </Link>
                    ) : null}
                  >Campaigns</SectionTitle>
                  {/* Billing's own totals, ON campaigns only: what goes to proactive outreach,
                      and the most the reactive ones may spend, per reaction (owner 2026-10-08). */}
                  {budgetsQ.data?.totals && (
                    <BudgetTotals totals={budgetsQ.data.totals} />
                  )}
                  <div className="k-card divide-y divide-[var(--line-subtle)]">
                    {!ongoing.settled ? (
                      <div className="p-4"><Shimmer className="h-10 w-full" /></div>
                    ) : ongoing.campaigns.length === 0 ? (
                      <EmptyNote>No campaign is on.</EmptyNote>
                    ) : (
                      ongoing.campaigns.map((c) => (
                        <CampaignLine
                          key={c.m.row.campaign.id}
                          c={c}
                          budget={budgetOf(c)}
                        />
                      ))
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

function CrewLead({ mission }: { mission: Mission | null }) {
  if (!mission) return <span className="k-fg font-medium">Your crew</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <CrewMark color={mission.crew.color} glyph={mission.crew.glyph} />
      <span className="k-fg font-medium">{mission.crew.name}</span>
    </span>
  );
}

function CallCard({
  brandId,
  lead,
  mission,
  highlight,
  href,
  onFocus,
  onSkip,
  isLast,
}: {
  brandId: string;
  lead: Lead;
  mission: Mission | null;
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
          <CrewLead mission={mission} />
          <span>got an interested reply</span>
          {at && <span>· {timeAgo(at)}</span>}
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
            {[at ? `Replied ${friendlyDate(at)}` : null, mission?.offerName ? `${mission.crew.name} · ${mission.offerName}` : mission?.crew.name].filter(Boolean).join(" · ")}
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

function MeetingLine({ lead, at, mission, href }: { lead: Lead; at: string | null; mission: Mission | null; href: string }) {
  const company = leadCompany(lead);
  return (
    <li>
      <Link href={href} className="k-hover flex items-start gap-3 px-4 py-3">
        <div className="w-[52px] shrink-0">
          <p className="text-[13px] font-medium tabular-nums">{at ? friendlyTime(at) : "—"}</p>
          <p className="k-fg3 text-[11px]">{at ? friendlyDate(at) : "booked"}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
            {company ? <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={16} /> : <PersonAvatar lead={lead} size={16} />}
            <span className="truncate">{company ?? leadName(lead)}</span>
          </p>
          <p className="k-fg3 truncate text-[12px]">
            {[company ? leadName(lead) : null, mission?.crew.name ? `booked by ${mission.crew.name}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>
    </li>
  );
}

function BudgetTotals({ totals }: { totals: NonNullable<OfferCampaignBudgets["totals"]> }) {
  const per = `/${totals.period}`;
  return (
    <div className="k-card mb-3 grid grid-cols-2 divide-x divide-[var(--line-subtle)]">
      <div className="min-w-0 p-3">
        <p className="k-label">Proactive</p>
        <p className="mt-1 text-[17px] font-medium tabular-nums">
          {fmtDailyBudgetUsd(totals.proactive.budgetCents)}
          <span className="k-fg3 text-[12px] font-normal">{per}</span>
        </p>
        <p className="k-fg3 text-[12px]">
          {formatCount(totals.proactive.campaigns)} {totals.proactive.campaigns === 1 ? "campaign" : "campaigns"}
        </p>
      </div>
      <div className="min-w-0 p-3">
        <p className="k-label">Reactive, at most</p>
        <p className="mt-1 text-[17px] font-medium tabular-nums">
          {fmtDailyBudgetUsd(totals.reactive.maxBudgetCents)}
          <span className="k-fg3 text-[12px] font-normal">{per}</span>
        </p>
        {totals.reactive.byTrigger.map((t) => (
          <p key={t.triggerKey ?? "none"} className="k-fg3 truncate text-[12px] tabular-nums">
            On {(t.triggerLabel ?? "other steps").toLowerCase()}: {fmtDailyBudgetUsd(t.maxBudgetCents)}
            {per}
          </p>
        ))}
      </div>
    </div>
  );
}

function CampaignLine({ c, budget }: { c: OngoingCampaign; budget: string | null }) {
  const { m, name, campaign } = c;
  const invested = m.row.revenue?.committedCostUsd ?? null;
  return (
    <Link href={m.href} className="k-hover block px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]">
      <span className="flex items-center gap-3">
        {name ? <PathAvatar name={name} size={20} /> : <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={20} />}
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name ?? m.crew.name}</span>
        <StateDot running={m.running} hold={m.paymentHold} />
      </span>
      {/* The full definition on its own line, as the Sales path page reads it: [Channel] → outcome. */}
      <span className="mt-1.5 block overflow-hidden">
        {campaign ? <CampaignLeg campaign={campaign} compact /> : <span className="k-fg4 text-[12px]">{"—"}</span>}
      </span>
      {/* Its type and budget, then what it has spent so far. */}
      <span className="k-fg3 mt-1.5 flex items-center justify-between gap-2 text-[12px] tabular-nums">
        <span className="truncate">
          {campaign ? `${campaignTag(campaign)} · ` : ""}
          {budget ?? "—"}
        </span>
        <span className="shrink-0">{invested != null ? `${formatUsdAdaptive(invested)} spent` : "—"}</span>
      </span>
    </Link>
  );
}
