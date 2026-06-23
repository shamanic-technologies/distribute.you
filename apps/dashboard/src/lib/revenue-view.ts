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
  /** Most-advanced event date; null until per-event timestamps exist. */
  date: string | null;
}

/** One day of the server-computed contacted-lead series (ascending). */
export interface OutreachContactedDay {
  /** UTC calendar day (YYYY-MM-DD) of the contacted-lead bucket. */
  date: string;
  /** Number of leads first contacted on this UTC day. */
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
  daily: OutreachContactedDay[];
  /** Contacted leads with a null contactedAt (counted in total, in no day bucket). */
  undatedCount: number;
}

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
 * documented null semantics. `totalCostUsd` is real (>= 0) even when pipeline is null.
 */
export interface CostEconomics {
  /** Total run cost in $, brand (+ optional campaign), feature-scoped. */
  totalCostUsd: number;
  /** (totalCostUsd / totalPipelineUsd) * 100. Null when pipeline is null or 0. */
  costOfAcquisitionPct: number | null;
  /** totalPipelineUsd / totalCostUsd. Null when cost is 0 or pipeline is null. */
  roiMultiple: number | null;
  /**
   * Lens-only: expected outcome COUNT = Σ per-lead probability across the lensed
   * leads. Present only on a `?lens=` response; absent on the un-lensed overview.
   * features-service is the single source — the dashboard never derives it.
   */
  expectedConversions?: number | null;
  /** Lens-only: `totalCostUsd / expectedConversions`; null when expectedConversions is 0. */
  costPerConversionUsd?: number | null;
}

/** Everything the overview + conversions pages render for a feature+brand. */
export interface RevenueOverview {
  featureSlug: string;
  /** Org-deduped expected pipeline. Null when no funnel is wired / no saved economics. */
  totalPipelineUsd: number | null;
  /** Cost economics from features-service (total spend + derived CAC % + ROI ×). */
  costEconomics: CostEconomics;
  /**
   * Server-computed contacted aggregate — the single source for the Outreach stat
   * card + the 7-day graph actual. Optional: absent on a cold / pre-rollout payload
   * (degrade the card to the legacy /stats outreach count, the graph to /pipeline-
   * activity actual). Populated in prod (features-service v0.62.0).
   */
  outreachContacted?: OutreachContacted;
  timeSeries: RevenuePoint[];
  organizations: ConversionOrg[];
  leads: ConversionLead[];
  events: ConversionEvent[];
}
