"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listOutcomePeople } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { integrationFor } from "@/lib/integrations";
import { timeAgo } from "@/lib/friendly-datetime";
import { OUTCOME_PEOPLE_PAGE_SIZE, type OutcomeStepStat } from "@/lib/v2/outcome-people";
import { useAudienceSnapshot, useBrandOutcomeList, type BrandOutcome } from "@/components/v2/brand-outcomes";
import { RecordsTabs } from "@/components/v2/records";
import { formatCount } from "@/lib/format-number";
import { v2Href, v2OutcomeHref } from "@/lib/v2/routes";
import { outcomeOf, type Outcome } from "@/lib/v2/outcomes";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useBucketCounts } from "@/components/v2/data";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import type { OngoingCampaign } from "@/components/v2/ongoing-campaigns";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import { v2CampaignHref } from "@/lib/v2/routes";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { PeoplePage } from "@/components/v2/people-page";
import { AudienceLists } from "@/components/v2/audience-page";
import { PostsPage } from "@/components/v2/posts-page";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { OutcomeStats } from "@/components/v2/outcome-stats";
import { stepLabel } from "@/lib/legs";

/**
 * OUTCOMES (owner 2026-10-10): what the brand gets. The Overview lists one row per step an
 * ON campaign lands on AND every step the brand's own tools state people for, campaigns or
 * not (owner 2026-10-11, crm-service, `brand-outcomes.ts`); each outcome's page lists the
 * people who reached it, everyone first, then the ones we contacted (lead-service).
 */

function useIds() {
  const p = useParams<{ orgId: string; brandId: string; stepKey?: string }>();
  return { orgId: p.orgId, brandId: p.brandId, stepKey: p.stepKey ? decodeURIComponent(p.stepKey) : null };
}

function CampaignFace({ c }: { c: OngoingCampaign }) {
  return <ServedPipeMark pipeId={c.m.pipe.id} size={16} />;
}

/** crm-service's source for the people OUR campaigns brought to a step (lead-service's buckets). */
const OUR_CAMPAIGNS_SOURCE = "campaigns";

/** One of the brand's own tools (PostHog, Clerk, Stripe…), or our campaigns, with its logo. */
function SourceName({ source }: { source: string }) {
  const def = source === OUR_CAMPAIGNS_SOURCE ? { name: "Distribute", domain: "distribute.you" } : integrationFor(source);
  if (!def) console.error("[v2] an outcome source the integrations catalogue does not name", { source });
  return (
    <span className="k-fg2 inline-flex min-w-0 items-center gap-1.5">
      {def ? <ProviderLogo domain={def.domain} size={16} className="rounded-[3px]" /> : null}
      <span className="truncate">{def?.name ?? source}</span>
    </span>
  );
}

/** "PostHog, Soar, Nova": where an outcome comes from, each with its face. A sales-funnel campaign is named once, never its parts. */
function ProducedBy({ campaigns, funnelCampaigns, sources = [] }: { campaigns: OngoingCampaign[]; funnelCampaigns: SalesFunnelCampaign[]; sources?: OutcomeStepStat["sources"] }) {
  const { orgId } = useIds();
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {sources
        // Our campaigns are named one by one beside it: the generic mark only stands when none is.
        .filter((src) => src.people > 0 && !(src.source === OUR_CAMPAIGNS_SOURCE && campaigns.length + funnelCampaigns.length > 0))
        .map((src) => (
        <SourceName key={src.source} source={src.source} />
      ))}
      {funnelCampaigns.map((f) => (
        <Link key={f.id} href={v2CampaignHref(orgId, f.brandId, f.id)} className="k-fg2 inline-flex min-w-0 items-center gap-1.5 hover:text-[var(--fg-1)]" onClick={(e) => e.stopPropagation()}>
          <FunnelFace name={f.salesFunnelName} size={16} />
          <span className="truncate">{f.salesFunnelName}</span>
        </Link>
      ))}
      {campaigns.map((c) => (
        <Link key={c.m.row.campaign.id} href={c.m.href} className="k-fg2 inline-flex min-w-0 items-center gap-1.5 hover:text-[var(--fg-1)]" onClick={(e) => e.stopPropagation()}>
          <CampaignFace c={c} />
          <span className="truncate">{c.name ?? c.m.pipe.name}</span>
        </Link>
      ))}
    </span>
  );
}

function Num({ n }: { n: number | null | undefined }) {
  return n == null ? <span className="k-fg4">—</span> : <span className="tabular-nums">{formatCount(n)}</span>;
}

/** Everyone who reached it, any source (crm-service); a step it does not serve reads our own people. */
function AllCount({ o, counts, peopleHeld }: { o: BrandOutcome; counts: Record<string, number> | null; peopleHeld: number | null }) {
  if (o.all) return <Num n={o.all.people} />;
  // Leads found = the people the brand's lists hold, the figure its sidebar entry and People tab state.
  if (o.outcome.items.kind === "leads-found") return peopleHeld == null ? <Shimmer className="ml-auto h-4 w-10" /> : <Num n={peopleHeld} />;
  if (o.outcome.items.kind !== "people" || o.outcome.items.bucket === "booking_call") return <Num n={null} />;
  if (!counts) return <Shimmer className="ml-auto h-4 w-10" />;
  return <Num n={counts[o.outcome.items.bucket]} />;
}

/** The ones we contacted: lead-service's bucket, the same figure the Contacted by us tab states. */
function OursCount({ o, counts }: { o: BrandOutcome; counts: Record<string, number> | null }) {
  const kind = o.outcome.items.kind;
  if (kind !== "people" && kind !== "leads-found") return <Num n={null} />;
  if (!counts) return <Shimmer className="ml-auto h-4 w-10" />;
  // A lead found that we contacted = lead-service's contacted bucket.
  return <Num n={counts[o.outcome.items.kind === "people" ? o.outcome.items.bucket : "contacted"]} />;
}

export function OutcomesOverviewPage() {
  const { orgId, brandId } = useIds();
  const { offerId } = useSelectedOffer();
  const { outcomes, settled, allError } = useBrandOutcomeList(orgId, brandId, offerId);
  const counts = useBucketCounts(brandId).data?.counts ?? null;
  const leadsFoundListed = outcomes.some((o) => o.outcome.items.kind === "leads-found");
  const peopleHeld = useAudienceSnapshot(brandId, leadsFoundListed).data?.totals.people.held ?? null;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">
          {!settled ? <Shimmer className="h-8 w-72" /> : outcomes.length === 0 ? "No outcome yet" : `${outcomes.length} outcome${outcomes.length === 1 ? "" : "s"}`}
        </h1>
        <p className="k-fg2 mb-6 mt-1 text-[14px]">What you get, from your campaigns and your own tools. Open one to see who.</p>
        {allError && <p className="mb-3 text-[13px] text-[var(--data-rose)]">We could not read your own tools right now. Only your campaigns show.</p>}
        <div className="k-card overflow-hidden">
          {!settled ? (
            <div className="space-y-px p-2">
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
              <Shimmer className="h-10 rounded-[8px]" />
            </div>
          ) : outcomes.length === 0 ? (
            <EmptyNote>Turn a campaign on, or connect PostHog, Clerk or Stripe, and what you get shows here.</EmptyNote>
          ) : (
            <div className="k-scroll overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b">
                    <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Outcome</th>
                    <th className="k-label px-3 py-2.5 text-left font-normal">From</th>
                    <th className="k-label px-3 py-2.5 text-right font-normal">People</th>
                    <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Contacted by us</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map((o) => (
                    <tr key={o.outcome.key} className="k-row k-line-subtle h-10 border-b last:border-b-0">
                      <td className="px-3 py-2 pl-4">
                        <Link href={v2OutcomeHref(orgId, brandId, o.outcome.key)} className="font-medium hover:underline">
                          {o.outcome.label}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <ProducedBy campaigns={o.campaigns} funnelCampaigns={o.funnelCampaigns} sources={o.all?.sources} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <AllCount o={o} counts={counts} peopleHeld={peopleHeld} />
                      </td>
                      <td className="px-3 py-2 pr-4 text-right">
                        <OursCount o={o} counts={counts} />
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

/** Everyone who reached one step, any source, earliest first; a row opens the person in the Unibox. */
function EveryoneTable({ bucket }: { bucket: string }) {
  const { orgId, brandId } = useIds();
  const [offset, setOffset] = useState(0);
  const q = useAuthQuery(
    ["outcomePeople", brandId, bucket, offset],
    () => listOutcomePeople(brandId, bucket, { limit: OUTCOME_PEOPLE_PAGE_SIZE, offset }),
    { ...pollOptions, enabled: !!brandId, placeholderData: keepPreviousData },
  );
  if (!q.data) {
    if (q.isError) return <EmptyNote>We could not read this list right now.</EmptyNote>;
    return (
      <div className="space-y-px p-2">
        <Shimmer className="h-10 rounded-[8px]" />
        <Shimmer className="h-10 rounded-[8px]" />
        <Shimmer className="h-10 rounded-[8px]" />
      </div>
    );
  }
  const { people, total } = q.data;
  if (total === 0) return <EmptyNote>Nobody yet.</EmptyNote>;
  const unibox = v2Href(orgId, brandId, "unibox");
  return (
    <>
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Person</th>
              <th className="k-label px-3 py-2.5 text-left font-normal">From</th>
              <th className="k-label px-3 py-2.5 text-left font-normal">Contacted by us</th>
              <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">When</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const name = p.displayName ?? p.emails[0] ?? p.phones[0] ?? null;
              const sub = p.company ?? (p.displayName ? p.emails[0] ?? null : null);
              return (
                <tr key={p.personKey} className="k-row k-line-subtle h-10 border-b last:border-b-0">
                  <td className="max-w-[320px] px-3 py-2 pl-4">
                    {p.personId ? (
                      <Link href={`${unibox}?person=${encodeURIComponent(p.personId)}`} className="block truncate font-medium hover:underline">
                        {name ?? <span className="k-fg4">—</span>}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{name ?? <span className="k-fg4">—</span>}</span>
                    )}
                    {sub && <span className="k-fg3 block truncate text-[12px]">{sub}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {p.sources.map((src) => (
                        <SourceName key={src.source} source={src.source} />
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2">{p.contactedByUs ? <span className="k-chip">Contacted by us</span> : <span className="k-fg4">—</span>}</td>
                  <td className="k-mono k-fg2 px-3 py-2 pr-4 text-right text-[12px]">{p.reachedAt ? timeAgo(p.reachedAt) : <span className="k-fg4">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 k-line-subtle flex items-center gap-3 border-t px-4 py-2.5 text-[12px] tabular-nums">
        <span>
          {formatCount(offset + 1)}–{formatCount(offset + people.length)} of {formatCount(total)}
        </span>
        <span className="ml-auto flex gap-1">
          <button type="button" className="k-btn-ghost h-6 px-2" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - OUTCOME_PEOPLE_PAGE_SIZE))}>
            Previous
          </button>
          <button
            type="button"
            className="k-btn-ghost h-6 px-2"
            disabled={offset + people.length >= total}
            onClick={() => setOffset(offset + OUTCOME_PEOPLE_PAGE_SIZE)}
          >
            Next
          </button>
        </span>
      </div>
    </>
  );
}

export function OutcomePage() {
  const { orgId, brandId, stepKey } = useIds();
  const { offerId } = useSelectedOffer();
  const { outcomes, settled } = useBrandOutcomeList(orgId, brandId, offerId);
  const counts = useBucketCounts(brandId).data?.counts ?? null;
  const catalogue = useLegCatalogue();
  const { staffMode } = useStaffMode();
  const [tab, setTab] = useState<"all" | "ours">("all");
  const listed = outcomes.find((o) => o.outcome.key === stepKey) ?? null;
  // A step nothing produces today still opens (an old link): its items are read the same way.
  const outcome = listed?.outcome ?? (stepKey ? outcomeOf(catalogue, null, stepKey) : null);
  if (!outcome) return null;
  // The posts are a staff read today (social-service behind the gateway's staff gate).
  if (outcome.items.kind === "posts" && staffMode) return <PostsPage />;
  const producing = listed && (listed.campaigns.length > 0 || listed.funnelCampaigns.length > 0 || (listed.all?.people ?? 0) > 0);
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes", href: v2OutcomeHref(orgId, brandId) }, { label: outcome.label }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">{outcome.label}</h1>
        <div className="k-fg2 mb-6 mt-1 flex flex-wrap items-center gap-x-2 text-[14px]">
          {!settled ? (
            <Shimmer className="h-5 w-56" />
          ) : producing && listed ? (
            <>
              <span>From</span>
              <ProducedBy campaigns={listed.campaigns} funnelCampaigns={listed.funnelCampaigns} sources={listed.all?.sources} />
            </>
          ) : (
            <span>Nothing brings this in today.</span>
          )}
        </div>
        {outcome.items.kind === "people" && listed?.all && (
          <OutcomeStats
            brandId={brandId}
            offerId={offerId}
            stepKey={outcome.key}
            label={stepLabel(catalogue, outcome.key) ?? outcome.label}
            plural={outcome.label}
            all={listed.all}
          />
        )}
        {outcome.items.kind === "people" && listed?.all ? (
          <div className="k-card overflow-hidden">
            <RecordsTabs
              tabs={[
                { key: "all", label: "Everyone", count: listed.all.people },
                { key: "ours", label: "Contacted by us", count: counts?.[outcome.items.bucket] ?? null },
              ]}
              active={tab}
              onPick={(k) => setTab(k === "ours" ? "ours" : "all")}
            />
            {tab === "all" ? <EveryoneTable bucket={outcome.items.bucket} /> : <PeoplePage bucket={outcome.items.bucket} />}
          </div>
        ) : outcome.items.kind === "people" ? (
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
