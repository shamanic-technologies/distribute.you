"use client";

/**
 * THE WORKFLOWS A CAMPAIGN'S CHANNEL CAN RUN, IN THE ORDER WE PICK THEM, AND WHY.
 *
 * A campaign is (offer x funnel x channel). The channel is worked by a WORKFLOW — the
 * pipeline that finds the people, writes the email and sends it — and we swap a
 * campaign onto a better one when the numbers say so. A customer therefore has three
 * questions about this list, in this order: why is it in THIS order, which one is
 * running, and how was each estimate arrived at.
 *
 * ── ONE TABLE, RANKED THE WAY THE SYSTEM ACTUALLY RANKS ──────────────────────────
 *
 * The order is features-service's `workflow-projection` ladder, ascending on
 * `resolved.costPerOutcomeUsd` — the exact figure campaign-service ranks on, and whose
 * argmin over measured rows IS `recommendedWorkflowDynastySlug`. Nothing here computes
 * a cost or invents a rank; it sorts on a served number and reads served evidence into
 * one sentence per row (`lib/workflow-rank-why`).
 *
 * This replaced four GRAIN TABS and three SECTIONS. Both were honest and neither
 * answered the question: the tabs offered four populations of one row model and the
 * sections ordered on a CAMPAIGN-grain price, so a reader was looking at a different
 * ranking from the one that decided what they are running.
 *
 * The RUNNING row is pinned first and framed, and it KEEPS its merit rank — a `#1`
 * badge on a row the producer ranks fourth would be this surface stating something the
 * ladder does not.
 *
 * ── THE LADDER IS ASKED AT THE CAMPAIGN'S OWN LEG ────────────────────────────────
 *
 * A campaign performs ONE arrow of its funnel, so the read sends `leg=<campaign.legKey>`
 * and features-service prices it through the brand's best-returning declared funnel
 * containing that leg. `funnel=<campaign.funnelKey>` is the fallback for a campaign
 * created before the leg column, and a campaign stating neither sends nothing at all.
 * Never both: `leg` wins at the producer, so sending two is a second source of truth.
 *
 * A FAILED ladder read is STATED, never papered over. The leg-keyed read legitimately
 * 404s (`leg_not_declared`) and 502s (`declared_funnels_unavailable`), and falling back
 * to a wider scope would answer a question nobody asked — so the table renders with no
 * rank and no why, keeping the campaign-grain figures it always had, and says why.
 *
 * ── THE REST OF THE RULES, EACH ONE A MISTAKE ALREADY PAID FOR ───────────────────
 *
 *  1. EVERY FIGURE IS SERVED. The campaign-grain cost is the producer's own
 *     `cpprCents`/`cpcCents`, and the ranked estimate is `resolved.costPerOutcomeUsd`.
 *  2. THE CHANNEL IS THE CAMPAIGN'S OWN (`useScopedFeatureSlug`), never the brand's
 *     sole feature — a campaign on another channel would list somebody else's workflows.
 *  3. A PRICE UNDER THE BAR SAYS SO (`Learning`; `Paused` while the campaign is stopped,
 *     because nothing is being measured then).
 *  4. THE OUTCOME IS THE CAMPAIGN'S OWN LEG, never its funnel — a visit-led campaign is
 *     counted and priced in WEBSITE VISITS.
 *  5. A RETIRED workflow gets NO row: the rows are the channel's catalogue, and a
 *     lineage nobody can be put on is not an option.
 *  6. OPENING A ROW OPENS A PANEL, not a page — the ranking stays on screen, and the
 *     open workflow rides `?workflow=<dynasty>` so a link still works.
 */

import { useCallback, useMemo } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { MaturityBadge } from "@/components/maturity-badge";
import { LearningTag } from "@/components/learning-tag";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import { WorkflowRankPanel } from "@/components/workflows/workflow-rank-panel";
import { formatCentsAsUsdAdaptive, formatUsdAdaptive } from "@/lib/format-number";
import { isLearning } from "@/lib/learning-threshold";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useScopePaused } from "@/lib/use-scope-paused";
import { isRevenueFeature } from "@/lib/revenue-feature";
import {
  listChannelWorkflows,
  listChannelWorkflowDynasties,
  getFeatureRevenueByWorkflow,
  getWorkflowRankLadder,
  type WorkflowRankLadder,
} from "@/lib/api";
import {
  buildCampaignWorkflowRows,
  resolveRunningWorkflow,
  workflowOutcomeCostCents,
  workflowOutcomeCount,
  type CampaignWorkflowRow,
  type WorkflowOutcomePair,
} from "@/lib/campaign-workflow-rows";
import {
  rankWorkflowRows,
  type RankedWorkflow,
  type WorkflowLadderRow,
} from "@/lib/workflow-rank-why";
import { useCampaignOutcomePair } from "@/lib/use-campaign-outcome-pair";

/**
 * THE OUTCOME COLUMN PAIR, in the words every other surface already uses.
 *
 * A campaign performs ONE leg of its funnel, so the pair is that leg's own: a
 * visit-led campaign buys website visits and reading `0 sales interests` on every row
 * describes an arrow it never runs. Byte-equal to the stat cards' and the Audiences
 * table's — a website visit is never called a sales interest.
 */
const OUTCOME_COLUMNS: Record<
  WorkflowOutcomePair,
  { count: string; cost: string; countTip: string; costTip: string; noun: string }
> = {
  reply: {
    count: "Sales interests",
    cost: "Cost per sales interest",
    noun: "Sales interest",
    countTip:
      "Sales interests this workflow produced for this campaign: people who replied wanting to talk. Counted per person, so somebody who replied twice is one.",
    costTip:
      "What one sales interest cost through this workflow on this campaign. It is what we charged divided by the interests it produced, and we take it from the same place your campaign's own cost card does.",
  },
  visit: {
    count: "Website visits",
    cost: "Cost per website visit",
    noun: "Website visit",
    countTip:
      "Website visits this workflow produced for this campaign: people who came to your site from one of its emails. Counted per person, so somebody who clicked twice is one.",
    costTip:
      "What one website visit cost through this workflow on this campaign. It is what we charged divided by the visits it produced, and we take it from the same place your campaign's own cost card does.",
  },
};

/** The step key the producer uses for each pair's outcome — how a sentence knows which
 *  observed count it may quote. */
const OUTCOME_STEP_KEY: Record<WorkflowOutcomePair, string> = {
  reply: "conversation",
  visit: "website_visit",
};

const WORKFLOW_TIP =
  "A workflow is the pipeline that runs this channel: it finds the people, writes the email and sends it. Your campaign runs one at a time, and we switch it for a better one when the numbers say so.";

const RANK_TIP =
  "The order we would pick them in for this campaign, cheapest estimated cost first. It is the same ranking we use ourselves, so the one at the top is the one we would put you on next.";

const EST_TIP =
  "What we expect one outcome to cost through this workflow. We use the closest evidence we have (your own audience, then this brand, then every client we run the channel for), and the last column says which. A workflow that has never run for you is priced at one outreach so it can earn a first try.";

const MODEL_TIP =
  "The AI model this workflow writes your emails with. Two workflows on the same channel routinely differ only here, which is why a cheaper one appears.";

const TEMPLATE_TIP =
  "The prompt template the emails are written from. The second line is its exact id, version included, and that version is what tells two of them apart.";

const INVESTED_TIP =
  "What has been spent through this workflow on this campaign so far: billed usage plus the holds open on sends already queued. It is the same money the cost beside it divides.";

const WHY_TIP =
  "Where this workflow's estimate came from, in one line. Open the row for the full breakdown.";

const RUNNING_TIP =
  "The workflow your campaign is running right now. We pick it, and we change it when another one is producing outcomes more cheaply.";

function fmtCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function fmtCents(value: number | null): string {
  return value === null ? "—" : formatCentsAsUsdAdaptive(value);
}

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

/**
 * The ladder's BRAND-LEVEL rows, narrowed to what a rank and a sentence need.
 *
 * The ladder also enumerates one row per (audience x workflow) couple; those answer a
 * different question and would give one workflow several ranks, so only `audienceId:
 * null` reaches the table. The FIRST brand row per dynasty wins, deterministically.
 */
function ladderRows(ladder: WorkflowRankLadder | undefined): WorkflowLadderRow[] {
  if (!ladder) return [];
  const out: WorkflowLadderRow[] = [];
  const seen = new Set<string>();
  for (const r of ladder.rows) {
    if (r.audienceId !== null) continue;
    const slug = r.workflow.workflowDynastySlug;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      workflowDynastySlug: slug,
      measured: r.measured,
      grain: r.resolved.grain,
      costBasis: r.resolved.costBasis,
      costPerOutcomeUsd: r.resolved.costPerOutcomeUsd,
      roiMultiple: r.resolved.roiMultiple,
      estimatesByGrain: r.estimatesByGrain,
    });
  }
  return out;
}

export function CampaignWorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isBeta = useIsBetaUser();

  const brandId = String(params.brandId ?? "");
  const campaignId = String(params.id ?? "");

  const { campaign, featureSlug, settled: slugSettled } = useScopedFeatureSlug(campaignId);
  // WHICH OUTCOME these rows are counted and priced by — the campaign's own LEG, never
  // its funnel. A visit-led campaign read `0 sales interests` on every row before this,
  // for an arrow it does not run.
  const pair = useCampaignOutcomePair(campaign, featureSlug);
  const columns = OUTCOME_COLUMNS[pair];
  const revenueOk = featureSlug !== null && isRevenueFeature(featureSlug);
  const ready = isBeta && Boolean(featureSlug);

  // The channel's catalogue. It decides which rows EXIST, so a retired lineage the
  // ladder still prices gets no row.
  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );

  // The channel's version-to-dynasty map — the only source that can name a SUPERSEDED
  // version, which is what the campaign row is routinely pinned to.
  const dynastiesQ = useAuthQuery(
    ["workflowDynasties", featureSlug ?? "none"],
    () => listChannelWorkflowDynasties(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );

  // This CAMPAIGN's money per workflow — the figure columns. The campaign is in the key
  // as well as in the request: a brand-scoped entry answering a campaign-scoped question
  // is the wrong-scope bug wearing a cache key.
  const campaignRevQ = useAuthQuery(
    ["campaignWorkflowRevenue", brandId, campaignId],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId),
    { ...pollOptions, enabled: ready && Boolean(brandId) && Boolean(campaignId) },
  );

  // THE RANKING. Asked at the campaign's own leg, and its arguments ride the key: a
  // leg-keyed answer and a funnel-keyed one are different bodies and must never share
  // a cache entry.
  const legKey = campaign?.legKey ?? null;
  const funnelKey = campaign?.funnelKey ?? null;
  const ladderQ = useAuthQuery(
    ["workflowRankLadder", brandId, legKey ?? "none", legKey ? "none" : (funnelKey ?? "none")],
    () =>
      getWorkflowRankLadder({
        featureSlug: featureSlug as string,
        brandId,
        leg: legKey,
        funnel: legKey ? null : funnelKey,
      }),
    { ...pollOptions, enabled: ready && Boolean(brandId), retry: false },
  );

  // A stopped campaign produces nothing, so a thin price is not "learning" — it is
  // waiting on a restart.
  const { paused } = useScopePaused(brandId, { campaignId, enabled: isBeta });

  // WHICH workflow is running is a fact about the CAMPAIGN, resolved from every source
  // the page holds. campaign-service states a VERSIONED slug and the catalogue carries
  // only each dynasty's CURRENT version, so a campaign pinned to an older one is
  // nameable only by a group's folded slugs or the membership map.
  const running = useMemo(
    () =>
      resolveRunningWorkflow(
        campaign?.workflowSlug ?? null,
        catalogueQ.data ?? [],
        [campaignRevQ.data ?? []],
        dynastiesQ.data ?? [],
      ),
    [campaign?.workflowSlug, catalogueQ.data, campaignRevQ.data, dynastiesQ.data],
  );

  const rows = useMemo(
    () =>
      buildCampaignWorkflowRows({
        catalogue: catalogueQ.data ?? [],
        groups: campaignRevQ.data ?? [],
        running,
        pair,
        isLearning,
      }),
    [catalogueQ.data, campaignRevQ.data, running, pair],
  );

  // The outcome noun the ranked estimate is about. The producer states it on a
  // leg-keyed body (`leg.toStep.label`), so it is READ rather than spelled here; the
  // column's own word is the fallback for a funnel- or goal-keyed answer.
  const outcomeNoun = ladderQ.data?.leg?.toStep.label ?? columns.noun;
  const outcomeStepKey = ladderQ.data?.leg?.toStep.key ?? OUTCOME_STEP_KEY[pair];

  const ranked = useMemo(
    () =>
      rankWorkflowRows<CampaignWorkflowRow>({
        rows,
        ladder: ladderRows(ladderQ.data),
        recommended: ladderQ.data?.recommendedWorkflowDynastySlug ?? null,
        outcomeStepKey,
        outcomeNoun,
        formatUsd: formatUsdAdaptive,
      }),
    [rows, ladderQ.data, outcomeStepKey, outcomeNoun],
  );

  // Reveal on SETTLE (resolved OR errored). A failing read paints the table, never an
  // eternal skeleton — and the ladder is allowed to fail without taking the figures
  // down with it.
  const pending =
    !slugSettled ||
    (catalogueQ.isPending && !catalogueQ.isError) ||
    (campaignRevQ.isPending && !campaignRevQ.isError) ||
    (ladderQ.isPending && !ladderQ.isError);

  // The open workflow lives in the URL, so a link to one still works and Back closes it.
  const openSlug = searchParams.get("workflow");
  const openRanked = openSlug
    ? (ranked.find((r) => r.row.workflowDynastySlug === openSlug) ?? null)
    : null;

  const setOpen = useCallback(
    (slug: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (slug) next.set("workflow", slug);
      else next.delete("workflow");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
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

  const empty = !pending && revenueOk && ranked.length === 0;
  const rankUnavailable = !pending && revenueOk && ladderQ.isError;

  return (
    // The table keeps the WHOLE width and the panel OVERLAYS it, the Leads page's shape:
    // a split would reflow the ranking somebody is reading the moment they open a row of
    // it, i.e. move the list as the cost of looking at one line.
    <div className="relative flex h-full flex-col">
      <div className="mx-auto w-full max-w-7xl space-y-6 overflow-y-auto p-4 pb-24 md:p-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-gray-900">Workflows</h1>
            <MaturityBadge level="beta" />
            <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Ranked the way we pick them for this campaign, cheapest estimated cost first.
            The figures are this campaign&apos;s own.
          </p>
        </div>

        {pending && (
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <Skeleton className="h-64 w-full rounded" />
          </div>
        )}

        {!pending && !revenueOk && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
            This channel does not run workflows.
          </div>
        )}

        {empty && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
            This channel offers no workflow yet.
          </div>
        )}

        {rankUnavailable && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
            We could not work out the ranking for this campaign just now, so the list is
            unordered. Everything below is still this campaign&apos;s own.
          </div>
        )}

        {!pending && revenueOk && ranked.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              {/* The min-width is gated at the SAME breakpoint the folded columns come
                  back at: an unconditional floor re-widens the row on a phone and pushes
                  the columns that DO render off to the right, which reads as the data
                  being missing rather than as it being one swipe away. */}
              <table className="w-full table-fixed text-sm md:table-auto md:min-w-[1180px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                    <th className="w-[12%] px-3 py-3 md:w-auto">
                      # <InfoTooltip tip={RANK_TIP} placement="top" />
                    </th>
                    <th className="w-[46%] px-4 py-3 md:w-[20%]">
                      Workflow <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      LLM <InfoTooltip tip={MODEL_TIP} placement="top" />
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      Template <InfoTooltip tip={TEMPLATE_TIP} placement="top" />
                    </th>
                    <th className="w-[42%] px-4 py-3 md:w-auto md:whitespace-nowrap">
                      Est. cost / outcome <InfoTooltip tip={EST_TIP} placement="top" />
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      {columns.count} <InfoTooltip tip={columns.countTip} placement="top" />
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      {columns.cost} <InfoTooltip tip={columns.costTip} placement="top" />
                    </th>
                    <th className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                      $ Invested <InfoTooltip tip={INVESTED_TIP} placement="top" />
                    </th>
                    <th className="hidden px-4 py-3 md:table-cell md:w-[22%]">
                      Why <InfoTooltip tip={WHY_TIP} placement="top" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <WorkflowRow
                      key={r.row.workflowDynastySlug}
                      ranked={r}
                      paused={paused}
                      selected={openSlug === r.row.workflowDynastySlug}
                      onOpen={() => setOpen(r.row.workflowDynastySlug)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {openRanked && featureSlug && (
        <WorkflowRankPanel
          ranked={openRanked}
          featureSlug={featureSlug}
          brandId={brandId}
          campaignId={campaignId}
          pair={pair}
          outcomeStepKey={outcomeStepKey}
          outcomeNoun={outcomeNoun}
          siblings={rows}
          paused={paused}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** One row. The RUNNING one is framed in the brand's own primary; the rest are plain. */
function WorkflowRow({
  ranked,
  paused,
  selected,
  onOpen,
}: {
  ranked: RankedWorkflow<CampaignWorkflowRow>;
  paused: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const row = ranked.row;
  return (
    <tr
      onClick={onOpen}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-pointer border-b border-gray-100 transition last:border-0 hover:bg-gray-50 ${
        row.running ? "bg-brand-50" : selected ? "bg-gray-50" : ""
      }`}
    >
      <td className="px-3 py-3">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums ${
            row.running
              ? "bg-brand-600 text-white"
              : ranked.recommended
                ? "border border-brand-200 bg-white text-brand-600"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {ranked.rank}
        </span>
      </td>
      <td className="px-4 py-3">
        {/* WRAPS: the pill is `shrink-0` and the name truncates, so in the narrow mobile
            cell a `nowrap` row squeezed the name to ZERO width and showed a badge with
            no workflow at all. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-gray-900">
            {row.workflowDynastyName}
          </span>
          {row.running && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[11px] font-medium text-brand-600">
              Running now
              <InfoTooltip tip={RUNNING_TIP} placement="top" />
            </span>
          )}
          {ranked.recommended && !row.running && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
              Our pick
            </span>
          )}
        </div>
        {/* The sentence rides the NAME cell below `md`, where its own column folds away:
            it is the answer to the page's whole question, so it may not be the thing a
            phone loses. */}
        <p className="mt-1 text-xs text-gray-500 md:hidden">{ranked.why}</p>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <WorkflowModelCell contentModel={row.contentModel} />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <WorkflowTemplateCell contentPromptType={row.contentPromptType} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-gray-800">
        {ranked.estCostPerOutcomeUsd == null ? (
          "—"
        ) : ranked.measured ? (
          fmtUsd(ranked.estCostPerOutcomeUsd)
        ) : (
          // An explore allowance is a FLOOR, not a price — it is the cost of one
          // outreach, set so an unproven workflow can earn a first run. Printing it as a
          // price would make the cheapest row on the page the least proven one.
          <span className="text-gray-500">from {fmtUsd(ranked.estCostPerOutcomeUsd)}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {fmtCount(workflowOutcomeCount(row))}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {row.learning ? <LearningTag paused={paused} /> : fmtCents(workflowOutcomeCostCents(row))}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {fmtUsd(row.committedCostUsd)}
      </td>
      <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{ranked.why}</td>
    </tr>
  );
}
