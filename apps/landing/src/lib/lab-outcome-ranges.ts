/**
 * The lab home's price table (owner 2026-11-25): one row per outcome, an icon beside its
 * name, our likely price range bare (`$30 - $40`). Rows, in order (owner 2026-11-26):
 * Engaged leads, Interested leads, Booked meetings; no Signup, no Website visit.
 *
 * Every figure is READ from the public fleet indexes (`GET /v1/public/indexes`, the
 * `valueRange {low, high}` features-service serves beside each value) at render. The
 * page ships no figure, the browser computes none, and a row whose index serves no
 * range is REMOVED: no single value, no last-known figure, no outcome count stands in.
 *
 * Lab only (`lab-distry`): run by the prototype route, never by `staticResponse`.
 * Alias-free so it carries real unit tests.
 */
import { z } from "zod";

/** The outcome each card prices, keyed on the index that measures it. */
export const OUTCOME_RANGE_SLUGS = {
  engagedLead: "cold-email-cost-per-engaged-lead",
  interestedLead: "cold-email-cost-per-positive-reply",
  meetingBooked: "cold-email-cost-per-meeting",
} as const;

/** Every piece of the block (its heading, its table), removed when no card can be drawn (a heading over no price says nothing). */
export const OUTCOME_RANGES_BLOCK = /<!--outcome-ranges-->[\s\S]*?<!--\/outcome-ranges-->/g;

const rangeSchema = z.object({ low: z.number().finite(), high: z.number().finite() });

const indexSchema = z.object({
  slug: z.string(),
  unit: z.string().nullish(),
  valueRange: rangeSchema.nullish(),
  valueRangeUnavailableReason: z.string().nullish(),
  // An EXPECTED value (meeting booked today) carries its range here, derived by features-service (OUTCOME-RANGES-1125).
  derivedValueRange: rangeSchema.nullish(),
  derivedValueRangeUnavailableReason: z.string().nullish(),
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
    const range = index.valueRange ?? index.derivedValueRange;
    const reason = index.valueRange === null && index.derivedValueRangeUnavailableReason && index.derivedValueRangeUnavailableReason !== "measured_value"
      ? index.derivedValueRangeUnavailableReason
      : index.valueRangeUnavailableReason;
    out.set(index.slug, range ? { low: range.low, high: range.high } : { missing: reason ?? "no_range_served" });
  }
  return out;
}

/** To the nearest ten from $10, to the dollar below (owner 2026-11-26), like `/indexes`. */
export function roundPrice(value: number): number {
  return Math.abs(value) >= 10 ? Math.round(value / 10) * 10 : Math.round(value);
}

/** `$4`, `$60`, `$1,240`. */
export function formatWholeUsd(value: number): string {
  return `$${roundPrice(value).toLocaleString("en-US")}`;
}

/** `$4 - $6`, `$60 - $70`, or null when the range cannot be stated in whole dollars. */
export function formatRange(range: OutcomeRange): string | null {
  const low = roundPrice(range.low);
  const high = roundPrice(range.high);
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
    /\s*<tr class="price-row[^"]*" data-index-slug="([^"]+)"[^>]*>[\s\S]*?<\/tr>/g,
    (card, slug: string) => {
      const served = ranges?.get(slug);
      const text = served && !("missing" in served) ? formatRange(served) : null;
      if (!ranges) {
        console.error(`[landing] lab price card hidden: ${slug} (read_failed)`);
        return "";
      }
      drawn += 1;
      if (!text) {
        // Every outcome the owner listed keeps its row (owner 2026-11-25 « toute la liste »): no served range yet = Learning, never a figure.
        const reason = !served ? "index_not_served" : "missing" in served ? served.missing : "range_under_a_dollar";
        console.error(`[landing] lab price row learning: ${slug} (${reason})`);
        return card.replace(/<b data-range[^>]*>[^<]*<\/b>/, '<b data-range class="learning">Learning</b>');
      }
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
