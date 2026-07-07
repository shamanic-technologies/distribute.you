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
 * (single source). Always present on a 200; the two ratios are null per the
 * documented null semantics. `actualCostUsd` is real (>= 0) even when pipeline is null.
 */
export interface CostEconomics {
  /** ACTUAL (billed) run cost in $, brand (+ optional campaign), feature-scoped. ROI/CAC
   *  ride realized spend, so this EXCLUDES provisioned holds (renamed from the ambiguous
   *  `totalCostUsd` — features-service#402). */
  actualCostUsd: number;
  /** (actualCostUsd / totalPipelineUsd) * 100. Null when pipeline is null or 0. */
  costOfAcquisitionPct: number | null;
  /** totalPipelineUsd / actualCostUsd. Null when cost is 0 or pipeline is null. */
  roiMultiple: number | null;
  /**
   * Lens-only: expected outcome COUNT = Σ per-lead probability across the lensed
   * leads. Present only on a `?lens=` response; absent on the un-lensed overview.
   * features-service is the single source — the dashboard never derives it.
   */
  expectedConversions?: number | null;
  /** Lens-only: `actualCostUsd / expectedConversions`; null when expectedConversions is 0. */
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
}

/** Everything the overview + conversions pages render for a feature+brand. */
export interface RevenueOverview {
  featureSlug: string;
  /** Org-deduped expected pipeline. Null when no funnel is wired / no saved economics. */
  totalPipelineUsd: number | null;
  /** Cost economics from features-service (total spend + derived CAC % + ROI ×). */
  costEconomics: CostEconomics;
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
  leads: ConversionLead[];
  events: ConversionEvent[];
}
