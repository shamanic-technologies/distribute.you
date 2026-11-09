import { z } from "zod";
import type { BoxCheck } from "./box-checks";

/**
 * Monitoring > Box > Page speed (staff only, DASH-SPEED-MONITOR-1110), alias-free so vitest reads it directly.
 *
 * Owner 2026-11-09: « make every page instant. Why do I have to ask again every day? ». Once a day at the box's quietest
 * hour (04:10 UTC) a robot (`page-speed-check.sh` in distribute-box, a permanent staff test member of OUR org,
 * kevin.lourd+speedcheck@gmail.com, never a client) opens every dashboard v2 page it can reach from our Distribute.you
 * brand's menus, read-only, and times each one. Every page posts ONE run to features-service's generic box-checks
 * registry under its own check name `page-speed-<page>`: value = the reload time from the saved copy in ms, `ok` = under
 * the 1 s budget, details = the click time, the slowest server read, the page's path. The robot's own health is the
 * plain watchdog `page-speed` on Box > Watchdogs (red when it stays silent 3 days). This module only reads what is served.
 */

export const PAGE_SPEED_PREFIX = "page-speed-";
/** The robot's own run (pages timed, box load): a watchdog like the others, never a page. */
export const PAGE_SPEED_WATCHDOG = "page-speed";

const ms = z.number().nullable();

/** What the robot stores beside each page's reload time. Every field is the robot's measure, never recomputed here. */
export const PageSpeedDetailsSchema = z.object({
  path: z.string(),
  route: z.string(),
  warmMs: z.number(),
  warmCapped: z.boolean(),
  inAppMs: ms,
  inAppFrom: z.string().nullable(),
  firstMs: ms,
  slowestRead: z.object({ path: z.string(), ms: z.number() }).nullable(),
  limit: z.number(),
});
export type PageSpeedDetails = z.infer<typeof PageSpeedDetailsSchema>;

/** A page check's details, or null with a loud log when the robot stored a shape this page does not know. */
export function pageSpeedDetails(c: Pick<BoxCheck, "check" | "latestDetails">): PageSpeedDetails | null {
  if (c.latestDetails == null) return null;
  const parsed = PageSpeedDetailsSchema.safeParse(c.latestDetails);
  if (!parsed.success) {
    console.error("[page-speed] unreadable details", { check: c.check, details: c.latestDetails, error: parsed.error.message });
    return null;
  }
  return parsed.data;
}

/** "Page speed: Offer › Targeting" -> "Offer › Targeting". */
export const pageName = (c: Pick<BoxCheck, "check" | "label">) => (c.label ?? c.check).replace(/^Page speed: /, "");

/** 640 -> "0.64 s", 1000 -> "1 s", 13100 -> "13.1 s", 30000 capped -> "over 30 s". */
export function secondsLabel(v: number, capped = false): string {
  if (capped) return `over ${Math.round(v / 1000)} s`;
  if (v < 1000) return `${(v / 1000).toFixed(2)} s`;
  if (v % 1000 === 0) return `${v / 1000} s`;
  return `${(v / 1000).toFixed(1)} s`;
}
