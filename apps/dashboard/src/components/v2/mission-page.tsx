"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Lead, RunRow } from "@/lib/api";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { formatCentsAsUsdAdaptive, formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDate, friendlyDateTime, timeAgo } from "@/lib/friendly-datetime";
import { shownFigure } from "@/lib/maturity";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useStaffMode } from "@/lib/use-staff-mode";
import { StatBasisSwitch } from "@/components/v2/stat-basis-switch";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { v2Href, v2RunHref } from "@/lib/v2/routes";
import { runState, runTaskLabel, useRecentRuns } from "@/components/v2/runs";
import { CrewMark } from "@/components/v2/crew-mark";
import { CrewTriggerTag } from "@/components/v2/crew-trigger-tag";
import { crewTrigger } from "@/lib/v2/crews";
import { campaignHoldCopy, useMissionHold } from "@/components/v2/mission-hold";
import { useMissions } from "@/components/v2/use-missions";
import { V2TabLink, missionTabs } from "@/components/v2/setup-pages";
import { useLatestInBucket } from "@/components/v2/data";
import { EmptyNote, Figure, SectionTitle, Shimmer, StateDot, StatTile, TopBar } from "@/components/v2/ui";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, leadTitle, personHref } from "@/components/v2/people-bits";

/**
 * One mission, laid out as Keel lays out one record: identity and state on top,
 * the figures in a row, what it produced in the main column, the facts about it on the
 * right. Every figure is the mission's own served group; the controls are v1's modal;
 * the hold is campaign-service's own sentence.
 */
export function MissionPage() {
  const { orgId, brandId, campaignId } = useParams<{ orgId: string; brandId: string; campaignId: string }>();
  const { missions, settled, missionByCampaignId } = useMissions(orgId, brandId, { allOffers: true });
  const mission = missionByCampaignId.get(campaignId) ?? null;
  const id = mission?.row.campaign.id ?? campaignId;
  const hold = useMissionHold(id, mission?.running ?? false);
  const budgetHidden = useDailyBudgetHidden();
  const visits = useLatestInBucket(brandId, "website_visit", 20, id);
  const replies = useLatestInBucket(brandId, "positive_reply", 20, id);
  const { basis } = useStatBasis();
  const { staffMode } = useStaffMode();

  // Every stored campaign row of this mission: a run is filed under whichever row was
  // live when it ran, so the ancestors carry its older work.
  const runIds = useMemo(() => {
    if (!mission) return null;
    const live = mission.row.campaign.id;
    return [live, ...[...missionByCampaignId.entries()].filter(([cid, m]) => m === mission && cid !== live).map(([cid]) => cid)];
  }, [mission, missionByCampaignId]);
  const runs = useRecentRuns(brandId, runIds, 60);

  const results = useMemo(() => {
    const out: { lead: Lead; kind: string; at: string }[] = [];
    for (const l of visits.data?.leads ?? []) if (l.firstClickedAt) out.push({ lead: l, kind: "Website visit", at: l.firstClickedAt });
    for (const l of replies.data?.leads ?? []) if (l.firstRepliedAt) out.push({ lead: l, kind: "Positive reply", at: l.firstRepliedAt });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
  }, [visits.data, replies.data]);
  const resultsSettled = visits.data !== undefined && replies.data !== undefined;

  if (settled && !mission) {
    return (
      <>
        <TopBar crumbs={[{ label: "Missions", href: staffMode ? v2Href(orgId, brandId, "missions") : undefined }, { label: "Not found" }]} />
        <EmptyNote>This mission does not exist on this brand.</EmptyNote>
      </>
    );
  }

  const g = mission?.row.revenue ?? null;
  const replyLed = mission?.leg?.toKey === "conversation";
  const resultCount = replyLed ? g?.positiveReplies : g?.websiteClicks;
  // The MATURE half of the served pairs, Learning exactly where the producer says so.
  const resultCost = shownFigure(g?.outcomesMaturity, (h) => (replyLed ? h.cpprCents : h.cpcCents), basis);
  const roi = shownFigure(g?.economicsMaturity, (h) => h.roiMultiple, basis);
  const name = mission ? `${mission.crew.name} · ${mission.offerName ?? "Offer"}` : "";
  const siblings = mission ? missions.filter((m) => m.crew.key === mission.crew.key && m !== mission) : [];
  const isEvent = crewTrigger(mission?.leg ?? null)?.kind === "event";
  const runList = runs.data ?? null;
  const todayKey = new Date().toDateString();
  const runsToday = runList ? runList.filter((r) => new Date(r.startedAt).toDateString() === todayKey).length : null;

  return (
    <>
      <TopBar
        crumbs={[{ label: "Missions", href: staffMode ? v2Href(orgId, brandId, "missions") : undefined }, { label: name || " " }]}
        actions={<StatBasisSwitch />}
      />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        {!mission ? (
          <Shimmer className="h-16 w-full rounded-xl" />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CrewMark color={mission.crew.color} glyph={mission.crew.glyph} size={40} />
              <div className="min-w-0">
                <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <StateDot running={mission.running && !hold} label={hold ? "Held" : undefined} hold={mission.paymentHold} />
                  {crewTrigger(mission.leg) ? (
                    <CrewTriggerTag trigger={crewTrigger(mission.leg)!} className="k-fg2 text-[13px]" />
                  ) : mission.leg ? (
                    <span className="k-chip">{mission.leg.label}</span>
                  ) : null}
                </div>
                <dl className="k-fg3 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
                  {budgetHidden ? null : <Fact k={isEvent ? "Daily cap" : "Daily budget"} v={`${fmtDailyBudgetUsd(mission.row.budgetCents)} / day`} />}
                  {mission.row.campaign.createdAt ? <Fact k="Started" v={friendlyDate(mission.row.campaign.createdAt)} /> : null}
                  {g?.totalPipelineUsd != null ? <Fact k="Pipeline" v={formatUsdAdaptive(g.totalPipelineUsd)} /> : null}
                  {siblings.length > 0 ? (
                    <div className="flex items-baseline gap-1.5">
                      <dt>Also on</dt>
                      <dd className="flex flex-wrap gap-x-2">
                        {siblings.map((sib) => (
                          <Link key={sib.row.campaign.id} href={sib.href} className="k-fg2 hover:underline">
                            {sib.offerName ?? "Offer"}
                          </Link>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CampaignControlsTrigger
                brandId={brandId}
                campaignId={mission.row.campaign.id}
                totalCentsOverride={mission.row.budgetCents}
                cap={crewTrigger(mission.leg)?.kind === "event"}
              />
            </div>
          </div>
        )}

        {mission ? (
          <nav className="k-line-subtle mt-4 flex gap-5 border-b" aria-label="Sections">
            {missionTabs(orgId, brandId, mission.row.campaign.id, "overview", staffMode).map((t) => (
              <V2TabLink key={t.href} tab={t} />
            ))}
          </nav>
        ) : null}

        {hold ? (
          <div className="k-card mt-4 p-4 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--data-amber)_35%,transparent)]">
            <p className="text-[13px] font-medium">{campaignHoldCopy(hold).headline}</p>
            <p className="k-fg2 mt-1 text-[13px]">{campaignHoldCopy(hold).body}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={replyLed ? "Positive replies" : "Website visits"}>
            <Figure value={resultCount == null ? "—" : formatCount(resultCount)} />
          </StatTile>
          <StatTile label={replyLed ? "Cost / reply" : "Cost / visit"}>
            <Figure
              value={resultCost.learning ? "Learning" : resultCost.value == null ? "—" : formatCentsAsUsdAdaptive(resultCost.value)}
            />
          </StatTile>
          <StatTile label="Spent">
            <Figure value={g?.committedCostUsd == null ? "—" : formatUsdAdaptive(g.committedCostUsd)} />
          </StatTile>
          <StatTile label="Return">
            <Figure value={roi.learning ? "Learning" : formatRoi(roi.value, "—")} />
          </StatTile>
        </div>

        {/* The work and what it brought in, side by side, each scrolling on its own on a
            wide screen. Stacked on a phone, where a scroll inside a scroll is a trap. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="min-w-0">
            <SectionTitle
              count={runList ? runList.length : null}
              right={runsToday != null ? <span>{formatCount(runsToday)} {runsToday === 1 ? "run" : "runs"} today</span> : undefined}
            >
              The work
            </SectionTitle>
            <div className={COLUMN}>
              {runList === null ? (
                runs.isError ? (
                  <EmptyNote>We could not load the runs. Retrying.</EmptyNote>
                ) : (
                  <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-14 w-full rounded-[10px]" />)}</div>
                )
              ) : runList.length === 0 ? (
                <EmptyNote>
                  {isEvent
                    ? `Waits for a ${mission?.leg?.fromLabel?.toLowerCase() ?? "lead"}. Nothing has come in yet.`
                    : "No run yet. The work shows here as it happens."}
                </EmptyNote>
              ) : (
                <ul className="space-y-2 p-3">
                  {runList.map((run) => (
                    <li key={run.id}>
                      <MissionRunCard run={run} href={v2RunHref(orgId, brandId, run.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="min-w-0">
            <SectionTitle count={resultsSettled ? results.length : null}>What it brought in</SectionTitle>
            <div className={COLUMN}>
              {!resultsSettled ? (
                <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-8 w-full" />)}</div>
              ) : results.length === 0 ? (
                <EmptyNote>Nothing yet. Results show here as they land.</EmptyNote>
              ) : (
                <ul className="divide-y divide-[var(--line-subtle)]">
                  {results.map(({ lead, kind, at }) => {
                    const company = leadCompany(lead);
                    const title = leadTitle(lead);
                    return (
                      <li key={`${kind}-${lead.id}`}>
                        <Link href={personHref(orgId, brandId, lead)} className="k-hover flex items-center gap-3 px-4 py-2.5">
                          <PersonAvatar lead={lead} size={28} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{leadName(lead)}</span>
                            <span className="k-fg3 flex items-center gap-1.5 truncate text-[12px]">
                              {company ? <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={12} /> : null}
                              {[title, company].filter(Boolean).join(" at ")}
                            </span>
                          </span>
                          <span className="k-chip shrink-0">{kind}</span>
                          <span className="k-fg3 hidden shrink-0 text-[12px] tabular-nums sm:inline">{friendlyDateTime(at)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** A column: a card that scrolls on its own on a wide screen, and flows on a phone. */
const COLUMN = "k-card k-scroll overflow-hidden lg:max-h-[calc(100svh-340px)] lg:min-h-[320px] lg:overflow-y-auto";

/** How long one run took, off its own two served instants. */
function took(run: RunRow): string | null {
  if (!run.completedAt) return null;
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** One run of this mission: what it did, its state, when, how long, what it cost. */
function MissionRunCard({ run, href }: { run: RunRow; href: string }) {
  const st = runState(run);
  const cost = Number(run.ownCostInUsdCents);
  const duration = took(run);
  return (
    <Link href={href} className="k-hover block rounded-[10px] p-3 shadow-[inset_0_0_0_1px_var(--line-subtle)]">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${st === "running" ? "k-dot-pulse text-[var(--run)]" : ""}`}
          style={{ background: st === "failed" ? "var(--data-rose)" : st === "running" ? "var(--run)" : "var(--data-teal)" }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{runTaskLabel(run)}</span>
        <span className="k-mono k-fg3 shrink-0 text-[11px]">{timeAgo(run.startedAt)}</span>
      </div>
      <p className="k-fg3 mt-1 flex justify-between gap-2 pl-3.5 text-[12px]">
        <span>{st === "failed" ? "Failed" : st === "running" ? "Running" : "Done"}{duration ? ` in ${duration}` : ""}</span>
        <span className="k-mono tabular-nums">{cost > 0 ? formatCentsAsUsdAdaptive(cost) : ""}</span>
      </p>
    </Link>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt>{k}</dt>
      <dd className="k-fg2 tabular-nums">{v}</dd>
    </div>
  );
}
