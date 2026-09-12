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

import { useCallback, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { MaturityBadge } from "@/components/maturity-badge";
import { LearningTag } from "@/components/learning-tag";
import { WorkflowModelCell, WorkflowTemplateCell } from "@/components/workflows/workflow-cells";
import { WorkflowRankPanel } from "@/components/workflows/workflow-rank-panel";
import { formatUsdAdaptive } from "@/lib/format-number";
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
  listAudiences,
  getBrand,
  type WorkflowRankLadder,
} from "@/lib/api";
import { GrainMark } from "@/components/marks/grain-mark";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import {
  WORKFLOW_GRAINS,
  WORKFLOW_GRAIN_LABEL,
  WORKFLOW_GRAIN_NOTE,
  brandLevelRows,
  grainFigures,
  grainsWithEvidence,
  audienceRowsFor,
  type WorkflowGrain,
  type WorkflowLadderRowShape,
} from "@/lib/workflow-grains";
import {
  buildCampaignWorkflowRows,
  resolveRunningWorkflow,
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

const PROJECTED_COUNT_TIP =
  "This count was walked through your funnel's own conversion rates rather than observed directly, so it is an expectation, not a headcount.";

const GRAIN_TAB_TIP =
  "Which evidence the three figures beside it are read from. The rank never moves with it: that is ours, and it is scored over every piece of evidence a workflow has — including the audiences it ran for, which is why the top row is sometimes not the cheapest figure on screen.";

const RUNNING_TIP =
  "The workflow your campaign is running right now. We pick it, and we change it when another one is producing outcomes more cheaply.";

function fmtCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

/**
 * The ladder's BRAND-LEVEL rows, narrowed to what a rank and a sentence need.
 *
 * The ladder also enumerates one row per (audience x workflow); those do not become
 * table rows (a workflow would get several) but they are NOT discarded — the panel lists
 * them, because a rank is scored over them and a reader who cannot see them cannot see
 * what the rank stands on. `ladderAllRows` is what carries them through.
 */
function ladderRows(ladder: WorkflowRankLadder | undefined): WorkflowLadderRow[] {
  if (!ladder) return [];
  return brandLevelRows(ladder.rows as unknown as WorkflowLadderRowShape[]).map((r) => {
    const row = r as unknown as WorkflowRankLadder["rows"][number];
    return {
      workflowDynastySlug: row.workflow.workflowDynastySlug,
      measured: row.measured,
      grain: row.resolved.grain,
      costBasis: row.resolved.costBasis,
      costPerOutcomeUsd: row.resolved.costPerOutcomeUsd,
      roiMultiple: row.resolved.roiMultiple,
      estimatesByGrain: row.estimatesByGrain,
      rank: row.rank ?? null,
    };
  });
}

/** Every row the producer sent, in its own shape — the panel reads the audiences off it. */
function ladderAllRows(ladder: WorkflowRankLadder | undefined): WorkflowLadderRowShape[] {
  return (ladder?.rows ?? []) as unknown as WorkflowLadderRowShape[];
}

/** The brand-level row of ONE workflow, for the grain columns and the provenance strip. */
function brandRowFor(
  rows: readonly WorkflowLadderRowShape[],
  slug: string,
): WorkflowLadderRowShape | null {
  return brandLevelRows(rows).find((r) => r.workflow.workflowDynastySlug === slug) ?? null;
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
    [
      "workflowRankLadder",
      brandId,
      legKey ?? "none",
      legKey ? "none" : (funnelKey ?? "none"),
      // The campaign rides the KEY as well as the request: a body carrying the campaign
      // grain and one without it are different answers and must never share an entry.
      legKey ? campaignId : "none",
    ],
    () =>
      getWorkflowRankLadder({
        featureSlug: featureSlug as string,
        brandId,
        leg: legKey,
        funnel: legKey ? null : funnelKey,
        campaignId,
      }),
    { ...pollOptions, enabled: ready && Boolean(brandId), retry: false },
  );

  // WHICH GRAIN the figure columns answer at. The RANK never moves with it — that is the
  // producer's, scored over a wider population than any one column shows, so a tab is a
  // change of SOURCE and never a change of ORDER.
  const [grain, setGrain] = useState<WorkflowGrain>("campaign");

  // The brand's own mark, for the `brand` grain. `["brand", brandId]` is the key the
  // tenant switcher already polls on every brand page, so it costs no request.
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId), {
    ...pollOptions,
    enabled: ready && Boolean(brandId),
  });

  // A DISPLAY LOOKUP, id -> name + face, for the audience rows the panel lists. The
  // producer sends an audience's evidence under its id and nothing else; naming it is
  // the one join this page makes, on the key the brand Overview already polls.
  const audiencesQ = useAuthQuery(["audiences", brandId], () => listAudiences(brandId), {
    ...pollOptions,
    enabled: ready && Boolean(brandId),
  });
  const audienceById = useMemo(() => {
    const m = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const a of audiencesQ.data?.audiences ?? []) {
      m.set(a.id, { name: a.name, avatarUrl: a.avatarUrl ?? null });
    }
    return m;
  }, [audiencesQ.data]);

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

  // Every row the producer sent, audiences included — the panel's own source.
  const allLadderRows = useMemo(() => ladderAllRows(ladderQ.data), [ladderQ.data]);

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
            Ranked the way we pick them for this campaign — the order is ours, read from
            the same place we pick from. {WORKFLOW_GRAIN_NOTE[grain]}
          </p>
        </div>

        {/* THE GRAIN IS A CHOICE OF SOURCE, NOT OF ORDER. Every tab renders the same
            three columns off the same rows; only whose evidence they state changes, and
            the rank column is byte-identical across all three. */}
        {!pending && revenueOk && ranked.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {WORKFLOW_GRAINS.map((g) => {
              const active = g === grain;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrain(g)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-brand-200 bg-brand-50 font-medium text-brand-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <GrainMark
                    grain={g}
                    brandDomain={brandQ.data?.brand.domain ?? null}
                    brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
                    size={16}
                  />
                  {WORKFLOW_GRAIN_LABEL[g]}
                </button>
              );
            })}
          </div>
        )}

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
                      grain={grain}
                      ladderRow={brandRowFor(allLadderRows, r.row.workflowDynastySlug)}
                      audienceRows={audienceRowsFor(allLadderRows, r.row.workflowDynastySlug)}
                      audienceById={audienceById}
                      brandDomain={brandQ.data?.brand.domain ?? null}
                      brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
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
          ladderRow={brandRowFor(allLadderRows, openRanked.row.workflowDynastySlug)}
          audienceRows={audienceRowsFor(allLadderRows, openRanked.row.workflowDynastySlug)}
          audienceById={audienceById}
          brandDomain={brandQ.data?.brand.domain ?? null}
          brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
          legStepLabel={ladderQ.data?.leg?.toStep.label ?? null}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** One row. The RUNNING one is framed in the brand's own primary; the rest are plain. */
function WorkflowRow({
  ranked,
  grain,
  ladderRow,
  audienceRows,
  audienceById,
  brandDomain,
  brandLogoUrl,
  paused,
  selected,
  onOpen,
}: {
  ranked: RankedWorkflow<CampaignWorkflowRow>;
  grain: WorkflowGrain;
  ladderRow: WorkflowLadderRowShape | null;
  audienceRows: ReturnType<typeof audienceRowsFor>;
  audienceById: Map<string, { name: string; avatarUrl: string | null }>;
  brandDomain: string | null;
  brandLogoUrl: string | null;
  paused: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const row = ranked.row;
  // THE ACTIVE GRAIN'S OWN FIGURES, served. `null` = this workflow never spent at this
  // grain, which is a different answer from having spent and produced nothing — the
  // first renders a dash, the second renders the zero it measured.
  const figures = grainFigures(ladderRow?.estimatesByGrain[grain]);
  const evidenceGrains = ladderRow ? grainsWithEvidence(ladderRow) : [];
  // The audiences that actually RAN it. They are what a rank standing on a figure no
  // column shows is standing on, so the row shows they exist and the panel lists them.
  const audiencesWithEvidence = audienceRows.filter((a) => a.figures != null);
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
          {ranked.rank ?? "—"}
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
        {/* WHERE THIS WORKFLOW HAS EVIDENCE, as marks. The rank is scored over every row
            a workflow has — its audiences included — so a reader seeing `#1` beside a
            campaign figure that is not the cheapest on the page needs to SEE that an
            audience is in the picture. The panel lists them; this says they exist. */}
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {evidenceGrains.map((g) => (
            <GrainMark
              key={g}
              grain={g}
              brandDomain={brandDomain}
              brandLogoUrl={brandLogoUrl}
              size={18}
            />
          ))}
          {audiencesWithEvidence.slice(0, 3).map((a) => {
            const meta = audienceById.get(a.audienceId);
            return (
              <AudienceAvatar
                key={a.audienceId}
                name={meta?.name ?? "Audience"}
                avatarUrl={meta?.avatarUrl}
                size={18}
              />
            );
          })}
          {audiencesWithEvidence.length > 3 && (
            <span className="text-[10px] text-gray-500">
              +{audiencesWithEvidence.length - 3}
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
          <span className="inline-flex items-center gap-1.5">
            {/* The producer's own PROVENANCE label for this figure — the finest grain
                that actually OBSERVED the outcome, which is decoupled from the grain the
                number was read at. A grain that spent and observed nothing is a floored
                projection and is never marked as that grain's own result. */}
            {ladderRow?.estimatesByGrain && ranked.ladder?.grain && ranked.ladder.grain !== "audience" && (
              <GrainMark
                grain={ranked.ladder.grain as WorkflowGrain}
                brandDomain={brandDomain}
                brandLogoUrl={brandLogoUrl}
                size={14}
              />
            )}
            {fmtUsd(ranked.estCostPerOutcomeUsd)}
          </span>
        ) : (
          // An explore allowance is a FLOOR, not a price — it is the cost of one
          // outreach, set so an unproven workflow can earn a first run. Printing it as a
          // price would make the cheapest row on the page the least proven one.
          <span className="text-gray-500">from {fmtUsd(ranked.estCostPerOutcomeUsd)}</span>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {figures == null ? (
          "—"
        ) : (
          <span className="inline-flex items-center gap-1.5">
            {fmtCount(figures.outcomeCount)}
            {!figures.outcomeObserved && (
              <InfoTooltip tip={PROJECTED_COUNT_TIP} placement="top" />
            )}
          </span>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {figures == null ? (
          "—"
        ) : isLearning(figures.outcomeCount) ? (
          <LearningTag paused={paused} />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <GrainMark
              grain={grain}
              brandDomain={brandDomain}
              brandLogoUrl={brandLogoUrl}
              size={14}
            />
            {fmtUsd(figures.costPerOutcomeUsd)}
          </span>
        )}
      </td>
      <td className="hidden px-4 py-3 whitespace-nowrap text-gray-800 md:table-cell">
        {figures == null ? "—" : fmtUsd(figures.spentUsd)}
      </td>
      <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{ranked.why}</td>
    </tr>
  );
}
