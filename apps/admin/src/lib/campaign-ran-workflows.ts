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
 * exactly one `workflow` / `execute-workflow` run — so the recent trigger runs ARE the
 * answer. This module only groups them; there is NO fallback to the configured slug,
 * since that value is the bug. An empty list means "no trigger in the window", which the
 * surface states as such.
 *
 * Alias-free (zod only) so it carries real unit tests. Keep it that way.
 */

import { z } from "zod";

/** The run that one campaign trigger opens — one per workflow execution. */
export const TRIGGER_SERVICE_NAME = "workflow";
export const TRIGGER_TASK_NAME = "execute-workflow";

/** Only the two fields this reads; the rest of the run is passed through untouched. */
export const TriggerRunSchema = z
  .object({
    workflowSlug: z.string().nullable(),
    startedAt: z.string(),
  })
  .passthrough();

export const TriggerRunsResponseSchema = z
  .object({ runs: z.array(TriggerRunSchema) })
  .passthrough();

export type TriggerRun = z.infer<typeof TriggerRunSchema>;

export interface RanWorkflow {
  /** The VERSIONED slug runs-service froze. */
  workflowSlug: string;
  /** How many triggers in the window ran it. */
  runs: number;
  /** ISO start of its most recent trigger. */
  lastStartedAt: string;
}

export interface RanWorkflowsSummary {
  /** Most recent first. */
  workflows: RanWorkflow[];
  /** Triggers read (the window size). */
  totalRuns: number;
  /** ISO start of the OLDEST trigger read — the window's lower edge. Null when empty. */
  windowStart: string | null;
}

/**
 * Group trigger runs by workflow. A run carrying no workflow is skipped (it cannot be
 * attributed) but still counts toward the window it was read in.
 */
export function summarizeRanWorkflows(runs: readonly TriggerRun[]): RanWorkflowsSummary {
  const bySlug = new Map<string, RanWorkflow>();
  let windowStart: string | null = null;
  for (const run of runs) {
    if (windowStart === null || run.startedAt < windowStart) windowStart = run.startedAt;
    const slug = run.workflowSlug;
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev) {
      bySlug.set(slug, { workflowSlug: slug, runs: 1, lastStartedAt: run.startedAt });
    } else {
      prev.runs += 1;
      if (run.startedAt > prev.lastStartedAt) prev.lastStartedAt = run.startedAt;
    }
  }
  const workflows = [...bySlug.values()].sort((a, b) =>
    a.lastStartedAt === b.lastStartedAt
      ? a.workflowSlug.localeCompare(b.workflowSlug)
      : a.lastStartedAt < b.lastStartedAt
        ? 1
        : -1,
  );
  return { workflows, totalRuns: runs.length, windowStart };
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
