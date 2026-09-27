"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getFeatureRevenueByWorkflow,
  getWorkflowRankLadder,
  listChannelWorkflows,
  type WorkflowRankLadder,
} from "@/lib/api";
import {
  buildCampaignWorkflowRows,
  workflowOutcomePairFor,
  type CampaignWorkflowRow,
  type WorkflowOutcomePair,
} from "@/lib/campaign-workflow-rows";
import { hiddenWorkflowSlugs, type EligibilityLadderRow } from "@/lib/workflow-eligibility";
import { rankWorkflowRows, type RankedWorkflow } from "@/lib/workflow-rank-why";
import { legColumnPair } from "@/lib/campaign-leg-columns";
import { legFor } from "@/lib/legs";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { isLearning } from "@/lib/learning-threshold";
import { formatUsdAdaptive } from "@/lib/format-number";
import type { WorkflowLadderRowShape } from "@/lib/workflow-grains";
import { ladderRowsForScope } from "@/components/workflows/campaign-workflows-page";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import type { CrewIdentity } from "@/lib/v2/crews";

/**
 * The data behind dashboard v2's brand-level Workflows pages.
 *
 * A row there is a workflow working for one MISSION (a crew working one offer), never a
 * workflow alone: a cost per outcome only means something once the outcome is named, and
 * the crew is what names it (a channel plus the step its leg lands on).
 *
 * The ranking is asked PER MISSION, with that mission's campaign id. features-service
 * refuses a leg-keyed ranking with no campaign on a brand selling several offers (409
 * `several_offers`: which offer is the leg bought for?), so a brand-wide read only ever
 * worked for single-offer brands. The keys are byte-equal to the campaign Workflows
 * page's, so the two surfaces dedupe to one request. The ladder's `audienceId: null` row
 * still carries the brand and fleet grains, which is what the Global and Brand columns
 * read. Nothing is ranked, divided or summed here.
 */

/** One mission this brand runs, as the ladder is asked for it. */
export interface MissionSpec {
  mission: Mission;
  crew: CrewIdentity;
  featureSlug: string;
  legKey: string;
  campaignId: string;
}

/** The crew key that travels in a workflow page's URL: `<channel slug>|<leg key>`. */
export function crewParam(spec: { featureSlug: string; legKey: string }): string {
  return `${spec.featureSlug}|${spec.legKey}`;
}

/** The brand's missions that can be ranked (they name a channel and a leg), running first. */
export function useBrandMissionSpecs(orgId: string, brandId: string) {
  const { missions, settled, missionByCampaignId } = useMissions(orgId, brandId);
  const specs = useMemo<MissionSpec[]>(() => {
    const out: MissionSpec[] = [];
    for (const m of missions) {
      const featureSlug = m.row.campaign.featureSlug;
      const legKey = m.row.campaign.legKey;
      if (!featureSlug || !legKey) continue;
      out.push({ mission: m, crew: m.crew, featureSlug, legKey, campaignId: m.row.campaign.id });
    }
    return out.sort(
      (a, b) =>
        Number(b.mission.running) - Number(a.mission.running) ||
        a.crew.name.localeCompare(b.crew.name) ||
        (a.mission.offerName ?? "").localeCompare(b.mission.offerName ?? ""),
    );
  }, [missions]);
  return { specs, settled, missionByCampaignId };
}

/** A read that has answered once stays answered: a failed poll must not repaint a skeleton. */
function settleOf(q: { data: unknown; isFetchedAfterMount: boolean }) {
  const answered = q.data !== undefined || q.isFetchedAfterMount;
  return { pending: !answered, failed: q.data === undefined && q.isFetchedAfterMount };
}

export interface CrewWorkflowRanking {
  ladder: WorkflowRankLadder | undefined;
  /** Every row the ladder sent, audiences included — what the panel's audience list reads. */
  allLadderRows: WorkflowLadderRowShape[];
  /** The ranked BRAND rows, in the producer's order, with the tier-excluded ones gone. */
  ranked: RankedWorkflow<CampaignWorkflowRow>[];
  rows: CampaignWorkflowRow[];
  pair: WorkflowOutcomePair;
  outcomeNoun: string;
  outcomeStepKey: string | null;
  /** Every versioned slug of each dynasty, from the catalogue — runs-service files runs
   *  under the VERSION, so a dynasty's history is the union of its versions' runs. */
  versionsByDynasty: Map<string, string[]>;
  pending: boolean;
  ladderError: boolean;
}

/**
 * ONE mission's ranking. Every key is the campaign Workflows page's own, so opening that
 * tab after this page costs no request.
 */
export function useMissionWorkflowRanking(
  brandId: string,
  spec: { featureSlug: string; legKey: string; campaignId: string } | null,
  enabled: boolean,
): CrewWorkflowRanking {
  const featureSlug = spec?.featureSlug ?? null;
  const legKey = spec?.legKey ?? null;
  const campaignId = spec?.campaignId ?? null;
  const ready = enabled && Boolean(brandId && featureSlug && legKey && campaignId);

  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );
  const groupsQ = useAuthQuery(
    ["campaignWorkflowRevenue", brandId, campaignId ?? "none"],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, campaignId),
    { ...pollOptions, enabled: ready },
  );
  const ladderQ = useAuthQuery(
    ["workflowRankLadder", brandId, legKey ?? "none", campaignId ?? "none"],
    () => getWorkflowRankLadder({ featureSlug: featureSlug as string, brandId, leg: legKey, campaignId }),
    { ...pollOptions, enabled: ready, retry: false },
  );

  const legCatalogue = useLegCatalogue();
  const pair = useMemo(
    () => workflowOutcomePairFor(legColumnPair(legFor(legCatalogue, legKey))),
    [legCatalogue, legKey],
  );

  const hidden = useMemo(
    () =>
      hiddenWorkflowSlugs({
        rows: (ladderQ.data?.rows ?? []) as unknown as EligibilityLadderRow[],
        observedPicks: ladderQ.data?.observedPicks,
      }),
    [ladderQ.data],
  );

  const rows = useMemo(
    () =>
      buildCampaignWorkflowRows({
        catalogue: catalogueQ.data ?? [],
        groups: groupsQ.data ?? [],
        running: { dynastySlug: null, dynastyName: null },
        pair,
        isLearning,
      }).filter((r) => !hidden.has(r.workflowDynastySlug)),
    [catalogueQ.data, groupsQ.data, pair, hidden],
  );

  const outcomeNoun = ladderQ.data?.leg?.toStep.label ?? (pair === "visit" ? "Website visit" : "Positive reply");
  const outcomeStepKey = ladderQ.data?.leg?.toStep.key ?? null;
  const outcomeNounPlural = pair === "visit" ? "Website visits" : "Positive replies";

  const ranked = useMemo(
    () =>
      rankWorkflowRows<CampaignWorkflowRow>({
        rows,
        ladder: ladderRowsForScope(ladderQ.data, null),
        recommended: ladderQ.data?.recommendedWorkflowDynastySlug ?? null,
        outcomeStepKey,
        outcomeNoun,
        outcomeNounPlural,
        formatUsd: formatUsdAdaptive,
      }),
    [rows, ladderQ.data, outcomeStepKey, outcomeNoun, outcomeNounPlural],
  );

  const allLadderRows = useMemo(
    () =>
      ((ladderQ.data?.rows ?? []) as unknown as WorkflowLadderRowShape[]).filter(
        (r) => !hidden.has(r.workflow.workflowDynastySlug),
      ),
    [ladderQ.data, hidden],
  );

  const versionsByDynasty = useMemo(() => {
    const m = new Map<string, { slug: string; version: number }[]>();
    for (const w of catalogueQ.data ?? []) {
      const list = m.get(w.workflowDynastySlug) ?? [];
      list.push({ slug: w.workflowSlug, version: w.version });
      m.set(w.workflowDynastySlug, list);
    }
    const out = new Map<string, string[]>();
    for (const [k, list] of m) out.set(k, list.sort((a, b) => b.version - a.version).map((v) => v.slug));
    return out;
  }, [catalogueQ.data]);

  const ladderSettle = settleOf(ladderQ);
  const pending = settleOf(catalogueQ).pending || settleOf(groupsQ).pending || ladderSettle.pending;

  return {
    ladder: ladderQ.data,
    allLadderRows,
    ranked,
    rows,
    pair,
    outcomeNoun,
    outcomeStepKey,
    versionsByDynasty,
    pending: ready ? pending : true,
    ladderError: ladderSettle.failed,
  };
}
