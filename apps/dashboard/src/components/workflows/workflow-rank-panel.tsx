"use client";

/**
 * ONE WORKFLOW, OPENED FROM ITS ROW — why it is ranked where it is, and what it did.
 *
 * This replaced a separate PAGE at `…/workflows/<dynasty>`. A page meant leaving the
 * ranking to read one row of it, which is the wrong shape for a list somebody is
 * comparing: the table stays on screen, the panel overlays it, and the open workflow
 * rides `?workflow=<dynasty>` so a link still works and the back button still means
 * something. Same shell as the Leads panel — full-screen on a phone, a right-hand
 * sheet on desktop, `z-20` so it sits above the list and below the support FAB.
 *
 * ── THE CARDS, IN THE ORDER A READER ASKS THE QUESTIONS ──────────────────────────
 *
 *  1. RANK AND WHY — the position, the producer's own pick badge, and the one
 *     sentence. It is the card the panel exists for.
 *  2. HOW WE PRICED IT — one block per grain the ladder carries (this audience, this
 *     brand, every client), each with its own spend, people reached, outcomes and unit
 *     cost, and the block the resolved figure CAME FROM marked. A grain the ladder does
 *     not carry says so in one line rather than being absent without explanation: the
 *     ladder omits a grain that has not spent, and "nothing spent here" is the answer.
 *  3. ON THIS CAMPAIGN — what the workflow actually produced for the campaign being
 *     read, off the same grouped row the table renders.
 *  4. THE CHARTS — outcome trend, this workflow against its siblings, and against the
 *     fleet. Each one renders ONLY when its series carries something; a card with no
 *     data is omitted rather than drawn empty, because an empty chart reads as a zero.
 *
 * ── WHAT IT MAY NOT DO ───────────────────────────────────────────────────────────
 *
 * Nothing here divides. Every figure is a served field rendered verbatim, and one the
 * producer could not state renders "—", never a zero: "we have no figure" and "it cost
 * nothing" are different statements. The fleet card is drawn APART and states its own
 * basis — its spend is `incurred` (comped money at full value: what the workflow costs
 * to produce an outcome) while everything else on the panel is `charged` (what this
 * customer paid). Two questions sharing the words "cost per outcome"; charting them as
 * one series would be the self-contradictory-surface bug.
 */

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { LearningTag } from "@/components/learning-tag";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { OutcomeTrendCard } from "@/components/revenue/outcome-trend-card";
import { RoiTrendCard } from "@/components/revenue/roi-trend-card";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import { GrainMark } from "@/components/marks/grain-mark";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import {
  grainFigures,
  type WorkflowGrain,
  type WorkflowGrainBlock,
  type WorkflowAudienceRow,
  type WorkflowLadderRowShape,
} from "@/lib/workflow-grains";
import { getWorkflowRevenue, getFleetWorkflowCost } from "@/lib/api";
import {
  fleetComparison,
  workflowOutcomeCostCents,
  workflowOutcomeCount,
  type CampaignWorkflowRow,
  type WorkflowOutcomePair,
} from "@/lib/campaign-workflow-rows";
import {
  type RankedWorkflow,
  type WorkflowLadderGrain,
  type WorkflowLadderGrainBlock,
} from "@/lib/workflow-rank-why";

const FLEET_OBJECTIVE_BY_PAIR: Record<WorkflowOutcomePair, string> = {
  reply: "positiveReply",
  visit: "websiteVisit",
};

const LADDER_TIP =
  "How we arrived at the estimate this workflow is ranked on. We use the closest evidence we have: your own audience if it ran there, then this brand, then every client we run the channel for. A level with nothing spent on it is not used.";

const CAMPAIGN_TIP =
  "What this workflow produced for the campaign you are looking at. It is the same figure as its row in the table.";

const FLEET_TIP =
  "What this workflow costs across every client we run it for. It is a different question from your own cost. It counts the spend the workflow incurs, including anything we later refunded, because what a workflow costs to produce an outcome does not depend on who was billed.";

const SIBLINGS_TIP =
  "The same price for the other workflows this campaign has run. Only the ones with enough behind them to state a price are drawn.";

/** The grains, finest first — the order the cascade walks and the order a reader reads. */
/**
 * THE GRAINS, FINEST FIRST — the cascade the producer prices through.
 *
 * The single `audience` pseudo-grain this used to carry is gone: it showed ONE
 * audience's block with no way to tell which, while the producer sends a row per
 * audience and the rank is scored over all of them. They have their own card now, which
 * is what makes a rank standing on an audience readable instead of mysterious.
 */
const GRAIN_ORDER: { key: WorkflowGrain; label: string; blurb: string }[] = [
  {
    key: "campaign",
    label: "This campaign",
    blurb: "Everything it has done for the campaign you are reading.",
  },
  { key: "brand", label: "This brand", blurb: "Everything it has done for you on this channel." },
  {
    key: "crossOrg",
    label: "Every client we run it for",
    blurb: "The benchmark, counted on what the workflow costs rather than on who was billed.",
  },
];

const AUDIENCES_TIP =
  "What this workflow did for each of your audiences, cheapest first. The rank above is scored over these too — so when the top row of the table is not the cheapest figure on screen, this is where its position comes from.";

const BASIS_TIP =
  "Charged is money you paid. Incurred counts spend we later refunded at full value, because it answers what the workflow COSTS to produce an outcome rather than what you were billed — which is why the fleet block is read apart from the rest.";

const PROJECTED_TIP =
  "This count was walked through your funnel's own conversion rates rather than observed directly, so it is an expectation, not a headcount.";

function fmtUsd(value: number | null | undefined): string {
  return value == null ? "—" : formatUsdAdaptive(value);
}

function fmtCents(value: number | null | undefined): string {
  return value == null ? "—" : formatCentsAsUsdAdaptive(value);
}

function fmtCount(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString("en-US");
}

/**
 * A row of horizontal bars. Lengths say only "bigger than" — every value is printed
 * beside its bar, because a length is a comparison and a number is the answer. A row
 * the producer could not measure is drawn with NO bar and its own word, never a
 * zero-length bar that reads as "nothing".
 */
export function BarRows({
  rows,
  format,
  lowerIsBetter = false,
  pending = false,
}: {
  rows: { key: string; label: string; value: number | null; highlight?: boolean; note?: string }[];
  format: (v: number) => string;
  lowerIsBetter?: boolean;
  pending?: boolean;
}) {
  const max = useMemo(
    () => Math.max(0, ...rows.map((r) => (r.value == null ? 0 : r.value))),
    [rows],
  );
  if (pending) return <Skeleton className="h-24 w-full rounded" />;
  if (rows.length === 0) return <p className="text-sm text-gray-500">Nothing to compare yet.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.value == null || max <= 0 ? 0 : Math.max(2, (r.value / max) * 100);
        return (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              {/* A truncated label carries its whole self on hover — a native `title`
                  is the right affordance for a truncation, and it is what the repo's
                  InfoTooltip rule explicitly leaves to `title`. */}
              <span
                title={r.label}
                className={`min-w-0 truncate ${r.highlight ? "font-medium text-gray-900" : "text-gray-600"}`}
              >
                {r.label}
              </span>
              <span
                className={`shrink-0 tabular-nums ${r.highlight ? "font-medium text-gray-900" : "text-gray-600"}`}
              >
                {r.value == null ? (r.note ?? "—") : format(r.value)}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
              {r.value != null && (
                <div
                  className={`h-2 rounded-full ${r.highlight ? "bg-brand-500" : "bg-gray-300"}`}
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
      {lowerIsBetter && <p className="pt-1 text-[11px] text-gray-400">Lower is better.</p>}
    </div>
  );
}

function Card({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500">
        {title}
        {tip && <InfoTooltip tip={tip} placement="top" />}
      </h3>
      {children}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}</span>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

/** One grain of the cascade, or the one line that says nothing was spent at it. */
function GrainBlock({
  label,
  blurb,
  block,
  used,
  outcomeNoun,
  grain,
  brandDomain,
  brandLogoUrl,
}: {
  label: string;
  blurb: string;
  block: WorkflowGrainBlock | undefined;
  used: boolean;
  outcomeNoun: string;
  grain: WorkflowGrain;
  brandDomain: string | null;
  brandLogoUrl: string | null;
}) {
  const figures = grainFigures(block);
  return (
    <div
      className={`rounded-lg border p-3 ${used ? "border-brand-200 bg-brand-50" : "border-gray-200 bg-gray-50"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <GrainMark
          grain={grain}
          brandDomain={brandDomain}
          brandLogoUrl={brandLogoUrl}
          size={18}
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
        {used && (
          <span className="inline-flex items-center rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[11px] font-medium text-brand-600">
            Used for the estimate
          </span>
        )}
        {block?.costBasis && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-500">
            {block.costBasis === "charged" ? "What you paid" : "What it costs us"}
            <InfoTooltip tip={BASIS_TIP} placement="top" />
          </span>
        )}
      </div>
      {!block ? (
        <p className="mt-1 text-xs text-gray-500">Nothing spent here yet, so it is not used.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-500">{blurb}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Figure label="Spent" value={fmtUsd(block.evidence.spentUsd)} />
            <Figure label="People reached" value={fmtCount(block.evidence.observedContacted)} />
            {/* THE FIGURE THE RANKING IS MADE OF. It replaced a "cost per person reached"
                that nothing ranks on and that no reader could reconcile with the estimate
                above — the whole point of this card is to show where that number came
                from, so the number itself has to be in it. Served, never divided. */}
            <div>
              <span className="text-gray-500">Cost per {outcomeNoun.toLowerCase()}</span>
              <p className="font-medium text-gray-900">
                {figures == null ? "—" : fmtUsd(figures.costPerOutcomeUsd)}
              </p>
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-gray-500">
                {outcomeNoun}
                {figures != null && !figures.outcomeObserved && (
                  <InfoTooltip tip={PROJECTED_TIP} placement="top" />
                )}
              </span>
              <p className="font-medium text-gray-900">
                {figures == null ? "—" : fmtCount(figures.outcomeCount)}
              </p>
            </div>
            {block.projected && (
              <>
                <Figure
                  label="Return on spend"
                  value={formatRoi(block.projected.roiMultiple ?? null)}
                />
                <Figure
                  label="Cost per paid client"
                  value={fmtUsd(block.projected.costPerPaidClientUsd)}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * EVERY AUDIENCE THIS WORKFLOW RAN FOR, cheapest first.
 *
 * The producer sends one row per (audience x workflow) and scores the rank over all of
 * them, so a workflow can sit at the top of the table on a figure that appears in no
 * column. This card is where that figure lives. Nothing is elected "the one the rank
 * stands on" — the ordering is a display choice over served values, and the claim about
 * which row won belongs to the producer.
 *
 * An audience we cannot name still gets its row: its evidence is real and its id is what
 * the producer sent. A row whose grain states no price sorts last rather than vanishing.
 */
function AudienceGrainList({
  rows,
  audienceById,
  outcomeNoun,
}: {
  rows: readonly WorkflowAudienceRow[];
  audienceById: Map<string, { name: string; avatarUrl: string | null }>;
  outcomeNoun: string;
}) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((r) => {
        const meta = audienceById.get(r.audienceId);
        const name = meta?.name ?? "An audience we could not name";
        return (
          <div key={r.audienceId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <AudienceAvatar name={name} avatarUrl={meta?.avatarUrl} size={24} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-900">{name}</p>
              <p className="text-xs text-gray-500">
                {fmtUsd(r.figures?.spentUsd ?? null)} spent
                {r.contacted != null && ` · ${fmtCount(r.contacted)} reached`}
                {r.figures != null && ` · ${fmtCount(r.figures.outcomeCount)} ${outcomeNoun.toLowerCase()}`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-gray-900">
              {r.figures == null ? "—" : fmtUsd(r.figures.costPerOutcomeUsd)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface WorkflowRankPanelProps {
  ranked: RankedWorkflow<CampaignWorkflowRow>;
  featureSlug: string;
  brandId: string;
  campaignId: string;
  pair: WorkflowOutcomePair;
  /** The step the campaign's leg lands on, in the producer's key. */
  outcomeStepKey: string | null;
  /** That step's label in the customer's words. */
  outcomeNoun: string;
  /** Every row of the table, for the sibling comparison. */
  siblings: readonly CampaignWorkflowRow[];
  paused: boolean;
  /** This workflow's BRAND-level ladder row — the cascade the grain cards read. */
  ladderRow: WorkflowLadderRowShape | null;
  /** Its audience rows, cheapest first, already ordered by `audienceRowsFor`. */
  audienceRows: readonly WorkflowAudienceRow[];
  /** A display lookup, id -> name + face. An id absent from it still gets its row. */
  audienceById: Map<string, { name: string; avatarUrl: string | null }>;
  brandDomain: string | null;
  brandLogoUrl: string | null;
  /** The leg's own step, in the producer's words — what every figure here is about. */
  legStepLabel: string | null;
  onClose: () => void;
}

export function WorkflowRankPanel({
  ranked,
  featureSlug,
  brandId,
  campaignId,
  pair,
  outcomeStepKey,
  outcomeNoun,
  siblings,
  ladderRow,
  audienceRows,
  audienceById,
  brandDomain,
  brandLogoUrl,
  legStepLabel,
  paused,
  onClose,
}: WorkflowRankPanelProps) {
  const row = ranked.row;
  const dynastySlug = row.workflowDynastySlug;
  const ready = Boolean(featureSlug && brandId && campaignId && dynastySlug);

  // The drill-down body: the whole un-grouped answer, narrowed to this workflow.
  const revenueQ = useAuthQuery(
    ["workflowRevenue", brandId, campaignId, dynastySlug],
    () => getWorkflowRevenue(featureSlug, brandId, campaignId, dynastySlug),
    { ...pollOptions, enabled: ready },
  );

  // Public, org-less, one answer for every tenant — the SAME key the table's own fleet
  // read uses, so opening a row costs no second request.
  const fleetQ = useAuthQuery(
    ["fleetWorkflowCost", featureSlug || "none", FLEET_OBJECTIVE_BY_PAIR[pair]],
    () => getFleetWorkflowCost(featureSlug, FLEET_OBJECTIVE_BY_PAIR[pair]),
    { ...pollOptions, enabled: ready },
  );

  const bodyPending = revenueQ.isPending && !revenueQ.isError;
  const fleetPending = fleetQ.isPending && !fleetQ.isError;

  const ladder = ranked.ladder;
  // WHICH grain the resolved NUMBERS came from: the finest one that SPENT. It is not
  // `resolved.grain`, which is a provenance LABEL for the finest grain that OBSERVED
  // the outcome — the two are decoupled on purpose, and marking the label's block
  // would point at the fleet on a row whose figure is this brand's own floored spend.
  // THE GRAIN THE NUMBERS CAME FROM — the finest one WITH SPEND, which is the producer's
  // own rule and is decoupled from `resolved.grain` (a provenance LABEL: the finest grain
  // that OBSERVED the outcome). A grain that spent and observed nothing keeps its own
  // floored spend as the number while being labelled `crossOrg`, so marking the label's
  // block would point at the fleet on a figure that is the customer's own.
  //
  // `campaign` sits between brand and audience in that cascade since v0.164.0. Leaving it
  // out marked THIS BRAND as the source on every campaign-scoped read — the mark pointing
  // one block away from the number it describes.
  const usedGrain: WorkflowLadderGrain | null = ladder
    ? ladderRow?.estimatesByGrain.audience
      ? "audience"
      : ladderRow?.estimatesByGrain.campaign
        ? "campaign"
        : ladderRow?.estimatesByGrain.brand
          ? "brand"
          : ladderRow?.estimatesByGrain.crossOrg
            ? "crossOrg"
            : null
    : null;

  const siblingRows = useMemo(
    () =>
      siblings
        .filter((r) => !r.learning && workflowOutcomeCostCents(r) != null)
        .map((r) => {
          // The model is what two sibling rows routinely differ BY, so a price
          // comparison that does not name it hides the variable it is about.
          const m = workflowModelMark(r.contentModel);
          return {
            key: r.workflowDynastySlug,
            label: m ? `${r.workflowDynastyName} · ${m.label}` : r.workflowDynastyName,
            value: workflowOutcomeCostCents(r),
            highlight: r.workflowDynastySlug === dynastySlug,
          };
        }),
    [siblings, dynastySlug],
  );

  const fleet = useMemo(
    () => fleetComparison(dynastySlug, fleetQ.data ?? []),
    [dynastySlug, fleetQ.data],
  );
  const fleetRows = useMemo(
    () => [
      { key: "mine", label: row.workflowDynastyName, value: fleet.mine, highlight: true, note: "Not measured" },
      { key: "best", label: "Best workflow on this channel", value: fleet.best, note: "Not measured" },
      { key: "median", label: "Median workflow on this channel", value: fleet.median, note: "Not measured" },
    ],
    [fleet, row.workflowDynastyName],
  );

  const revenue = revenueQ.data;
  const outcomeSeries = pair === "visit" ? revenue?.clicked : revenue?.repliedPositive;
  // A chart is drawn ONLY when its series carries something. An empty chart reads as a
  // zero, which is the one thing an absent figure must never say.
  const hasOutcomeSeries = Boolean(outcomeSeries?.daily?.length);
  const hasRoiHistory = Boolean(revenue?.roiHistory?.daily?.length);
  const hasFleet = fleetRows.some((r) => r.value != null);

  return (
    <div className="absolute inset-0 md:left-auto md:w-[34rem] md:max-w-[94vw] bg-gray-50 border-gray-200 md:border-l md:shadow-2xl overflow-y-auto z-20 pb-24">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-gray-600 md:hidden"
          aria-label="Back to the workflow list"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="hidden min-w-0 truncate font-semibold text-gray-800 md:block">
          {row.workflowDynastyName}
        </h2>
        <button
          onClick={onClose}
          className="hidden text-gray-400 hover:text-gray-600 md:block"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 md:p-6">
        <Card title="Rank and why">
          <div className="flex flex-wrap items-center gap-2">
            {/* `bg-gray-900` has NO `html.dark` remap, so it paints a near-black blob on the
                dark surface. These two tints are remapped, and they are the same pair the
                table's own rank badge wears. */}
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-100 px-2 text-xs font-medium text-gray-700 tabular-nums">
              #{ranked.rank}
            </span>
            <span className="text-sm font-medium text-gray-900">{row.workflowDynastyName}</span>
            {row.running && (
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                Running now
              </span>
            )}
            {ranked.recommended && !row.running && (
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
                Our pick
              </span>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-700">{ranked.why}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Figure
              label={`Estimated cost per ${outcomeNoun.toLowerCase()}`}
              value={fmtUsd(ranked.estCostPerOutcomeUsd)}
            />
            {/* The ladder's OWN return, served. An unmeasured row states none at all —
                an explore allowance is a cost floor, not a result to divide into. */}
            <Figure label="Return on spend" value={formatRoi(ladder?.roiMultiple ?? null)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <WorkflowModelCell contentModel={row.contentModel} />
            <WorkflowTemplateCell contentPromptType={row.contentPromptType} />
          </div>
        </Card>

        <Card title="How we priced it" tip={LADDER_TIP}>
          {!ladder ? (
            <p className="text-sm text-gray-500">
              We have no estimate for this workflow yet, so there is nothing to break down.
            </p>
          ) : !ladder.measured ? (
            <p className="text-sm text-gray-500">
              Nothing has been spent on this workflow, so there is no evidence to price it
              on. The figure above is the price of one outreach, set so it can earn a first
              try.
            </p>
          ) : (
            <div className="space-y-3">
              {GRAIN_ORDER.map((g) => (
                <GrainBlock
                  key={g.key}
                  grain={g.key}
                  label={g.label}
                  blurb={g.blurb}
                  block={ladderRow?.estimatesByGrain[g.key]}
                  used={usedGrain === g.key}
                  outcomeNoun={outcomeNoun}
                  brandDomain={brandDomain}
                  brandLogoUrl={brandLogoUrl}
                />
              ))}
            </div>
          )}
        </Card>

        {audienceRows.length > 0 && (
          <Card title="Your audiences, through this workflow" tip={AUDIENCES_TIP}>
            <AudienceGrainList
              rows={audienceRows}
              audienceById={audienceById}
              outcomeNoun={outcomeNoun}
            />
          </Card>
        )}

        <Card title="On this campaign" tip={CAMPAIGN_TIP}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Figure label={outcomeNoun} value={fmtCount(workflowOutcomeCount(row))} />
            <div>
              <span className="text-gray-500">Cost per {outcomeNoun.toLowerCase()}</span>
              {row.learning ? (
                <p className="mt-0.5">
                  <LearningTag paused={paused} />
                </p>
              ) : (
                <p className="font-medium text-gray-900">
                  {fmtCents(workflowOutcomeCostCents(row))}
                </p>
              )}
            </div>
            <Figure label="Invested" value={fmtUsd(row.committedCostUsd)} />
            <Figure label="Outreach" value={fmtCount(row.outreach)} />
          </div>
        </Card>

        {hasOutcomeSeries && (
          <div className="mb-4">
            <OutcomeTrendCard
              series={outcomeSeries}
              label={outcomeNoun}
              pending={bodyPending}
            />
          </div>
        )}

        {hasRoiHistory && (
          <div className="mb-4">
            <RoiTrendCard
              history={revenue?.roiHistory ?? null}
              pending={bodyPending}
              learning={Boolean(row.learning)}
              paused={paused}
            />
          </div>
        )}

        {siblingRows.length > 0 && (
          <Card title="Against your other workflows" tip={SIBLINGS_TIP}>
            <BarRows
              rows={siblingRows}
              format={(v) => formatCentsAsUsdAdaptive(v)}
              lowerIsBetter
            />
          </Card>
        )}

        {(hasFleet || fleetPending) && (
          <Card title="Against every client we run it for" tip={FLEET_TIP}>
            <BarRows
              rows={fleetRows}
              format={(v) => formatUsdAdaptive(v)}
              lowerIsBetter
              pending={fleetPending}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
