/**
 * The lab home's four price cards (owner 2026-11-25): one per outcome, each stating our
 * likely price range, bare (`$4 - $6`), under the outcome's name.
 *
 * Every figure is READ from the public fleet indexes (`GET /v1/public/indexes`, the
 * `valueRange {low, high}` features-service serves beside each value) at render. The
 * page ships no figure, the browser computes none, and a card whose index serves no
 * range is REMOVED: no single value, no last-known figure, no outcome count stands in.
 *
 * Lab only (`lab-distry`): run by the prototype route, never by `staticResponse`.
 * Alias-free so it carries real unit tests.
 */
import { z } from "zod";

/** The outcome each card prices, keyed on the index that measures it. */
export const OUTCOME_RANGE_SLUGS = {
  interestedLead: "cold-email-cost-per-positive-reply",
  meetingBooked: "cold-email-cost-per-meeting",
  // Not served yet (a sibling workspace adds the index): the card lights up the day it is.
  signup: "cold-email-cost-per-signup",
  websiteVisit: "cold-email-cost-per-click",
} as const;

/** The whole block, removed when no card can be drawn (a heading over no price says nothing). */
export const OUTCOME_RANGES_BLOCK = /<!--outcome-ranges-->[\s\S]*?<!--\/outcome-ranges-->/;

const rangeSchema = z.object({ low: z.number().finite(), high: z.number().finite() });

const indexSchema = z.object({
  slug: z.string(),
  unit: z.string().nullish(),
  valueRange: rangeSchema.nullish(),
  valueRangeUnavailableReason: z.string().nullish(),
});

const listSchema = z.object({
  indexes: z.array(indexSchema),
  rangeRule: z.object({ lowPercentile: z.number(), highPercentile: z.number(), text: z.string() }).nullish(),
});

export type OutcomeRange = { low: number; high: number };
/** Per slug: the served range, or the reason there is none. */
export type OutcomeRanges = Map<string, OutcomeRange | { missing: string }>;

/** `GET /v1/public/indexes`, read for its ranges only; null on a shape we do not know. */
export function parseOutcomeRanges(body: unknown): OutcomeRanges | null {
  const parsed = listSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[landing] lab price cards: /v1/public/indexes has an unknown shape", parsed.error.issues.slice(0, 3));
    return null;
  }
  const out: OutcomeRanges = new Map();
  for (const index of parsed.data.indexes) {
    if (index.unit && index.unit !== "usd") continue;
    out.set(index.slug, index.valueRange ? { low: index.valueRange.low, high: index.valueRange.high } : { missing: index.valueRangeUnavailableReason ?? "no_range_served" });
  }
  return out;
}

/** `$4`, `$1,240`: a price range is stated in whole dollars. */
export function formatWholeUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** `$4 - $6`, or null when the range cannot be stated in whole dollars. */
export function formatRange(range: OutcomeRange): string | null {
  const low = Math.round(range.low);
  const high = Math.round(range.high);
  if (!(low >= 1) || !(high >= low)) return null;
  return `${formatWholeUsd(low)} - ${formatWholeUsd(high)}`;
}

/**
 * Fill each `data-index-slug` card's `<b data-range>` from the served ranges; remove a
 * card with none, logged with its slug and reason. `ranges === null` = the read failed:
 * every card goes, and the block with them.
 */
export function applyOutcomeRanges(html: string, ranges: OutcomeRanges | null): string {
  let drawn = 0;
  const out = html.replace(
    /\s*<article class="price-card[^"]*" data-index-slug="([^"]+)"[^>]*>[\s\S]*?<\/article>/g,
    (card, slug: string) => {
      const served = ranges?.get(slug);
      const text = served && !("missing" in served) ? formatRange(served) : null;
      if (!text) {
        const reason = !ranges ? "read_failed" : !served ? "index_not_served" : "missing" in served ? served.missing : "range_under_a_dollar";
        console.error(`[landing] lab price card hidden: ${slug} (${reason})`);
        return "";
      }
      drawn += 1;
      // A function, so a figure such as `$12` is never read as a group reference.
      return card.replace(/(<b data-range[^>]*>)[^<]*(<\/b>)/, (_m, open: string, close: string) => `${open}${text}${close}`);
    },
  );
  return drawn === 0 ? out.replace(OUTCOME_RANGES_BLOCK, "") : out;
}

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

/** The served ranges through the gateway; null on a failed read (logged loud). */
export async function fetchOutcomeRanges(timeoutMs = 8_000): Promise<OutcomeRanges | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/public/indexes`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    return parseOutcomeRanges(await res.json());
  } catch (error) {
    console.error("[landing] lab price cards: /v1/public/indexes read failed", error);
    return null;
  }
}

/** The page with its price cards filled, or without them. Nothing is fetched for a page carrying none. */
export async function withOutcomeRanges(html: string): Promise<string> {
  if (!html.includes("data-index-slug=")) return html;
  return applyOutcomeRanges(html, await fetchOutcomeRanges());
}
