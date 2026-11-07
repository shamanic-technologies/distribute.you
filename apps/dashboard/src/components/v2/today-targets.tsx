"use client";

import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { friendlyDate } from "@/lib/friendly-datetime";
import { nextExpectedWords, reasonWords, targetsOfOffer, type CampaignTargetRow, type MilestoneCard, type OfferTargetEntry } from "@/lib/campaign-targets";
import { formatRatePct } from "@/lib/pipe-stats";
import { StepMark } from "@/components/marks/step-mark";
import { RoiLabel } from "@/components/v2/roi-label";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { useCampaignTargetRow, useCampaignTargets } from "@/components/v2/data";
import { useBrandScope } from "@/components/v2/brand-scope";

/**
 * Today, ONE row of cards per Target of each offer of the brand (owner 2026-11-07, AUDIENCE-PER-OFFER-1107:
 * the brand is the scope; served per offer, so a brand selling several offers shows each offer's row,
 * named, never a sum made here), its campaigns merged by features-service (owner 2026-11-07,
 * TARGET-ROWS-UNIQUE-1107; rows since 2026-11-06, LEAD-GENERIC-1106): how many so far,
 * $ each, the measured return when features-service says it means something, and the count over time
 * with its projection. The Target's NAME is served: no outcome word is written here. The past never
 * moves with the Plan; the dotted part is the current Plan's projection.
 */
export function TodayTargets({ orgId, brandId }: { orgId: string; brandId: string }) {
  const q = useCampaignTargets(brandId);
  const { offers } = useBrandScope();
  const rows = q.data ? targetsOfOffer(q.data.offerTargets, null) : [];
  // Several offers on the page: each row names its offer.
  const named = new Set(rows.map((r) => r.offerId)).size > 1;
  const offerName = (id: string) => (named ? (offers.find((o) => o.offerId === id)?.name ?? null) : null);
  return (
    <section>
      <SectionTitle count={q.data ? rows.length : null}>Targets</SectionTitle>
      {!q.answered ? (
        <Shimmer className="h-40 w-full rounded-xl" />
      ) : q.data === undefined ? (
        <div className="k-card">
          <EmptyNote>Could not read your targets right now.</EmptyNote>
        </div>
      ) : rows.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign is on. Each campaign&apos;s target shows here once it runs.</EmptyNote>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <TargetRow key={`${r.offerId}:${r.target?.key ?? r.salesFunnelCampaignIds.join(",")}`} row={r} offerName={offerName(r.offerId)} />
          ))}
        </div>
      )}
    </section>
  );
}

function TargetRow({ row, offerName }: { row: OfferTargetEntry; offerName: string | null }) {
  const label = row.target?.label ?? null;
  const roi = row.measuredReturn.roiMultiple;
  const next = nextExpectedWords(row.projection.nextExpectedInHours);
  return (
    <div>
      <div className="mb-2 flex min-w-0 items-center gap-2">
        {row.target && <StepMark stepKey={row.target.key} />}
        <span className="truncate text-[14px] font-medium">{label ?? "No target yet"}</span>
        {offerName && <span className="k-fg3 truncate text-[13px]">{offerName}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        <StatTile label="So far">
          <Figure value={row.outcomesToDate != null ? formatCount(row.outcomesToDate) : "—"} />
          {row.outcomesToDate == null && <p className="k-fg3 mt-1 text-[12px]">{reasonWords(row.outcomesUnavailableReason)}</p>}
        </StatTile>
        <StatTile label="$ each">
          {row.costPerOutcomeUsd != null ? (
            <Figure value={formatUsdAdaptive(row.costPerOutcomeUsd)} />
          ) : (
            <p className="k-fg3 text-[13px]">{reasonWords(row.costPerOutcomeUnavailableReason)}</p>
          )}
          {row.spentUsd != null && <p className="k-fg3 mt-auto pt-2 text-[12px] tabular-nums">{formatUsdAdaptive(row.spentUsd)} spent</p>}
        </StatTile>
        <StatTile label={<RoiLabel />} note="Measured">
          {roi != null ? (
            <span className={`text-[22px] font-medium leading-7 tabular-nums ${roiIsGood(roi) ? "text-[var(--run)]" : ""}`}>{formatRoi(roi)}</span>
          ) : (
            <p className="k-fg3 text-[13px]">{reasonWords(row.measuredReturn.unavailableReason)}</p>
          )}
        </StatTile>
        <StatTile className="col-span-3 md:col-span-2" label="Over time" note={planWords(row.projection.planComputedAt)}>
          <TargetCurve past={row.past.map((p) => p.cumulativeOutcomes)} ahead={row.projection.daily.map((d) => d.cumulativeExpectedOutcomes)} />
          <p className="k-fg2 mt-2 text-[12px]">{next ?? reasonWords(row.projection.unavailableReason)}</p>
        </StatTile>
      </div>
    </div>
  );
}

/**
 * The campaign page (owner 2026-11-06 via tallinn-v9: the same block as Today, any outcome, posts included): one card
 * per milestone Start to Target, counted from the Units the campaign's runs produced, never the Plan line. The Target
 * card carries the measured return. Every figure is served (features-service campaign-targets, one campaign).
 */
export function CampaignMilestoneCards({ brandId, campaignId }: { brandId: string; campaignId: string }) {
  const q = useCampaignTargetRow(brandId, campaignId);
  const row = q.data?.targets.find((t) => t.salesFunnelCampaignId === campaignId) ?? null;
  const cards = row?.milestones ?? [];
  return (
    <section>
      <SectionTitle right={<span>Since it started</span>}>Milestones</SectionTitle>
      {!q.answered ? (
        <Shimmer className="h-40 w-full rounded-xl" />
      ) : !row ? (
        <div className="k-card">
          <EmptyNote>Could not read this campaign&apos;s milestones right now.</EmptyNote>
        </div>
      ) : cards.length === 0 ? (
        <div className="k-card">
          <EmptyNote>{reasonWords(row.milestonesUnavailableReason ?? null)}</EmptyNote>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <MilestoneCardView key={c.step} card={c} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function MilestoneCardView({ card, row }: { card: MilestoneCard; row: CampaignTargetRow }) {
  const roi = card.isTarget ? row.measuredReturn.roiMultiple : null;
  const next = nextExpectedWords(card.projection.nextExpectedInHours);
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex min-w-0 items-center gap-2">
        <StepMark stepKey={card.step} />
        <span className="truncate text-[14px] font-medium">{card.label}</span>
        {card.isTarget && <span className="k-chip ml-auto">Target</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <Figure value={card.count != null ? formatCount(card.count) : "—"} />
        {card.isTarget && roi != null && (
          <span className={`text-[13px] tabular-nums ${roiIsGood(roi) ? "text-[var(--run)]" : "k-fg2"}`}>ROI {formatRoi(roi)}</span>
        )}
      </div>
      {card.count == null && <p className="k-fg3 text-[12px]">{reasonWords(card.countUnavailableReason)}</p>}
      <dl className="k-fg2 mt-2 grid grid-cols-3 gap-2 text-[12px] tabular-nums">
        <div className="min-w-0">
          <dt className="k-label">$ each</dt>
          <dd className="truncate">{card.costPerUnitUsd != null ? formatUsdAdaptive(card.costPerUnitUsd) : <span className="k-fg4">—</span>}</dd>
        </div>
        <div className="min-w-0">
          <dt className="k-label">From start</dt>
          <dd className="truncate">{card.costFromStartUsd != null ? formatUsdAdaptive(card.costFromStartUsd) : <span className="k-fg4">—</span>}</dd>
        </div>
        <div className="min-w-0">
          <dt className="k-label">To next</dt>
          <dd className="truncate">{card.isTarget ? <span className="k-fg4">—</span> : card.conversionToNextPct != null ? formatRatePct(card.conversionToNextPct) : <span className="k-fg4">—</span>}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <TargetCurve past={card.past.map((p) => p.cumulativeOutcomes)} ahead={card.projection.daily.map((d) => d.cumulativeExpectedOutcomes)} />
      </div>
      <p className="k-fg3 mt-1 text-[12px]">{next ?? reasonWords(card.projection.unavailableReason)}</p>
    </div>
  );
}

/** When the projection's Plan was computed: the dotted part reads it, the past never does. */
function planWords(at: string | null): string | undefined {
  if (!at) return undefined;
  const d = friendlyDate(at);
  return d === "Today" ? "Plan updated today" : `Plan updated ${d}`;
}

/** The served running total, then the served projection dotted after it. Draws what it is handed. */
function TargetCurve({ past, ahead }: { past: number[]; ahead: number[] }) {
  const all = [...past, ...ahead];
  if (all.length < 2) return <div className="h-12" />;
  const w = 300;
  const h = 48;
  const max = Math.max(...all, 1);
  const x = (i: number) => (i / (all.length - 1)) * w;
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const path = (from: number, to: number) =>
    all
      .slice(from, to)
      .map((v, k) => `${k ? "L" : "M"}${x(from + k).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  // The dotted part starts on the last measured point, so the two read as one line.
  const split = Math.max(0, past.length - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-12 w-full text-[var(--accent)]" aria-hidden="true">
      {past.length > 1 && <path d={path(0, past.length)} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      {ahead.length > 0 && (
        <path d={path(split, all.length)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
