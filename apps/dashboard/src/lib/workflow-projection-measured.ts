/**
 * A workflow-projection row the dashboard is allowed to READ.
 *
 * features-service serves two kinds of row on `/features/:slug/workflow-projection`.
 * A MEASURED row rests on real spend: it carries a grain, unit costs, and — where the
 * brand has economics — a return. An UNMEASURED row (`measured: false`) exists for the
 * BACKEND's serving consumer only: it is how an ACTIVE workflow with no history at all
 * becomes reachable, so it can earn its first run instead of staying invisible forever
 * because it never spent. Its `resolved.costPerOutcomeUsd` is an EXPLORE ALLOWANCE — a
 * cost floor deliberately set at the price of one outreach, not a result — and it
 * states no return at all (`costPerPaidClientUsd` / `roiMultiple` / `cacPct` null,
 * `grain` null, `estimatesByGrain` empty).
 *
 * So an unmeasured row is the CHEAPEST row by construction. Every dashboard surface
 * that ranks these rows argmins on `resolved.costPerOutcomeUsd` (the "Your best model"
 * headline, `selectWorkflowForOptimizationGoal`, the per-audience table), which means
 * an unproven workflow would take the headline the moment features-service#821 ships,
 * printing a bogus cheap cost above a blank return. What a customer reads must always
 * be backed by real evidence, so these rows are dropped at the ONE reader boundary
 * (`getWorkflowProjectionLadder`) rather than at each ranking site — a per-surface
 * filter is one a new surface forgets to write.
 *
 * Dropping them BEFORE the row schema runs is also what keeps every consumer type
 * unchanged: an unmeasured row's null `grain` / null `costPerClickUsd` would otherwise
 * force `resolved` to widen and every `estimatesByGrain[row.resolved.grain]` read to
 * branch on a case no surface may render anyway.
 *
 * Alias-free (no `@/` import, no zod) so it carries REAL unit tests — vitest resolves
 * no `@` alias in this repo. Keep it that way.
 */

/**
 * FALSE only for a row the producer explicitly stated as unmeasured. A row with NO
 * `measured` key is KEPT: that is every row served today, so this is an exact no-op
 * until features-service ships the flag, and a producer that stops sending it degrades
 * to the current behaviour rather than blanking every surface at once.
 */
export function isMeasuredProjectionRow(row: unknown): boolean {
  if (typeof row !== "object" || row === null) return true;
  return (row as { measured?: unknown }).measured !== false;
}

/**
 * The rows a display surface may read. Non-array input is passed through untouched so
 * the schema behind this preprocess still fails loud on a malformed payload instead of
 * being handed a silently-corrected empty array.
 */
export function measuredProjectionRows(rows: unknown): unknown {
  return Array.isArray(rows) ? rows.filter(isMeasuredProjectionRow) : rows;
}
