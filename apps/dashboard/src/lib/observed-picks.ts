/**
 * WHAT ACTUALLY RAN — read off the ledger the producer reads, never off the campaign row.
 *
 * A campaign's `workflowSlug` (campaign-service's own column) is the workflow it was
 * CONFIGURED with at creation. The selector picks a (workflow, audience) cell per trigger
 * and hands it straight to the execution call without writing it back, so that column is
 * a configuration and badging it `Running` states a setting where a reader expects a fact.
 *
 * Measured in prod 2026-09-14 on the campaign this was reported from: the row said
 * `sales-cold-email-outreach-rudder-v3` — a DEPRECATED version of a dynasty that had
 * **never served a single lead on that campaign** — while `…-lithium-v6` had served
 * 2,439 of them, most recently that morning. The page badged Rudder.
 *
 * features-service v0.165.2 serves the answer on the SAME leg-keyed body this page
 * already reads (`observedPicks`), built from the trigger runs runs-service froze at
 * write time. So this module reads a served block; it derives nothing, and there is no
 * second request.
 *
 * ── THERE IS NO FALLBACK TO THE CONFIGURED SLUG, DELIBERATELY ────────────────────────
 *
 * The producer's own contract: `observedPicks: null` means "we could not read this"
 * (runs unreachable), and `last: null` means the campaign has never triggered. Neither
 * is a licence to show the configured workflow — that value is the bug. Both answer
 * `null` here and the caller draws NO tag, which is the honest state.
 *
 * ── A TAG ON THE AUDIENCE COLUMN IS A SET, NEVER A SINGLETON ─────────────────────────
 *
 * A trigger names ONE audience, so `last.audienceId` is a single id and reads like "the
 * current audience". It is not: a run fans across the offer's audiences within minutes.
 * Measured on the same campaign, the served 50-pick window spans **26 minutes, one
 * workflow and SIX audiences** (04:01 to 04:07), and over 28 hours ten distinct
 * audiences were picked. Tagging `last.audienceId` alone would mark one of six that ran
 * in the same six minutes — the arbitrary-mark bug this file already records one surface
 * over. So the column mark reads the whole window, and a column with no pick in it is
 * the real distinction the mark draws.
 *
 * Alias-free (its only import is a type, erased at build) so it carries real unit tests.
 * Keep it that way.
 */

import type { RunningWorkflow } from "./campaign-workflow-rows";

/** One pick the selector made, as features-service states it. */
export interface ObservedPick {
  /** The identity member the trigger ran under — a family has several and they interleave. */
  campaignId: string;
  /** The VERSIONED slug runs-service froze, kept so a reader can join back to the ledger. */
  workflowSlug: string;
  /** Its dynasty — the key `rank`, `scopeRank` and the row list all speak. */
  workflowDynastySlug: string;
  /** Null when the catalogue describes no version of the dynasty. */
  workflowDynastyName: string | null;
  /** Null when the trigger predates the audience write-tag. Never substituted. */
  audienceId: string | null;
  startedAt: string;
}

/** The served block. */
export interface ObservedPicks {
  last: ObservedPick | null;
  recent: ObservedPick[];
  truncated: boolean;
}

/**
 * The workflow the campaign LAST ran, as a `RunningWorkflow` the row builder accepts.
 *
 * Null on every honest absence: the block missing (a funnel- or goal-keyed body, which
 * this page never asks for), the block null (runs unreachable), or no trigger yet.
 */
export function runningFromObservedPicks(
  picks: ObservedPicks | null | undefined,
): RunningWorkflow | null {
  const last = picks?.last;
  if (!last) return null;
  return {
    dynastySlug: last.workflowDynastySlug,
    dynastyName: last.workflowDynastyName,
  };
}

/** When that last pick ran, so a tag can say how fresh it is. Null when there is none. */
export function lastPickAt(picks: ObservedPicks | null | undefined): string | null {
  return picks?.last?.startedAt ?? null;
}

/**
 * Every audience the served window saw a pick for.
 *
 * A pick stating no audience (older than the write-tag) contributes nothing rather than
 * a guess. `last` is `recent[0]` at the producer, so reading `recent` alone is complete;
 * it is unioned anyway so a window of zero still marks the one pick we were given.
 */
export function observedAudienceIds(
  picks: ObservedPicks | null | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!picks) return out;
  for (const p of [...(picks.recent ?? []), ...(picks.last ? [picks.last] : [])]) {
    if (p?.audienceId) out.add(p.audienceId);
  }
  return out;
}
