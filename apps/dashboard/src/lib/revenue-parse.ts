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
  // Per-lead outcome timestamps (email-gateway firstClickedAt / firstRepliedAt).
  // `.nullish()` decouples rollout; the digest renders a discreet "time ago" off
  // the goal's signal (signups → clickedAt, sales_meetings → repliedPositiveAt).
  clickedAt: z.string().nullish(),
  repliedPositiveAt: z.string().nullish(),
  // Per-lead firmographics (features-service#441). Additive `.nullish()` so the
  // parse succeeds before + after that producer reaches prod; each is null when the
  // upstream enrichment never resolved a value (no synthesis). `orgEmployeeCount` is
  // a RAW headcount (`z.coerce.number()` — the wire may serialize it as a string) —
  // the consumer bands it for display.
  title: z.string().nullish(),
  seniority: z.string().nullish(),
  orgIndustry: z.string().nullish(),
  orgEmployeeCount: z.coerce.number().nullish(),
  orgCity: z.string().nullish(),
  orgCountry: z.string().nullish(),
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
  // features-service renamed the billed run-cost `totalCostUsd` → `actualCostUsd`
  // (ROI/CAC ride realized spend, holds excluded — features-service#402). Accept BOTH
  // for rollout tolerance; the flatten normalizes to `actualCostUsd`.
  actualCostUsd: z.number().optional(),
  totalCostUsd: z.number().optional(),
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
// Spend figures: total = ACTUAL + PROVISIONED (committed), actual = billed only,
// provisioned = open holds only (features-service naming convention). The `total*`
// committed fields + their actual/provisioned siblings are additive (.optional()) so
// the dashboard ships ahead of features-service: until that service lands the legacy
// `todaySpentCents`/`cpcCents` carry actual-only, and the render prefers `total*` when
// present. `totalSpentCents` keeps its name across the rollout (value flips actual→committed).
const SpendSchema = z.object({
  totalSpentCents: z.coerce.number(),
  actualSpentCents: z.coerce.number().optional(),
  provisionedSpentCents: z.coerce.number().optional(),
  totalSpentTodayCents: z.coerce.number().optional(),
  actualSpentTodayCents: z.coerce.number().optional(),
  provisionedSpentTodayCents: z.coerce.number().optional(),
  todaySpentCents: z.coerce.number().optional(),
  sources: z.array(
    z.object({
      source: z.string(),
      // features-service renamed `spentCents` → the committed/actual/provisioned trio
      // (features-service#402). The card renders only `source` + `sharePct`, so all
      // amounts are optional for rollout tolerance.
      totalSpentCents: z.coerce.number().optional(),
      actualSpentCents: z.coerce.number().optional(),
      provisionedSpentCents: z.coerce.number().optional(),
      spentCents: z.coerce.number().optional(),
      sharePct: z.coerce.number(),
    }),
  ),
  totalCpcCents: z.coerce.number().nullable().optional(),
  actualCpcCents: z.coerce.number().nullable().optional(),
  provisionedCpcCents: z.coerce.number().nullable().optional(),
  cpcCents: z.coerce.number().nullable().optional(),
  // REAL tracked conversion counts (attributed, deduped) from the brand's live
  // conversion tracker — features-service sources them from lead-service. Optional
  // for rollout tolerance (absent on a pre-rollout payload → the Signups/Meetings
  // cards render "—" + the setup CTA). Must be declared here or Zod strips them.
  signupsCount: z.coerce.number().optional(),
  salesMeetingsCount: z.coerce.number().optional(),
  // REAL cost-per-signup / cost-per-meeting = committed spend (actual+provisioned)
  // ÷ the REAL tracked count above (no projection — projected cpsCents/cpsmCents
  // were removed in features-service#406 and are now recomputed from live tracker
  // data). null when the count is 0 (no denominator) → the CPS/CPSM card renders
  // "—", never a false $0.
  cpsCents: z.coerce.number().nullable().optional(),
  cpsmCents: z.coerce.number().nullable().optional(),
  // REAL attributed positive-reply count + cost-per-positive-reply for the single-step
  // `positive_replies` goal (mirrors signupsCount/cpsCents). Additive/optional — absent
  // until features-service ships the field (spawned in lockstep); cost null when count 0.
  positiveRepliesCount: z.coerce.number().optional(),
  cpprCents: z.coerce.number().nullable().optional(),
});

const FeatureRevenueResponseSchema = z.object({
  featureSlug: z.string(),
  spend: SpendSchema.nullable().optional(),
  // features-service#416 renamed the Overview count-series (shape unchanged) and
  // added `sequences`. BOTH the new (`recipients*`) and legacy names are `.optional()`
  // so the parse succeeds on current prod features (old names) AND post-#416 (new
  // names); the flatten below prefers the new name, falls back to the legacy one.
  sequences: SignalSeriesSchema.optional(),
  recipientsContacted: SignalSeriesSchema.optional(),
  recipientsOpened: SignalSeriesSchema.optional(),
  recipientsClicked: SignalSeriesSchema.optional(),
  recipientsRepliesPositive: SignalSeriesSchema.optional(),
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
    costEconomics: {
      // Normalize the renamed field: prefer `actualCostUsd`, fall back to legacy
      // `totalCostUsd` until features-service is live everywhere.
      actualCostUsd: d.costEconomics.actualCostUsd ?? d.costEconomics.totalCostUsd ?? 0,
      costOfAcquisitionPct: d.costEconomics.costOfAcquisitionPct,
      roiMultiple: d.costEconomics.roiMultiple,
      expectedConversions: d.costEconomics.expectedConversions,
      costPerConversionUsd: d.costEconomics.costPerConversionUsd,
    },
    spend: d.spend,
    // Normalize the features-service#416 count-series renames at this single parser
    // boundary: prefer the new `recipients*` name, fall back to the legacy one, so
    // every consumer of `outreachContacted`/`opened`/`clicked`/`repliedPositive`
    // renders correctly on BOTH old-prod and post-#416 payloads with no per-consumer
    // change. `sequences` (new per-day outreach VOLUME, undeduped) is a distinct
    // series — the Outreach card + graph bars prefer it; grain differs from
    // `outreachContacted` (distinct leads reached) BY DESIGN.
    sequences: d.sequences,
    outreachContacted: d.recipientsContacted ?? d.outreachContacted,
    opened: d.recipientsOpened ?? d.opened,
    clicked: d.recipientsClicked ?? d.clicked,
    repliedPositive: d.recipientsRepliesPositive ?? d.repliedPositive,
    meetingsBooked: d.meetingsBooked,
    purchased: d.purchased,
    timeSeries: d.timeSeries,
    organizations: d.organizations,
    leads: d.leads,
    events: d.events,
  };
}
