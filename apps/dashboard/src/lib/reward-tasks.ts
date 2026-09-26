/**
 * Reading client-service's reward-task ledger for the surface in front of the
 * reader.
 *
 * The ledger answers per BRAND — every task of every offer, plus a per-offer
 * roll-up — because one read per brand is one poll, and a page filtering that to
 * its own offer is a display lookup rather than a second request. Nothing here
 * derives a task, a due date or a reward: every one of those is client-service's,
 * which is the whole reason it owns the ledger. Alias-free, so it carries real unit
 * tests. Do NOT add an `@/…` import.
 *
 * ## Why an absent roll-up is null and not zero
 *
 * "We were not told about this offer" and "this offer has nothing due" are
 * different statements, and only one of them should put a number on screen. A
 * count we invented reads exactly like a measured one.
 */

/** The granularity a task belongs to. The producer may state a finer scope; only the
 *  offer is read. */
export type RewardTaskScope = {
  type: string;
  brandId: string;
  offerId: string;
};

/** One reward task, exactly as client-service states it. */
export type RewardTask = {
  taskKey: string;
  scope: RewardTaskScope;
  rewardCents: number;
  due: boolean;
  dueAt: string;
  lastCompletedAt: string | null;
  completedCount: number;
  contentChangedAt: string;
  /**
   * `observed` — we compared two readings and they differed, so the clock is
   * ours and certain. `producer_ts` — this is the first time the ledger ever saw
   * this scope, so the baseline is brand-service's own last-touched timestamp,
   * which ALSO moves for reasons that are not a refresh. A day count
   * derived from that baseline is therefore a number we cannot stand behind.
   */
  contentChangedProvenance: string;
};

/** How many of a scope's children have something due, without restating them. */
export type RewardRollupEntry = { offerId: string; dueCount: number; taskCount: number };

/**
 * The first task DUE on this offer — the one
 * thing to do on the offer's own page. Null when nothing is due, so the band says nothing.
 */
export function dueTaskForOffer(tasks: readonly RewardTask[], offerId: string): RewardTask | null {
  return tasks.find((t) => t.scope.offerId === offerId && t.due) ?? null;
}

/**
 * How many tasks are due on one offer. `null` when the roll-up does not mention
 * it — never a fabricated zero.
 */
export function dueCountForOffer(
  rollup: readonly RewardRollupEntry[],
  offerId: string,
): number | null {
  for (const entry of rollup) {
    if (entry.offerId === offerId) return entry.dueCount;
  }
  return null;
}

/**
 * How long this task's numbers have gone unchanged, in whole days, or `null`
 * when we cannot honestly say.
 *
 * Null in two cases, and both matter:
 *  - `producer_ts` provenance, where the baseline is a timestamp that moves for
 *    reasons that are not a refresh (see the type above). The band then says the
 *    refresh is owed without claiming to know for how long, which is true.
 *  - an unparseable or future instant, which is wire-rot rather than an age.
 */
export function daysSinceChanged(task: RewardTask, now: Date): number | null {
  if (task.contentChangedProvenance !== "observed") return null;
  const changed = Date.parse(task.contentChangedAt);
  if (!Number.isFinite(changed)) return null;
  const elapsedMs = now.getTime() - changed;
  if (elapsedMs < 0) return null;
  return Math.floor(elapsedMs / 86_400_000);
}

/** The reward as a whole-dollar string. Every reward is a whole-dollar amount by
 *  construction, and cents on a one-line band are noise. */
export function formatReward(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}
