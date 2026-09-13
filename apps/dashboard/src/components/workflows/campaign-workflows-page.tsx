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
 * ── THE ORDER WAS UNREADABLE, AND NOT BECAUSE IT WAS WRONG ───────────────────────
 *
 * "je n'arrive pas à lire dans cette table ton critère de ranking". The table listed 24
 * workflows numbered 1..24 and the cost beside the number did not ascend with it: rank
 * 1 read $175, rank 2 $317, rank 3 $21. Nothing was broken. features-service scores
 * `rank` per DYNASTY over EVERY row that dynasty has — the campaign row AND each
 * per-audience row — while the page displayed ONE row per workflow and ONE figure per
 * row, so the cell that won the argmin was usually not the cell on screen. The page was
 * displaying one number and ordering on another, and the deciding one was nowhere.
 *
 * So the fix is not a re-rank. It is to SHOW THE CELLS. Rows are workflows in served
 * `rank` order, columns are the campaign then each audience, and a cell is that
 * (workflow x audience) row's own `resolved.costPerOutcomeUsd`. The argmin now runs over
 * exactly what a reader can see.
 *
 * Prod, 2026-09-13, brand `75d7e3e8` / campaign `f7b1b610` / leg `start_to_conversation`:
 * `lithium` is rank 1 on an AUDIENCE cell of 3 conversations on $61.06 = $20.35, while
 * its campaign column reads $174.77. That is the whole story, and it is legible the
 * moment both cells are on screen.
 *
 * ── EXPECT A WALL OF REPEATED FIGURES. THAT IS THE FINDING ───────────────────────
 *
 * Of 312 cells on that campaign, 273 are the fleet floor, 32 the campaign grain and 7
 * an audience's own evidence; 21 of the 24 workflow rows are IDENTICAL across every
 * column. A cell resting on its own column's evidence is drawn FULL and every inherited
 * floor is MUTED, which is what makes the repetition legible rather than confusing.
 *
 * ── TWO SERVED POSITIONS, AND THEY DISAGREE ON PURPOSE ───────────────────────────
 *
 * `rank` is the merit order (what we would put this campaign on next) and orders the
 * matrix's ROWS. `scopeRank` (features-service v0.164.1) is a row's place within its own
 * column, ascending on the figure that column displays, and orders each PER-AUDIENCE
 * page. Reading `rank` on a per-audience list would make it ascend on a number it is not
 * showing — the exact bug this replaced, one scope down.
 *
 * ── THE THREE GRAIN TABS ARE GONE ────────────────────────────────────────────────
 *
 * They swapped which evidence three columns were read from while the rank stayed put, so
 * they could not answer the question the reader was asking. Campaign is a COLUMN now;
 * Brand has no meaning on a campaign page; Global is read in the panel, which already
 * lists every grain at once. Do not re-add a tab.
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
 * to a wider scope would answer a question nobody asked — so the surface renders with no
 * rank and no why, and says why.
 *
 * ── THE COLUMN ORDER IS THE PRODUCER'S TOO ───────────────────────────────────────
 *
 * `/audience-stats` already ranks a campaign's audiences on their own pooled cost per
 * outcome (ascending) and is scoped to the campaign's identity, so the columns and the
 * sidebar read it in the order served. It is NOT ordered on each audience's best ladder
 * cell: that ties 10 of 12 audiences at one inherited floor and says nothing.
 *
 * ⚠️ Column 1 and row 1 do NOT intersect at the best cell, and that is real. The best
 * audience overall (`audiences[0]`) carried 0 replies on 92 contacted — the explore
 * floor one grain over — while the only genuinely measured audience sat second. So the
 * single best cell is marked EXPLICITLY rather than implied by the corner.
 *
 * ── THE REST OF THE RULES, EACH ONE A MISTAKE ALREADY PAID FOR ───────────────────
 *
 *  1. EVERY FIGURE IS SERVED. Nothing here divides, and nothing sorts on a cost.
 *  2. THE CHANNEL IS THE CAMPAIGN'S OWN (`useScopedFeatureSlug`), never the brand's
 *     sole feature — a campaign on another channel would list somebody else's workflows.
 *  3. A PRICE UNDER THE BAR SAYS SO (`Learning`; `Paused` while the campaign is stopped,
 *     because nothing is being measured then).
 *  4. THE OUTCOME IS THE CAMPAIGN'S OWN LEG, never its funnel — a visit-led campaign is
 *     counted and priced in WEBSITE VISITS.
 *  5. A RETIRED workflow gets NO row: the rows are the channel's catalogue, and a
 *     lineage nobody can be put on is not an option.
 *  6. OPENING A ROW OPENS A PANEL, not a page — the ranking stays on screen, and the
 *     open workflow rides `?workflow=<dynasty>` so a link still works. The open SCOPE
 *     rides `?scope=<audienceId>` for the same reason.
 *  7. A CELL IS NEVER FABRICATED. A row the ladder does not carry states nothing.
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
  fetchFeatureAudienceStats,
  type WorkflowRankLadder,
} from "@/lib/api";
import { GrainMark } from "@/components/marks/grain-mark";
import { AudienceAvatar } from "@/components/audiences/audience-avatar";
import {
  grainFigures,
  scopeLadderRows,
  audienceRowsFor,
  type WorkflowLadderRowShape,
  type WorkflowLegOutcome,
} from "@/lib/workflow-grains";
import {
  buildMatrixCellIndex,
  matrixWorkflowOrder,
  matrixCellKey,
  bestMatrixCell,
  isBestCell,
  cellRestsOnOwnEvidence,
  type MatrixCell,
  type MatrixLadderRow,
} from "@/lib/workflow-matrix";
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
      "Sales interests this workflow produced for this audience: people who replied wanting to talk. Counted per person, so somebody who replied twice is one.",
    costTip:
      "What one sales interest cost through this workflow for this audience. It is what we charged divided by the interests it produced.",
  },
  visit: {
    count: "Website visits",
    cost: "Cost per website visit",
    noun: "Website visit",
    countTip:
      "Website visits this workflow produced for this audience: people who came to your site from one of its emails. Counted per person, so somebody who clicked twice is one.",
    costTip:
      "What one website visit cost through this workflow for this audience. It is what we charged divided by the visits it produced.",
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
  "The order we would pick them in for this campaign. We score every workflow over all the evidence it has, your audiences included, so the one at the top is the one we would put you on next. That is why the top row is sometimes not the cheapest figure on its own line.";

const SCOPE_RANK_TIP =
  "The order for this audience, cheapest first on the figure beside it. It is a different question from the overall pick, which is scored across every audience at once.";

const MATRIX_TIP =
  "Every estimate the ranking is made of. A row is a workflow, a column is who it was priced for, and the number is what one outcome is expected to cost there.";

const EST_TIP =
  "What we expect one outcome to cost through this workflow. We use the closest evidence we have (your own audience, then this brand, then every client we run the channel for), and the last column says which. A workflow that has never run for you is priced at one outreach so it can earn a first try.";

const MODEL_TIP =
  "The AI model this workflow writes your emails with. Two workflows on the same channel routinely differ only here, which is why a cheaper one appears.";

const TEMPLATE_TIP =
  "The prompt template the emails are written from. The second line is its exact id, version included, and that version is what tells two of them apart.";

const INVESTED_TIP =
  "What has been spent through this workflow for this audience so far: billed usage plus the holds open on sends already queued. It is the same money the cost beside it divides.";

const WHY_TIP =
  "Where this workflow's estimate came from, in one line. Open the row for the full breakdown.";

const PROJECTED_COUNT_TIP =
  "This count was walked through your funnel's own conversion rates rather than observed directly, so it is an expectation, not a headcount.";

const RUNNING_TIP =
  "The workflow your campaign is running right now. We pick it, and we change it when another one is producing outcomes more cheaply.";

const BEST_CELL_TIP =
  "The cheapest outcome anywhere on this grid. It is one workflow priced for one audience, which is why it does not have to sit in the first row or the first column.";

const CURRENT_BEST_TIP =
  "Your cheapest audience on this campaign, on its own cost per outcome across every workflow it has run.";

const CAMPAIGN_SCOPE_TIP =
  "Everything this campaign has produced, across every audience it runs.";

function fmtCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

/**
 * ONE SCOPE's ladder rows, narrowed to what a rank and a sentence need.
 *
 * `audienceId: null` is the campaign column; a string is one audience's. The per-audience
 * page reads its OWN column here, so its estimate, its sentence and its position all
 * describe the same body of evidence.
 */
function ladderRowsForScope(
  ladder: WorkflowRankLadder | undefined,
  audienceId: string | null,
): WorkflowLadderRow[] {
  if (!ladder) return [];
  return scopeLadderRows(ladder.rows as unknown as WorkflowLadderRowShape[], audienceId).map(
    (r) => {
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
        scopeRank: row.scopeRank ?? null,
      };
    },
  );
}

/** Every row the producer sent, in its own shape — the panel reads the audiences off it. */
function ladderAllRows(ladder: WorkflowRankLadder | undefined): WorkflowLadderRowShape[] {
  return (ladder?.rows ?? []) as unknown as WorkflowLadderRowShape[];
}

/** The campaign-column row of ONE workflow, for the panel's grain cascade. */
function campaignColumnRowFor(
  rows: readonly WorkflowLadderRowShape[],
  slug: string,
): WorkflowLadderRowShape | null {
  return scopeLadderRows(rows, null).find((r) => r.workflow.workflowDynastySlug === slug) ?? null;
}

/** THIS SCOPE's own figures for one workflow — the audience's block on an audience page,
 *  the campaign's on the campaign column. Never a coarser grain wearing this scope's
 *  name: a figure the scope did not produce is absent, not borrowed. */
function scopeFigures(
  row: WorkflowLadderRowShape | null,
  audienceId: string | null,
): WorkflowLegOutcome | null {
  if (!row) return null;
  return grainFigures(
    audienceId ? row.estimatesByGrain.audience : row.estimatesByGrain.campaign,
  );
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

  // This CAMPAIGN's money per workflow — what builds the display rows. The campaign is in
  // the key as well as in the request: a brand-scoped entry answering a campaign-scoped
  // question is the wrong-scope bug wearing a cache key.
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

  // THE COLUMN ORDER, and the sidebar's. `/audience-stats` already ranks this campaign's
  // audiences on their own pooled cost per outcome, so it is read in the order served and
  // never re-sorted. The key is byte-equal to the campaign Overview's, so the two dedupe
  // to one poll. A campaign predating the funnel column names no funnel and therefore no
  // order: it gets the campaign column alone rather than an order invented here.
  const audienceStatsQ = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, funnelKey ?? "none", "campaign", campaignId],
    () =>
      fetchFeatureAudienceStats(featureSlug as string, {
        brandId,
        funnel: funnelKey as NonNullable<typeof funnelKey>,
        campaignId,
      }),
    { ...pollOptions, enabled: ready && Boolean(brandId) && Boolean(funnelKey) },
  );

  // The brand's own mark, for the panel's brand grain. `["brand", brandId]` is the key the
  // tenant switcher already polls on every brand page, so it costs no request.
  const brandQ = useAuthQuery(["brand", brandId], () => getBrand(brandId), {
    ...pollOptions,
    enabled: ready && Boolean(brandId),
  });

  // A DISPLAY LOOKUP, id -> name + face. The producer sends an audience's evidence under
  // its id and nothing else; naming it is the one join this page makes, on the key the
  // brand Overview already polls.
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

  // Every row the producer sent, audiences included — the matrix's and the panel's source.
  const allLadderRows = useMemo(() => ladderAllRows(ladderQ.data), [ladderQ.data]);
  const matrixRows = useMemo(
    () => (ladderQ.data?.rows ?? []) as unknown as MatrixLadderRow[],
    [ladderQ.data],
  );

  // THE SCOPE a reader is on. `null` = the matrix. It lives in the URL so a link to one
  // audience's ranking still works and Back leaves it.
  const scopeParam = searchParams.get("scope");
  // A scope the ladder does not carry is not a scope: an id somebody pasted must not
  // paint an empty table that reads as "this audience produced nothing".
  const knownScopes = useMemo(() => {
    const s = new Set<string>();
    for (const r of matrixRows) if (r.audienceId) s.add(r.audienceId);
    return s;
  }, [matrixRows]);
  const scope = scopeParam && knownScopes.has(scopeParam) ? scopeParam : null;

  // THE COLUMNS: the producer's audience order, kept to the audiences the ladder actually
  // carries a column for. An audience the ladder does not price has no cell to show, and
  // one the ladder carries but `/audience-stats` did not rank has no stated position —
  // inventing one here would be this page ordering what the producer ordered.
  const audienceColumns = useMemo(() => {
    const served = audienceStatsQ.data?.audiences ?? [];
    return served
      .filter((a) => knownScopes.has(a.audienceId))
      .map((a) => ({
        audienceId: a.audienceId,
        name: audienceById.get(a.audienceId)?.name ?? a.audience.name,
        avatarUrl: audienceById.get(a.audienceId)?.avatarUrl ?? a.audience.avatarUrl ?? null,
      }));
  }, [audienceStatsQ.data, knownScopes, audienceById]);

  const matrixOrder = useMemo(() => matrixWorkflowOrder(matrixRows), [matrixRows]);
  const cellIndex = useMemo(() => buildMatrixCellIndex(matrixRows), [matrixRows]);
  const best = useMemo(() => bestMatrixCell(matrixRows), [matrixRows]);

  // The display rows, keyed by dynasty — the matrix draws the catalogue's rows in the
  // producer's rank order, so a retired lineage the ladder prices still gets none.
  const rowBySlug = useMemo(() => {
    const m = new Map<string, CampaignWorkflowRow>();
    for (const r of rows) m.set(r.workflowDynastySlug, r);
    return m;
  }, [rows]);

  const matrixDisplayRows = useMemo(() => {
    const ordered = matrixOrder
      .map((m) => ({ ...m, row: rowBySlug.get(m.dynastySlug) ?? null }))
      .filter((m): m is { dynastySlug: string; rank: number | null; row: CampaignWorkflowRow } =>
        m.row !== null,
      );
    // The RUNNING row is pinned first and KEEPS its rank — a reader opening this page
    // wants to see what is happening, and a `#1` badge on a row the producer ranks
    // fourth would be this surface stating something the ladder does not.
    const i = ordered.findIndex((m) => m.row.running);
    if (i <= 0) return ordered;
    const [pinned] = ordered.splice(i, 1);
    return [pinned, ...ordered];
  }, [matrixOrder, rowBySlug]);

  // THE PER-AUDIENCE LIST, ordered on the producer's `scopeRank` — the position that
  // ascends on the figure this list shows.
  const scopeLadder = useMemo(
    () => ladderRowsForScope(ladderQ.data, scope),
    [ladderQ.data, scope],
  );
  const scopeRanked = useMemo(
    () =>
      rankWorkflowRows<CampaignWorkflowRow>({
        rows,
        ladder: scopeLadder,
        recommended: ladderQ.data?.recommendedWorkflowDynastySlug ?? null,
        outcomeStepKey,
        outcomeNoun,
        formatUsd: formatUsdAdaptive,
        orderBy: "scopeRank",
      }),
    [rows, scopeLadder, ladderQ.data, outcomeStepKey, outcomeNoun],
  );

  // Reveal on SETTLE (resolved OR errored). A failing read paints the surface, never an
  // eternal skeleton — and the ladder is allowed to fail without taking the rows down.
  const pending =
    !slugSettled ||
    (catalogueQ.isPending && !catalogueQ.isError) ||
    (campaignRevQ.isPending && !campaignRevQ.isError) ||
    (ladderQ.isPending && !ladderQ.isError);

  // The open workflow lives in the URL, so a link to one still works and Back closes it.
  const openSlug = searchParams.get("workflow");
  const openRow = openSlug ? (rowBySlug.get(openSlug) ?? null) : null;
  const openRanked = useMemo(() => {
    if (!openRow) return null;
    const [only] = rankWorkflowRows<CampaignWorkflowRow>({
      rows: [openRow],
      ladder: ladderRowsForScope(ladderQ.data, null),
      recommended: ladderQ.data?.recommendedWorkflowDynastySlug ?? null,
      outcomeStepKey,
      outcomeNoun,
      formatUsd: formatUsdAdaptive,
    });
    return only ?? null;
  }, [openRow, ladderQ.data, outcomeStepKey, outcomeNoun]);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setOpen = useCallback((slug: string | null) => setParam("workflow", slug), [setParam]);
  const setScope = useCallback((id: string | null) => setParam("scope", id), [setParam]);

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

  const empty = !pending && revenueOk && rows.length === 0;
  const rankUnavailable = !pending && revenueOk && ladderQ.isError;
  const scopeName = scope ? (audienceById.get(scope)?.name ?? "This audience") : null;

  return (
    // The grid keeps the WHOLE width and the panel OVERLAYS it, the Leads page's shape:
    // a split would reflow the ranking somebody is reading the moment they open a row of
    // it, i.e. move the list as the cost of looking at one line.
    <div className="relative flex h-full flex-col">
      <div className="w-full space-y-6 overflow-y-auto p-4 pb-24 md:p-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-gray-900">Workflows</h1>
            <MaturityBadge level="beta" />
            <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {scope
              ? `Ranked for ${scopeName}, cheapest first on what it has cost there.`
              : "Every estimate the ranking is made of. A row is a workflow, a column is who it was priced for."}
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

        {!pending && revenueOk && rows.length > 0 && (
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <ScopeSidebar
              audiences={audienceColumns}
              scope={scope}
              brandDomain={brandQ.data?.brand.domain ?? null}
              brandLogoUrl={brandQ.data?.brand.logoUrl ?? null}
              onSelect={setScope}
            />

            <div className="min-w-0 flex-1">
              {scope === null ? (
                <WorkflowMatrix
                  rows={matrixDisplayRows}
                  audiences={audienceColumns}
                  cells={cellIndex}
                  best={best}
                  onOpen={setOpen}
                  onSelectScope={setScope}
                />
              ) : (
                <ScopeTable
                  ranked={scopeRanked}
                  audienceId={scope}
                  audienceName={scopeName ?? "This audience"}
                  audienceAvatarUrl={audienceById.get(scope)?.avatarUrl ?? null}
                  ladderRows={allLadderRows}
                  columns={columns}
                  paused={paused}
                  openSlug={openSlug}
                  onOpen={setOpen}
                />
              )}
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
          ladderRow={campaignColumnRowFor(allLadderRows, openRanked.row.workflowDynastySlug)}
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

interface AudienceColumn {
  audienceId: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * THE SECOND-LEVEL SIDEBAR: the campaign, then every audience in the producer's order.
 *
 * `audiences[0]` carries `Current best` because `/audience-stats` ranks them ascending on
 * their own cost per outcome — that is the producer's answer, restated, not a pick made
 * here. It is a SCROLLING rail rather than a full column on a phone, where a 12-entry
 * sidebar above the grid would push the grid off the first screen.
 */
/**
 * EXPORTED so a render probe can mount it — this surface's defects are geometric (a
 * rotated label clipping, a column tint landing on the wrong column) and no source
 * assertion can see one. Two were found that way and neither was visible to `tsc` or to
 * the 4090-test suite. Nothing in the app imports these three.
 */
export function ScopeSidebar({
  audiences,
  scope,
  brandDomain,
  brandLogoUrl,
  onSelect,
}: {
  audiences: readonly AudienceColumn[];
  scope: string | null;
  brandDomain: string | null;
  brandLogoUrl: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <nav className="w-full shrink-0 rounded-xl border border-gray-200 bg-white p-2 md:w-56 md:max-h-[70vh] md:overflow-y-auto">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
          scope === null
            ? "bg-brand-50 font-medium text-brand-700"
            : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <GrainMark
          grain="campaign"
          brandDomain={brandDomain}
          brandLogoUrl={brandLogoUrl}
          size={18}
        />
        <span className="truncate">Campaign</span>
        <InfoTooltip tip={CAMPAIGN_SCOPE_TIP} placement="top" />
      </button>

      {audiences.length > 0 && (
        <p className="mt-2 px-2 pb-1 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
          Audiences
        </p>
      )}

      {audiences.map((a, i) => {
        const active = scope === a.audienceId;
        return (
          <button
            key={a.audienceId}
            type="button"
            onClick={() => onSelect(a.audienceId)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
              active
                ? "bg-brand-50 font-medium text-brand-700"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} size={18} />
            <span className="min-w-0 flex-1 truncate">{a.name}</span>
            {i === 0 && (
              <span className="inline-flex shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                Best
                <InfoTooltip tip={CURRENT_BEST_TIP} placement="top" />
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * THE GRID. Rows in the producer's `rank` order, columns in the producer's audience
 * order, one served figure per cell.
 *
 * The FIRST COLUMN is sticky so a workflow keeps its name while a reader scrolls sideways
 * through twelve audiences, and the headers are OBLIQUE so a 76px column can carry a name
 * a person can read. Nothing compresses: the grid scrolls rather than squeezing twelve
 * columns into a phone.
 */
export function WorkflowMatrix({
  rows,
  audiences,
  cells,
  best,
  onOpen,
  onSelectScope,
}: {
  rows: readonly { dynastySlug: string; rank: number | null; row: CampaignWorkflowRow }[];
  audiences: readonly AudienceColumn[];
  cells: Map<string, MatrixCell>;
  best: ReturnType<typeof bestMatrixCell>;
  onOpen: (slug: string) => void;
  onSelectScope: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">Every estimate, side by side</h2>
        <InfoTooltip tip={MATRIX_TIP} placement="top" />
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[240px] min-w-[240px] bg-white px-4 pt-3 pb-2 text-left align-bottom text-xs font-medium text-gray-500">
                Workflow <InfoTooltip tip={RANK_TIP} placement="top" />
              </th>
              <ObliqueHeader label="Campaign" tip={CAMPAIGN_SCOPE_TIP}>
                <GrainMark grain="campaign" size={16} />
              </ObliqueHeader>
              {audiences.map((a, i) => (
                <ObliqueHeader
                  key={a.audienceId}
                  label={a.name}
                  best={i === 0}
                  onClick={() => onSelectScope(a.audienceId)}
                >
                  <AudienceAvatar name={a.name} avatarUrl={a.avatarUrl} size={16} />
                </ObliqueHeader>
              ))}
              {/* A rotated label runs up and to the RIGHT of its own column, so the last
                  few reach past the table's own width and the scroll container clips
                  them: measured at 1440, the final two ran 11px and 107px over. The
                  spacer puts that overhang INSIDE the scrollable width, so scrolling
                  right reveals a name rather than the end of the grid. */}
              <th aria-hidden className="w-[160px] min-w-[160px] p-0" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // The rank-1 row is our pick, and the running row is what is happening —
              // two different facts, each with its own badge, so each gets its own tint.
              const rowTint = r.row.running
                ? "bg-brand-50"
                : r.rank === 1
                  ? "bg-gray-50"
                  : "";
              return (
                <tr
                  key={r.dynastySlug}
                  onClick={() => onOpen(r.dynastySlug)}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(r.dynastySlug);
                    }
                  }}
                  className={`cursor-pointer border-b border-gray-100 transition last:border-0 hover:bg-gray-50 ${rowTint}`}
                >
                  <td
                    className={`sticky left-0 z-10 w-[240px] min-w-[240px] px-4 py-2.5 ${
                      rowTint === "" ? "bg-white" : rowTint
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums ${
                          r.row.running
                            ? "bg-brand-600 text-white"
                            : r.rank === 1
                              ? "border border-brand-200 bg-white text-brand-600"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {r.rank ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                        {r.row.workflowDynastyName}
                      </span>
                      {r.row.running && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-2 py-0.5 text-[11px] font-medium text-brand-600">
                          Running
                          <InfoTooltip tip={RUNNING_TIP} placement="top" />
                        </span>
                      )}
                    </div>
                  </td>
                  <MatrixCellTd
                    cell={cells.get(matrixCellKey(r.dynastySlug, null))}
                    best={isBestCell(best, r.dynastySlug, null)}
                  />
                  {audiences.map((a, i) => (
                    <MatrixCellTd
                      key={a.audienceId}
                      cell={cells.get(matrixCellKey(r.dynastySlug, a.audienceId))}
                      best={isBestCell(best, r.dynastySlug, a.audienceId)}
                      column={i === 0}
                    />
                  ))}
                  <td aria-hidden className="w-[160px] min-w-[160px] p-0" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
        A figure in full colour is what that column actually produced. A faded one repeats
        a price from a wider pool, because nothing has been measured there yet.
      </p>
    </div>
  );
}

/**
 * A column head, rotated so a 76px column can carry a readable name.
 *
 * `origin-bottom-left` with `-rotate-45` runs the label up and to the right from the
 * bottom of the column, which is the shape every dense matrix uses. The height is fixed
 * so the rotated text has somewhere to go rather than clipping into the row above.
 */
function ObliqueHeader({
  label,
  tip,
  best,
  onClick,
  children,
}: {
  label: string;
  tip?: string;
  best?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      {children}
      {/* BOUNDED, because a 45-degree label needs `width / √2` of vertical room and a
          name has no length limit: at `h-[140px]` with no cap, nine of twelve real
          audience names were silently CUT at the top of the scroll container (measured
          `top: 29` against a container top of 75). An ellipsis says there is more; a
          clip says nothing. The full name is on the `title`, in the sidebar, and on the
          page the column opens. */}
      <span className={`max-w-[130px] truncate ${best ? "font-medium text-brand-700" : ""}`}>
        {label}
      </span>
      {best && (
        <span className="inline-flex shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
          Best
        </span>
      )}
      {tip && <InfoTooltip tip={tip} placement="top" />}
    </div>
  );
  return (
    <th
      title={label}
      className={`h-[168px] w-[76px] min-w-[76px] p-0 align-bottom text-xs font-medium ${
        best ? "text-brand-700" : "text-gray-500"
      }`}
    >
      <div className="relative h-[168px] w-[76px]">
        <div className="absolute bottom-1 left-1/2 origin-bottom-left -rotate-45">
          {onClick ? (
            <button
              type="button"
              onClick={onClick}
              className="cursor-pointer rounded px-1 py-0.5 hover:bg-gray-50"
            >
              {inner}
            </button>
          ) : (
            inner
          )}
        </div>
      </div>
    </th>
  );
}

/**
 * ONE CELL.
 *
 * FULL when the figure rests on this column's own evidence, MUTED when it is a floor
 * inherited from a wider pool — which is the grid's whole visual language, and why 21
 * identical rows read as a fact rather than as a bug. A cell the ladder does not carry
 * states nothing: `—`, never a zero.
 */
function MatrixCellTd({
  cell,
  best,
  column,
}: {
  cell: MatrixCell | undefined;
  best: boolean;
  column?: boolean;
}) {
  const own = cellRestsOnOwnEvidence(cell);
  const columnTint = column && !best ? "bg-gray-50" : "";
  if (!cell || cell.costPerOutcomeUsd == null) {
    return (
      <td
        className={`w-[76px] min-w-[76px] px-2 py-2.5 text-center text-xs text-gray-300 tabular-nums ${columnTint}`}
      >
        —
      </td>
    );
  }
  if (best) {
    return (
      <td className="w-[76px] min-w-[76px] border border-brand-300 bg-brand-100 px-2 py-2.5 text-center text-xs font-semibold text-brand-700 tabular-nums">
        <span className="inline-flex items-center gap-1">
          {fmtUsd(cell.costPerOutcomeUsd)}
          <InfoTooltip tip={BEST_CELL_TIP} placement="top" />
        </span>
      </td>
    );
  }
  return (
    <td
      className={`w-[76px] min-w-[76px] px-2 py-2.5 text-center text-xs tabular-nums ${columnTint} ${
        own ? "font-medium text-gray-900" : "text-gray-400"
      }`}
    >
      {/* NO per-cell tooltip here. The footer under the grid already states what a
          full figure means against a faded one, and seven of them on one row is the
          same sentence said seven times. The BEST cell keeps its own, because that is
          a different claim. */}
      {fmtUsd(cell.costPerOutcomeUsd)}
    </td>
  );
}

/**
 * ONE AUDIENCE's column, expanded.
 *
 * Ordered and numbered on the producer's `scopeRank`, so the list ascends on the figure
 * it displays and `#1` is that audience's own best. Every figure beside it is that
 * audience's OWN block (`estimatesByGrain.audience`), never a coarser grain wearing its
 * name.
 */
export function ScopeTable({
  ranked,
  audienceId,
  audienceName,
  audienceAvatarUrl,
  ladderRows,
  columns,
  paused,
  openSlug,
  onOpen,
}: {
  ranked: readonly RankedWorkflow<CampaignWorkflowRow>[];
  audienceId: string;
  audienceName: string;
  audienceAvatarUrl: string | null;
  ladderRows: readonly WorkflowLadderRowShape[];
  columns: (typeof OUTCOME_COLUMNS)[WorkflowOutcomePair];
  paused: boolean;
  openSlug: string | null;
  onOpen: (slug: string) => void;
}) {
  const bySlug = useMemo(() => {
    const m = new Map<string, WorkflowLadderRowShape>();
    for (const r of scopeLadderRows(ladderRows, audienceId)) {
      m.set(r.workflow.workflowDynastySlug, r);
    }
    return m;
  }, [ladderRows, audienceId]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
        <AudienceAvatar name={audienceName} avatarUrl={audienceAvatarUrl} size={20} />
        <h2 className="min-w-0 truncate text-sm font-medium text-gray-900">{audienceName}</h2>
        <InfoTooltip tip={SCOPE_RANK_TIP} placement="top" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm md:table-auto md:min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
              <th className="w-[12%] px-3 py-3 md:w-auto">
                # <InfoTooltip tip={SCOPE_RANK_TIP} placement="top" />
              </th>
              <th className="w-[46%] px-4 py-3 md:w-[20%]">
                Workflow <InfoTooltip tip={WORKFLOW_TIP} placement="top" />
              </th>
              <th className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                LLM <InfoTooltip tip={MODEL_TIP} placement="top" />
              </th>
              <th className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                Template <InfoTooltip tip={TEMPLATE_TIP} placement="top" />
              </th>
              <th className="w-[42%] px-4 py-3 md:w-auto md:whitespace-nowrap">
                Est. cost / outcome <InfoTooltip tip={EST_TIP} placement="top" />
              </th>
              <th className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                {columns.count} <InfoTooltip tip={columns.countTip} placement="top" />
              </th>
              <th className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                {columns.cost} <InfoTooltip tip={columns.costTip} placement="top" />
              </th>
              <th className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                $ Invested <InfoTooltip tip={INVESTED_TIP} placement="top" />
              </th>
              <th className="hidden px-4 py-3 md:table-cell md:w-[22%]">
                Why <InfoTooltip tip={WHY_TIP} placement="top" />
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <ScopeRow
                key={r.row.workflowDynastySlug}
                ranked={r}
                figures={scopeFigures(bySlug.get(r.row.workflowDynastySlug) ?? null, audienceId)}
                audienceName={audienceName}
                audienceAvatarUrl={audienceAvatarUrl}
                paused={paused}
                selected={openSlug === r.row.workflowDynastySlug}
                onOpen={() => onOpen(r.row.workflowDynastySlug)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** One row of an audience's own list. */
function ScopeRow({
  ranked,
  figures,
  audienceName,
  audienceAvatarUrl,
  paused,
  selected,
  onOpen,
}: {
  ranked: RankedWorkflow<CampaignWorkflowRow>;
  figures: WorkflowLegOutcome | null;
  audienceName: string;
  audienceAvatarUrl: string | null;
  paused: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const row = ranked.row;
  const bestHere = ranked.scopeRank === 1;
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
              : bestHere
                ? "border border-brand-200 bg-white text-brand-600"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {ranked.scopeRank ?? "—"}
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
          {bestHere && !row.running && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">
              Current best
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
      <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
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
      <td className="hidden px-4 py-3 text-gray-800 whitespace-nowrap md:table-cell">
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
      <td className="hidden px-4 py-3 text-gray-800 whitespace-nowrap md:table-cell">
        {figures == null ? (
          "—"
        ) : isLearning(figures.outcomeCount) ? (
          <LearningTag paused={paused} />
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <AudienceAvatar name={audienceName} avatarUrl={audienceAvatarUrl} size={14} />
            {fmtUsd(figures.costPerOutcomeUsd)}
          </span>
        )}
      </td>
      <td className="hidden px-4 py-3 text-gray-800 whitespace-nowrap md:table-cell">
        {figures == null ? "—" : fmtUsd(figures.spentUsd)}
      </td>
      <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{ranked.why}</td>
    </tr>
  );
}
