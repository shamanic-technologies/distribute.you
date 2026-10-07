import { z } from "zod";

// ── Where an offer's leads come from (features-service, per offer) ──
// Alias-free on purpose: tests parse a real prod body through it (tests/offer-sourcing.test.ts).
// A campaign reads "[sourcing origin] -> [channel] -> outcome" (owner 2026-10-07): finding a
// lead (screen, reveal, verify) is the SOURCING half of its cost, emailing it the OUTREACH
// half; sourcing + outreach = the campaign's total, to the cent (features-service #1376).
// Every catalogue origin is listed, used or not. Since inception, net.
const SourcingFiguresSchema = z.object({
  serveCount: z.coerce.number(),
  leadsServed: z.coerce.number(),
  sourcingCostUsd: z.coerce.number(),
  costPerLeadUsd: z.coerce.number().nullable(),
  positiveReplies: z.coerce.number(),
  sourcingCostPerPositiveReplyUsd: z.coerce.number().nullable(),
  outreachCostUsd: z.coerce.number(),
  endToEndCostUsd: z.coerce.number(),
  endToEndCostPerPositiveReplyUsd: z.coerce.number().nullable(),
  roi: z.coerce.number().nullable(),
  roiUnavailableReason: z.string().nullable(),
});

const SourcingOriginSchema = SourcingFiguresSchema.extend({
  slug: z.string(),
  // Whose data the origin is (features-service v0.179.78): the logo.dev mark is drawn off
  // `domain`, never a name. null = no single vendor (the customer's own CRM contacts).
  // `.nullish()` while the release rolls out: an older body omits it.
  provider: z.object({ name: z.string(), domain: z.string() }).nullish(),
  name: z.string(),
  family: z.string(),
  description: z.string().nullable(),
  live: z.boolean(),
  used: z.boolean(),
});

export type SourcingOrigin = z.infer<typeof SourcingOriginSchema>;

const SourcingCampaignSchema = z.object({
  campaignId: z.string(),
  featureSlug: z.string(),
  legKey: z.string().nullable(),
  // A campaign's leads served before audiences were tagged come back as ONE source with
  // `slug: null, name: null` (the campaign-grain twin of `unattributed`). Required-and-nullable:
  // a plain string here threw the whole read ("Could not read where your leads come from").
  sources: z.array(z.object({ slug: z.string().nullable(), name: z.string().nullable() })),
});

const OfferSourcingSchema = z.object({
  offerId: z.string(),
  origins: z.array(SourcingOriginSchema),
  // Serves recorded before audiences were tagged: no origin, never spread over one.
  unattributed: SourcingFiguresSchema.nullable(),
  campaigns: z.array(SourcingCampaignSchema),
});

export type OfferSourcing = z.infer<typeof OfferSourcingSchema>;

/** Parse features-service's offer sourcing read; throws loud on a shape mismatch. */
export function parseOfferSourcing(raw: unknown): OfferSourcing {
  const parsed = OfferSourcingSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferSourcing: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getOfferSourcing: invalid response shape");
  }
  return parsed.data;
}
