/**
 * WHICH WORKFLOWS A CAMPAIGN ACTUALLY RAN — read off the runs ledger, never off the
 * campaign row.
 *
 * `campaign.workflowSlug` is the workflow picked when the campaign was CREATED.
 * campaign-service now picks a workflow for every trigger from features-service's
 * ranking and hands it straight to the execution call without writing it back, so a
 * campaign runs many workflows over time and that column is only its starting config.
 * Measured in prod 2026-09-24 on campaign 3922c8e1: the row said
 * `sales-cold-email-outreach-tango` (every version retired, last run 2026-08-24) while
 * the last days ran alioth, delphi, nimbus, helm, baobab, azalea-v4, catalyst.
 *
 * runs-service freezes `workflowSlug` on every run at write time, and each trigger opens
 * exactly one `execute-workflow` run — so the recent trigger runs ARE the answer, and
 * runs-service already aggregates them (`/v1/stats/costs?groupBy=workflowSlug` returns
 * `runCount` + `maxStartedAt` per workflow). This module only orders that answer; there
 * is NO fallback to the configured slug, since that value is the bug. An empty list means
 * "no trigger in the window", which the surface states as such.
 *
 * Alias-free (zod only) so it carries real unit tests. Keep it that way.
 */

import { z } from "zod";

/** The run that one campaign trigger opens — one per workflow execution. */
export const TRIGGER_TASK_NAME = "execute-workflow";

/** How far back "recently" reaches. A busy campaign triggers hundreds of times a day,
 *  so a window in TIME (not a count of runs) is what shows every workflow it rotated
 *  through rather than only the last few hours. */
export const RAN_WORKFLOWS_WINDOW_DAYS = 7;

/** One runs-service `/v1/stats/costs?groupBy=workflowSlug` group. Only the fields read
 *  here are declared; the cost totals pass through untouched. */
export const WorkflowRunGroupSchema = z
  .object({
    dimensions: z.object({ workflowSlug: z.string().nullable().optional() }).passthrough(),
    runCount: z.number(),
    maxStartedAt: z.string().nullable(),
  })
  .passthrough();

export const WorkflowRunGroupsResponseSchema = z
  .object({ groups: z.array(WorkflowRunGroupSchema) })
  .passthrough();

export type WorkflowRunGroup = z.infer<typeof WorkflowRunGroupSchema>;

export interface RanWorkflow {
  /** The VERSIONED slug runs-service froze on the run. */
  workflowSlug: string;
  /** How many triggers in the window ran it. */
  runs: number;
  /** ISO start of its most recent trigger. */
  lastStartedAt: string;
}

export interface RanWorkflowsSummary {
  /** Most recent first. */
  workflows: RanWorkflow[];
  /** Triggers in the window, across every workflow. */
  totalRuns: number;
}

/**
 * Order runs-service's per-workflow groups, newest run first. A group carrying no
 * workflow cannot be attributed and is skipped (its runs still count toward the total).
 */
export function summarizeRanWorkflows(groups: readonly WorkflowRunGroup[]): RanWorkflowsSummary {
  const workflows: RanWorkflow[] = [];
  let totalRuns = 0;
  for (const g of groups) {
    totalRuns += g.runCount;
    const slug = g.dimensions.workflowSlug;
    if (!slug || !g.maxStartedAt || g.runCount <= 0) continue;
    workflows.push({ workflowSlug: slug, runs: g.runCount, lastStartedAt: g.maxStartedAt });
  }
  workflows.sort((a, b) =>
    a.lastStartedAt === b.lastStartedAt
      ? a.workflowSlug.localeCompare(b.workflowSlug)
      : a.lastStartedAt < b.lastStartedAt
        ? 1
        : -1,
  );
  return { workflows, totalRuns };
}

/**
 * A readable name for a workflow slug: the part after the feature prefix, capitalised
 * (`sales-cold-email-outreach-azalea-v4` → `Azalea v4`). The whole remainder is kept —
 * taking only the last segment turns every versioned slug into `V4`.
 */
export function workflowShortName(workflowSlug: string, featureSlug?: string | null): string {
  const prefix = featureSlug ? `${featureSlug}-` : "";
  const rest =
    prefix && workflowSlug.startsWith(prefix) && workflowSlug.length > prefix.length
      ? workflowSlug.slice(prefix.length)
      : workflowSlug;
  const words = rest.split("-");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
