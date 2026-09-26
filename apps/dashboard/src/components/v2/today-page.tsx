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
import { cumulativeWindow, dailyWindow, utcDay } from "@/lib/v2/series";
import { v2Href } from "@/lib/v2/routes";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import {
  BarSpark,
  EmptyNote,
  Figure,
  KeyHint,
  SectionTitle,
  Shimmer,
  SparkLine,
  StateDot,
  StackMeter,
  StatTile,
  TickGauge,
  TopBar,
} from "@/components/v2/ui";
import { useCrewRuns, useRecentRuns, runState, runTaskLabel } from "@/components/v2/runs";
import type { RunRow } from "@/lib/api";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import {
  useNeedsYourCall,
  useBrandInfo,
  useBrandRevenue,
  useBucketCounts,
  useLatestInBucket,
  useTheirLastWords,
  useStandingCounts,
} from "@/components/v2/data";
import {
  CompanyMark,
  PersonAvatar,
  leadCompany,
  leadCompanyDomain,
  leadName,
  leadTitle,
  personHref,
} from "@/components/v2/people-bits";

const SPARK_DAYS = 14;

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
  const today = utcDay(now);
  const brand = useBrandInfo(brandId).data?.brand ?? null;
  const rev = useBrandRevenue(brandId);
  const data = rev.data;
  const standings = useStandingCounts(brandId).data;
  const buckets = useBucketCounts(brandId).data;
  const { missions, crews, settled: missionsSettled, missionByCampaignId } = useMissions(orgId, brandId);
  const { byCrew, settled: runsSettled } = useCrewRuns(brandId, missionByCampaignId);
  const recentRuns = useRecentRuns(brandId, 60);
  const { cents: budgetCents } = useRunningDailyBudgetCents(brandId, { enabled: rev.enabled });

  const spentToday = data?.spend ? data.spend.totalSpentTodayCents ?? data.spend.todaySpentCents ?? null : null;
  const running = missions.filter((m) => m.running);
  const learning = scopeIsLearning(missions.map((m) => m.row));
  const interestedStanding = standings?.counts.sales_interest ?? null;

  // Runs today, per crew: runs-service's own roll-up filed under each crew.
  let runsToday = 0;
  for (const r of byCrew.values()) runsToday += r.runsToday;
  const crewSpend = crews.map((c) => ({
    key: c.crew.key,
    value: byCrew.get(c.crew.key)?.spendTodayCents ?? 0,
    color: c.crew.color,
  }));

  // Needs your call: people who REPLIED with interest and whom nobody has closed or
  // disqualified yet. `total` is lead-service's count of that set.
  const callQ = useNeedsYourCall(brandId, 5);
  const needsCall = callQ.data?.total ?? null;
  const callLeads = callQ.data?.leads ?? [];
  const [cursor, setCursor] = useState(0);
  const visits = useLatestInBucket(brandId, "website_visit", 8);
  const replies = useLatestInBucket(brandId, "positive_reply", 8);
  const meetings = useLatestInBucket(brandId, "meeting_booked", 3);
  const outcomeByLeadId = useMemo(() => {
    const m = new Map<string, LeadOutcome>();
    for (const l of data?.leadOutcomes ?? []) m.set(l.leadId, l);
    return m;
  }, [data]);

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
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeLine = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const roi = data?.costEconomics.roiMultiple ?? null;
  const gaugeMax = Math.max(3, Math.ceil((roi ?? 0) + 0.5));

  return (
    <>
      <TopBar
        crumbs={[{ label: "Today" }]}
        actions={
          <>
            {rev.enabled && <CampaignControlsTrigger brandId={brandId} />}
          </>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {greeting(now)}
              {first ? `, ${first}` : ""}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {!runsSettled ? (
                " "
              ) : (
                <>
                  Your crew finished{" "}
                  <Link
                    href={v2Href(orgId, brandId, "crew")}
                    className="k-fg underline decoration-[var(--line-strong)] underline-offset-4 hover:decoration-[var(--fg-2)]"
                  >
                    {formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"}
                  </Link>{" "}
                  today.
                  {needsCall != null && needsCall > 0 && (
                    <>
                      {" "}
                      <Link href={v2Href(orgId, brandId, "work")} className="k-fg hover:underline">
                        {formatCount(needsCall)} {needsCall === 1 ? "needs" : "need"} your call.
                      </Link>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <p className="k-fg3 text-[13px]">
            {dateLine} · {timeLine}
          </p>
        </div>

        {!rev.enabled ? (
          <div className="k-card">
            <EmptyNote>This view isn&apos;t available yet.</EmptyNote>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
              <StatTile label="Pipeline" note={brand?.name ? "expected" : undefined}>
                {rev.pending ? <Shimmer className="h-7 w-20" /> : <Figure value={data?.totalPipelineUsd != null ? formatUsdAdaptive(data.totalPipelineUsd) : "—"} />}
                <SparkLine
                  className="mt-auto h-8 pt-2"
                  values={data?.roiHistory ? cumulativeWindow(data.roiHistory.daily.map((d) => ({ date: d.date, value: d.cumulativePipelineUsd })), 30, today) : null}
                />
              </StatTile>
              <StatTile label="Positive replies" note={`${SPARK_DAYS} days`} href={`${v2Href(orgId, brandId, "people")}?tab=positive-replies`}>
                {rev.pending ? <Shimmer className="h-7 w-12" /> : <Figure value={data?.repliedPositive ? formatCount(data.repliedPositive.total) : "—"} />}
                <BarSpark className="mt-auto pt-2" values={data?.repliedPositive ? dailyWindow(data.repliedPositive.daily, SPARK_DAYS, today) : null} />
              </StatTile>
              <StatTile label="Website visits" note={`${SPARK_DAYS} days`} href={`${v2Href(orgId, brandId, "people")}?tab=website-visits`}>
                {rev.pending ? <Shimmer className="h-7 w-12" /> : <Figure value={data?.clicked ? formatCount(data.clicked.total) : "—"} />}
                <BarSpark className="mt-auto pt-2" values={data?.clicked ? dailyWindow(data.clicked.daily, SPARK_DAYS, today) : null} />
              </StatTile>
              <StatTile label="Crew today" note={`${running.length} running`} href={v2Href(orgId, brandId, "crew")}>
                {!runsSettled ? <Shimmer className="h-7 w-16" /> : <Figure value={formatCount(runsToday)} unit={runsToday === 1 ? "run" : "runs"} />}
                <div className="mt-auto pt-2">
                  <StackMeter parts={crewSpend} max={budgetCents} />
                  <p className="k-mono k-fg3 mt-1.5 text-[11px]">
                    {spentToday != null ? formatCentsAsUsdAdaptive(spentToday) : "—"} of {fmtDailyBudgetUsd(budgetCents)} budget
                  </p>
                </div>
              </StatTile>
              <StatTile label="Spent" note="all time">
                {rev.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={data?.spend ? formatCentsAsUsdAdaptive(data.spend.totalSpentCents) : "—"} />}
                <SparkLine
                  className="mt-auto h-8 pt-2"
                  values={data?.roiHistory ? cumulativeWindow(data.roiHistory.daily.map((d) => ({ date: d.date, value: d.cumulativeSpendUsd })), 30, today) : null}
                />
              </StatTile>
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
                    <Link href={v2Href(orgId, brandId, "work")} className="k-btn-ghost w-full justify-center">
                      {formatCount(needsCall - callLeads.length)} more in Work →
                    </Link>
                  )}
                </div>
              </section>

              <aside className="space-y-6">
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
                    {meetings.data === undefined ? (
                      <div className="p-4"><Shimmer className="h-16 w-full" /></div>
                    ) : meetings.data.leads.length === 0 ? (
                      <EmptyNote>No meeting booked yet. Booked meetings land here.</EmptyNote>
                    ) : (
                      <ul className="divide-y divide-[var(--line-subtle)]">
                        {meetings.data.leads.map((lead) => (
                          <MeetingLine
                            key={lead.id}
                            lead={lead}
                            at={lead.leadId ? outcomeByLeadId.get(lead.leadId)?.meetingBookedAt ?? null : null}
                            mission={missionByCampaignId.get(lead.campaignId) ?? null}
                            href={personHref(orgId, brandId, lead)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
                <section>
                  <SectionTitle
                    count={missionsSettled ? missions.length : null}
                    right={
                      <Link href={v2Href(orgId, brandId, "missions")} className="hover:text-[var(--fg-1)]">
                        All missions →
                      </Link>
                    }
                  >
                    Missions
                  </SectionTitle>
                  <div className="k-card divide-y divide-[var(--line-subtle)]">
                    {!missionsSettled ? (
                      <div className="p-4"><Shimmer className="h-10 w-full" /></div>
                    ) : missions.length === 0 ? (
                      <EmptyNote>No mission yet.</EmptyNote>
                    ) : (
                      missions.slice(0, 5).map((m) => <MissionLine key={m.row.campaign.id} m={m} />)
                    )}
                  </div>
                </section>
                <section>
                  <SectionTitle
                    right={
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
                          Live
                        </span>
                        {runsSettled && (
                          <Link href={v2Href(orgId, brandId, "crew")} className="hover:text-[var(--fg-1)]">
                            {formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"} today
                          </Link>
                        )}
                      </span>
                    }
                  >
                    Crew activity
                  </SectionTitle>
                  <ActivityFeed
                    visits={visits.data?.leads ?? null}
                    replies={replies.data?.leads ?? null}
                    runs={recentRuns.data ?? null}
                    missionFor={(id) => (id ? missionByCampaignId.get(id) ?? null : null)}
                    hrefFor={(lead) => personHref(orgId, brandId, lead)}
                  />
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

function MissionLine({ m }: { m: Mission }) {
  const g = m.row.revenue;
  return (
    <Link href={m.href} className="k-hover flex items-center gap-3 px-4 py-3 first:rounded-t-[12px] last:rounded-b-[12px]">
      <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={20} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px]">
          <span className="font-medium">{m.crew.name}</span>
          {m.offerName && <span className="k-fg2"> · {m.offerName}</span>}
        </p>
        <p className="k-fg3 truncate text-[12px]">{m.leg?.label ?? "—"}</p>
      </div>
      <div className="shrink-0 text-right">
        <StateDot running={m.running} />
        <p className="k-mono k-fg3 text-[11px]">
          {g?.committedCostUsd != null ? formatUsdAdaptive(g.committedCostUsd) : "—"} spent
        </p>
      </div>
    </Link>
  );
}

type FeedItem =
  | { kind: "visit" | "reply"; lead: Lead; at: string; key: string }
  | { kind: "run"; run: RunRow; at: string; key: string };

function ActivityFeed({
  visits,
  replies,
  runs,
  missionFor,
  hrefFor,
}: {
  visits: Lead[] | null;
  replies: Lead[] | null;
  runs: RunRow[] | null;
  missionFor: (campaignId: string | null) => Mission | null;
  hrefFor: (lead: Lead) => string;
}) {
  // A display merge of three served lists, ordered by the instant each one proves.
  const items = useMemo(() => {
    const out: FeedItem[] = [];
    for (const l of visits ?? []) if (l.firstClickedAt) out.push({ kind: "visit", lead: l, at: l.firstClickedAt, key: `v-${l.id}` });
    for (const l of replies ?? []) if (l.firstRepliedAt) out.push({ kind: "reply", lead: l, at: l.firstRepliedAt, key: `r-${l.id}` });
    for (const r of runs ?? []) if (runState(r) !== "failed") out.push({ kind: "run", run: r, at: r.startedAt, key: `x-${r.id}` });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 14);
  }, [visits, replies, runs]);

  if (!visits && !replies && !runs) return <Shimmer className="h-48 w-full rounded-xl" />;
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const firstEarlier = items.findIndex((i) => i.at < todayStart);
  return (
    <div className="k-card max-h-[520px] overflow-y-auto k-scroll">
      {items.length === 0 ? (
        <EmptyNote>Nothing landed yet.</EmptyNote>
      ) : (
        <ul>
          {items.map((item, idx) => {
            const campaignId = item.kind === "run" ? item.run.campaignId : item.lead.campaignId;
            const m = missionFor(campaignId);
            const divider = idx === firstEarlier && idx > 0;
            return (
              <li key={item.key} className={idx > 0 && !divider ? "border-t border-[var(--line-subtle)]" : ""}>
                {divider && (
                  <p className="k-fg3 flex items-center gap-2 border-t border-[var(--line-subtle)] bg-[var(--bg-inset)] px-4 py-1.5 text-[11px]">
                    Earlier
                  </p>
                )}
                {item.kind === "run" ? (
                  <Link href={m?.href ?? "#"} className="k-hover flex items-start gap-3 px-4 py-3">
                    <CrewTile m={m} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="font-medium">{m?.crew.name ?? "Your crew"}</span>{" "}
                        <span>{runTaskLabel(item.run).charAt(0).toLowerCase() + runTaskLabel(item.run).slice(1)}</span>
                      </p>
                      <p className="k-fg3 truncate text-[12px]">
                        {[m?.offerName, runState(item.run) === "running" ? "running now" : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="k-fg3 shrink-0 text-[12px]">{timeAgo(item.at)}</span>
                  </Link>
                ) : (
                  <Link href={hrefFor(item.lead)} className="k-hover flex items-start gap-3 px-4 py-3">
                    <CrewTile m={m} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="font-medium">{m?.crew.name ?? "Your crew"}</span>{" "}
                        {item.kind === "reply" ? "got a positive reply" : "brought a website visit"}
                      </p>
                      <p className="k-fg3 flex min-w-0 items-center gap-1.5 truncate text-[12px]">
                        {leadCompany(item.lead) && <CompanyMark name={leadCompany(item.lead) ?? ""} domain={leadCompanyDomain(item.lead)} size={14} />}
                        <span className="truncate">{[leadName(item.lead), leadCompany(item.lead)].filter(Boolean).join(" · ")}</span>
                      </p>
                    </div>
                    <span className="k-fg3 shrink-0 text-[12px]">{timeAgo(item.at)}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Keel draws an agent's mark on a tinted square in activity rows. */
function CrewTile({ m }: { m: Mission | null }) {
  if (!m) return <span className="h-6 w-6 shrink-0" />;
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px]"
      style={{ background: `color-mix(in oklab, ${m.crew.color} 14%, transparent)` }}
    >
      <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={14} />
    </span>
  );
}
