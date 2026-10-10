"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { formatCount } from "@/lib/format-number";
import { v2OutcomeHref } from "@/lib/v2/routes";
import { outcomeOf, type Outcome } from "@/lib/v2/outcomes";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useBucketCounts } from "@/components/v2/data";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { useOngoingCampaigns, type OngoingCampaign, type OngoingOutcome } from "@/components/v2/ongoing-campaigns";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { CrewMark } from "@/components/v2/crew-mark";
import { PeoplePage } from "@/components/v2/people-page";
import { AudienceLists } from "@/components/v2/audience-page";
import { PostsPage } from "@/components/v2/posts-page";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";

/**
 * OUTCOMES (owner 2026-10-10): what the selected offer's running campaigns produce. The
 * Overview lists one row per step an ON campaign lands on; each outcome's page lists the
 * items that reached it, read from the service that serves them (`lib/v2/outcomes.ts`).
 */

function useIds() {
  const p = useParams<{ orgId: string; brandId: string; stepKey?: string }>();
  return { orgId: p.orgId, brandId: p.brandId, stepKey: p.stepKey ? decodeURIComponent(p.stepKey) : null };
}

function CampaignFace({ c }: { c: OngoingCampaign }) {
  return c.name ? <PathAvatar name={c.name} size={16} /> : <CrewMark color={c.m.crew.color} glyph={c.m.crew.glyph} size={16} />;
}

/** "Soar, Nova": the campaigns behind an outcome, each with its face. */
function ProducedBy({ campaigns }: { campaigns: OngoingCampaign[] }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {campaigns.map((c) => (
        <Link key={c.m.row.campaign.id} href={c.m.href} className="k-fg2 inline-flex min-w-0 items-center gap-1.5 hover:text-[var(--fg-1)]" onClick={(e) => e.stopPropagation()}>
          <CampaignFace c={c} />
          <span className="truncate">{c.name ?? c.m.crew.name}</span>
        </Link>
      ))}
    </span>
  );
}

function Count({ outcome, counts }: { outcome: Outcome; counts: Record<string, number> | null }) {
  if (outcome.items.kind !== "people") return <span className="k-fg4">—</span>;
  if (!counts) return <Shimmer className="ml-auto h-4 w-10" />;
  const n = counts[outcome.items.bucket];
  return n == null ? <span className="k-fg4">—</span> : <span className="tabular-nums">{formatCount(n)}</span>;
}

export function OutcomesOverviewPage() {
  const { orgId, brandId } = useIds();
  const { offerId } = useSelectedOffer();
  const { outcomes, settled } = useOngoingCampaigns(orgId, brandId, offerId);
  const counts = useBucketCounts(brandId).data?.counts ?? null;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">
          {!settled ? <Shimmer className="h-8 w-72" /> : outcomes.length === 0 ? "No outcome yet" : `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"} your campaigns produce`}
        </h1>
        <p className="k-fg2 mb-6 mt-1 text-[14px]">What your running campaigns bring in. Open one to see who reached it.</p>
        <div className="k-card overflow-hidden">
          {!settled ? (
            <div className="space-y-px p-2">
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
            </div>
          ) : outcomes.length === 0 ? (
            <EmptyNote>Turn a campaign on and what it brings in shows here.</EmptyNote>
          ) : (
            <div className="k-scroll overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b">
                    <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Outcome</th>
                    <th className="k-label px-3 py-2.5 text-left font-normal">Produced by</th>
                    <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">People</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o: OngoingOutcome) => (
                    <tr key={o.outcome.key} className="k-row k-line-subtle h-10 border-b last:border-b-0">
                      <td className="px-3 py-2 pl-4">
                        <Link href={v2OutcomeHref(orgId, brandId, o.outcome.key)} className="font-medium hover:underline">
                          {o.outcome.label}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <ProducedBy campaigns={o.campaigns} />
                      </td>
                      <td className="px-3 py-2 pr-4 text-right">
                        <Count outcome={o.outcome} counts={counts} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OutcomePage() {
  const { orgId, brandId, stepKey } = useIds();
  const { offerId } = useSelectedOffer();
  const { outcomes, settled } = useOngoingCampaigns(orgId, brandId, offerId);
  const { staffMode } = useStaffMode();
  const running = outcomes.find((o) => o.outcome.key === stepKey) ?? null;
  // A step no campaign runs today still opens (an old link): its items are read the same way.
  const outcome = running?.outcome ?? (stepKey ? outcomeOf(null, stepKey) : null);
  if (!outcome) return null;
  // The posts are a staff read today (social-service behind the gateway's staff gate).
  if (outcome.items.kind === "posts" && staffMode) return <PostsPage />;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes", href: v2OutcomeHref(orgId, brandId) }, { label: outcome.label }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">{outcome.label}</h1>
        <div className="k-fg2 mb-6 mt-1 flex flex-wrap items-center gap-x-2 text-[14px]">
          {!settled ? (
            <Shimmer className="h-5 w-56" />
          ) : running ? (
            <>
              <span>Produced by</span>
              <ProducedBy campaigns={running.campaigns} />
            </>
          ) : (
            <span>No running campaign produces this today.</span>
          )}
        </div>
        {outcome.items.kind === "people" ? (
          <div className="k-card overflow-hidden">
            <PeoplePage bucket={outcome.items.bucket} />
          </div>
        ) : outcome.items.kind === "leads-found" ? (
          <AudienceLists />
        ) : (
          <div className="k-card">
            <EmptyNote>Not available yet. We cannot list each one here yet.</EmptyNote>
          </div>
        )}
      </div>
    </div>
  );
}
