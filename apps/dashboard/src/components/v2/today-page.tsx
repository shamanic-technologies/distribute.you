"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { Lead } from "@/lib/api";
import { formatCount, formatUsdAdaptive, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { timeAgo } from "@/lib/friendly-datetime";
import { cumulativeWindow, dailyWindow, utcDay } from "@/lib/v2/series";
import { v2Href } from "@/lib/v2/routes";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { MaturityBadge } from "@/components/maturity-badge";
import {
  BarSpark,
  EmptyNote,
  Figure,
  Meter,
  SectionTitle,
  Shimmer,
  SparkLine,
  StateDot,
  StatTile,
  TopBar,
} from "@/components/v2/ui";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import {
  useNeedsYourCall,
  useBrandInfo,
  useBrandRevenue,
  useLatestInBucket,
  useStandingCounts,
} from "@/components/v2/data";
import {
  CompanyMark,
  PersonAvatar,
  leadCompany,
  leadCompanyDomain,
  leadName,
  leadTitle,
  v1LeadHref,
} from "@/components/v2/people-bits";

const SPARK_DAYS = 14;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * v2 "Today" (beta) — Keel's home, stating our brand. Every figure is a served field
 * on v1's own query keys; the only arithmetic is choosing which served bucket is today.
 */
export function TodayPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { user } = useUser();
  const now = useMemo(() => new Date(), []);
  const today = utcDay(now);
  const brand = useBrandInfo(brandId).data?.brand ?? null;
  const rev = useBrandRevenue(brandId);
  const data = rev.data;
  const standings = useStandingCounts(brandId).data;
  const { missions, settled: missionsSettled, missionByCampaignId } = useMissions(orgId, brandId);
  const { cents: budgetCents } = useRunningDailyBudgetCents(brandId, { enabled: rev.enabled });

  const outreach = data?.sequences ?? data?.outreachContacted;
  const outreachToday = outreach ? outreach.daily.find((d) => d.date === today)?.count ?? 0 : null;
  const spentToday = data?.spend ? data.spend.totalSpentTodayCents ?? data.spend.todaySpentCents ?? null : null;
  const running = missions.filter((m) => m.running);
  const learning = scopeIsLearning(missions.map((m) => m.row));
  const interestedStanding = standings?.counts.sales_interest ?? null;

  // Needs your call: people who REPLIED with interest and whom nobody has closed or
  // disqualified yet. `total` is lead-service's count of that set.
  const callQ = useNeedsYourCall(brandId, 5);
  const needsCall = callQ.data?.total ?? null;
  const visits = useLatestInBucket(brandId, "website_visit", 8);
  const replies = useLatestInBucket(brandId, "positive_reply", 8);

  const first = user?.firstName ?? null;
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const timeLine = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <TopBar
        crumbs={[{ label: "Today" }]}
        actions={
          <>
            <MaturityBadge level="beta" />
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
              {outreachToday == null ? (
                " "
              ) : (
                <>
                  Your crew started{" "}
                  <span className="k-fg underline decoration-[var(--line-strong)] underline-offset-4">
                    {formatCount(outreachToday)} {outreachToday === 1 ? "outreach" : "outreaches"}
                  </span>{" "}
                  today.
                  {needsCall != null && needsCall > 0 && (
                    <>
                      {" "}
                      <Link href={v2Href(orgId, brandId, "work")} className="k-fg hover:underline">
                        {formatCount(needsCall)} {needsCall === 1 ? "person replied" : "people replied"} with interest.
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
              <StatTile label="Pipeline" note={brand?.name ? "expected" : undefined}>
                {rev.pending ? <Shimmer className="h-7 w-20" /> : <Figure value={data?.totalPipelineUsd != null ? formatUsdAdaptive(data.totalPipelineUsd) : "—"} />}
                <SparkLine
                  className="mt-auto h-8 pt-2"
                  values={data?.roiHistory ? cumulativeWindow(data.roiHistory.daily.map((d) => ({ date: d.date, value: d.cumulativePipelineUsd })), 30, today) : null}
                />
              </StatTile>
              <StatTile label="Return" note="per dollar">
                {rev.pending ? (
                  <Shimmer className="h-7 w-16" />
                ) : (
                  <Figure value={learning ? "Learning" : formatRoi(data?.costEconomics.roiMultiple)} />
                )}
                <p className="k-fg3 mt-auto pt-2 text-[12px]">
                  {learning ? "Fewer than 10 outcomes yet" : "Pipeline over what it cost"}
                </p>
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
                {rev.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={outreachToday != null ? formatCount(outreachToday) : "—"} unit="sent" />}
                <div className="mt-auto pt-2">
                  <Meter value={spentToday} max={budgetCents} />
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
                    <Link href={v2Href(orgId, brandId, "deals")} className="hover:text-[var(--fg-1)]">
                      {interestedStanding != null ? `All ${formatCount(interestedStanding)} interested →` : "All deals →"}
                    </Link>
                  }
                >
                  Needs your call
                </SectionTitle>
                <div className="space-y-3">
                  {callQ.isPending && !callQ.isError ? (
                    [0, 1].map((i) => <Shimmer key={i} className="h-36 w-full rounded-xl" />)
                  ) : (callQ.data?.leads ?? []).length === 0 ? (
                    <div className="k-card">
                      <EmptyNote>Nobody is waiting on you. People who reply with interest land here.</EmptyNote>
                    </div>
                  ) : (
                    (callQ.data?.leads ?? []).map((lead, i) => (
                      <CallCard
                        key={lead.id}
                        lead={lead}
                        mission={missionByCampaignId.get(lead.campaignId) ?? null}
                        highlight={i === 0}
                        href={v1LeadHref(orgId, brandId, lead)}
                      />
                    ))
                  )}
                </div>
              </section>

              <aside className="space-y-6">
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
                      <span className="flex items-center gap-1.5">
                        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
                        Live
                      </span>
                    }
                  >
                    Crew activity
                  </SectionTitle>
                  <ActivityFeed
                    visits={visits.data?.leads ?? null}
                    replies={replies.data?.leads ?? null}
                    missionFor={(id) => missionByCampaignId.get(id) ?? null}
                    hrefFor={(lead) => v1LeadHref(orgId, brandId, lead)}
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
  lead,
  mission,
  highlight,
  href,
}: {
  lead: Lead;
  mission: Mission | null;
  highlight: boolean;
  href: string;
}) {
  const name = leadName(lead);
  const company = leadCompany(lead);
  const title = leadTitle(lead);
  const at = lead.firstRepliedAt ?? lead.firstClickedAt ?? null;
  return (
    <div className={`${highlight ? "k-card-accent" : "k-card"} grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_260px]`}>
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
        {mission?.offerName && <p className="k-fg3 mt-1 truncate text-[12px]">Mission {mission.crew.name} · {mission.offerName}</p>}
        <div className="mt-4 flex items-center gap-2">
          <Link href={href} className={highlight ? "k-btn-accent" : "k-btn-strong"}>
            Open conversation
          </Link>
          <a href={`mailto:${lead.email}`} className="k-btn">
            Email
          </a>
        </div>
      </div>
      <div className="k-inset hidden flex-col justify-center gap-1 rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--line-subtle)] md:flex">
        <div className="flex items-center gap-2">
          <PersonAvatar lead={lead} size={24} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{name}</p>
            <p className="k-fg3 truncate text-[12px]">{lead.email}</p>
          </div>
        </div>
      </div>
    </div>
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

function ActivityFeed({
  visits,
  replies,
  missionFor,
  hrefFor,
}: {
  visits: Lead[] | null;
  replies: Lead[] | null;
  missionFor: (campaignId: string) => Mission | null;
  hrefFor: (lead: Lead) => string;
}) {
  // A display merge of two served lists, ordered by the instant each one proves.
  const items = useMemo(() => {
    const out: { lead: Lead; kind: "visit" | "reply"; at: string }[] = [];
    for (const l of visits ?? []) if (l.firstClickedAt) out.push({ lead: l, kind: "visit", at: l.firstClickedAt });
    for (const l of replies ?? []) if (l.firstRepliedAt) out.push({ lead: l, kind: "reply", at: l.firstRepliedAt });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [visits, replies]);

  if (!visits && !replies) return <Shimmer className="h-48 w-full rounded-xl" />;
  return (
    <div className="k-card">
      {items.length === 0 ? (
        <EmptyNote>Nothing landed yet.</EmptyNote>
      ) : (
        <ul className="divide-y divide-[var(--line-subtle)]">
          {items.map(({ lead, kind, at }) => {
            const m = missionFor(lead.campaignId);
            const company = leadCompany(lead);
            return (
              <li key={`${kind}-${lead.id}`}>
                <Link href={hrefFor(lead)} className="k-hover flex items-start gap-3 px-4 py-3">
                  {m ? <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={20} /> : <span className="h-5 w-5" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      <span className="font-medium">{m?.crew.name ?? "Your crew"}</span>{" "}
                      {kind === "reply" ? "got a positive reply" : "brought a website visit"}
                    </p>
                    <p className="k-fg3 flex min-w-0 items-center gap-1.5 truncate text-[12px]">
                      {company && <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={14} />}
                      <span className="truncate">{[leadName(lead), company].filter(Boolean).join(" · ")}</span>
                    </p>
                  </div>
                  <span className="k-fg3 shrink-0 text-[12px]">{timeAgo(at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
