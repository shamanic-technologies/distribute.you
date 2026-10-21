import { z } from "zod";
import type { TimelineTag } from "./timeline-tags";
import { dimensionValueLabel, uniboxValueTag, type LifecycleRung, type UniboxDimension, type UniboxRow } from "./unibox-leads";

/**
 * The Deals board (owner 2026-10-21, DEALS-LIFECYCLE-1021): one column per rung of THE lifecycle
 * ladder (features-service, read through lead-service: Contacted, Engaged, Signed up, Meeting
 * booked, Meeting attended, Paid client), never lead-service's old standings. Interest, fit and
 * reachability are chips on the card and filters above the board, never columns. This module only
 * picks the served rungs and names served values; it decides nothing. Alias-free (real unit tests).
 */

/** "Lead found" is nobody we wrote to yet: not a deal, not a column. */
const NOT_A_COLUMN = new Set(["lead_found"]);

/** The board's columns: the served ladder in rank order, minus Lead found. */
export function dealsBoardRungs(ladder: LifecycleRung[]): LifecycleRung[] {
  return [...ladder].filter((r) => !NOT_A_COLUMN.has(r.key)).sort((a, b) => a.rank - b.rank);
}

/** The filters the board offers above the columns (lifecycle IS the columns, so not one of them). */
export const DEALS_FILTER_DIMENSIONS: UniboxDimension[] = ["interest", "fit", "contactability", "conversation"];

/**
 * A card's chips: what is TRUE of the person beside the rung, only the values that change a
 * decision (Interested / Not interested, Wrong person / Not our target, Unsubscribed / Bounced /
 * Do not contact). The default (not asked, good fit, reachable) shows nothing.
 */
export function dealCardChips(row: Pick<UniboxRow, "interest" | "fit" | "contactability">): TimelineTag[] {
  const out: TimelineTag[] = [];
  if (row.interest === "interested" || row.interest === "not_interested") {
    out.push(uniboxValueTag("interest", row.interest, dimensionValueLabel("interest", row.interest)));
  }
  if (row.fit !== "fit") out.push(uniboxValueTag("fit", row.fit, dimensionValueLabel("fit", row.fit)));
  if (row.contactability !== "contactable") {
    out.push(uniboxValueTag("contactability", row.contactability, dimensionValueLabel("contactability", row.contactability)));
  }
  return out;
}

/**
 * features-service `GET /offers/:offerId/deals-value?columns=lifecycle` (v0.179.313): the offer's
 * value per lifecycle rung, each card's value, and the totals (steps add up to `totalUsd` =
 * `expectedPipelineUsd` + `wonUsd`). Read, never summed here.
 */
const DealsLifecycleCardSchema = z
  .object({
    humanId: z.string().nullable(),
    companyKey: z.string().nullable(),
    relationKey: z.string().nullable(),
    leadIds: z.array(z.string()),
    valueUsd: z.number().nullable(),
    zeroValueReason: z.string().nullable(),
    valueSource: z.string().nullable(),
    entryRateSource: z.string().nullable(),
  })
  .passthrough();

const DealsLifecycleRungSchema = z
  .object({
    key: z.string(),
    rank: z.number(),
    label: z.string(),
    valueKind: z.string(),
    valueUsd: z.number().nullable(),
    expected: z.boolean(),
    cardCount: z.number(),
    leadCount: z.number(),
    organizationCount: z.number(),
    cards: z.array(DealsLifecycleCardSchema),
  })
  .passthrough();

export const DealsLifecycleSchema = z
  .object({
    offerId: z.string(),
    brandId: z.string(),
    campaignId: z.string().nullable(),
    columns: z.literal("lifecycle"),
    unvaluedReason: z.string().nullable(),
    totalUsd: z.number().nullable(),
    expectedPipelineUsd: z.number().nullable(),
    wonUsd: z.number().nullable(),
    rungs: z.array(DealsLifecycleRungSchema),
  })
  .passthrough();
export type DealsLifecycle = z.infer<typeof DealsLifecycleSchema>;
export type DealsLifecycleRung = z.infer<typeof DealsLifecycleRungSchema>;

/** One served column's value, and each card's value keyed the way a Unibox row names itself. */
export interface ServedRungValue {
  valueUsd: number | null;
  expected: boolean;
  valueKind: string;
  byRow: Map<string, number | null>;
}

/** The served rung, keyed for the board: a card is found by its relation, else its human. */
export function servedRungValues(body: DealsLifecycle | undefined): Map<string, ServedRungValue> {
  const out = new Map<string, ServedRungValue>();
  for (const r of body?.rungs ?? []) {
    const byRow = new Map<string, number | null>();
    for (const c of r.cards) {
      const id = c.relationKey ?? c.humanId;
      if (id) byRow.set(id, c.valueUsd);
    }
    out.set(r.key, { valueUsd: r.valueUsd, expected: r.expected, valueKind: r.valueKind, byRow });
  }
  return out;
}

/** The board's query string for the offer's lifecycle values: net, the offer's people, one campaign or all. */
export function dealsLifecycleQuery(brandId: string, campaignId: string | null): string {
  const qs = new URLSearchParams({ brandId, pricing: "net", columns: "lifecycle" });
  if (campaignId) qs.set("campaignId", campaignId);
  return qs.toString();
}
