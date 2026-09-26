// View-model for the feature revenue overview + conversions surfaces.
//
// Mirrors the features-service `GET /v1/features/{slug}/revenue` contract 1:1 —
// features-service is the single source that computes expected pipeline revenue
// (MAX inside each entity, SUM across distinct orgs) from the brand's saved sales
// economics. The dashboard only renders. `timeSeries`, `events`, and the date
// fields stay empty/null until email-gateway exposes per-event timestamps.
//
// Plain TS interfaces (no `@/lib/api` import) so these types stay safe to import
// from components reused in the public-report bundle.

/**
 * One step of the walk: how many reached it, what reaching it cost, and what share of
 * the rung before converted into it. Every figure is SERVED — a browser dividing two
 * served counts is the compute-a-stat-in-the-browser bug, and it would drift from the
 * producer's own answer the moment either side changed scope.
 *
 * `recipientsReached` at 0 is MEASURED, not absent: it means nobody got here, which is
 * the answer somebody asking "is this working" most needs to read.
 */
export interface StepCustomerCost {
  costCents: number;
  statedCount: number;
  unstatedCount: number;
  coverage: string;
  /** What ONE crossing cost the customer on average. Null when nobody stated one. */
  costPerReachCents: number | null;
}

export interface StepWalkRow {
  step: string;
  leadField: string;
  recipientsReached: number | null;
  costPerReachCents: number | null;
  fromStep: string;
  fromRecipientsReached: number | null;
  conversionFromPreviousPct: number | null;
  /**
   * What the CUSTOMER states this step cost them, beside what we charged. Absent on a
   * body older than features-service v0.148.0, null when the statements could not be
   * read — both mean "we have no figure", never "it was free".
   */
  customerCost?: StepCustomerCost | null;
}

/** The steps a campaign's leads reached, walked in order. Null on a read with no one
 *  path to walk (brand and offer grains, a lensed read). */
export interface StepWalk {
  name: string;
  committedSpentCents: number;
  /** DISTINCT leads contacted — the base the FIRST step converts from. */
  contactedRecipients: number;
  steps: StepWalkRow[];
}

export interface RevenuePoint {
  date: string;
  cumulativePipelineUsd: number;
}

export interface ConversionTopPerson {
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
}

/** One organisation row (overview table + Organizations tab), deduped. */
export interface ConversionOrg {
  orgId: string | null;
  orgName: string | null;
  orgLogoUrl: string | null;
  /** Company domain for logo.dev when `orgLogoUrl` is absent. */
  orgDomain?: string | null;
  /** The most-likely person (argmax person_EV). */
  topPerson: ConversionTopPerson | null;
  /** Conversion channels across the org (multi-tag). */
  tags: string[];
  expectedRevenueUsd: number;
  /** Most-advanced event date; null until per-event timestamps exist. */
  mostAdvancedDate: string | null;
}

/** One person row (Leads tab). */
/** The four outcomes features-service attributes per lead (conversion tracker). */
export type LeadOutcomeField = "signup" | "meetingBooked" | "formSubmission" | "purchased";

/**
 * What ONE lead has reached — the only thing a browser surface ever asks a `/revenue`
 * lead row. Structurally a `LeadStageEvidence` (lead-stages.ts) plus its id and
 * the four realized-outcome timestamps, so it feeds `trackedStages` directly.
 *
 * Every flag is optional and `undefined` means "not measured", which is NOT `false`
 * ("measured, did not happen"). Both read as "we have not seen this"; neither may be
 * rendered as a denial.
 */
export interface LeadOutcome {
  leadId: string;
  clicked?: boolean;
  repliedPositive?: boolean;
  meetingBooked?: boolean;
  meetingAttended?: boolean;
  signup?: boolean;
  formSubmission?: boolean;
  purchased?: boolean;
  signupAt?: string | null;
  meetingBookedAt?: string | null;
  formSubmissionAt?: string | null;
  purchasedAt?: string | null;
}

export interface ConversionLead {
  leadId: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  orgName: string | null;
  orgLogoUrl: string | null;
  /** Company domain for logo.dev when `orgLogoUrl` is absent. */
  orgDomain?: string | null;
  tags: string[];
  expectedRevenueUsd: number;
  /**
   * Per-lead conversion probability (0–100) for the requested outcome lens.
   * Present ONLY on a lensed `?lens=` response (Signups / Booked Meetings /
   * Sales pages); absent/null on the un-lensed overview. features-service is the
   * single source — the dashboard never derives it.
   */
  conversionProbabilityPct?: number | null;
  /**
   * email-gateway delivery flag (features-service#372). True once the lead is
   * contacted; STAYS true after click/reply, so a count never undercounts. The
   * single source for the Outreach stat card + the 7-day graph's actual outreach
   * series. Optional on the wire to decouple the backend rollout.
   */
  contacted?: boolean;
  /**
   * Real per-lead `firstContactedAt` ISO timestamp; null when not yet contacted
   * or the date is unknown (NEVER synthesized). Buckets the graph's actual
   * outreach series by its local calendar day.
   */
  contactedAt?: string | null;
  /** ISO timestamp of first website click (email-gateway firstClickedAt); null
   *  when not clicked / unknown. The signups-goal digest's "time ago" source. */
  clickedAt?: string | null;
  /** ISO timestamp of first positive reply (email-gateway firstRepliedAt); null
   *  when none / unknown. The sales_meetings-goal digest's "time ago" source. */
  repliedPositiveAt?: string | null;
  /** Per-lead REALIZED outcomes (features-service#476 conversion-tracker attribution):
   *  boolean + first-occurrence timestamp. `undefined` (not just false) until the
   *  producer reaches prod → the Leads page hides the matching outcome tab until then. */
  /** Served all along and undeclared until 2026-08-28, so every reader saw `undefined`
   *  where the producer had said `true`. `undefined` still means "not measured". */
  clicked?: boolean;
  repliedPositive?: boolean;
  meetingAttended?: boolean;
  meetingAttendedAt?: string | null;
  signup?: boolean;
  signupAt?: string | null;
  formSubmission?: boolean;
  formSubmissionAt?: string | null;
  meetingBooked?: boolean;
  meetingBookedAt?: string | null;
  purchased?: boolean;
  purchasedAt?: string | null;
  /** Firmographics (features-service#441), null when upstream enrichment had no
   *  value. `orgEmployeeCount` is a RAW headcount — the consumer bands it. */
  title?: string | null;
  seniority?: string | null;
  orgIndustry?: string | null;
  orgEmployeeCount?: number | null;
  orgCity?: string | null;
  orgCountry?: string | null;
  /** Most-advanced event date; null until per-event timestamps exist. */
  date: string | null;
}

/** One day of a server-computed signal series (ascending). */
export interface SignalSeriesDay {
  /** UTC calendar day (YYYY-MM-DD) of the signal bucket. */
  date: string;
  /** Number of leads first carrying the signal on this UTC day. */
  count: number;
}

/**
 * Server-computed contacted aggregate (features-service#371/#372), from the SAME
 * `/revenue` `leads[]` snapshot the table renders — the single source for the
 * Overview Outreach stat card (`total`) AND the 7-day graph's ACTUAL outreach
 * series (`daily`). The dashboard renders only: it never re-sums or re-buckets
 * leads client-side. `total = sum(daily[].count) + undatedCount`.
 */
export interface OutreachContacted {
  /** Total contacted leads in scope — the Outreach stat-card count. */
  total: number;
  /**
   * Per-day contacted buckets (the Outreach ACTUAL series), keyed by the UTC day
   * of each lead's contactedAt, ascending. Complete series — one entry per day
   * with ≥1 dated contacted lead; the graph slices its 7-day window from it.
   */
  daily: SignalSeriesDay[];
  /** Contacted leads with a null contactedAt (counted in total, in no day bucket). */
  undatedCount: number;
}

/** Same shape as `outreachContacted`, for clicked / goal-outcome actuals. */
export type SignalSeries = OutreachContacted;

/** One raw event row (Events tab), single channel. */
export interface ConversionEvent {
  leadId: string;
  person: string | null;
  org: string | null;
  eventType: string;
  eventDate: string;
  contributionUsd: number;
}

/**
 * Derived cost economics for the feature+brand — computed by features-service
 * (single source). Always present on a 200; the ratios are null per the documented
 * null semantics.
 *
 * ONE spend basis, and it is COMMITTED (billed + the open provisioned holds). It is
 * byte the same total the `spend` block reports as `totalSpentCents`, so the ROI a
 * campaign row shows and the "Total spent" the Overview shows can never describe
 * different money. features-service serves a billed-only sibling too; the dashboard
 * does not read it and never falls back to it, because a billed figure rendered under
 * a committed label is the contradiction this replaced.
 */
export interface CostEconomics {
  /** COMMITTED run spend in $, brand (+ optional campaign), feature-scoped — billed
   *  PLUS open holds. Null is "we have no figure", never "it cost nothing". */
  committedCostUsd: number | null;
  /** (committedCostUsd / totalPipelineUsd) * 100. Null when pipeline is null or 0. */
  costOfAcquisitionPct: number | null;
  /** totalPipelineUsd / committedCostUsd. Null when cost is 0 or pipeline is null. */
  roiMultiple: number | null;
  /**
   * REALIZED dollar cost of winning ONE customer, for the scope this body describes —
   * served on EVERY response including the default un-lensed brand read, so the brand
   * Overview's `$ CAC` card reads it directly.
   *
   * It is `lifetimeRevenueUsd / roiMultiple` — the same statement as ROI and % CAC in a
   * third unit, which is why it MATCHES the lensed `costPerConversionUsd` for the same
   * scope rather than being a second opinion. Null (never 0) when the brand states no
   * lifetime revenue, or when the pipeline is null/0.
   */
  costPerAcquisitionUsd: number | null;
  /**
   * Lens-only: expected outcome COUNT = Σ per-lead probability across the lensed
   * leads. Present only on a `?lens=` response; absent on the un-lensed overview.
   * features-service is the single source — the dashboard never derives it.
   */
  expectedConversions?: number | null;
  /** Lens-only: `committedCostUsd / expectedConversions`; null when expectedConversions is 0. */
  costPerConversionUsd?: number | null;
}

/** One pre-computed cost source (descending) in the spend block. The card renders only
 *  `source` + `sharePct`; the amounts are carried for completeness. */
export interface SpendSource {
  /** runs-service cost name (billable line item, e.g. "apollo people-search"). */
  source: string;
  /** Committed spend (actual + provisioned) attributed to this source, USD cents. */
  totalSpentCents?: number;
  /** Actual (billed) spend attributed to this source, USD cents. */
  actualSpentCents?: number;
  /** Provisioned holds attributed to this source, USD cents. */
  provisionedSpentCents?: number;
  /** LEGACY actual-only spend (pre features-service#402). */
  spentCents?: number;
  /** This source's share of the committed total, percent (0–100). */
  sharePct: number;
}

/**
 * Canonical spend block for the Overview cost card — server-computed by
 * features-service, reconciled to runs ACTUAL spend (single source, the
 * dashboard renders verbatim instead of summing the runs breakdown client-side).
 * Present on the un-lensed OVERVIEW response; null on a lensed (`?lens=`) response.
 * `*Cents` values are USD cents → divide by 100 for display; a null cost metric
 * renders "—", never a false $0. (features-service#396)
 */
export interface Spend {
  /** Canonical "Total spent" = ACTUAL + PROVISIONED (committed). features-service keeps
   *  this name; its value is the committed total once that service lands (until then it
   *  is actual-only, today's behavior). Naming convention: total = actual+provisioned. */
  totalSpentCents: number;
  /** Actual (billed) spend only, USD cents. Additive — present once features-service lands. */
  actualSpentCents?: number;
  /** Open provisioned holds only, USD cents. Additive — present once features-service lands. */
  provisionedSpentCents?: number;
  /** "Budget spent today" = ACTUAL + PROVISIONED for runs since 00:00 UTC. Additive — read
   *  in preference to the legacy `todaySpentCents` once present. */
  totalSpentTodayCents?: number;
  /** Actual (billed) spend today only, USD cents. Additive. */
  actualSpentTodayCents?: number;
  /** Provisioned holds today only, USD cents. Additive. */
  provisionedSpentTodayCents?: number;
  /** LEGACY actual-only today spend. Optional for rollout: features-service renames it to
   *  `actualSpentTodayCents`; render `totalSpentTodayCents ?? todaySpentCents`. */
  todaySpentCents?: number;
  /** Per cost-name actual spend + share-of-total, descending — the "top cost sources" list. */
  sources: SpendSource[];
  /** CPC = (ACTUAL + PROVISIONED) / clicks (committed). Additive — read in preference to the
   *  legacy `cpcCents` once present. Null (renders "—"), never a false $0. */
  totalCpcCents?: number | null;
  /** Actual-only CPC, USD cents. Additive. */
  actualCpcCents?: number | null;
  /** Provisioned-only CPC, USD cents. Additive. */
  provisionedCpcCents?: number | null;
  /** LEGACY actual-only CPC. Optional for rollout: features-service renames it to
   *  `actualCpcCents`; render `totalCpcCents ?? cpcCents`. */
  cpcCents?: number | null;
  /** REAL tracked signup count (attributed + deduped) from the brand's live conversion
   *  tracker — features-service sources it from lead-service. Additive/optional: absent on a
   *  pre-rollout payload → the beta Signups card renders "—" + setup CTA. `0` is a real value. */
  signupsCount?: number;
  /** REAL tracked sales-meeting-booked count (attributed + deduped) from the live tracker.
   *  Additive/optional; absent → the beta Sales Meetings card renders "—" + setup CTA. */
  salesMeetingsCount?: number;
  /** REAL cost per signup, USD cents = committed spend (actual+provisioned) ÷ `signupsCount`.
   *  Recomputed from live tracker data (the old PROJECTED cpsCents was removed in
   *  features-service#406). null when `signupsCount` is 0 (no denominator) → CPS card "—". */
  cpsCents?: number | null;
  /** REAL cost per sales meeting booked, USD cents = committed spend ÷ `salesMeetingsCount`.
   *  Recomputed from live tracker data. null when `salesMeetingsCount` is 0 → CPSM card "—". */
  cpsmCents?: number | null;
  /** REAL attributed positive-reply count for the brand (single-step `positive_replies` goal).
   *  Additive/optional — absent until features-service ships it (spawned in lockstep); until
   *  then the Positive Replies card renders "—". `0` is a real value. */
  positiveRepliesCount?: number;
  /** REAL cost per positive reply, USD cents = committed spend ÷ `positiveRepliesCount`.
   *  Additive/optional; null when the count is 0 (no denominator) → the card renders "—",
   *  never a false $0. */
  cpprCents?: number | null;
  /** REAL tracked form-submission count (attributed + deduped) from the live conversion
   *  tracker — the form_submissions goal outcome, sibling of `signupsCount`. Additive/optional;
   *  absent → the beta Form submissions card renders "—" + setup CTA. `0` is a real value. */
  formSubmissionsCount?: number;
  /** REAL cost per form submission, USD cents = committed spend ÷ `formSubmissionsCount`.
   *  null when `formSubmissionsCount` is 0 (no denominator) → the CPFS card renders "—". */
  cpfsCents?: number | null;
  /** REAL tracked SALE (paying-client won) count — terminal outcome of the website_purchase
   *  goal (multi-step close) AND the combined sales goal. Additive/optional; absent → the
   *  Sales card renders "—". */
  salesCount?: number;
  /** REAL cost per sale, USD cents = committed spend ÷ `salesCount`.
   *  null when `salesCount` is 0 → the cost card renders "—". */
  cpSaleCents?: number | null;
}

/**
 * One day of the brand's return-on-spend curve. BOTH legs are cumulative since the
 * brand's first spend and both are REALIZED — spend dated by runs' own cost buckets,
 * pipeline by the per-lead event timestamps. Nothing is spread, smoothed or modelled,
 * which is what makes the curve safe to show as a result rather than a forecast.
 */
export interface RoiHistoryPoint {
  /** UTC calendar day (YYYY-MM-DD). */
  date: string;
  cumulativeSpendUsd: number;
  cumulativePipelineUsd: number;
  /**
   * `cumulativePipelineUsd / cumulativeSpendUsd`. Null — never 0 — on a day whose
   * cumulative spend is still 0: "could not be measured", not "returned nothing".
   */
  roiMultiple: number | null;
}

export interface RoiHistory {
  /** One point per UTC day that has spend or a dated outcome, ascending. A day with
   *  neither is ABSENT rather than fabricated, so the series can have gaps. */
  daily: RoiHistoryPoint[];
  /** The curve's final cumulative pipeline — the part of `totalPipelineUsd` it describes. */
  datedPipelineUsd: number;
  /** Pipeline counted in the headline whose outcome carries no timestamp, so it sits on
   *  no day. `datedPipelineUsd + undatedPipelineUsd === totalPipelineUsd`. */
  undatedPipelineUsd: number;
}

/** Everything the overview + conversions pages render at a feature, offer or brand grain. */
export interface RevenueOverview {
  /** The acquisition channel this answer is about, present ONLY on the per-feature read.
   *  Absent at the offer and brand grains, which span several channels. No consumer
   *  reads it. */
  featureSlug?: string;
  /** Org-deduped expected pipeline. Null when there are no saved economics. */
  totalPipelineUsd: number | null;
  /** Cost economics from features-service (total spend + derived CAC % + ROI ×). */
  costEconomics: CostEconomics;
  /**
   * Return on spend across the brand's whole life — what the brand Overview charts.
   *
   * Null when features-service could not build it (it is fail-soft there on purpose: a
   * curve must never 502 an Overview whose every other number is correct) and on a
   * lensed read. `daily` can legitimately be empty for a brand with neither spend nor a
   * dated outcome.
   */
  roiHistory?: RoiHistory | null;
  /**
   * The steps walked in order, or null when there is no one path to walk (brand and
   * offer grains, a lensed read). A campaign is the surface that gets a value.
   */
  stepWalk?: StepWalk | null;
  /**
   * Canonical spend block (Total spent / today / top sources / CPC / CPS / CPSM),
   * server-computed + reconciled to runs ACTUAL spend. Present on the un-lensed
   * overview; null on a lensed response. Optional in the view-model so a cold /
   * pre-rollout payload (absent block) degrades the cost card gracefully.
   */
  spend?: Spend | null;
  /**
   * Server-computed contacted aggregate — the single source for the Outreach stat
   * card + the 7-day graph actual. Optional: absent on a cold / pre-rollout payload
   * (degrade the card to the legacy /stats outreach count, the graph to /pipeline-
   * activity actual). Populated in prod (features-service v0.62.0).
   */
  outreachContacted?: OutreachContacted;
  /**
   * Per-day outreach VOLUME — email sequences launched per day, UNDEDUPED by lead
   * (instantly campaigns-created, features-service#416). The single source for the
   * Overview "Outreach" stat card (`total`) AND the 7-day graph's ACTUAL outreach
   * bars. Distinct from `outreachContacted` (distinct leads reached): re-contacts
   * count here but not there, so `sequences.total >= outreachContacted.total` BY
   * DESIGN — the two grains are not reconciled. Optional: absent on a pre-#416
   * payload, where the card + graph fall back to `outreachContacted`. Overview
   * response only (null on a lensed response, absent on a grouped one).
   */
  sequences?: SignalSeries;
  /**
   * Positive/negative-agnostic OPEN actual series (features-service#416
   * `recipientsOpened`, normalized from the legacy `opened`). Optional during
   * rollout; no per-day-opens consumer wired yet, carried for completeness.
   */
  opened?: SignalSeries;
  /**
   * Server-computed actual series from the SAME `/revenue` `leads[]` snapshot as
   * `outreachContacted`: Clicks and observed goal outcomes. Optional
   * during backend rollout; when absent the chart keeps legacy pipeline-activity
   * actuals for that series.
   */
  clicked?: SignalSeries;
  /**
   * Positive-reply ACTUAL series — the meeting-goal engagement signal (a screened
   * positive reply = a buyer conversation; the booked-meetings lens's P=replyToMeeting
   * signal, and the cost-per-positive-reply headline). Same shape as the others,
   * server-computed from the SAME leads[] snapshot (features-service). Optional
   * during backend rollout; absent → the meeting-goal positive-reply line/bars render
   * empty until features-service ships it.
   */
  repliedPositive?: SignalSeries;
  meetingsBooked?: SignalSeries;
  purchased?: SignalSeries;
  timeSeries: RevenuePoint[];
  organizations: ConversionOrg[];
  events: ConversionEvent[];
  /**
   * Leads that have REACHED SOMETHING — one entry per lead carrying at least one
   * realized outcome, never the whole contacted population.
   *
   * This replaces a `leads: ConversionLead[]` that held every lead the brand ever
   * contacted, fully hydrated, and it is the reason the dashboard stopped painting
   * instantly. Measured in prod (brand `75d7e3e8`, 2026-08-31): `/revenue` answers
   * **10,903,573 bytes**, of which **10,860,781** are that array — 9,854 rows, each
   * carrying a name, a photo URL, an org, a logo, tags, a seniority, an industry, an
   * employee count. Everything else on the body (the headline, the economics, the spend
   * block, every count series, the ROI history, the step walk) is 43KB.
   *
   * The persisted cache refuses any snapshot over `MAX_PERSISTED_ENTRY_BYTES` (2MB,
   * persist-cache.ts), so `brandRevenue` / `offerRevenue` /
   * `featureRevenue` were never written to disk — and those three keys are what every
   * money card, the Return-on-spend chart and the cost card read. Nothing errored: the
   * reveal gates are settle-based and correct, the network answered, the numbers were
   * right. Those surfaces simply cold-skeletoned on EVERY load, on every brand, offer,
   * and campaign page, while the small reads beside them (the Offers table's
   * `brandOfferMoney`, 118KB) painted from disk instantly. That contrast IS the bug
   * report.
   *
   * Only TWO browser surfaces read per-lead rows and both do the same thing with them:
   * build a `leadId → outcome` MAP (the Leads page's outcome tab + its detail panel, and
   * the lead board's stages). A lead carrying no outcome is looked up and
   * found absent, which is byte-identical to it not being in the array at all — so
   * carrying it costs 10.8MB to say nothing. On the brand that surfaced this: **72 of
   * 9,854** leads carry an outcome, and they serialize to **19,720 bytes**.
   *
   * ⚠️ This does not shrink the WIRE: 10.9MB still crosses the network and is still
   * `JSON.parse`d by `fetch` before this parser ever runs. Only features-service can fix
   * that, by not hydrating every contacted lead on a read that asked for money. Filed as
   * the follow-up.
   */
  leadOutcomes: LeadOutcome[];
  /**
   * Which per-lead outcome fields the producer SERVES on this body — a fact about the
   * payload, not about any lead.
   *
   * The Leads page shows an outcome tab only once features-service actually attributes
   * that outcome (`#476`), and it used to answer that by asking whether ANY lead row
   * carried the key. Now that `leadOutcomes` holds only the leads that reached
   * something, that question would silently change meaning — from "is attribution
   * wired" to "has anyone converted yet" — and a brand with the tracker live and zero
   * signups would lose a tab it should have. So the presence answer is computed once,
   * over the full array, before it is narrowed.
   */
  outcomeFieldsServed: LeadOutcomeField[];
  /**
   * WHEN THIS SCOPE'S FIGURES STOP BEING NOISE — served whole, divided by nobody
   * (features-service v0.165.0).
   *
   * Null wherever the producer states it cannot answer for this read: the lensed
   * `?lens=` body, the lean `?groupBy=` groups, the short-circuits and the
   * cold-start path — the same gate `spend` and `stepWalk` already ride. Null is
   * "this read carries no verdict", never "the scope is priced".
   */
  learningPhase?: LearningPhase | null;
  /**
   * WHAT ONE OUTCOME HAS COST, DAY BY DAY — served whole, divided by nobody
   * (features-service#980).
   *
   * `null` wherever the producer states it cannot build one: the lensed and grouped
   * bodies, a scope with no placeable leg, one whose leg carries no rate. Null is "this
   * read carries no curve", never "the outcome was free".
   */
  costPerOutcomeHistory?: CostPerOutcomeHistory | null;
  /**
   * HOW OFTEN THIS SCOPE CONVERTS, DAY BY DAY — served whole, divided by nobody
   * (features-service#992).
   *
   * Same gate and the same two absences as the curve above it. Null is "this read carries
   * no curve", never "it converts nothing" — the MEASURED zero lives on a point.
   */
  conversionRateHistory?: ConversionRateHistory | null;
}

/** One UTC day of the curve. BOTH legs are cumulative since the scope's first day. */
export interface CostPerOutcomePoint {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Every dollar of COMMITTED spend up to and including that day — the basis the return
   *  curve rides, so the two describe the same money. */
  cumulativeSpendUsd: number;
  /** Every outcome of this leg's step DATED up to that day. FRACTIONAL on a deeper leg,
   *  where it is the driver signal walked forward through the leg rates. */
  cumulativeOutcomes: number;
  /** `cumulativeSpendUsd / cumulativeOutcomes`. NULL — never 0 — while either is still 0:
   *  "could not be measured" and "cost nothing" are different statements. */
  costPerOutcomeUsd: number | null;
}

/** The whole answer, rendered verbatim — nothing here is divided or re-based. */
export interface CostPerOutcomeHistory {
  /** The step every count is denominated in. The producer's word, never one picked here. */
  outcomeStep: { key: string; label: string; description?: string };
  /** The leg that step closes, canonical. */
  legKey: string;
  /**
   * TRUE ⟺ the counts are raw OBSERVATIONS. FALSE means they were walked forward through
   * the leg rates from the signal we can observe, so the whole curve is a PROJECTION
   * — a different statement from a measured price, and this app does not let those two
   * share a label unremarked.
   */
  outcomeObserved: boolean;
  /** Ascending, one entry per day with spend or a dated outcome. Empty = neither yet. */
  daily: CostPerOutcomePoint[];
  /** The curve's final cumulative count — the part of the scope's count it describes. */
  datedOutcomes: number;
  /** Outcomes counted in the scope's total whose signal carries no timestamp, so they sit
   *  on no day. Reported rather than dropped: dated + undated is the whole count — and it
   *  is exactly why a browser could never have divided this curve out for itself. */
  undatedOutcomes: number;
}

/** One day of the conversion curve. Cumulative from the scope's first reach. */
export interface ConversionRatePoint {
  date: string;
  cumulativeContacted: number;
  /** Fractional on a deeper leg — see {@link ConversionRateHistory.outcomeObserved}. */
  cumulativeOutcomes: number;
  /**
   * `100 * cumulativeOutcomes / cumulativeContacted`.
   *
   * NULL means NO DENOMINATOR — nobody had been reached yet, so there is no rate to
   * state. `0` is a MEASURED zero: people were reached and none of them converted.
   *
   * ⚠️ The opposite polarity to `CostPerOutcomePoint.costPerOutcomeUsd`, which nulls at
   * zero OUTCOMES. Both are the producer's own rule and both are right; they only look
   * inconsistent because the two cards sit side by side.
   */
  conversionRatePct: number | null;
}

/** The whole answer, rendered verbatim — nothing here is divided or re-based. */
export interface ConversionRateHistory {
  /** The step the rate converts TO. The producer's word, never one picked here. */
  outcomeStep: { key: string; label: string; description?: string };
  /** The leg that step closes, canonical. */
  legKey: string;
  /** TRUE ⟺ the outcome counts are raw OBSERVATIONS; FALSE means the curve is a
   *  PROJECTION walked forward through the leg rates, which the card states. */
  outcomeObserved: boolean;
  /** Ascending, one entry per day the scope reached someone or converted one. */
  daily: ConversionRatePoint[];
  /** The population the CURVE covers — people and outcomes carrying a timestamp. */
  datedContacted: number;
  datedOutcomes: number;
  /**
   * Counted in the scope's totals and sitting on NO day, so the curve's last point
   * legitimately differs from {@link scopeConversionRatePct} whenever either is non-zero.
   * Stated rather than hidden, and neither leg is floored onto the other.
   */
  undatedContacted: number;
  undatedOutcomes: number;
  /** The WHOLE scope's rate — the headline. Served precisely so no browser divides two
   *  of the producer's fields to obtain it. Null when there is no denominator at all. */
  scopeConversionRatePct: number | null;
}

/**
 * Five verdicts, and the middle three are the ones the browser used to collapse into
 * one — which is how a countdown reached zero while the outcomes had not arrived.
 *
 * `learning_limited` is NOT terminal: the spend target is reached and the outcomes are
 * still landing, which is what {@link LearningPhase.outcomeLagDays} is for.
 */
export type LearningStatus =
  | "priced"
  | "learning"
  | "learning_limited"
  | "paused"
  | "unmeasured";

/**
 * WHICH ingredient is missing, when the producer cannot say.
 *
 * Read as a plain string union rather than a `z.enum`, the same way the step and
 * channel-family vocabularies are: the producer is free to name a new reason, and a
 * reader that closes the set throws on the body the day it does. An unknown token
 * renders as the generic sentence rather than blanking the band.
 */
export type LearningUnmeasuredReason =
  | "no_campaigns"
  | "campaigns_unreadable"
  | "no_leg_stated"
  | "no_outcome_evidence"
  | "leg_unpriceable"
  | "no_expected_price"
  | "no_daily_ceiling"
  | (string & {});

/** What raising the ceiling to this figure would leave. Same unit as `daysRemaining`. */
export interface LearningCeilingScenario {
  dailyCeilingUsd: number;
  daysRemaining: number;
}

/** ONE campaign of the scope, with its own count — so a reader can SEE why the verdict reads so. */
export interface LearningPhaseCampaign {
  campaignId: string;
  campaignIds: string[];
  campaignIdentityKey: string | null;
  legKey: string | null;
  outcomeStep: { key: string; label: string; description?: string } | null;
  /** `null` is "we could not count this"; `0` is a measurement. */
  outcomesObserved: number | null;
  outcomeObserved: boolean;
  live: boolean;
}

/** The whole answer, rendered verbatim — nothing here is divided, minimised or joined. */
export interface LearningPhase {
  status: LearningStatus;
  /** Present ⟺ `status === "unmeasured"`. */
  unmeasuredReason: LearningUnmeasuredReason | null;
  /** The LEADING campaign — whose countdown this is. */
  campaignId: string | null;
  campaignIdentityKey: string | null;
  legKey: string | null;
  outcomeStep: { key: string; label: string; description?: string } | null;
  outcomesObserved: number | null;
  outcomesRequired: number;
  progressPct: number | null;
  outcomeObserved: boolean;
  /** Pooled over the cells that OBSERVED an outcome. Null = every figure we hold is a floor. */
  expectedCostPerOutcomeUsd: number | null;
  spendTargetUsd: number | null;
  committedSpentUsd: number | null;
  spendRemainingUsd: number | null;
  dailyCeilingUsd: number | null;
  /** Whole days at the current ceiling. Null on every status but `learning`. */
  daysRemaining: number | null;
  ceilingScenarios: LearningCeilingScenario[];
  /** Why reaching the spend target is not reaching the outcomes. */
  outcomeLagDays: number;
  campaigns: LearningPhaseCampaign[];
}

/**
 * A revenue body parsed WITH its full per-lead array. Server-side only — the
 * outcome-digest cron, which names each person and what they did on the day, so it
 * genuinely needs the names, photos and orgs. It runs on its own schedule, so the
 * payload never touches a browser, a poll or the persisted cache.
 *
 * Do NOT reach for this from a component: use `leadOutcomes` if you need outcomes, or
 * lead-service (`listBrandLeads`) if you need people — that read is scoped and already
 * persisted under its own key.
 */
export interface RevenueOverviewWithLeads extends RevenueOverview {
  leads: ConversionLead[];
}
