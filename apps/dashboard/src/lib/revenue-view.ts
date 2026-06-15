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
  /** Most-advanced event date; null until per-event timestamps exist. */
  date: string | null;
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
  timeSeries: RevenuePoint[];
  organizations: ConversionOrg[];
  leads: ConversionLead[];
  events: ConversionEvent[];
}
