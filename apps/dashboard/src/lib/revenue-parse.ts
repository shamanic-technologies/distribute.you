// Single parser for the features-service `/features/{slug}/revenue` contract,
// shared by the authed client (`@/lib/api`) and the public-report server build
// (`report-api.ts`). Dependency-free (zod + view types only) so report-api stays
// off the Clerk-authed `@/lib/api` module.
//
// safeParse → a shape-rot success becomes a caught error (keepPreviousData on the
// authed side; empty section on the report side), never a render crash.

import { z } from "zod";
import type { RevenueOverview, RevenueOverviewWithLeads } from "./revenue-view";

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
  // Per-lead REALIZED outcomes (features-service#476 conversion-tracker attribution):
  // boolean + first-occurrence timestamp for signup / form submission / meeting booked
  // / purchase. `.optional()`/`.nullish()` decouple the backend rollout — absent (all
  // undefined) until features-service reaches prod, so the Leads page hides the
  // matching outcome tab until then (no empty tab pre-attribution).
  // The three the producer has served all along and this schema never declared, so Zod
  // stripped them at the parse boundary: a consumer asking whether a lead REPLIED, or
  // CLICKED, or ATTENDED the meeting read `undefined` forever and could not tell that
  // apart from "not measured". Verified on the wire (2026-08-28) — every lead row on the
  // funnel-scoped read carries all three beside the ones below.
  clicked: z.boolean().optional(),
  repliedPositive: z.boolean().optional(),
  meetingAttended: z.boolean().optional(),
  meetingAttendedAt: z.string().nullish(),
  signup: z.boolean().optional(),
  signupAt: z.string().nullish(),
  formSubmission: z.boolean().optional(),
  formSubmissionAt: z.string().nullish(),
  meetingBooked: z.boolean().optional(),
  meetingBookedAt: z.string().nullish(),
  purchased: z.boolean().optional(),
  purchasedAt: z.string().nullish(),
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

/**
 * The twelve fields of a `/revenue` lead row a BROWSER surface can read — its id, the
 * seven outcome flags `trackedStages` renders, and the four realized-outcome
 * timestamps the Leads page dates its outcome tab by. Picked from the full row rather
 * than re-declared, so the two can never drift.
 */
const LeadOutcomeSchema = RevenueLeadSchema.pick({
  leadId: true,
  clicked: true,
  repliedPositive: true,
  meetingBooked: true,
  meetingAttended: true,
  signup: true,
  formSubmission: true,
  purchased: true,
  signupAt: true,
  meetingBookedAt: true,
  formSubmissionAt: true,
  purchasedAt: true,
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
  // COMMITTED spend (billed + open holds) — features-service's single basis, and what
  // ROI, % CAC and $ CAC below all divide by. `.optional()` for rollout tolerance only;
  // required on the wire today.
  //
  // The billed-only sibling (`actualCostUsd`) is NOT read and NOT a fallback. Actual
  // means actual, committed means committed; putting one under the other's label is
  // exactly what made a brand's Overview and its campaigns table disagree.
  committedCostUsd: z.number().optional(),
  costOfAcquisitionPct: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  // The dollar cost of winning one customer, answered on EVERY response including
  // the default un-lensed brand read (features-service v0.127.0). `.nullish()` for
  // rollout tolerance only — it is required on the wire today.
  costPerAcquisitionUsd: z.number().nullish(),
  // Lens-only (Signups / Booked Meetings / Sales). `.nullish()` so the un-lensed
  // overview + grouped responses (which omit the field) still parse.
  expectedConversions: z.number().nullish(),
  costPerConversionUsd: z.number().nullish(),
});
// Return on spend across the brand's whole life. Both legs CUMULATIVE and REALIZED:
// spend dated by runs' own cost buckets, pipeline by the per-lead event timestamps.
// The last point's `roiMultiple` IS `costEconomics.roiMultiple`, by construction.
const RoiHistorySchema = z.object({
  daily: z.array(
    z.object({
      date: z.string(),
      cumulativeSpendUsd: z.coerce.number(),
      cumulativePipelineUsd: z.coerce.number(),
      roiMultiple: z.coerce.number().nullable(),
    }),
  ),
  datedPipelineUsd: z.coerce.number(),
  undatedPipelineUsd: z.coerce.number(),
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
  // REAL tracked form-submission count + cost-per-form-submission (form_submissions
  // goal, the visit-driven sibling of signups). Same committed-spend denominator as
  // cpsCents. Optional for rollout tolerance; cpfsCents null when the count is 0.
  formSubmissionsCount: z.coerce.number().optional(),
  cpfsCents: z.coerce.number().nullable().optional(),
  // REAL tracked SALE (paying-client won) count + cost-per-sale — the terminal outcome
  // of BOTH the website_purchase goal (multi-step close) and the combined sales goal
  // (event=sale, RENAMED from purchase). Same rollout tolerance; cpSaleCents null at 0.
  salesCount: z.coerce.number().optional(),
  cpSaleCents: z.coerce.number().nullable().optional(),
});

/**
 * One rung of the funnel: how many reached it, what reaching it cost, and what share of
 * the rung before converted into it.
 *
 * Every figure here is SERVED. The rate in particular has to be: a browser dividing two
 * served counts is the compute-a-stat-in-the-browser bug, and it would drift from the
 * producer's own answer the moment either side changed its scope.
 *
 * `recipientsReached` is nullable and 0 is NOT null: 0 is measured and means nobody got
 * here, which is the answer somebody asking "is this working" most needs to read.
 */
/**
 * What the CUSTOMER states ONE rung cost them — the legs they work themselves.
 *
 * Beside `costPerReachCents`, never inside it: that one is what WE charged, this one is
 * their own money, in no ledger of ours. `.nullish()` because the producer declares the
 * block required AND nullable (null = the statements could not be read at all), and
 * because a cached pre-v0.148.0 body carries none.
 */
const StepCustomerCostSchema = z.object({
  costCents: z.number(),
  statedCount: z.number(),
  unstatedCount: z.number(),
  coverage: z.string(),
  /** The stated total divided by the rung's count — SERVED, never divided here. Null
   *  when nobody stated a cost, nobody reached the rung, or the count is unmeasured;
   *  never 0, which would say their work was free. */
  costPerReachCents: z.number().nullable(),
});

const FunnelStepSchema = z.object({
  step: z.string(),
  leadField: z.string(),
  recipientsReached: z.number().nullable(),
  costPerReachCents: z.number().nullable(),
  fromStep: z.string(),
  fromRecipientsReached: z.number().nullable(),
  conversionFromPreviousPct: z.number().nullable(),
  customerCost: StepCustomerCostSchema.nullish(),
});

const FunnelStepsSchema = z.object({
  funnelKey: z.string(),
  name: z.string(),
  committedSpentCents: z.number(),
  /** DISTINCT leads contacted — the base the FIRST rung converts from. */
  contactedRecipients: z.number(),
  steps: z.array(FunnelStepSchema),
});


const FeatureRevenueResponseSchema = z.object({
  // OPTIONAL because this parser is shared by all THREE money grains, and only the
  // per-feature one names a channel. A feature IS an acquisition channel here, so the
  // brand and offer bodies carry no such name by construction — a brand runs several
  // channels and an offer sells through several, which is the whole reason those reads
  // exist. Required, it made every brand and offer Overview throw the moment #3468
  // repointed them: real data on the wire (pipeline $7,000, ROI 2.62x, CAC $953 on the
  // brand that surfaced it), a failed parse, and a section painted as labels with no
  // numbers under them — nothing on screen saying it had broken.
  //
  // Nothing reads it off the parsed value; it is kept so the per-feature body's own
  // field is not silently stripped.
  featureSlug: z.string().optional(),
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
  // THE FUNNEL WALKED STEP BY STEP (features-service#854, live). Required AND NULLABLE
  // on the wire, which is the producer saying `null` is a value it means to send: it
  // is null wherever there is no ONE funnel to walk (the brand and offer grains span
  // several, a lensed read is a subset of the leads beside the whole spend, a channel
  // with no funnel wired never read its leads at all). `.optional()` would parse every
  // body EXCEPT the one the null was written for, so `.nullish()` — the same call the
  // required-and-nullable rule prescribes, and it also tolerates a cached pre-#854 body.
  funnelSteps: FunnelStepsSchema.nullish(),
  headline: z.object({ totalPipelineUsd: z.number().nullable() }),
  costEconomics: CostEconomicsSchema,
  // Overview-only (null on `?lens=`, absent on grouped) and fail-soft server-side,
  // so the reader must tolerate both absent and null.
  roiHistory: RoiHistorySchema.nullish(),
  timeSeries: z.array(z.object({ date: z.string(), cumulativePipelineUsd: z.number() })),
  organizations: z.array(RevenueOrgSchema),
  events: z.array(RevenueEventSchema),
  // SLIM leads. Zod strips every undeclared key, so picking the twelve fields a browser
  // surface can actually read means the other twenty-four (name, photo, org, logo, tags,
  // seniority, industry, employee count…) are never validated, never allocated and never
  // held. See `RevenueOverview.leadOutcomes` for the measured sizes.
  leads: z.array(LeadOutcomeSchema),
});

/**
 * The same body, WITH the per-lead array — the digest's parse, and the ONLY one that
 * carries it.
 *
 * REQUIRED here on purpose: this parse is reached by asking for the leads, so an
 * absent array means the producer stopped sending them and the digest would silently
 * report "nothing landed" for every brand on the platform. A loud parse failure is the
 * honest answer. (`.optional()` is what would hide it.)
 */
const RevenueWithLeadsResponseSchema = FeatureRevenueResponseSchema.extend({
  leads: z.array(RevenueLeadSchema),
});

/** The four outcome flags, and the timestamp of each, in one place so the filter, the
 *  presence answer and the schema pick cannot drift apart. */
const OUTCOME_FIELDS = ["signup", "meetingBooked", "formSubmission", "purchased"] as const;
/** Every flag a browser surface reads — the four above plus the three the delivery
 *  layer measures, which `trackedStages` renders on the lead panel and the leg board. */
const OUTCOME_FLAGS = [
  ...OUTCOME_FIELDS,
  "clicked",
  "repliedPositive",
  "meetingAttended",
] as const;
const OUTCOME_DATES = [
  "signupAt",
  "meetingBookedAt",
  "formSubmissionAt",
  "purchasedAt",
] as const;

/**
 * Has this lead reached ANYTHING?
 *
 * A lead with every flag false and every date null is looked up by both browser
 * consumers and found absent either way — carrying it says nothing and costs, at the
 * measured population, 10.8MB to say it. A `false` is deliberately NOT an outcome: it is
 * the producer saying "measured, did not happen", which is exactly the row we drop.
 */
function leadReachedSomething(lead: z.infer<typeof LeadOutcomeSchema>): boolean {
  if (OUTCOME_FLAGS.some((f) => lead[f] === true)) return true;
  return OUTCOME_DATES.some((d) => lead[d] != null);
}

/**
 * TWO parsers, because `leads[]` is 99.6% of this payload and NO browser surface reads
 * it.
 *
 * Measured in prod (brand `75d7e3e8`, 2026-08-31): `/brands/:id/revenue` answers
 * **10,903,573 bytes**, of which **10,860,781** are the 9,854-entry `leads[]`. The
 * per-feature read is the same size. Everything else on the body — the headline, the
 * economics, the spend block, every count series, the ROI history, the funnel walk —
 * is 43KB.
 *
 * That array is what took the dashboard's instant paint away. The persisted cache
 * refuses any snapshot over `MAX_PERSISTED_ENTRY_BYTES` (2MB, persist-cache.ts), so
 * `brandRevenue` / `offerRevenue` / `offerFunnelRevenue` / `featureRevenue` were never
 * written to disk at all — and those four keys are what every money card, the
 * Return-on-spend chart and the cost card read. Nothing errored: the reveal gates are
 * settle-based and correct, the network answered, the numbers were right. Every one of
 * those surfaces simply cold-skeletoned on EVERY load, on every brand, offer, funnel and
 * campaign page, while the small reads beside them (the Offers table's `brandOfferMoney`,
 * 118KB) painted instantly from disk. That contrast is the whole bug report.
 *
 * So the browser parse OMITS the field rather than parsing-then-discarding it: zod
 * strips an undeclared key, so the 9,854 rows are never validated either — the parse
 * itself was tens of megabytes of main-thread work every poll.
 *
 * The type carries the split, which is the point: `RevenueOverview` has NO `leads`, so a
 * browser surface that reaches for one is a COMPILE error rather than an empty array it
 * would read as "nobody is in the pipeline". Only {@link parseRevenueWithLeads} returns
 * them, and only the outcome-digest cron calls it.
 *
 * ⚠️ This does not shrink the WIRE: 10.9MB still crosses the network and is still
 * `JSON.parse`d by `fetch`. Only features-service can fix that, by not serving `leads[]`
 * on a read that did not ask for it. Filed as the follow-up; the digest conforms to
 * whatever opt-in it designs.
 */
function flattenRevenue(d: z.infer<typeof FeatureRevenueResponseSchema>): RevenueOverview {
  return {
    featureSlug: d.featureSlug,
    totalPipelineUsd: d.headline.totalPipelineUsd,
    costEconomics: {
      committedCostUsd: d.costEconomics.committedCostUsd ?? null,
      costOfAcquisitionPct: d.costEconomics.costOfAcquisitionPct,
      roiMultiple: d.costEconomics.roiMultiple,
      costPerAcquisitionUsd: d.costEconomics.costPerAcquisitionUsd ?? null,
      expectedConversions: d.costEconomics.expectedConversions,
      costPerConversionUsd: d.costEconomics.costPerConversionUsd,
    },
    roiHistory: d.roiHistory ?? null,
    funnelSteps: d.funnelSteps ?? null,
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
    events: d.events,
    // NARROWED, and the presence answer is taken BEFORE the narrowing — see
    // `RevenueOverview.outcomeFieldsServed`. `.some` short-circuits on the first row,
    // so this is four comparisons, not four passes.
    leadOutcomes: d.leads.filter(leadReachedSomething),
    outcomeFieldsServed: OUTCOME_FIELDS.filter((f) =>
      d.leads.some((l) => l[f] !== undefined),
    ),
  };
}

/**
 * Validate + flatten a revenue body for a BROWSER surface. Throws on shape rot.
 *
 * Carries no `leads[]` — see {@link flattenRevenue}. Every dashboard reader of
 * `/revenue` goes through this one.
 */
export function parseFeatureRevenue(raw: unknown, label: string): RevenueOverview {
  const parsed = FeatureRevenueResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: revenue response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard] ${label}: invalid revenue response shape`);
  }
  return flattenRevenue(parsed.data);
}

/**
 * Validate + flatten a revenue body INCLUDING its per-lead array.
 *
 * The outcome-digest cron is the only caller: it names, per person, what each one did on
 * the day, so it genuinely needs the rows. It runs server-side on its own schedule, so
 * the payload never touches a browser, a poll or the persisted cache.
 *
 * Do NOT call this from a component. If a surface ever needs per-lead rows, it reads
 * lead-service (`listBrandLeads`) like the leads page does — that read is paginated,
 * scoped, and already persisted under its own key.
 */
export function parseRevenueWithLeads(raw: unknown, label: string): RevenueOverviewWithLeads {
  const parsed = RevenueWithLeadsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: revenue response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard] ${label}: invalid revenue response shape`);
  }
  return { ...flattenRevenue(parsed.data), leads: parsed.data.leads };
}
