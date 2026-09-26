"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { listLeadsPage, type Lead } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadsColumnPageQuery } from "@/lib/leads-server-page";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { utcDay } from "@/lib/v2/series";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { campaignHoldCopy, useMissionHold } from "@/components/v2/mission-hold";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { brandLeadScopeKey, useLatestInBucket, useStandingCounts } from "@/components/v2/data";
import { EmptyNote, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, v1LeadHref } from "@/components/v2/people-bits";

/**
 * Work (beta): Keel's task board, answering "what is the crew doing and what is waiting
 * on me". Paused missions wait on the customer, running missions are the crew at work
 * (each states its own hold when campaign-service has one), interested replies are the
 * calls only a person can make, and what landed today is done. Every card is a served
 * row; nothing is scheduled or invented.
 */
export function WorkPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { missions, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const interested = useStandingCounts(brandId).data?.counts.sales_interest ?? null;
  const callQ = useAuthQuery(
    ["leadsPage", brandLeadScopeKey(brandId), "column", "sales_interest", "", 10],
    () => listLeadsPage({ brandId }, leadsColumnPageQuery({ column: "sales_interest", search: "", shown: 10 })),
    { refetchInterval: POLL_INTERVAL },
  );
  const visits = useLatestInBucket(brandId, "website_visit", 15);
  const replies = useLatestInBucket(brandId, "positive_reply", 15);

  const today = utcDay(new Date());
  const done: { lead: Lead; kind: string; at: string }[] = [];
  for (const l of visits.data?.leads ?? []) if (l.firstClickedAt?.slice(0, 10) === today) done.push({ lead: l, kind: "Website visit", at: l.firstClickedAt });
  for (const l of replies.data?.leads ?? []) if (l.firstRepliedAt?.slice(0, 10) === today) done.push({ lead: l, kind: "Positive reply", at: l.firstRepliedAt });
  done.sort((a, b) => b.at.localeCompare(a.at));
  const doneSettled = visits.data !== undefined && replies.data !== undefined;

  const paused = missions.filter((m) => !m.running);
  const running = missions.filter((m) => m.running);

  return (
    <>
      <TopBar crumbs={[{ label: "Work" }]} actions={<MaturityBadge level="beta" />} />
      <div className="px-4 pb-10 pt-5 md:px-6">
        <h1 className="text-[20px] font-medium tracking-[-0.01em]">Work</h1>
        <p className="k-fg2 mt-1 text-[13px]">What your crew is doing, and what is waiting on you.</p>
        <div className="k-scroll mt-4 flex gap-3 overflow-x-auto pb-2">
          <Column title="Paused" dot="var(--fg-4)" count={settled ? paused.length : null}>
            {!settled ? <Skeleton /> : paused.length === 0 ? <EmptyNote>Every mission is running.</EmptyNote> : paused.map((m) => <MissionCard key={m.row.campaign.id} m={m} />)}
          </Column>
          <Column title="In progress" dot="var(--data-teal)" count={settled ? running.length : null}>
            {!settled ? <Skeleton /> : running.length === 0 ? <EmptyNote>No mission is running.</EmptyNote> : running.map((m) => <MissionCard key={m.row.campaign.id} m={m} />)}
          </Column>
          <Column title="Needs your call" dot="var(--accent)" count={interested}>
            {callQ.data === undefined ? (
              callQ.isError ? <EmptyNote>We could not load these.</EmptyNote> : <Skeleton />
            ) : callQ.data.leads.length === 0 ? (
              <EmptyNote>Nobody is waiting on you.</EmptyNote>
            ) : (
              callQ.data.leads.map((l) => (
                <LeadCard key={l.id} lead={l} kind="Wants to talk" at={l.firstRepliedAt ?? null} m={missionByCampaignId.get(l.campaignId) ?? null} href={v1LeadHref(orgId, brandId, l)} />
              ))
            )}
          </Column>
          <Column title="Landed today" dot="var(--data-lime)" count={doneSettled ? done.length : null}>
            {!doneSettled ? <Skeleton /> : done.length === 0 ? <EmptyNote>Nothing yet today.</EmptyNote> : done.map((d) => (
              <LeadCard key={`${d.kind}-${d.lead.id}`} lead={d.lead} kind={d.kind} at={d.at} m={missionByCampaignId.get(d.lead.campaignId) ?? null} href={v1LeadHref(orgId, brandId, d.lead)} />
            ))}
          </Column>
        </div>
      </div>
    </>
  );
}

function Skeleton() {
  return <>{[0, 1, 2].map((i) => <Shimmer key={i} className="h-[76px] rounded-[10px]" />)}</>;
}

function Column({ title, dot, count, children }: { title: string; dot: string; count: number | null; children: React.ReactNode }) {
  return (
    <section className="k-surface flex w-[280px] min-w-[240px] shrink-0 flex-col rounded-[12px] p-2 shadow-[inset_0_0_0_1px_var(--line-subtle)] md:flex-1 md:basis-0">
      <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        <span className="text-[13px] font-medium">{title}</span>
        <span className="k-fg3 ml-auto text-[12px] tabular-nums">{count == null ? "" : formatCount(count)}</span>
      </header>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function MissionCard({ m }: { m: Mission }) {
  const hold = useMissionHold(m.row.campaign.id, m.running);
  return (
    <Link href={m.href} className="k-card k-hover block p-2.5">
      <div className="flex items-center gap-2">
        <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={18} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{m.crew.name}</span>
        <StateDot running={m.running && !hold} label={hold ? "Held" : undefined} />
      </div>
      <p className="k-fg2 mt-1 truncate text-[12px]">{m.offerName ?? "Offer"}{m.leg ? ` · ${m.leg.label}` : ""}</p>
      {hold ? (
        <p className="mt-1.5 text-[12px] text-[var(--data-amber)]">{campaignHoldCopy(hold).headline}</p>
      ) : (
        <p className="k-fg3 mt-1.5 text-[11px] tabular-nums">
          {m.row.budgetCents != null ? `${fmtDailyBudgetUsd(m.row.budgetCents)} a day` : ""}
        </p>
      )}
    </Link>
  );
}

function LeadCard({ lead, kind, at, m, href }: { lead: Lead; kind: string; at: string | null; m: Mission | null; href: string }) {
  const company = leadCompany(lead);
  return (
    <Link href={href} className="k-card k-hover block p-2.5">
      <div className="flex items-center gap-2">
        <PersonAvatar lead={lead} size={18} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{leadName(lead)}</span>
      </div>
      {company ? (
        <div className="k-fg2 mt-1 flex items-center gap-1.5 text-[12px]">
          <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={14} />
          <span className="truncate">{company}</span>
        </div>
      ) : null}
      <div className="k-fg3 mt-1.5 flex items-center gap-1.5 text-[11px]">
        <span className="k-chip">{kind}</span>
        {m ? <span className="truncate">{m.crew.name}</span> : null}
        <span className="ml-auto shrink-0 tabular-nums">{at ? timeAgo(at) : ""}</span>
      </div>
    </Link>
  );
}
