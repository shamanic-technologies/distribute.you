/**
 * WHEN a campaign's path last changed, for the client campaign page (P5.1, owner 2026-10-31). Alias-free so vitest
 * reads it directly.
 *
 * campaign-service serves every plan change a funnel campaign applied, newest first (`GET /sales-funnel-campaigns/{id}/
 * plan-changes`: from which sales funnel to which, `appliedAt`), and the funnel it runs now (`runningSalesFunnelId`).
 * The path changed when the newest change that LANDED on the running funnel was applied; a change from a funnel to
 * itself moved nothing. A selection over the served history: nothing is computed or compared here.
 */

export interface PathChangeLike {
  fromSalesFunnelId: string;
  toSalesFunnelId: string;
  appliedAt: string;
}

/** The `appliedAt` of the change that put the campaign on the path it runs now, else null (it never changed). */
export function pathChangedAt(changes: readonly PathChangeLike[], runningSalesFunnelId: string | null | undefined): string | null {
  if (!runningSalesFunnelId) return null;
  const hit = changes.find((c) => c.toSalesFunnelId === runningSalesFunnelId && c.fromSalesFunnelId !== c.toSalesFunnelId);
  return hit?.appliedAt ?? null;
}

/** "Oct 29", the day in UTC (one day on every surface, whatever the reader's zone). */
export function shortUtcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The one sentence under the path: "Since Oct 29 we follow a better path to Signup." */
export function pathChangeSentence(appliedAt: string, targetLabel: string | null): string {
  return `Since ${shortUtcDay(appliedAt)} we follow a better path${targetLabel ? ` to ${targetLabel}` : ""}.`;
}
