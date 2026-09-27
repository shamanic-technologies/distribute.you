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
import { useMissions } from "@/components/v2/use-missions";
import type { CrewIdentity } from "@/lib/v2/crews";

/**
 * The data behind dashboard v2's brand-level Workflows pages.
 *
 * A row there is a workflow working for one CREW, never a workflow alone: a cost per
 * outcome only means something once the outcome is named, and the crew is what names it
 * (a channel plus the step its leg lands on). The same workflow can be cheap for Scout
 * (website visits) and dear for Herald (positive replies), so it gets one row per crew.
 *
 * Everything is the producer's: the ranking ladder asked at the crew's own leg WITHOUT a
 * campaign (so its `audienceId: null` row is the brand's and carries the brand and fleet
 * grains), the channel catalogue for names, and features-service's money grouped by
 * workflow at the brand. Nothing is ranked, divided or summed here.
 */

/** One crew this brand runs, as the ladder is asked for it. */
export interface CrewSpec {
  crew: CrewIdentity;
  featureSlug: string;
  legKey: string;
}

/** The crew key that travels in a workflow page's URL: `<channel slug>|<leg key>`. */
export function crewParam(spec: { featureSlug: string; legKey: string }): string {
  return `${spec.featureSlug}|${spec.legKey}`;
}

/** The brand's crews, one per (channel, leg) its missions run — running or paused. */
export function useBrandCrewSpecs(orgId: string, brandId: string) {
  const { missions, settled } = useMissions(orgId, brandId);
  const specs = useMemo<CrewSpec[]>(() => {
    const byKey = new Map<string, CrewSpec>();
    for (const m of missions) {
      const featureSlug = m.row.campaign.featureSlug;
      const legKey = m.row.campaign.legKey;
      if (!featureSlug || !legKey) continue;
      const key = crewParam({ featureSlug, legKey });
      if (!byKey.has(key)) byKey.set(key, { crew: m.crew, featureSlug, legKey });
    }
    return [...byKey.values()].sort((a, b) => a.crew.name.localeCompare(b.crew.name));
  }, [missions]);
  return { specs, settled };
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
 * ONE crew's ranking at brand grain. The ladder key is byte-distinct from the campaign
 * page's (no campaign in it) because the question is: a brand-scoped entry answering a
 * campaign question would be the wrong-scope bug wearing a cache key.
 */
export function useCrewWorkflowRanking(
  brandId: string,
  spec: { featureSlug: string; legKey: string } | null,
  enabled: boolean,
): CrewWorkflowRanking {
  const featureSlug = spec?.featureSlug ?? null;
  const legKey = spec?.legKey ?? null;
  const ready = enabled && Boolean(brandId && featureSlug && legKey);

  const catalogueQ = useAuthQuery(
    ["workflows", featureSlug ?? "none"],
    () => listChannelWorkflows(featureSlug as string),
    { ...pollOptions, enabled: ready },
  );
  const groupsQ = useAuthQuery(
    ["brandWorkflowRevenue", brandId, featureSlug ?? "none"],
    () => getFeatureRevenueByWorkflow(featureSlug as string, brandId, null),
    { ...pollOptions, enabled: ready },
  );
  const ladderQ = useAuthQuery(
    ["workflowRankLadder", brandId, legKey ?? "none", "brand", featureSlug ?? "none"],
    () => getWorkflowRankLadder({ featureSlug: featureSlug as string, brandId, leg: legKey }),
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

  const pending =
    (catalogueQ.isPending && !catalogueQ.isError) ||
    (groupsQ.isPending && !groupsQ.isError) ||
    (ladderQ.isPending && !ladderQ.isError);

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
    ladderError: ladderQ.isError,
  };
}
