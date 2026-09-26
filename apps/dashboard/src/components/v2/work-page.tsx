"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Lead, RunRow } from "@/lib/api";
import { formatCount, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { friendlyTime, timeAgo } from "@/lib/friendly-datetime";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { campaignHoldCopy, useMissionHold } from "@/components/v2/mission-hold";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { useNeedsYourCall } from "@/components/v2/data";
import { useCrewRuns, useRunsTodayList, runState, runTaskLabel } from "@/components/v2/runs";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, v1LeadHref } from "@/components/v2/people-bits";

interface DoneGroup {
  key: string;
  mission: Mission | null;
  label: string;
  count: number;
  costCents: number;
  lastAt: string;
}

/**
 * Work (beta): Keel's task board on runs-service. What waits (missions not sending
 * right now, each stating why), what is running (today's runs still in flight), what
 * needs a person (interested replies), and what the crew finished today (today's runs,
 * grouped by crew and step). Every card is a served row; the crew filter only hides
 * cards already loaded.
 */
export function WorkPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { missions, crews, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const callQ = useNeedsYourCall(brandId, 10);
  const interested = callQ.data?.total ?? null;
  const today = useRunsTodayList(brandId, 200);
  const { byCrew, settled: rollupSettled } = useCrewRuns(brandId, missionByCampaignId);
  const [crewFilter, setCrewFilter] = useState<string | null>(null);

  let runsToday = 0;
  let spendToday = 0;
  for (const r of byCrew.values()) {
    runsToday += r.runsToday;
    spendToday += r.spendTodayCents;
  }

  const keep = (m: Mission | null) => !crewFilter || m?.crew.key === crewFilter;
  const runs = today.data ?? null;
  const running = (runs ?? []).filter((r) => runState(r) === "running").filter((r) => keep(missionOf(r)));
  function missionOf(r: RunRow): Mission | null {
    return r.campaignId ? missionByCampaignId.get(r.campaignId) ?? null : null;
  }

  const done = useMemo<DoneGroup[]>(() => {
    const groups = new Map<string, DoneGroup>();
    for (const r of runs ?? []) {
      if (runState(r) !== "done") continue;
      const m = r.campaignId ? missionByCampaignId.get(r.campaignId) ?? null : null;
      const label = runTaskLabel(r);
      const key = `${m?.crew.key ?? "none"}|${label}`;
      const g = groups.get(key) ?? { key, mission: m, label, count: 0, costCents: 0, lastAt: r.startedAt };
      g.count += 1;
      g.costCents += Number(r.ownCostInUsdCents);
      if (r.startedAt > g.lastAt) g.lastAt = r.startedAt;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [runs, missionByCampaignId]);
  const doneShown = done.filter((g) => keep(g.mission));

  const waiting = missions.filter((m) => keep(m));
  const needsCall = (callQ.data?.leads ?? []).filter((l) => keep(missionByCampaignId.get(l.campaignId) ?? null));
  const runningCrews = crews.filter((c) => c.running > 0).length;

  return (
    <>
      <TopBar crumbs={[{ label: "Work" }]} actions={<MaturityBadge level="beta" />} />
      <div className="px-4 pb-10 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {interested == null ? "Work" : interested === 0 ? "Nothing needs your call" : `${formatCount(interested)} ${interested === 1 ? "needs" : "need"} your call`}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {rollupSettled ? (
                <>
                  <span className="k-fg font-medium tabular-nums">{formatCount(runsToday)}</span> {runsToday === 1 ? "run" : "runs"} today, {formatCentsAsUsdAdaptive(spendToday)} spent so far.
                </>
              ) : (
                " "
              )}
            </p>
          </div>
          {settled && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${runningCrews ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {runningCrews} {runningCrews === 1 ? "crew" : "crews"} running now
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {crews.map((c) => {
            const on = crewFilter === c.crew.key;
            return (
              <button
                key={c.crew.key}
                type="button"
                aria-pressed={on}
                title={c.crew.name}
                onClick={() => setCrewFilter(on ? null : c.crew.key)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${on ? "bg-[var(--bg-selected)] shadow-[inset_0_0_0_1px_var(--line-strong)]" : "k-hover"}`}
              >
                <CrewMark color={c.crew.color} glyph={c.crew.glyph} size={18} />
              </button>
            );
          })}
          {crewFilter && (
            <button type="button" onClick={() => setCrewFilter(null)} className="k-btn-ghost text-[12px]">
              Show every crew
            </button>
          )}
        </div>

        <div className="k-scroll mt-4 flex gap-4 overflow-x-auto pb-2">
          <Column
            title="Waiting"
            icon={<span className="h-3 w-3 rounded-full border-[1.5px] border-dashed border-[var(--fg-3)]" />}
            count={null}
            meta="not sending now"
          >
            {!settled ? <Skeleton /> : waiting.length === 0 ? <EmptyNote>No mission.</EmptyNote> : <WaitingList missions={waiting} />}
          </Column>
          <Column
            title="Running"
            icon={<span className="k-dot-pulse h-2 w-2 rounded-full bg-[var(--run)] text-[var(--run)]" />}
            count={runs ? running.length : null}
            meta="started today"
          >
            {runs === null ? (
              today.isError ? <EmptyNote>We could not load today&apos;s runs.</EmptyNote> : <Skeleton />
            ) : running.length === 0 ? (
              <EmptyNote>Nothing in flight right now.</EmptyNote>
            ) : (
              running.slice(0, 20).map((r) => <RunCard key={r.id} run={r} m={missionOf(r)} />)
            )}
          </Column>
          <Column
            title="Needs your call"
            icon={<span className="h-3 w-3 rounded-full border-[1.5px] border-[var(--fg-1)]" />}
            count={interested}
            meta="replied with interest"
          >
            {callQ.data === undefined ? (
              callQ.isError ? <EmptyNote>We could not load these.</EmptyNote> : <Skeleton />
            ) : needsCall.length === 0 ? (
              <EmptyNote>Nobody is waiting on you.</EmptyNote>
            ) : (
              needsCall.map((l) => (
                <LeadCard key={l.id} lead={l} m={missionByCampaignId.get(l.campaignId) ?? null} href={v1LeadHref(orgId, brandId, l)} />
              ))
            )}
          </Column>
          <Column
            title="Done today"
            icon={
              <svg width="13" height="13" viewBox="0 0 14 14" className="text-[var(--data-teal)]" aria-hidden="true">
                <circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.15" />
                <path d="M4.2 7.2 6.2 9.1 9.8 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            count={runs ? doneShown.reduce((s, g) => s + g.count, 0) : null}
            meta={runs && !today.complete ? "latest 200" : `${formatCentsAsUsdAdaptive(doneShown.reduce((s, g) => s + g.costCents, 0))}`}
          >
            {runs === null ? (
              today.isError ? <EmptyNote>We could not load today&apos;s runs.</EmptyNote> : <Skeleton />
            ) : doneShown.length === 0 ? (
              <EmptyNote>Nothing finished yet today.</EmptyNote>
            ) : (
              doneShown.map((g) => <DoneCard key={g.key} g={g} />)
            )}
          </Column>
        </div>
      </div>
    </>
  );
}

function Skeleton() {
  return <>{[0, 1, 2].map((i) => <Shimmer key={i} className="h-[84px] rounded-[10px]" />)}</>;
}

function Column({
  title,
  icon,
  count,
  meta,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number | null;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-[280px] min-w-[240px] shrink-0 flex-col md:flex-1 md:basis-0">
      <header className="flex h-8 items-center gap-2 px-0.5">
        <span className="inline-flex w-3.5 justify-center">{icon}</span>
        <span className="text-[13px] font-medium">{title}</span>
        <span className="k-fg3 text-[13px] tabular-nums">{count == null ? "" : formatCount(count)}</span>
        {meta != null && <span className="k-mono k-fg3 ml-auto truncate text-[11px]">{meta}</span>}
      </header>
      <div className="mt-1 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function WaitingList({ missions }: { missions: Mission[] }) {
  return (
    <>
      {missions.map((m) => (
        <WaitingCard key={m.row.campaign.id} m={m} />
      ))}
    </>
  );
}

function WaitingCard({ m }: { m: Mission }) {
  const hold = useMissionHold(m.row.campaign.id, m.running);
  // A running mission with no hold is sending: it belongs to Running, not here.
  if (m.running && !hold) return null;
  return (
    <Link href={m.href} className="k-card block p-3">
      <div className="flex items-center gap-2 text-[12px]">
        <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} />
        <span className="font-medium">{m.crew.name}</span>
        <span className="k-fg3">·</span>
        <span className="k-fg2 truncate">{m.running ? "Held" : "Paused"}</span>
        <span className="k-mono k-fg3 ml-auto shrink-0 text-[11px]">{fmtDailyBudgetUsd(m.row.budgetCents ?? 0)}/day</span>
      </div>
      <p className="mt-1.5 truncate text-[13px] font-medium">{m.offerName ?? "Offer"}{m.leg ? ` · ${m.leg.label}` : ""}</p>
      <p className={`mt-1 text-[12px] ${hold ? "text-[var(--data-amber)]" : "k-fg3"}`}>
        {hold ? campaignHoldCopy(hold).headline : "Paused. Restart it from its mission."}
      </p>
    </Link>
  );
}

function RunCard({ run, m }: { run: RunRow; m: Mission | null }) {
  return (
    <Link href={m?.href ?? "#"} className="k-card block p-3">
      <div className="flex items-center gap-2 text-[12px]">
        {m ? <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} /> : null}
        <span className="font-medium">{m?.crew.name ?? "Crew"}</span>
        <span className="k-fg3 truncate">· {m?.offerName ?? ""}</span>
        <span className="k-mono ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--fg-2)]">
          <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
          {timeAgo(run.startedAt)}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium">{runTaskLabel(run)}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--data-track)]">
        <div className="k-indeterminate h-full w-1/3 rounded-full bg-[var(--run)]" />
      </div>
    </Link>
  );
}

function LeadCard({ lead, m, href }: { lead: Lead; m: Mission | null; href: string }) {
  const company = leadCompany(lead);
  const at = lead.firstRepliedAt ?? null;
  return (
    <Link href={href} className="k-card block p-3">
      <div className="flex items-center gap-2 text-[12px]">
        {m ? <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} /> : null}
        <span className="font-medium">{m?.crew.name ?? "Crew"}</span>
        <span className="k-fg3">· Replied with interest</span>
        <span className="k-mono k-fg3 ml-auto shrink-0 text-[11px]">{at ? timeAgo(at) : ""}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-[13px] font-medium">
        <PersonAvatar lead={lead} size={18} />
        <span className="truncate">Follow up with {leadName(lead)}</span>
      </p>
      {company ? (
        <div className="k-fg2 mt-1 flex items-center gap-1.5 text-[12px]">
          <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={14} />
          <span className="truncate">{company}</span>
        </div>
      ) : null}
      <div className="mt-2.5 flex gap-1.5">
        <span className="k-btn-strong h-6 px-2 text-[12px]">Open conversation</span>
      </div>
    </Link>
  );
}

function DoneCard({ g }: { g: DoneGroup }) {
  return (
    <Link href={g.mission?.href ?? "#"} className="k-card block p-3">
      <div className="flex items-center gap-2 text-[12px]">
        {g.mission ? <CrewMark color={g.mission.crew.color} glyph={g.mission.crew.glyph} size={16} /> : null}
        <span className="font-medium">{g.mission?.crew.name ?? "Crew"}</span>
        <span className="k-fg3 truncate">· {g.mission?.offerName ?? ""}</span>
        <span className="k-mono k-fg3 ml-auto shrink-0 text-[11px]">{friendlyTime(g.lastAt)}</span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium">{g.label}</p>
      <p className="k-fg2 mt-1 flex items-center gap-1.5 text-[12px] tabular-nums">
        <svg width="12" height="12" viewBox="0 0 14 14" className="text-[var(--data-teal)]" aria-hidden="true">
          <path d="M3.5 7.3 6 9.6l4.6-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {formatCount(g.count)} {g.count === 1 ? "time" : "times"}
        {g.costCents > 0 ? ` · ${formatCentsAsUsdAdaptive(g.costCents)}` : ""}
      </p>
    </Link>
  );
}
