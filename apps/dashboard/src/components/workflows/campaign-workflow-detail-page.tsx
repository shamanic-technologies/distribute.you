"use client";

/**
 * ONE WORKFLOW, ON ONE CAMPAIGN.
 *
 * The table one level up answers "which of these made money"; this page answers "what
 * did THIS one do". It is not a second computation: features-service serves the SAME
 * un-grouped body the campaign Overview reads, narrowed to the leads this workflow
 * served and the spend it incurred (`?workflow=<dynastySlug>`), so the cards here and
 * the cards there are the same cards on the same fields and a figure cannot mean two
 * things one click apart.
 *
 * ── WHAT IS CHARTED, AND WHY EACH ONE IS HONEST ──────────────────────────────────
 *
 *  · RETURN ON SPEND and CUMULATIVE SALES INTERESTS reuse the Overview's own cards.
 *    Both are cumulative on both legs and both come off served series.
 *
 *  · THE FUNNEL WALK draws `funnelSteps`: `recipientsReached` per rung and the served
 *    `conversionFromPreviousPct` between them. NOTHING is divided here — a rate
 *    computed in the browser drifts from the producer, and the producer already
 *    publishes it.
 *
 *  · VS THE CAMPAIGN'S OTHER WORKFLOWS reads the SAME grouped query key the table
 *    polls, so drilling in costs no second request and the bar for this workflow can
 *    never disagree with its own row.
 *
 *  · VS THE FLEET is a PUBLIC cross-org read, and it is drawn apart from everything
 *    else on the page with its basis stated: its `costBasis` is `incurred` (comped
 *    spend at full value — what the workflow COSTS to produce an outcome), while every
 *    other figure here is `charged` (what this customer paid). Two questions sharing
 *    the words "cost per outcome"; charting them as one series would be the
 *    self-contradictory-surface bug.
 *
 * A figure the producer could not measure renders "—", never a zero: "we have no
 * figure" and "it cost nothing" are different statements.
 */

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { ScoreCard } from "@/components/visibility/score-card";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import { MaturityBadge } from "@/components/maturity-badge";
import { LearningTag } from "@/components/learning-tag";
import { RoiTrendCard } from "@/components/revenue/roi-trend-card";
import { OutcomeTrendCard } from "@/components/revenue/outcome-trend-card";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useScopePaused } from "@/lib/use-scope-paused";
import {
  listChannelWorkflows,
  getFeatureRevenueByWorkflow,
  getWorkflowRevenue,
  getFleetWorkflowCost,
} from "@/lib/api";
import {
  buildCampaignWorkflowRows,
  resolveRunningWorkflow,
  fleetComparison,
  type CampaignWorkflowRow,
} from "@/lib/campaign-workflow-rows";

/** The objective the fleet read is priced on — the outcome this channel sells. */
const FLEET_OBJECTIVE = "positiveReply";

const FLEET_TIP =
  "What this workflow costs across every client we run it for. It is a different question from your own cost above: it counts the spend the workflow incurs, including anything we later refunded, because what a workflow costs to produce an outcome does not depend on who was billed.";

const SIBLINGS_TIP =
  "The same price for the other workflows this campaign has run. Only the ones with enough sales interests behind them to state a price are drawn.";

const MODEL_TIP =
  "The AI model this workflow writes your emails with, and the prompt template it writes them from. Both come from the workflow itself, so they are what ran for you.";

const FUNNEL_TIP =
  "How far the people this workflow reached got down your funnel, and the share of each step that reached the next. Both come from us; nothing here is worked out in your browser.";

function fmtCents(value: number | null | undefined): string {
  return value == null ? "—" : formatCentsAsUsdAdaptive(value);
}

function fmtUsd(value: number | null | undefined): string {
  return value == null ? "—" : formatUsdAdaptive(value);
}

function fmtCount(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString("en-US");
}

/**
 * A row of horizontal bars, the shape the published cost articles use.
 *
 * Bars are drawn against the row set's own maximum, so the LENGTHS say only "bigger
 * than" — every value is printed beside its bar, because a length is a comparison and
 * a number is the answer. A row whose value the producer could not measure is drawn
 * with no bar and its own word, never a zero-length bar that reads as "nothing".
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
  if (pending) return <Skeleton className="h-28 w-full rounded" />;
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">Nothing to compare yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.value == null || max <= 0 ? 0 : Math.max(2, (r.value / max) * 100);
        return (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              {/* A truncated label carries its whole self on hover — a native `title`
                  is the right affordance for a truncation (it states nothing the
                  reader needs that is not already on screen in full elsewhere), and
                  it is what the repo's InfoTooltip rule explicitly leaves to `title`. */}
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
      {lowerIsBetter && (
        <p className="pt-1 text-[11px] text-gray-400">Lower is better.</p>
      )}
    </div>
  );
}

function Panel({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <h3 className="mb-4 inline-flex items-center gap-1 font-medium text-gray-800">
        {title}
        {tip && <InfoTooltip tip={tip} placement="top" />}
      </h3>
      {children}
    </div>
  );
}

export function CampaignWorkflowDetailPage() {
  const params = useParams();
  const isBeta = useIsBetaUser();

  const brandId = String(params.brandId ?? "");
  const campaignId = String(params.id ?? "");
  const dynastySlug = decodeURIComponent(String(params.workflowDynastySlug ?? ""));

  const { campaign, featureSlug, settled: slugSettled } = useScopedFeatureSlug(campaignId);
  const ready = isBeta && Boolean(featureSlug) && Boolean(brandId) && Boolean(campaignId) && Boolean(dynastySlug);

  // Byte-equal to the table's keys, so arriving here costs no request the table did
  // not already make — and the row's figures and this page's cannot diverge.
  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );
  const groupsQ = useAuthQuery(
    ["campaignWorkflowRevenue", brandId, campaignId],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId),
    { ...pollOptions, enabled: ready },
  );

  // The drill-down body: the whole un-grouped answer, narrowed to this workflow.
  const revenueQ = useAuthQuery(
    ["workflowRevenue", brandId, campaignId, dynastySlug],
    () => getWorkflowRevenue(featureSlug as string, brandId, campaignId, dynastySlug),
    { ...pollOptions, enabled: ready },
  );

  // Public, org-less, one answer for every tenant.
  const fleetQ = useAuthQuery(
    ["fleetWorkflowCost", featureSlug ?? "none", FLEET_OBJECTIVE],
    () => getFleetWorkflowCost(featureSlug as string, FLEET_OBJECTIVE),
    { ...pollOptions, enabled: ready },
  );

  const { paused } = useScopePaused(brandId, { campaignId, enabled: isBeta });

  const rows = useMemo(
    () =>
      buildCampaignWorkflowRows({
        catalogue: catalogueQ.data ?? [],
        groups: groupsQ.data ?? [],
        // Resolved from the catalogue AND this campaign's own groups, because the
        // catalogue carries only each dynasty's current version and campaign-service
        // states a versioned slug — see `resolveRunningWorkflow`.
        running: resolveRunningWorkflow(campaign?.workflowSlug ?? null, catalogueQ.data ?? [], [
          groupsQ.data ?? [],
        ]),
        isLearning,
      }),
    [catalogueQ.data, groupsQ.data, campaign?.workflowSlug],
  );

  const row: CampaignWorkflowRow | undefined = rows.find(
    (r) => r.workflowDynastySlug === dynastySlug,
  );

  // Null for a workflow that states no model, and for a RETIRED one (its shape is only
  // in the catalogue, which no longer holds it). Both render "—" rather than a guess.
  const model = workflowModelMark(row?.contentModel);

  const revenue = revenueQ.data;
  const funnel = revenue?.funnelSteps ?? null;

  const headerPending = !slugSettled || (catalogueQ.isPending && !catalogueQ.isError) || (groupsQ.isPending && !groupsQ.isError);
  const bodyPending = revenueQ.isPending && !revenueQ.isError;
  const fleetPending = fleetQ.isPending && !fleetQ.isError;

  const siblingRows = useMemo(
    () =>
      rows
        .filter((r) => !r.learning && r.cpprCents != null)
        .map((r) => {
          // The model is what two sibling rows routinely differ BY, so a price
          // comparison that does not name it hides the variable it is about. It is
          // appended rather than given its own column: `BarRows` truncates and carries
          // the whole string on the row's `title`, so a narrow viewport loses the
          // suffix and keeps the name.
          const m = workflowModelMark(r.contentModel);
          return {
            key: r.workflowDynastySlug,
            label: m ? `${r.workflowDynastyName} · ${m.label}` : r.workflowDynastyName,
            value: r.cpprCents,
            highlight: r.workflowDynastySlug === dynastySlug,
          };
        }),
    [rows, dynastySlug],
  );

  const fleet = useMemo(
    () => fleetComparison(dynastySlug, fleetQ.data ?? []),
    [dynastySlug, fleetQ.data],
  );

  const fleetRows = useMemo(
    () => [
      { key: "mine", label: row?.workflowDynastyName ?? dynastySlug, value: fleet.mine, highlight: true, note: "Not measured" },
      { key: "best", label: "Best workflow on this channel", value: fleet.best, note: "Not measured" },
      { key: "median", label: "Median workflow on this channel", value: fleet.median, note: "Not measured" },
    ],
    [fleet, row?.workflowDynastyName, dynastySlug],
  );

  const funnelRows = useMemo(
    () =>
      (funnel?.steps ?? []).map((s) => ({
        key: s.leadField || s.step,
        label:
          s.conversionFromPreviousPct == null
            ? s.step
            : `${s.step} · ${s.conversionFromPreviousPct.toFixed(1)}% of ${s.fromStep}`,
        value: s.recipientsReached,
        note: "Not measured",
      })),
    [funnel],
  );

  if (!isBeta) {
    return (
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h1 className="text-base font-medium text-gray-900">Not available</h1>
          <p className="mt-1 text-sm text-gray-500">
            This page is still in beta and is not open on your account yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {headerPending ? (
            <Skeleton className="h-6 w-48" />
          ) : (
            <h1 className="text-lg font-medium text-gray-900">
              {row?.workflowDynastyName ?? dynastySlug}
            </h1>
          )}
          <MaturityBadge level="beta" />
          {row?.running && (
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
              Running now
            </span>
          )}
        </div>
        {/* The SAME two-line cells the table renders — the model and the template
            read identically on the row and on the page it opens, which is the whole
            reason they are one component rather than two spellings. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
          {headerPending ? (
            <Skeleton className="h-8 w-64" />
          ) : (
            <>
              <WorkflowModelCell contentModel={row?.contentModel ?? null} />
              <WorkflowTemplateCell contentPromptType={row?.contentPromptType ?? null} />
              <InfoTooltip tip={MODEL_TIP} placement="top" />
            </>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          What this workflow did for this campaign. Every number is this campaign&apos;s own.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 items-stretch">
        <ScoreCard
          label="Sales interests"
          value={fmtCount(row?.positiveReplies ?? null)}
          pending={headerPending}
        />
        <ScoreCard
          label="Cost per sales interest"
          value={row?.learning ? "" : fmtCents(row?.cpprCents ?? null)}
          action={row?.learning ? <LearningTag paused={paused} /> : undefined}
          pending={headerPending}
        />
        <ScoreCard
          label="$ Invested"
          value={fmtUsd(row?.committedCostUsd ?? null)}
          pending={headerPending}
        />
        <ScoreCard label="Outreach" value={fmtCount(row?.outreach ?? null)} pending={headerPending} />
        <ScoreCard
          label="Website visits"
          value={fmtCount(row?.websiteClicks ?? null)}
          pending={headerPending}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RoiTrendCard
          history={revenue?.roiHistory ?? null}
          pending={bodyPending}
          learning={Boolean(row?.learning)}
          paused={paused}
        />
        <OutcomeTrendCard
          series={revenue?.repliedPositive}
          label="Sales interests"
          pending={bodyPending}
        />
      </div>

      <Panel title="Funnel progress" tip={FUNNEL_TIP}>
        {bodyPending ? (
          <Skeleton className="h-28 w-full rounded" />
        ) : funnelRows.length === 0 ? (
          <p className="text-sm text-gray-500">
            This channel has no sales funnel wired, so there is no walk to draw.
          </p>
        ) : (
          <BarRows rows={funnelRows} format={(v) => v.toLocaleString("en-US")} />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Against your other workflows" tip={SIBLINGS_TIP}>
          <BarRows
            rows={siblingRows}
            format={(v) => formatCentsAsUsdAdaptive(v)}
            lowerIsBetter
            pending={headerPending}
          />
        </Panel>
        <Panel title="Against every client we run it for" tip={FLEET_TIP}>
          <BarRows
            rows={fleetRows}
            format={(v) => formatUsdAdaptive(v)}
            lowerIsBetter
            pending={fleetPending}
          />
        </Panel>
      </div>
    </div>
  );
}
