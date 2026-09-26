"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { RunRow } from "@/lib/api";
import { formatCount, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { isLearning } from "@/lib/learning-threshold";
import { timeAgo } from "@/lib/friendly-datetime";
import { v2Href } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission, type CrewSummary } from "@/components/v2/use-missions";
import { useCrewRuns, useRecentRuns, runState, runTaskLabel, type CrewRuns } from "@/components/v2/runs";
import { EmptyNote, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { useBrandRevenue } from "@/components/v2/data";

/** The result a mission's leg lands on, read off its own served group. */
export function missionResult(m: Mission): { count: number | null; noun: string; costCents: number | null } {
  const g = m.row.revenue;
  if (m.leg?.toKey === "conversation") {
    const n = g?.positiveReplies ?? null;
    return { count: n, noun: n === 1 ? "positive reply" : "positive replies", costCents: g?.cpprCents ?? null };
  }
  if (m.leg?.toKey === "website_visit") {
    const n = g?.websiteClicks ?? null;
    return { count: n, noun: n === 1 ? "website visit" : "website visits", costCents: g?.cpcCents ?? null };
  }
  return { count: null, noun: "results", costCents: null };
}

/** What a crew's RUNNING missions may spend today: the rule every v1 daily total uses. */
function crewCeilingCents(missions: Mission[]): number {
  return missions.reduce((s, m) => s + (m.running && (m.row.budgetCents ?? 0) > 0 ? (m.row.budgetCents ?? 0) : 0), 0);
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Crew (beta): Keel's agent grid on runs-service. A crew is one leg through one channel.
 * Each card states its runs today with a week of daily counts, when it last ran, what
 * it spent today against what its running missions may spend, and the result its
 * missions landed. The header states the brand's runs and spend today against its
 * running daily budget. Every figure is served; runs are only filed under their crew.
 */
export function CrewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { missions, crews, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const { byCrew, settled: runsSettled } = useCrewRuns(brandId, missionByCampaignId);
  const recent = useRecentRuns(brandId, 60);
  const revenue = useBrandRevenue(brandId);
  const { cents: ceiling } = useRunningDailyBudgetCents(brandId, { enabled: revenue.enabled });
  const runningCrews = crews.filter((c) => c.running > 0).length;

  let runsToday = 0;
  let spendToday = 0;
  for (const r of byCrew.values()) {
    runsToday += r.runsToday;
    spendToday += r.spendTodayCents;
  }

  // The latest run each crew made, off the served list (newest first).
  const lastRunByCrew = useMemo(() => {
    const out = new Map<string, RunRow>();
    for (const run of recent.data ?? []) {
      const m = run.campaignId ? missionByCampaignId.get(run.campaignId) : undefined;
      if (m && !out.has(m.crew.key)) out.set(m.crew.key, run);
    }
    return out;
  }, [recent.data, missionByCampaignId]);

  return (
    <>
      <TopBar
        crumbs={[{ label: "Crew" }]}
        actions={
          <>
            <Link href={v2Href(orgId, brandId, "offers")} className="k-btn">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M1.5 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5M12.5 5.5v4M10.5 7.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              Add a crew
            </Link>
            <MaturityBadge level="beta" />
          </>
        }
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {runsSettled && ceiling != null
                ? `${formatCount(runsToday)} ${runsToday === 1 ? "run" : "runs"} today, ${formatCentsAsUsdAdaptive(spendToday)} of ${fmtDailyBudgetUsd(ceiling)}`
                : "Your crew"}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {settled
                ? `${crews.length} ${crews.length === 1 ? "crew" : "crews"}. Each one moves your leads one step, through one channel.`
                : " "}
            </p>
          </div>
          {settled && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className={`h-1.5 w-1.5 rounded-full ${runningCrews ? "k-dot-pulse bg-[var(--run)] text-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
              {runningCrews} {runningCrews === 1 ? "crew" : "crews"} running now
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!settled
            ? [0, 1, 2].map((i) => <Shimmer key={i} className="h-80 rounded-xl" />)
            : crews.map((c) => (
                <CrewCard
                  key={c.crew.key}
                  crew={c}
                  missions={missions.filter((m) => m.crew.key === c.crew.key)}
                  runs={byCrew.get(c.crew.key) ?? null}
                  runsSettled={runsSettled}
                  lastRun={lastRunByCrew.get(c.crew.key) ?? null}
                  workHref={v2Href(orgId, brandId, "work")}
                />
              ))}
          {settled && (
            <div className="k-card flex min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="mb-2 flex gap-1.5">
                {(["square", "hex", "triangle"] as const).map((g) => (
                  <span key={g} className="k-inset inline-flex h-7 w-7 items-center justify-center rounded-[7px] shadow-[inset_0_0_0_1px_var(--line)]">
                    <CrewMark color="var(--fg-2)" glyph={g} size={14} />
                  </span>
                ))}
                <span className="k-inset inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--fg-2)] shadow-[inset_0_0_0_1px_var(--line)]">+</span>
              </div>
              <p className="text-[14px] font-medium">Add a crew</p>
              <p className="k-fg2 max-w-[260px] text-[13px]">
                Fund another channel on one of your offers, and a new crew starts working it.
              </p>
              <Link href={v2Href(orgId, brandId, "offers")} className="k-btn mt-2">
                + Open offers
              </Link>
            </div>
          )}
        </div>

        <RecentRuns runs={recent.data ?? null} error={recent.isError} missionFor={(id) => (id ? missionByCampaignId.get(id) ?? null : null)} crews={crews} />
      </div>
    </>
  );
}

function CrewCard({
  crew,
  missions,
  runs,
  runsSettled,
  lastRun,
  workHref,
}: {
  crew: CrewSummary;
  missions: Mission[];
  runs: CrewRuns | null;
  runsSettled: boolean;
  lastRun: RunRow | null;
  workHref: string;
}) {
  const ceiling = crewCeilingCents(missions);
  const leg = missions[0]?.leg?.label ?? null;
  const results = missions.map(missionResult);
  const counted = results.filter((r) => r.count != null);
  const resultCount = counted.length ? counted.reduce((s, r) => s + (r.count ?? 0), 0) : null;
  const priced = missions.length === 1 ? results[0] : null;
  const spend = runs?.spendTodayCents ?? 0;
  const pills = 10;
  const filled = ceiling > 0 ? Math.min(pills, Math.round((spend / ceiling) * pills)) : 0;
  const today = new Date().getDay();
  return (
    <div id={crew.crew.key} className="k-card flex scroll-mt-16 flex-col p-4">
      <div className="flex items-start gap-3">
        <CrewMark color={crew.crew.color} glyph={crew.crew.glyph} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-medium">{crew.crew.name}</p>
            <StateDot running={crew.running > 0} />
          </div>
          <p className="k-fg2 truncate text-[13px]">
            {leg ? `Brings ${leg.toLowerCase()}` : "Moves your leads one step"}
            {` · ${crew.missions} ${crew.missions === 1 ? "mission" : "missions"}`}
          </p>
        </div>
      </div>

      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        <div className="border-b border-r border-[var(--line-subtle)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="k-label">Runs today</p>
            <p className="k-fg3 text-[11px]">7 days</p>
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-[20px] font-medium leading-6 tabular-nums">{runsSettled ? formatCount(runs?.runsToday ?? 0) : "–"}</p>
            <div className="flex flex-col items-end">
              <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
                {(runs?.week ?? [0, 0, 0, 0, 0, 0, 0]).map((v, i, arr) => {
                  const max = Math.max(...arr, 1);
                  return (
                    <span
                      key={i}
                      className="w-[6px] rounded-[2px]"
                      style={{
                        height: `${Math.max(3, (v / max) * 20)}px`,
                        background: v > 0 ? crew.crew.color : "var(--data-track)",
                        opacity: v > 0 ? (i === arr.length - 1 ? 1 : 0.45) : 1,
                      }}
                    />
                  );
                })}
              </div>
              <div className="k-mono k-fg4 mt-0.5 flex gap-[3px] text-[7px] leading-none" aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => WEEKDAY_LETTERS[(today - 6 + i + 7) % 7]).map((l, i) => (
                  <span key={i} className="w-[6px] text-center">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-b border-[var(--line-subtle)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="k-label">Last run</p>
            <p className="k-fg3 text-[11px]">7 days</p>
          </div>
          <p className="mt-1.5 text-[20px] font-medium leading-6 tabular-nums">
            {!runsSettled ? "–" : runs?.lastRunAt ? timeAgo(runs.lastRunAt) : "None"}
          </p>
        </div>
        <div className="border-r border-[var(--line-subtle)] p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="k-label">Spend</p>
            <p className="k-fg3 text-[11px]">of {fmtDailyBudgetUsd(ceiling)}</p>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[20px] font-medium leading-6 tabular-nums">{runsSettled ? formatCentsAsUsdAdaptive(spend) : "–"}</p>
            <div className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: pills }, (_, i) => (
                <span
                  key={i}
                  className="h-4 w-[5px] rounded-full"
                  style={{ background: i < filled ? crew.crew.color : "var(--data-track)" }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="k-label">Result</p>
            <p className="k-fg3 truncate text-[11px]">all time</p>
          </div>
          <p className="mt-1.5 text-[20px] font-medium leading-6 tabular-nums">
            {resultCount != null ? formatCount(resultCount) : "–"}
            {priced && priced.count != null && (
              <span className="k-fg3 ml-1.5 text-[12px] font-normal">
                {isLearning(priced.count) ? "learning" : priced.costCents != null ? `${formatCentsAsUsdAdaptive(priced.costCents)} each` : ""}
              </span>
            )}
          </p>
        </div>
      </div>

      <Link href={workHref} className="k-hover -mx-2 mt-2 flex items-center gap-2 rounded-[8px] px-2 py-2 text-[13px]">
        <span className="k-fg3 shrink-0">{lastRun && runState(lastRun) === "running" ? "Now" : "Last"}</span>
        <span className="min-w-0 flex-1 truncate">
          {lastRun ? runTaskLabel(lastRun) : runs?.lastRunAt ? "Ran a step" : "No run in 7 days"}
        </span>
        {(lastRun?.startedAt ?? runs?.lastRunAt) && (
          <span className="k-mono k-fg3 shrink-0 text-[11px]">{timeAgo(lastRun?.startedAt ?? runs?.lastRunAt ?? "")}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg4 shrink-0" aria-hidden="true">
          <path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <ul className="mt-1 border-t border-[var(--line-subtle)] pt-1">
        {missions.map((m) => {
          const r = missionResult(m);
          return (
            <li key={m.row.campaign.id}>
              <Link href={m.href} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                <StateDot running={m.running} label="" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{m.offerName ?? "Offer"}</span>
                <span className="k-fg2 shrink-0 text-[12px] tabular-nums">
                  {r.count != null ? `${formatCount(r.count)} ${r.noun}` : fmtDailyBudgetUsd(m.row.budgetCents ?? 0) + " / day"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentRuns({
  runs,
  error,
  missionFor,
  crews,
}: {
  runs: RunRow[] | null;
  error: boolean;
  missionFor: (campaignId: string | null) => Mission | null;
  crews: CrewSummary[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const rows = (runs ?? []).filter((r) => {
    if (!filter) return true;
    return missionFor(r.campaignId)?.crew.key === filter;
  });
  return (
    <div className="mt-10">
      <SectionTitle
        count={runs ? runs.length : null}
        right={
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setFilter(null)} className={filter ? "k-btn-ghost" : "k-btn"}>All</button>
            {crews.map((c) => (
              <button
                key={c.crew.key}
                type="button"
                onClick={() => setFilter(c.crew.key)}
                className={filter === c.crew.key ? "k-btn" : "k-btn-ghost"}
              >
                <CrewMark color={c.crew.color} glyph={c.crew.glyph} size={14} /> {c.crew.name}
              </button>
            ))}
          </div>
        }
      >
        Recent runs
      </SectionTitle>
      {runs === null ? (
        error ? <EmptyNote>We could not load the runs. Retrying.</EmptyNote> : <Shimmer className="h-48 rounded-xl" />
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  {["Time", "Crew", "Step", "Mission", "Status", "Cost"].map((h) => (
                    <th key={h} className={`k-label px-3 py-2.5 font-medium first:pl-4 last:pr-4 ${h === "Cost" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6}><EmptyNote>No run yet.</EmptyNote></td></tr>
                ) : (
                  rows.slice(0, 30).map((run) => {
                    const m = missionFor(run.campaignId);
                    const st = runState(run);
                    const cost = Number(run.ownCostInUsdCents);
                    return (
                      <tr key={run.id} className="k-row">
                        <td className="k-mono k-fg2 whitespace-nowrap py-2 pl-4 pr-3 text-[12px] tabular-nums">
                          {new Date(run.startedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-3">
                          {m ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <CrewMark color={m.crew.color} glyph={m.crew.glyph} /> {m.crew.name}
                            </span>
                          ) : <span className="k-fg4">{"—"}</span>}
                        </td>
                        <td className="px-3">{runTaskLabel(run)}</td>
                        <td className="k-fg2 px-3">{m?.offerName ?? "—"}</td>
                        <td className="px-3">
                          <span className="inline-flex items-center gap-1.5 text-[12px]">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: st === "failed" ? "var(--data-rose)" : st === "running" ? "var(--run)" : "var(--data-teal)" }}
                            />
                            {st === "failed" ? "Failed" : st === "running" ? "Running" : "Done"}
                          </span>
                        </td>
                        <td className="k-mono k-fg2 px-3 pr-4 text-right text-[12px] tabular-nums">
                          {cost > 0 ? formatCentsAsUsdAdaptive(cost) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
