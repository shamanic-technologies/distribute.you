"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { integrationFor } from "@/lib/integrations";
import { timeAgo } from "@/lib/friendly-datetime";
import { OUTCOME_PEOPLE_PAGE_SIZE, type OutcomeStepStat } from "@/lib/v2/outcome-people";
import { useAudienceSnapshot, useBrandOutcomeList, useCatalogueSteps, useStepIcons, type BrandOutcome } from "@/components/v2/brand-outcomes";
import { RecordsTabs } from "@/components/v2/records";
import { fetchOutcomePeople, outcomePeopleKey, useOutcomePrefetch } from "@/components/v2/outcome-prefetch";
import { formatCount } from "@/lib/format-number";
import { v2Href, v2OutcomeHref } from "@/lib/v2/routes";
import { outcomeOf, reachedStepOf, type Outcome } from "@/lib/v2/outcomes";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useReachedCounts } from "@/components/v2/data";
import { useBrandScope } from "@/components/v2/brand-scope";
import type { OngoingCampaign } from "@/components/v2/ongoing-campaigns";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import { v2CampaignHref } from "@/lib/v2/routes";
import type { SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { PeoplePage } from "@/components/v2/people-page";
import { LeadsFoundPeople } from "@/components/v2/audience-page";
import { PostsPage } from "@/components/v2/posts-page";
import { CostPerUnit, NetworkLogo, PublishedBody, PublishedOutcomePage, usePublishedOutcomeLabel, usePublishedOutcomes } from "@/components/v2/published-outcome-page";
import { ResearchDrawer } from "@/components/v2/research-template-outputs";
import { opensDrawer } from "@/components/v2/research-live-workflows";
import { isPublishedOutcomeKey, type PublishedOutcomeKey, type PublishedUnits } from "@/lib/v2/published-units";
import { BarSpark, EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { OutcomePinButton } from "@/components/v2/outcome-pins";
import { LedgerOutcomeStats, OutcomeStats, useOutcomeCostSeries } from "@/components/v2/outcome-stats";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { LearningFigure, RoiLabel } from "@/components/v2/roi-label";
import { formatUsdAdaptive } from "@/lib/format-number";
import {
  costStepOf,
  lastDays,
  ledgerOutcomeOf,
  unlistedLedgerOutcomes,
  type LedgerOutcome,
  type OfferMix,
  type OfferOutcomeCostSeries,
  type OutcomeCostStep,
} from "@/lib/v2/outcome-cost-series";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
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

/** crm-service's source for the people OUR campaigns brought to a step (lead-service's Unibox people). */
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
  if (o.outcome.items.kind !== "people") return <Num n={null} />;
  if (!counts) return <Shimmer className="ml-auto h-4 w-10" />;
  return <Num n={counts[o.outcome.items.step]} />;
}

/**
 * The ones we contacted. A people outcome reads crm-service's served `contactedByUs` (OUTCOMES-CONTACTED-1027: people
 * OUR campaigns brought to the step), the outcome page's tile and tab figure; lead-service's reached count holds every
 * lead the brand knows on that step, Stripe payers never written to included (16 vs 1 on Paid clients, 2026-11-08).
 * Leads found keeps the leads lead-service saw reach their first email (`reachedStepOf`): those we did write to.
 */
function OursCount({ o, counts }: { o: BrandOutcome; counts: Record<string, number> | null }) {
  if (o.all) return <Num n={o.all.contactedByUs} />;
  if (o.outcome.items.kind === "people") return <Num n={null} />;
  const step = reachedStepOf(o.outcome);
  if (!step) return <Num n={null} />;
  if (!counts) return <Shimmer className="ml-auto h-4 w-10" />;
  return <Num n={counts[step]} />;
}

/**
 * THE OUTCOMES OVERVIEW (owner 2026-11-08, OUTCOMES-TABLE-1108: « reprends l'UI … en t'inspirant du Catalogue »): the
 * Catalogue's anatomy, a live-sentence title then ONE table, a row per outcome the brand reaches, in the producer's order
 * (features-service's outcome-cost-series `steps[]`). Columns: Outcome (mark, name, how many with "N from us" in
 * discreet), $ / outcome (measured, expected small, the running curve solid with the served expected dotted), $ Spent.
 * A click on a row opens the outcome's page in the right panel; its name opens the page itself. Every figure is served
 * (crm-service people, lead-service reached-step counts, features-service cost); ROI and value wait on features-service
 * (BRAND-VALUE-ROI-1108: what a value and a return mean once the page reads the whole brand, several offers).
 */
const OTH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const OTD = "px-3 py-3 align-middle first:pl-4 last:pr-4";

type OpenRow = { kind: "outcome"; key: string } | { kind: "published"; key: PublishedOutcomeKey } | { kind: "ledger"; key: string };

/** A ledger outcome's names off the public catalogue; a key the catalogue does not name reads as its key, loudly. */
function ledgerNames(steps: ReturnType<typeof useCatalogueSteps>, key: string): { label: string; plural: string } {
  const st = steps?.get(key);
  if (steps && !st) console.error("[v2] the brand ledger holds an outcome the public catalogue does not name", { key });
  return { label: st?.name ?? key, plural: st?.pluralName ?? st?.name ?? key };
}

export function OutcomesOverviewPage() {
  const { orgId, brandId } = useIds();
  const { outcomes, settled, allError } = useBrandOutcomeList(orgId, brandId);
  const counts = useReachedCounts(brandId, outcomes.flatMap((o) => reachedStepOf(o.outcome) ?? [])).data ?? null;
  const leadsFoundListed = outcomes.some((o) => o.outcome.items.kind === "leads-found");
  const peopleHeld = useAudienceSnapshot(brandId, leadsFoundListed).data?.totals.people.held ?? null;
  // The BRAND series, one offer or several: its rows carry `offerMix` (BRAND-VALUE-ROI-1108), value and returns traced
  // per offer; a brand selling one offer reads that offer's figures byte for byte.
  const costQ = useOutcomeCostSeries(brandId, null);
  const costAnswered = costQ.data !== undefined || (costQ.isFetchedAfterMount && costQ.isError);
  const stepIcons = useStepIcons();
  // The published outcomes (posts, newsletter emails): one row each once the brand has a row (OUTCOME-FINEST-1106).
  const published = usePublishedOutcomes(brandId);
  // One row per outcome: a published outcome with a row is shown by its own row, never a second generic one beside it.
  const publishedKeys = new Set<string>(published.withRows.map((p) => p.key));
  const ordered = inServedOrder(outcomes, costQ.data).filter((o) => !publishedKeys.has(o.outcome.key));
  // GSC-CONNECTOR-1108: every other outcome the brand's ledger holds (a connector's, « Google search click » included),
  // one row each in the producer's order, never a second row for an outcome shown above.
  const catalogueSteps = useCatalogueSteps();
  const ledgerOnly = unlistedLedgerOutcomes(
    costQ.data,
    new Set([...outcomes.map((o) => o.outcome.key), ...publishedKeys]),
    (k) => catalogueSteps?.get(k)?.leadState ?? null,
  );
  const ready = settled && published.settled;
  const count = ordered.length + published.withRows.length + ledgerOnly.length;
  const [open, setOpen] = useState<OpenRow | null>(null);
  const openOutcome = open?.kind === "outcome" ? ordered.find((o) => o.outcome.key === open.key) ?? null : null;
  const openPublished = open?.kind === "published" ? published.withRows.find((p) => p.key === open.key) ?? null : null;
  const openLedger = open?.kind === "ledger" ? ledgerOnly.find((l) => l.outcomeKey === open.key) ?? null : null;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes" }, { label: "Overview" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">
          {!ready ? <Shimmer className="h-8 w-72" /> : count === 0 ? "No outcome yet" : `${count} outcome${count === 1 ? "" : "s"}`}
        </h1>
        <p className="k-fg2 mb-6 mt-1 text-[14px]">What you got since you started, and what each one cost.</p>
        {allError && <p className="mb-3 text-[13px] text-[var(--data-rose)]">We could not read your own tools right now. Only your campaigns show.</p>}
        {published.failed.length > 0 && <p className="mb-3 text-[13px] text-[var(--data-rose)]">We could not read some of your posts or newsletters right now. Retrying.</p>}
        {!ready ? (
          <div className="k-card overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="k-row flex h-16 items-center px-4">
                <Shimmer className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : count === 0 ? (
          <div className="k-card">
            <EmptyNote>Turn a campaign on, or connect PostHog, Clerk or Stripe, and what you get shows here.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <div className="k-scroll overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b">
                    <th className={`${OTH} w-full`}>Outcome</th>
                    <th className={`${OTH} min-w-[200px]`}>
                      <RoiLabel />
                    </th>
                    <th className={`${OTH} min-w-[220px]`}>$ / outcome</th>
                    <th className={`${OTH} text-right`}>$ Value</th>
                    <th className={`${OTH} text-right`}>$ Spent</th>
                    <th className={OTH}>
                      <span className="sr-only">Pin</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((o) => (
                    <OutcomeRow
                      key={o.outcome.key}
                      o={o}
                      href={v2OutcomeHref(orgId, brandId, o.outcome.key)}
                      counts={counts}
                      peopleHeld={peopleHeld}
                      cost={costStepOf(costQ.data, o.outcome.key)}
                      costAnswered={costAnswered}
                      icon={stepIcons?.get(o.outcome.key) ?? null}
                      brandId={brandId}
                      selected={open?.kind === "outcome" && open.key === o.outcome.key}
                      onOpen={() => setOpen({ kind: "outcome", key: o.outcome.key })}
                    />
                  ))}
                  {published.withRows.map((p) => (
                    <PublishedOutcomeRow
                      key={p.key}
                      outcomeKey={p.key}
                      data={p.data}
                      icon={stepIcons?.get(p.key) ?? null}
                      selected={open?.kind === "published" && open.key === p.key}
                      onOpen={() => setOpen({ kind: "published", key: p.key })}
                    />
                  ))}
                  {ledgerOnly.map((l) => (
                    <LedgerOutcomeRow
                      key={l.outcomeKey}
                      lo={l}
                      name={ledgerNames(catalogueSteps, l.outcomeKey).plural}
                      href={v2OutcomeHref(orgId, brandId, l.outcomeKey)}
                      icon={stepIcons?.get(l.outcomeKey) ?? null}
                      brandId={brandId}
                      selected={open?.kind === "ledger" && open.key === l.outcomeKey}
                      onOpen={() => setOpen({ kind: "ledger", key: l.outcomeKey })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">An outcome is one thing you got. Open a row to see who reached it.</div>
          </div>
        )}
      </div>
      {openOutcome && (
        <ResearchDrawer
          wide
          label={openOutcome.outcome.label}
          onClose={() => setOpen(null)}
          head={<DrawerHead icon={stepIcons?.get(openOutcome.outcome.key) ?? null} name={openOutcome.outcome.label} />}
          right={
            <Link href={v2OutcomeHref(orgId, brandId, openOutcome.outcome.key)} className="k-btn">
              Open page
            </Link>
          }
        >
          <div className="p-4">
            <OutcomeDetail stepKey={openOutcome.outcome.key} />
          </div>
        </ResearchDrawer>
      )}
      {openLedger && (
        <ResearchDrawer
          wide
          label={ledgerNames(catalogueSteps, openLedger.outcomeKey).plural}
          onClose={() => setOpen(null)}
          head={<DrawerHead icon={stepIcons?.get(openLedger.outcomeKey) ?? null} name={ledgerNames(catalogueSteps, openLedger.outcomeKey).plural} />}
          right={
            <Link href={v2OutcomeHref(orgId, brandId, openLedger.outcomeKey)} className="k-btn">
              Open page
            </Link>
          }
        >
          <div className="p-4">
            <LedgerOutcomeStats lo={openLedger} {...ledgerNames(catalogueSteps, openLedger.outcomeKey)} />
          </div>
        </ResearchDrawer>
      )}
      {openPublished && (
        <ResearchDrawer
          wide
          label={openPublished.key}
          onClose={() => setOpen(null)}
          head={<PublishedDrawerHead outcomeKey={openPublished.key} icon={stepIcons?.get(openPublished.key) ?? null} />}
          right={
            <Link href={v2OutcomeHref(orgId, brandId, openPublished.key)} className="k-btn">
              Open page
            </Link>
          }
        >
          <div className="p-4">
            <PublishedBody outcomeKey={openPublished.key} data={openPublished.data} />
          </div>
        </ResearchDrawer>
      )}
    </div>
  );
}

function DrawerHead({ icon, name }: { icon: string | null; name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <CatalogueMark icon={icon} name={name} size={24} />
      <span className="truncate text-[14px] font-medium">{name}</span>
    </span>
  );
}

function PublishedDrawerHead({ outcomeKey, icon }: { outcomeKey: PublishedOutcomeKey; icon: string | null }) {
  return <DrawerHead icon={icon} name={usePublishedOutcomeLabel(outcomeKey)} />;
}

/** The producer's step order (outcome-cost-series `steps[]`); a step it does not serve (posts) keeps its place after. */
function inServedOrder(list: BrandOutcome[], series: OfferOutcomeCostSeries | null | undefined): BrandOutcome[] {
  if (!series) return list;
  const at = new Map(series.steps.map((s, i) => [s.stepKey, i] as const));
  const rank = (o: BrandOutcome) => at.get(o.outcome.key) ?? series.steps.length;
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/** The name opens the outcome's page; a click anywhere else on the row opens it in the right panel. */
function RowName({ icon, name, href, sub }: { icon: string | null; name: string; href: string; sub: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <CatalogueMark icon={icon} name={name} size={32} />
      <span className="min-w-0">
        <Link href={href} className="block truncate font-medium hover:underline">
          {name}
        </Link>
        <span className="k-fg3 flex items-center gap-1 truncate text-[12px] tabular-nums">{sub}</span>
      </span>
    </span>
  );
}

function rowProps(onOpen: () => void, selected: boolean) {
  return {
    className: `k-row k-line-subtle cursor-pointer border-b last:border-b-0 ${selected ? "k-selected" : ""}`,
    onClick: (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (opensDrawer(e.target, e.currentTarget)) onOpen();
    },
  };
}

/**
 * An outcome only the brand's ledger states (GSC-CONNECTOR-1108: a connector's, « Google search click »), in the same
 * table: its Units since inception and from us, the last 28 days as bars, $ each and what it cost to produce, all
 * served by features-service's `ledgerOutcomes`; nothing summed here. No ROI or value: no campaign aims at it.
 */
function LedgerOutcomeRow({
  lo,
  name,
  href,
  icon,
  brandId,
  selected,
  onOpen,
}: {
  lo: LedgerOutcome;
  name: string;
  href: string;
  icon: string | null;
  brandId: string;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <tr {...rowProps(onOpen, selected)}>
      <td className={OTD}>
        <span className="flex items-center justify-between gap-4">
          <RowName
            icon={icon}
            name={name}
            href={href}
            sub={
              <>
                <Num n={lo.units} />
                <span>·</span>
                <Num n={lo.ourUnits} /> from us
              </>
            }
          />
          <BarSpark values={lastDays(lo.daily, 28).map((d) => d.units ?? 0)} className="hidden shrink-0 md:flex" />
        </span>
      </td>
      <td className={OTD}>
        <span className="k-fg4">—</span>
      </td>
      <td className={OTD}>
        <span className="min-w-[88px] text-[14px] font-medium tabular-nums">
          {lo.costPerUnitUsd != null ? formatUsdAdaptive(lo.costPerUnitUsd) : <span className="k-fg4">—</span>}
        </span>
      </td>
      <td className={`${OTD} whitespace-nowrap text-right tabular-nums`}>
        <span className="k-fg4">—</span>
      </td>
      <td className={`${OTD} whitespace-nowrap text-right tabular-nums`}>
        {lo.productionCostUsd != null ? formatUsdAdaptive(lo.productionCostUsd) : <span className="k-fg4">—</span>}
      </td>
      <td className={`${OTD} w-8`}>
        <OutcomePinButton brandId={brandId} outcomeKey={lo.outcomeKey} compact />
      </td>
    </tr>
  );
}

function OutcomeRow({
  o,
  href,
  counts,
  peopleHeld,
  cost,
  costAnswered,
  icon,
  brandId,
  selected,
  onOpen,
}: {
  o: BrandOutcome;
  href: string;
  counts: Record<string, number> | null;
  peopleHeld: number | null;
  cost: OutcomeCostStep | null;
  costAnswered: boolean;
  icon: string | null;
  brandId: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const warm = useOutcomePrefetch(brandId);
  // The running $ / outcome (features-service's cumulative months), its served expected dotted beside it.
  const curve = cost ? cost.months.map((m) => m.cumulativeCostPerOutcomeUsd).filter((v): v is number => v != null) : null;
  const mix = cost?.offerMix ?? null;
  const name = o.outcome.label;
  return (
    <tr {...rowProps(onOpen, selected)} onMouseEnter={() => warm(o.outcome)} onFocus={() => warm(o.outcome)}>
      <td className={OTD}>
        <RowName
          icon={icon}
          name={name}
          href={href}
          sub={
            <>
              <AllCount o={o} counts={counts} peopleHeld={peopleHeld} />
              <span>·</span>
              <OursCount o={o} counts={counts} /> from us
            </>
          }
        />
      </td>
      <td className={OTD}>
        <OutcomeRoiCell answered={costAnswered} mix={mix} />
      </td>
      <td className={OTD}>
        <span className="flex items-center gap-3">
          <span className="min-w-[88px] text-[14px] font-medium tabular-nums">
            <OutcomeCostFigure answered={costAnswered} cost={cost} />
          </span>
          <MeasuredExpectedSpark measured={curve} expected={mix?.expectedCostPerOutcomeUsd ?? null} />
        </span>
      </td>
      <td className={`${OTD} whitespace-nowrap text-right tabular-nums`}>
        <OutcomeValueCell answered={costAnswered} mix={mix} />
      </td>
      <td className={`${OTD} whitespace-nowrap text-right tabular-nums`}>
        {!costAnswered ? <Shimmer className="ml-auto h-4 w-12" /> : cost ? formatUsdAdaptive(cost.sinceInception.spendUsd) : <span className="k-fg4">—</span>}
      </td>
      <td className={`${OTD} w-8`}>
        <OutcomePinButton brandId={brandId} outcomeKey={o.outcome.key} compact />
      </td>
    </tr>
  );
}

/** A published outcome (posts, newsletter emails) in the same table: features-service `published-units`, nothing divided here. */
function PublishedOutcomeRow({ outcomeKey, data, icon, selected, onOpen }: { outcomeKey: PublishedOutcomeKey; data: PublishedUnits; icon: string | null; selected: boolean; onOpen: () => void }) {
  const { orgId, brandId } = useIds();
  const name = usePublishedOutcomeLabel(outcomeKey);
  const expected = data.accounting?.costPerUnit.expectedUsd ?? null;
  return (
    <tr {...rowProps(onOpen, selected)}>
      <td className={OTD}>
        <RowName
          icon={icon}
          name={name}
          href={v2OutcomeHref(orgId, brandId, outcomeKey)}
          sub={
            <>
              <NetworkLogo outcomeKey={outcomeKey} size={12} />
              <span>
                {formatCount(data.totals.all.units)} · {formatCount(data.totals.ours.units)} from us
              </span>
            </>
          }
        />
      </td>
      <td className={OTD}>
        <span className="k-fg4">—</span>
      </td>
      <td className={OTD}>
        <span className="flex items-center gap-3">
          <span className="min-w-[88px] text-[14px] font-medium tabular-nums">
            <CostPerUnit data={data} />
            {expected != null && <span className="k-fg3 ml-1 whitespace-nowrap text-[11px] font-normal">{formatUsdAdaptive(expected)} expected</span>}
          </span>
        </span>
      </td>
      <td className={`${OTD} text-right`}>
        <span className="k-fg4">—</span>
      </td>
      <td className={`${OTD} whitespace-nowrap text-right tabular-nums`}>{formatUsdAdaptive(data.totals.ours.spentUsd)}</td>
      <td className={`${OTD} w-8`}>
        <OutcomePinButton brandId={brandId} outcomeKey={outcomeKey} compact />
      </td>
    </tr>
  );
}

/**
 * The outcome's return (BRAND-VALUE-ROI-1108): only where it IS a campaign Target (ROI-CONSISTENCY-1103), else `—`.
 * Measured big (greyed while Learning), the served expected small, the measured curve solid with the expected dotted flat
 * (an expected figure has no history). Every figure is features-service's `offerMix`.
 */
function OutcomeRoiCell({ answered, mix }: { answered: boolean; mix: OfferMix | null }) {
  if (!answered) return <Shimmer className="h-4 w-16" />;
  if (!mix || !mix.isCampaignTarget) return <span className="k-fg4">—</span>;
  const measured = mix.measuredReturn.roiMultiple;
  const expected = mix.expectedReturn.roiMultiple;
  const curve = mix.measuredReturn.months.map((m) => m.roiMultiple).filter((v): v is number => v != null);
  return (
    <span className="flex items-center gap-3">
      <span className="min-w-[72px] text-[14px] font-medium tabular-nums">
        {measured != null ? (
          mix.measuredReturn.learning ? (
            <LearningFigure measured={formatRoi(measured)} expected={expected != null ? formatRoi(expected) : null} />
          ) : (
            <span className="whitespace-nowrap">
              <span className={roiIsGood(measured) ? "text-[var(--run)]" : ""}>{formatRoi(measured)}</span>
              {expected != null && <span className="k-fg3 ml-1 text-[11px] font-normal">{formatRoi(expected)} expected</span>}
            </span>
          )
        ) : expected != null ? (
          <span className="whitespace-nowrap">
            {formatRoi(expected)}
            <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>
          </span>
        ) : (
          <span className="k-fg3 text-[13px] font-normal">Learning</span>
        )}
      </span>
      <MeasuredExpectedSpark measured={curve} expected={expected} />
    </span>
  );
}

/** What it is worth: the traced value of our Target outcomes (beside $ Spent), else what one is worth. */
function OutcomeValueCell({ answered, mix }: { answered: boolean; mix: OfferMix | null }) {
  if (!answered) return <Shimmer className="ml-auto h-4 w-12" />;
  const total = mix?.measuredReturn.valueUsd ?? null;
  const each = mix?.valuePerOutcomeUsd ?? null;
  if (total == null && each == null) return <span className="k-fg4">—</span>;
  return (
    <span className="block">
      {total != null ? formatUsdAdaptive(total) : formatUsdAdaptive(each!)}
      <span className="k-fg3 block text-[11px]">{total != null && each != null ? `${formatUsdAdaptive(each)} each` : total == null ? "each" : "\u00a0"}</span>
    </span>
  );
}

/**
 * The running figure as a solid line (measured so far) and the served expected as a dotted level on the same scale
 * (owner 2026-10-19: a curve never hides behind Learning). Display only: every point is served.
 */
function MeasuredExpectedSpark({ measured, expected }: { measured: number[] | null; expected: number | null }) {
  const pts = measured ?? [];
  if (pts.length < 2 && expected == null) return <span className="h-7 w-[120px]" />;
  const w = 120;
  const h = 28;
  const all = expected != null ? [...pts, expected] : pts;
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const line = pts.length >= 2 ? pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join(" ") : null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-[120px] shrink-0 text-[var(--accent)]" aria-hidden="true">
      {expected != null && <line x1="0" x2={w} y1={y(expected)} y2={y(expected)} stroke="var(--fg-3)" strokeWidth="1.25" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
      {line && <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
    </svg>
  );
}

/** $ per outcome: measured; greyed while Learning with the served expected beside it; else the served expected. */
function OutcomeCostFigure({ answered, cost }: { answered: boolean; cost: OutcomeCostStep | null }) {
  if (!answered) return <Shimmer className="h-7 w-20" />;
  if (!cost) return <span className="k-fg4">—</span>;
  const measured = cost.sinceInception.costPerOutcomeUsd;
  // Expected at the brand's actual spend mix (BRAND-VALUE-ROI-1108), never one offer's figure under a brand label.
  const expected = cost.offerMix?.expectedCostPerOutcomeUsd ?? null;
  if (measured == null) {
    return expected != null ? (
      <span className="whitespace-nowrap">
        {formatUsdAdaptive(expected)}
        <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>
      </span>
    ) : (
      <span className="k-fg3 text-[13px] font-normal">Learning</span>
    );
  }
  if (cost.sinceInception.learning) return <LearningFigure measured={formatUsdAdaptive(measured)} expected={expected != null ? formatUsdAdaptive(expected) : null} />;
  return <>{formatUsdAdaptive(measured)}</>;
}

/**
 * Everyone who reached one step, any source, earliest first; a row opens the person in the Unibox. `contactedOnly` =
 * the Contacted by us tab: crm-service narrows to the people our campaigns brought there, its `total` the tab's count.
 */
function EveryoneTable({ crmStep, contactedOnly = false }: { crmStep: string; contactedOnly?: boolean }) {
  const { orgId, brandId } = useIds();
  const [offset, setOffset] = useState(0);
  const q = useAuthQuery(outcomePeopleKey(brandId, crmStep, contactedOnly, offset), () => fetchOutcomePeople(brandId, crmStep, contactedOnly, offset), {
    ...pollOptions,
    enabled: !!brandId,
    placeholderData: keepPreviousData,
  });
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
              <th className="k-label px-3 py-2.5 text-left font-normal">From us</th>
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
                  <td className="px-3 py-2">{p.contactedByUs ? <span className="k-chip">From us</span> : <span className="k-fg4">—</span>}</td>
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
  const { outcomes } = useBrandOutcomeList(orgId, brandId);
  const catalogue = useLegCatalogue();
  const { staffMode } = useStaffMode();
  const listed = outcomes.find((o) => o.outcome.key === stepKey) ?? null;
  // A step nothing produces today still opens (an old link): its items are read the same way.
  const outcome = listed?.outcome ?? (stepKey ? outcomeOf(catalogue, null, stepKey) : null);
  // A published outcome (posts, newsletter emails) has its own page, every customer (OUTCOME-FINEST-1106).
  if (isPublishedOutcomeKey(stepKey)) return <PublishedOutcomePage outcomeKey={stepKey} />;
  if (!outcome) return null;
  // The posts are a staff read today (social-service behind the gateway's staff gate).
  if (outcome.items.kind === "posts" && staffMode) return <PostsPage />;
  return (
    <div>
      <TopBar crumbs={[{ label: "Outcomes", href: v2OutcomeHref(orgId, brandId) }, { label: outcome.label }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 flex-1 text-[28px] font-semibold leading-[34px] tracking-[-0.01em]">{outcome.label}</h1>
          <OutcomePinButton brandId={brandId} outcomeKey={outcome.key} />
        </div>
        <OutcomeDetail stepKey={outcome.key} />
      </div>
    </div>
  );
}

/**
 * One outcome's content, under its title: where it comes from, its stats, then everyone who reached it and the ones
 * from us. The outcome's page and the Overview's right panel (OUTCOMES-TABLE-1108) render the same body.
 */
function OutcomeDetail({ stepKey }: { stepKey: string }) {
  const { orgId, brandId } = useIds();
  const offerId = useBrandScope().soleOfferId;
  const { outcomes, settled } = useBrandOutcomeList(orgId, brandId);
  const catalogue = useLegCatalogue();
  const [tab, setTab] = useState<"all" | "ours">("all");
  const listed = outcomes.find((o) => o.outcome.key === stepKey) ?? null;
  const outcome = listed?.outcome ?? outcomeOf(catalogue, null, stepKey);
  // GSC-CONNECTOR-1108: an outcome only the brand's ledger states (a connector's) opens on its served Units.
  const costQ = useOutcomeCostSeries(brandId, null);
  const catalogueSteps = useCatalogueSteps();
  const ledger = ledgerOutcomeOf(costQ.data, stepKey);
  if (!outcome) return null;
  const producing = listed && (listed.campaigns.length > 0 || listed.funnelCampaigns.length > 0 || (listed.all?.people ?? 0) > 0);
  const ledgerOnly = ledger !== null && outcome.items.kind !== "people" && outcome.items.kind !== "leads-found";
  if (ledgerOnly) return <LedgerOutcomeStats lo={ledger} {...ledgerNames(catalogueSteps, stepKey)} />;
  // Not listed anywhere else and the ledger has not answered yet: wait for it rather than say "not available".
  if (!listed && outcome.items.kind === "unavailable" && costQ.data === undefined && !costQ.isError) return <Shimmer className="h-24 w-full" />;
  return (
    <>
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
              { key: "ours", label: "From us", count: listed.all.contactedByUs },
            ]}
            active={tab}
            onPick={(k) => setTab(k === "ours" ? "ours" : "all")}
          />
          {tab === "all" ? (
            <EveryoneTable key="all" crmStep={outcome.items.crmStep} />
          ) : (
            <EveryoneTable key="ours" crmStep={outcome.items.crmStep} contactedOnly />
          )}
        </div>
      ) : outcome.items.kind === "people" ? (
        <div className="k-card overflow-hidden">
          <PeoplePage step={outcome.items.step} />
        </div>
      ) : outcome.items.kind === "leads-found" ? (
        <LeadsFoundPeople />
      ) : (
        <div className="k-card">
          <EmptyNote>Not available yet. We cannot list each one here yet.</EmptyNote>
        </div>
      )}
    </>
  );
}
