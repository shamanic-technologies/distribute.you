"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Lead } from "@/lib/api";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { formatCentsAsUsdAdaptive, formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { friendlyDate, friendlyDateTime } from "@/lib/friendly-datetime";
import { isLearning } from "@/lib/learning-threshold";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { v2Href } from "@/lib/v2/routes";
import { CrewMark } from "@/components/v2/crew-mark";
import { campaignHoldCopy, useMissionHold } from "@/components/v2/mission-hold";
import { useMissions } from "@/components/v2/use-missions";
import { missionTabs } from "@/components/v2/setup-pages";
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
  const { missions, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const mission = missionByCampaignId.get(campaignId) ?? null;
  const id = mission?.row.campaign.id ?? campaignId;
  const hold = useMissionHold(id, mission?.running ?? false);
  const visits = useLatestInBucket(brandId, "website_visit", 20, id);
  const replies = useLatestInBucket(brandId, "positive_reply", 20, id);

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
        <TopBar crumbs={[{ label: "Missions", href: v2Href(orgId, brandId, "missions") }, { label: "Not found" }]} />
        <EmptyNote>This mission does not exist on this brand.</EmptyNote>
      </>
    );
  }

  const g = mission?.row.revenue ?? null;
  const replyLed = mission?.leg?.toKey === "conversation";
  const resultCount = replyLed ? g?.positiveReplies : g?.websiteClicks;
  const resultCost = replyLed ? g?.cpprCents : g?.cpcCents;
  const name = mission ? `${mission.crew.name} · ${mission.offerName ?? "Offer"}` : "";
  const siblings = mission ? missions.filter((m) => m.crew.key === mission.crew.key && m !== mission) : [];

  return (
    <>
      <TopBar
        crumbs={[{ label: "Missions", href: v2Href(orgId, brandId, "missions") }, { label: name || " " }]}
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
                  <StateDot running={mission.running && !hold} label={hold ? "Held" : undefined} />
                  {mission.leg ? <span className="k-chip">{mission.leg.label}</span> : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CampaignControlsTrigger brandId={brandId} campaignId={mission.row.campaign.id} totalCentsOverride={mission.row.budgetCents} />
            </div>
          </div>
        )}

        {mission ? (
          <nav className="k-line-subtle mt-4 flex gap-5 border-b" aria-label="Sections">
            {missionTabs(orgId, brandId, mission.row.campaign.id, "overview").map((t) => (
              <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className="k-tab text-[13px]">
                {t.label}
              </Link>
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
              value={resultCount != null && isLearning(resultCount) ? "Learning" : resultCost == null ? "—" : formatCentsAsUsdAdaptive(resultCost)}
            />
          </StatTile>
          <StatTile label="Spent">
            <Figure value={g?.committedCostUsd == null ? "—" : formatUsdAdaptive(g.committedCostUsd)} />
          </StatTile>
          <StatTile label="Return">
            <Figure value={mission?.row.learning ? "Learning" : formatRoi(g?.roiMultiple ?? null, "—")} />
          </StatTile>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <SectionTitle>What it brought in</SectionTitle>
            <div className="k-card overflow-hidden">
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
          </div>

          <aside className="k-card h-fit p-4">
            <p className="k-label">Details</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row k="Crew" v={mission ? <span className="inline-flex items-center gap-1.5"><CrewMark color={mission.crew.color} glyph={mission.crew.glyph} />{mission.crew.name}</span> : null} />
              <Row k="Offer" v={mission?.offerName ?? null} />
              <Row k="Step" v={mission?.leg?.label ?? null} />
              <Row k="Daily ceiling" v={mission ? `${fmtDailyBudgetUsd(mission.row.budgetCents)} / day` : null} />
              <Row k="Started" v={mission?.row.campaign.createdAt ? friendlyDate(mission.row.campaign.createdAt) : null} />
              <Row k="Pipeline" v={g?.totalPipelineUsd == null ? null : formatUsdAdaptive(g.totalPipelineUsd)} />
            </dl>
            {siblings.length > 0 ? (
              <>
                <p className="k-label mt-5">Same crew, other offers</p>
                <ul className="mt-2 space-y-1">
                  {siblings.map((s) => (
                    <li key={s.row.campaign.id}>
                      <Link href={s.href} className="k-hover -mx-2 flex items-center justify-between rounded-[8px] px-2 py-1.5 text-[13px]">
                        <span className="truncate">{s.offerName ?? "Offer"}</span>
                        <StateDot running={s.running} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}
