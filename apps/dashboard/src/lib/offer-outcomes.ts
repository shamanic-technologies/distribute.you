/**
 * An OFFER's outcomes — what it buys, and the leg × channel rows serving each.
 *
 * features-service `GET /offers/:offerId/outcomes` (v0.174.1) answers one row per
 * outcome the offer buys (a step at least one of our channels lands a leg on), and
 * under each, every leg × channel serving it in parallel. Every figure is SERVED:
 * nothing here divides, sums or ranks. Rows are NOT additive — a lead reached through
 * two channels is one lead in the outcome row and one in each leg row — so no surface
 * may print a total of them.
 *
 * Alias-free on purpose (its only import is zod), so the rules below carry REAL unit
 * tests. Adding an `@/…` import turns them into resolution failures.
 *
 * Vocabularies (step keys, `unmeasuredReason`, `countBasis`, `legSource`) are read as
 * plain STRINGS, never `z.enum`: the producer owns them and a closed set throws the
 * whole page the day one grows. Every nullable figure is `.nullable()`, never
 * `.optional()`: the producer states the null on purpose (a figure it cannot measure),
 * and `.optional()` parses every body except the one the null was written for.
 */
import { z } from "zod";

const FiguresShape = {
  recipientsReached: z.number().nullable(),
  spentUsd: z.number(),
  costPerOutcomeUsd: z.number().nullable(),
  valuePerOutcomeUsd: z.number().nullable(),
  valueUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  unmeasuredReason: z.string().nullable(),
};

const StepRefSchema = z.object({ key: z.string(), label: z.string() });

const OfferOutcomeLegSchema = z.object({
  ...FiguresShape,
  legKey: z.string(),
  fromStep: StepRefSchema.nullable(),
  toStep: StepRefSchema,
  featureSlug: z.string(),
  channelName: z.string(),
  campaignIds: z.array(z.string()),
  legSource: z.string(),
  countBasis: z.string(),
});

const OfferOutcomeRowSchema = z.object({
  ...FiguresShape,
  step: z.object({ key: z.string(), label: z.string(), description: z.string() }),
  valueBasisFunnelKey: z.string().nullable(),
  legs: z.array(OfferOutcomeLegSchema),
});

export const OfferOutcomesResponseSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  costBasis: z.string(),
  maturityDays: z.number().nullable(),
  outcomes: z.array(OfferOutcomeRowSchema),
  unattributedCampaignIds: z.array(z.string()),
  hiddenCampaignIds: z.array(z.string()),
});

export type OfferOutcomeLeg = z.infer<typeof OfferOutcomeLegSchema>;
export type OfferOutcomeRow = z.infer<typeof OfferOutcomeRowSchema>;
export type OfferOutcomes = z.infer<typeof OfferOutcomesResponseSchema>;
/** The five figures both an outcome row and a leg row carry. */
export type OutcomeFigures = Pick<OfferOutcomeRow, keyof typeof FiguresShape>;

export function parseOfferOutcomes(raw: unknown, label: string): OfferOutcomes {
  const parsed = OfferOutcomesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: response shape mismatch`, { issues: parsed.error.issues });
    throw new Error(`[dashboard] ${label}: invalid response shape`);
  }
  return parsed.data;
}

/**
 * Why a figure is null, in the customer's words. The producer names the missing
 * ingredient; this only translates it. An unknown token is stated as unmeasured
 * rather than dropped, because "we could not measure this" still has to be said.
 */
const REASON_WORDS: Record<string, string> = {
  maturing: "Too early: results are still coming in",
  nothing_spent: "Nothing spent here yet",
  no_value_defined: "No value set: add your lifetime revenue in Offer Settings",
  step_not_counted: "We do not count this outcome yet",
  evidence_unreadable: "We could not read the results for this outcome",
  // The leg's count is real, but its campaigns serve no leads of their own (an internal
  // step like AI meeting booking), so no spend is tied to it: count yes, price no.
  not_attributable: "Spend can't be tied to these results yet",
};

export function unmeasuredReasonWords(reason: string | null): string | null {
  if (reason == null) return null;
  return REASON_WORDS[reason] ?? "Not measured yet";
}

/**
 * A step's label as the name of a COUNT: `26 positive replies`, `7 meetings booked`.
 * A participle label (`Meeting booked`) pluralizes its noun, everything else its last
 * word. Display only: the label itself is the producer's.
 */
export function pluralStepLabel(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return label;
  const pluralize = (w: string) =>
    /[^aeiou]y$/i.test(w) ? `${w.slice(0, -1)}ies` : /(s|x|ch|sh)$/i.test(w) ? `${w}es` : `${w}s`;
  const last = words.length - 1;
  const participle = words.length > 1 && /(ed|en)$/i.test(words[last]);
  const i = participle ? last - 1 : last;
  words[i] = pluralize(words[i]);
  return words.join(" ");
}

/** The fields of a stored campaign row the link resolver reads. */
export interface CampaignRef {
  id: string;
  offerId?: string | null;
  funnelKey?: string | null;
  featureSlug?: string | null;
  status: string;
  updatedAt: string;
}

/**
 * The ONE campaign a leg × channel row links to, or null.
 *
 * A campaign as the customer knows it is one (offer × funnel × channel) IDENTITY, and
 * campaign-service stores it as many rows (it used to mint one per workflow switch, and
 * keeps them). So `campaignIds` routinely lists dozens of rows of ONE campaign. The row
 * links when those ids collapse to exactly one identity — to its live row, else the
 * latest — the same collapse the Campaigns table makes. Two identities is two campaigns
 * and there is no single one to open. Before the campaigns read lands, only a single id
 * can be trusted.
 */
export function legCampaignId(
  campaignIds: readonly string[],
  campaigns: readonly CampaignRef[] | undefined,
  isActive: (status: string) => boolean,
): string | null {
  if (campaignIds.length === 0) return null;
  if (!campaigns) return campaignIds.length === 1 ? campaignIds[0] : null;
  const wanted = new Set(campaignIds);
  const rows = campaigns.filter((c) => wanted.has(c.id));
  if (rows.length === 0) return campaignIds.length === 1 ? campaignIds[0] : null;
  const identities = new Set(
    rows.map((c) => `${c.offerId ?? ""}|${c.funnelKey ?? ""}|${c.featureSlug ?? ""}`),
  );
  if (identities.size !== 1) return null;
  let held: CampaignRef | null = null;
  for (const c of rows) {
    if (!held) held = c;
    else if (isActive(held.status)) continue;
    else if (isActive(c.status) || c.updatedAt > held.updatedAt) held = c;
  }
  return held?.id ?? null;
}
