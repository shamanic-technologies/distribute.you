"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useNeedsYourCall, useTheirLastWords } from "@/components/v2/data";
import { useCrewRuns, useRunsTodayList, runState, runTaskLabel } from "@/components/v2/runs";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, personHref } from "@/components/v2/people-bits";

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
  const [view, setView] = useState<"board" | "list">("board");
  const [type, setType] = useState<"all" | "waiting" | "running" | "call" | "done">("all");

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
  const oldestCall = needsCall.reduce<string | null>((o, l) => (l.firstRepliedAt && (!o || l.firstRepliedAt < o) ? l.firstRepliedAt : o), null);
  const show = (t: typeof type) => type === "all" || type === t;

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
          <span className="mx-1 h-4 w-px bg-[var(--line)]" />
          <label className="k-btn relative h-7 pr-7 text-[12px]">
            <span className="k-fg2">Type</span>
            <span>{TYPE_LABEL[type]}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" className="k-fg3 pointer-events-none absolute right-2.5" aria-hidden="true">
              <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <select
              aria-label="Type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <span className="k-inset ml-auto inline-flex rounded-[9px] p-0.5 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={view === v ? "k-btn h-6 px-2 text-[12px]" : "k-btn-ghost h-6 px-2 text-[12px]"}
              >
                {v === "board" ? "Board" : "List"}
              </button>
            ))}
          </span>
        </div>

        {view === "list" ? (
          <WorkList
            waiting={show("waiting") ? waiting : []}
            running={show("running") ? running : []}
            calls={show("call") ? needsCall : []}
            done={show("done") ? doneShown : []}
            missionOf={missionOf}
            missionForLead={(l) => missionByCampaignId.get(l.campaignId) ?? null}
            personHrefFor={(l) => personHref(orgId, brandId, l)}
          />
        ) : (
        <div className="k-scroll mt-4 flex gap-4 overflow-x-auto pb-2">
          {show("waiting") && <Column
            title="Waiting"
            icon={<span className="h-3 w-3 rounded-full border-[1.5px] border-dashed border-[var(--fg-3)]" />}
            count={null}
            meta="not sending now"
          >
            {!settled ? <Skeleton /> : waiting.length === 0 ? <EmptyNote>No mission.</EmptyNote> : <WaitingList missions={waiting} />}
          </Column>}
          {show("running") && <Column
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
          </Column>}
          {show("call") && <Column
            title="Needs your call"
            icon={<span className="h-3 w-3 rounded-full border-[1.5px] border-[var(--fg-1)]" />}
            count={interested}
            meta={oldestCall ? `since ${friendlyTime(oldestCall)}` : "replied with interest"}
          >
            {callQ.data === undefined ? (
              callQ.isError ? <EmptyNote>We could not load these.</EmptyNote> : <Skeleton />
            ) : needsCall.length === 0 ? (
              <EmptyNote>Nobody is waiting on you.</EmptyNote>
            ) : (
              needsCall.map((l) => (
                <LeadCard key={l.id} brandId={brandId} lead={l} m={missionByCampaignId.get(l.campaignId) ?? null} href={personHref(orgId, brandId, l)} />
              ))
            )}
          </Column>}
          {show("done") && <Column
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
          </Column>}
        </div>
        )}
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

/** Keel's "Running for 02:03": the clock since the run's own start, ticking. */
function useElapsed(since: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function RunCard({ run, m }: { run: RunRow; m: Mission | null }) {
  const elapsed = useElapsed(run.startedAt);
  return (
    <Link href={m?.href ?? "#"} className="k-card block p-3">
      <div className="flex items-center gap-2 text-[12px]">
        {m ? <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} /> : null}
        <span className="font-medium">{m?.crew.name ?? "Crew"}</span>
        <span className="k-fg3 truncate">· {m?.offerName ?? ""}</span>
        <span className="k-mono ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--fg-2)]">
          <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
          <span className="sr-only">Running for</span>
          <span className="tabular-nums">{elapsed}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-medium">{runTaskLabel(run)}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--data-track)]">
        <div className="k-indeterminate h-full w-1/3 rounded-full bg-[var(--run)]" />
      </div>
      <p className="k-fg3 mt-1.5 flex justify-between text-[11px]">
        <span className="truncate">{m?.leg?.label ?? "In flight"}</span>
        <span className="k-mono shrink-0 tabular-nums">{Number(run.ownCostInUsdCents) > 0 ? formatCentsAsUsdAdaptive(Number(run.ownCostInUsdCents)) : ""}</span>
      </p>
    </Link>
  );
}

function LeadCard({ brandId, lead, m, href }: { brandId: string; lead: Lead; m: Mission | null; href: string }) {
  const company = leadCompany(lead);
  const at = lead.firstRepliedAt ?? null;
  const { inbound, settled } = useTheirLastWords(lead.id, brandId);
  const body = inbound?.bodyText?.trim() ?? "";
  return (
    <div className="k-card block p-3">
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
      <Link href={href} className="k-inset mt-2 block rounded-[8px] p-2 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        {!settled ? (
          <Shimmer className="h-8 w-full" />
        ) : inbound ? (
          <>
            {inbound.subject ? <p className="truncate text-[12px] font-medium">{inbound.subject}</p> : null}
            <p className="k-fg2 line-clamp-2 text-[12px] leading-[17px]">
              {body || (inbound.bodyStatus === "unavailable" ? "We hold this reply and could not read it." : "The reply says nothing.")}
            </p>
          </>
        ) : (
          <p className="k-fg3 text-[12px]">Open the conversation to read the reply.</p>
        )}
      </Link>
      <div className="mt-2.5 flex items-center gap-1.5">
        <Link href={href} className="k-btn-strong h-6 px-2 text-[12px]">Open conversation</Link>
        <a href={`mailto:${lead.email}`} className="k-btn h-6 px-2 text-[12px]">Email</a>
      </div>
    </div>
  );
}

const TYPE_LABEL = { all: "All", waiting: "Waiting", running: "Running", call: "Needs your call", done: "Done today" } as const;

/** Keel's List view: the same cards, one row each, newest first. */
function WorkList({
  waiting,
  running,
  calls,
  done,
  missionOf,
  missionForLead,
  personHrefFor,
}: {
  waiting: Mission[];
  running: RunRow[];
  calls: Lead[];
  done: DoneGroup[];
  missionOf: (r: RunRow) => Mission | null;
  missionForLead: (l: Lead) => Mission | null;
  personHrefFor: (l: Lead) => string;
}) {
  type Row = { key: string; state: string; dot: string; m: Mission | null; what: string; where: string; at: string | null; href: string };
  const rows: Row[] = [
    ...calls.map((l) => ({
      key: `c-${l.id}`,
      state: "Needs your call",
      dot: "var(--fg-1)",
      m: missionForLead(l),
      what: `Follow up with ${leadName(l)}`,
      where: leadCompany(l) ?? l.email,
      at: l.firstRepliedAt ?? null,
      href: personHrefFor(l),
    })),
    ...running.map((r) => ({
      key: `r-${r.id}`,
      state: "Running",
      dot: "var(--run)",
      m: missionOf(r),
      what: runTaskLabel(r),
      where: missionOf(r)?.offerName ?? "—",
      at: r.startedAt,
      href: missionOf(r)?.href ?? "#",
    })),
    ...waiting
      .filter((m) => !m.running)
      .map((m) => ({
        key: `w-${m.row.campaign.id}`,
        state: "Paused",
        dot: "var(--fg-4)",
        m,
        what: m.leg?.label ?? "Mission",
        where: m.offerName ?? "—",
        at: null,
        href: m.href,
      })),
    ...done.map((g) => ({
      key: `d-${g.key}`,
      state: `Done ${g.count}×`,
      dot: "var(--data-teal)",
      m: g.mission,
      what: g.label,
      where: g.mission?.offerName ?? "—",
      at: g.lastAt,
      href: g.mission?.href ?? "#",
    })),
  ];
  return (
    <div className="k-card mt-4 overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              {["State", "Crew", "What", "Where", "When"].map((h) => (
                <th key={h} className={`k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4 ${h === "When" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5}><EmptyNote>Nothing here.</EmptyNote></td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="k-row">
                  <td className="whitespace-nowrap py-2 pl-4 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.dot }} />
                      {r.state}
                    </span>
                  </td>
                  <td className="px-3">
                    {r.m ? (
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <CrewMark color={r.m.crew.color} glyph={r.m.crew.glyph} size={14} /> {r.m.crew.name}
                      </span>
                    ) : <span className="k-fg4">{"—"}</span>}
                  </td>
                  <td className="max-w-[280px] px-3"><Link href={r.href} className="block truncate hover:underline">{r.what}</Link></td>
                  <td className="k-fg2 max-w-[200px] truncate px-3">{r.where}</td>
                  <td className="k-mono k-fg3 whitespace-nowrap px-3 pr-4 text-right text-[12px]">{r.at ? timeAgo(r.at) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
