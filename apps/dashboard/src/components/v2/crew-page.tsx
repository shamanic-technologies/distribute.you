"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Lead } from "@/lib/api";
import { formatCount, formatUsdAdaptive, formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { isLearning } from "@/lib/learning-threshold";
import { v1Brand } from "@/lib/v2/routes";
import { MaturityBadge } from "@/components/maturity-badge";
import { CrewMark } from "@/components/v2/crew-mark";
import { useMissions, type Mission, type CrewSummary } from "@/components/v2/use-missions";
import { useBrandRevenue, useLatestInBucket } from "@/components/v2/data";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { EmptyNote, SectionTitle, Shimmer, StateDot, TopBar } from "@/components/v2/ui";
import { CompanyMark, leadCompany, leadCompanyDomain, leadName, v1LeadHref } from "@/components/v2/people-bits";

/** The result a mission's leg lands on, read off its own served group. */
function result(m: Mission): { count: number | null; noun: string; costCents: number | null } {
  const g = m.row.revenue;
  if (m.leg?.toKey === "conversation") return { count: g?.positiveReplies ?? null, noun: "positive replies", costCents: g?.cpprCents ?? null };
  if (m.leg?.toKey === "website_visit") return { count: g?.websiteClicks ?? null, noun: "website visits", costCents: g?.cpcCents ?? null };
  return { count: null, noun: "results", costCents: null };
}

/**
 * Crew (beta): Keel's agent grid. A crew is one leg through one channel. The header
 * states the brand's served spend and running ceiling; each card states how many of its
 * missions run, what they may spend today (running ceilings, the rule every v1 daily total
 * uses) and each mission's own served result count and price. Nothing is divided here.
 */
export function CrewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { missions, crews, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const visits = useLatestInBucket(brandId, "website_visit", 15);
  const replies = useLatestInBucket(brandId, "positive_reply", 15);
  const running = crews.filter((c) => c.running > 0).length;
  const revenue = useBrandRevenue(brandId);
  const spent = revenue.data?.costEconomics?.committedCostUsd ?? null;
  const { cents: ceiling } = useRunningDailyBudgetCents(brandId, { enabled: revenue.enabled });

  return (
    <>
      <TopBar crumbs={[{ label: "Crew" }]} actions={<MaturityBadge level="beta" />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
          {settled && spent != null && ceiling != null
            ? `${formatUsdAdaptive(spent)} spent, up to ${fmtDailyBudgetUsd(ceiling)} a day`
            : "Your crew"}
        </h1>
        <p className="k-fg2 mt-1 text-[14px]">
          {settled
            ? `${crews.length} ${crews.length === 1 ? "crew" : "crews"}, ${running} running now. Each crew moves your leads one step, through one channel.`
            : " "}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {!settled
            ? [0, 1, 2].map((i) => <Shimmer key={i} className="h-72 rounded-xl" />)
            : crews.map((c) => (
                <CrewCard key={c.crew.key} crew={c} missions={missions.filter((m) => m.crew.key === c.crew.key)} />
              ))}
          {settled && (
            <div className="k-card flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--line)] p-8 text-center shadow-none">
              <p className="text-[14px] font-medium">Add a crew</p>
              <p className="k-fg2 max-w-[260px] text-[13px]">
                Fund another channel on an offer, and a new crew starts working it.
              </p>
              <Link href={`${v1Brand(orgId, brandId)}/offers`} className="k-btn mt-2">
                Open offers
              </Link>
            </div>
          )}
        </div>

        <div className="mt-10">
          <SectionTitle>Recent results</SectionTitle>
          <RecentResults
            visits={visits.data?.leads ?? null}
            replies={replies.data?.leads ?? null}
            missionFor={(id) => missionByCampaignId.get(id) ?? null}
            hrefFor={(l) => v1LeadHref(orgId, brandId, l)}
          />
        </div>
      </div>
    </>
  );
}

function CrewCard({ crew, missions }: { crew: CrewSummary; missions: Mission[] }) {
  // What its running missions may spend today: running ceilings add, the rule
  // `scopeTotalCents` holds for every v1 daily total.
  const ceiling = missions.reduce((s, m) => s + (m.running && (m.row.budgetCents ?? 0) > 0 ? (m.row.budgetCents ?? 0) : 0), 0);
  const leg = missions[0]?.leg?.label ?? null;
  const channel = missions[0]?.row.campaign.featureSlug ?? null;
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
            {channel ? " by cold email" : ""}
          </p>
        </div>
      </div>

      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        <div className="border-b border-r border-[var(--line-subtle)] p-3">
          <p className="k-label">Missions</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">
            {crew.running}
            <span className="k-fg3 text-[13px] font-normal"> of {crew.missions} running</span>
          </p>
        </div>
        <div className="border-b border-[var(--line-subtle)] p-3">
          <p className="k-label">Offers</p>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{new Set(missions.map((m) => m.offerId)).size}</p>
        </div>
        <div className="col-span-2 p-3">
          <div className="flex items-baseline justify-between">
            <p className="k-label">Daily ceiling</p>
            <p className="k-fg3 text-[12px]">running missions</p>
          </div>
          <p className="mt-1 text-[20px] font-medium tabular-nums">{fmtDailyBudgetUsd(ceiling)}<span className="k-fg3 text-[13px] font-normal"> / day</span></p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-[var(--line-subtle)]">
        {missions.map((m) => {
          const r = result(m);
          return (
            <li key={m.row.campaign.id}>
              <Link href={m.href} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-2">
                <span className="min-w-0 flex-1 truncate text-[13px]">{m.offerName ?? "Offer"}</span>
                <span className="k-fg2 shrink-0 text-[12px] tabular-nums">
                  {r.count != null ? `${formatCount(r.count)} ${r.noun}` : "—"}
                </span>
                <span className="k-fg3 shrink-0 text-[12px] tabular-nums">
                  {r.count != null && isLearning(r.count)
                    ? "learning"
                    : r.costCents != null
                      ? `${formatCentsAsUsdAdaptive(r.costCents)} each`
                      : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="k-fg3 mt-auto pt-3 text-[12px]">
        Runs on its own. Pause it or change its daily budget from any of its missions.
      </p>
    </div>
  );
}

function RecentResults({
  visits,
  replies,
  missionFor,
  hrefFor,
}: {
  visits: Lead[] | null;
  replies: Lead[] | null;
  missionFor: (id: string) => Mission | null;
  hrefFor: (lead: Lead) => string;
}) {
  const rows = useMemo(() => {
    const out: { lead: Lead; kind: "visit" | "reply"; at: string }[] = [];
    for (const l of visits ?? []) if (l.firstClickedAt) out.push({ lead: l, kind: "visit", at: l.firstClickedAt });
    for (const l of replies ?? []) if (l.firstRepliedAt) out.push({ lead: l, kind: "reply", at: l.firstRepliedAt });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  }, [visits, replies]);
  if (!visits && !replies) return <Shimmer className="h-48 rounded-xl" />;
  return (
    <div className="k-card overflow-hidden">
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              {["Time", "Crew", "Result", "Person", "Company", "Mission"].map((h) => (
                <th key={h} className="k-label px-3 py-2.5 text-left font-medium first:pl-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><EmptyNote>No result yet.</EmptyNote></td></tr>
            ) : (
              rows.map(({ lead, kind, at }) => {
                const m = missionFor(lead.campaignId);
                const company = leadCompany(lead);
                return (
                  <tr key={`${kind}-${lead.id}`} className="k-row">
                    <td className="k-fg2 whitespace-nowrap py-2.5 pl-4 pr-3 tabular-nums">
                      {new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-3">
                      {m ? (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <CrewMark color={m.crew.color} glyph={m.crew.glyph} /> {m.crew.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3">{kind === "reply" ? "Positive reply" : "Website visit"}</td>
                    <td className="px-3">
                      <Link href={hrefFor(lead)} className="hover:underline">{leadName(lead)}</Link>
                    </td>
                    <td className="px-3">
                      {company ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={16} />
                          {company}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="k-fg2 px-3 pr-4">{m?.offerName ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
