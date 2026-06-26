// Single parser for the features-service `/features/{slug}/revenue` contract,
// shared by the authed client (`@/lib/api`) and the public-report server build
// (`report-api.ts`). Dependency-free (zod + view types only) so report-api stays
// off the Clerk-authed `@/lib/api` module.
//
// safeParse → a shape-rot success becomes a caught error (keepPreviousData on the
// authed side; empty section on the report side), never a render crash.

import { z } from "zod";
import type { RevenueOverview } from "./revenue-view";

const RevenueTopPersonSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
});
const RevenueOrgSchema = z.object({
  orgId: z.string().nullable(),
  orgName: z.string().nullable(),
  orgLogoUrl: z.string().nullable(),
  // Company domain for logo.dev (features-service maps the lead's primaryDomain
  // through). `.nullish()` so the parse survives until that backend field ships.
  orgDomain: z.string().nullish(),
  topPerson: RevenueTopPersonSchema.nullable(),
  tags: z.array(z.string()),
  expectedRevenueUsd: z.number(),
  mostAdvancedDate: z.string().nullable(),
});
const RevenueLeadSchema = z.object({
  leadId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  photoUrl: z.string().nullable(),
  orgName: z.string().nullable(),
  orgLogoUrl: z.string().nullable(),
  orgDomain: z.string().nullish(),
  tags: z.array(z.string()),
  expectedRevenueUsd: z.number(),
  // Only present on a `?lens=` (Signups / Booked Meetings / Sales) response;
  // `.nullish()` so the un-lensed overview parse (no field) still succeeds.
  conversionProbabilityPct: z.number().nullish(),
  // email-gateway delivery evidence (features-service#372). `.optional()` /
  // `.nullish()` decouple the backend rollout — once prod serves them the
  // Outreach card + graph-actual read straight off this payload.
  contacted: z.boolean().optional(),
  contactedAt: z.string().nullish(),
  date: z.string().nullable(),
});
const RevenueEventSchema = z.object({
  leadId: z.string(),
  person: z.string().nullable(),
  org: z.string().nullable(),
  eventType: z.string(),
  eventDate: z.string(),
  contributionUsd: z.number(),
});
const CostEconomicsSchema = z.object({
  totalCostUsd: z.number(),
  costOfAcquisitionPct: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  // Lens-only (Signups / Booked Meetings / Sales). `.nullish()` so the un-lensed
  // overview + grouped responses (which omit the field) still parse.
  expectedConversions: z.number().nullish(),
  costPerConversionUsd: z.number().nullish(),
});
// Server-computed signal aggregate. `.optional()` on the response fields decouples
// backend rollout; `z.coerce.number()` because Postgres numeric/bigint can
// serialize as a string on the wire.
const SignalSeriesSchema = z.object({
  total: z.coerce.number(),
  daily: z.array(
    z.object({ date: z.string(), count: z.coerce.number() }),
  ),
  undatedCount: z.coerce.number(),
});

// Canonical spend block (features-service#396). `*Cents` tolerate string OR
// number on the wire (Postgres numeric/bigint can serialize as a string) via
// `z.coerce.number()`; the cost metrics are `.nullable()` (null → render "—").
// `spend` itself is `.nullable()` (null on a lensed response) + `.optional()`
// (absent on a cold / pre-rollout payload) so the overview parse survives both.
const SpendSchema = z.object({
  totalSpentCents: z.coerce.number(),
  todaySpentCents: z.coerce.number(),
  sources: z.array(
    z.object({
      source: z.string(),
      spentCents: z.coerce.number(),
      sharePct: z.coerce.number(),
    }),
  ),
  cpcCents: z.coerce.number().nullable(),
  cpsCents: z.coerce.number().nullable(),
  cpsmCents: z.coerce.number().nullable(),
});

const FeatureRevenueResponseSchema = z.object({
  featureSlug: z.string(),
  spend: SpendSchema.nullable().optional(),
  outreachContacted: SignalSeriesSchema.optional(),
  opened: SignalSeriesSchema.optional(),
  clicked: SignalSeriesSchema.optional(),
  repliedPositive: SignalSeriesSchema.optional(),
  meetingsBooked: SignalSeriesSchema.optional(),
  purchased: SignalSeriesSchema.optional(),
  headline: z.object({ totalPipelineUsd: z.number().nullable() }),
  costEconomics: CostEconomicsSchema,
  timeSeries: z.array(z.object({ date: z.string(), cumulativePipelineUsd: z.number() })),
  organizations: z.array(RevenueOrgSchema),
  leads: z.array(RevenueLeadSchema),
  events: z.array(RevenueEventSchema),
});

/** Validate + flatten the backend response into the view-model. Throws on shape rot. */
export function parseFeatureRevenue(raw: unknown, label: string): RevenueOverview {
  const parsed = FeatureRevenueResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: revenue response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard] ${label}: invalid revenue response shape`);
  }
  const d = parsed.data;
  return {
    featureSlug: d.featureSlug,
    totalPipelineUsd: d.headline.totalPipelineUsd,
    costEconomics: d.costEconomics,
    spend: d.spend,
    outreachContacted: d.outreachContacted,
    opened: d.opened,
    clicked: d.clicked,
    repliedPositive: d.repliedPositive,
    meetingsBooked: d.meetingsBooked,
    purchased: d.purchased,
    timeSeries: d.timeSeries,
    organizations: d.organizations,
    leads: d.leads,
    events: d.events,
  };
}
