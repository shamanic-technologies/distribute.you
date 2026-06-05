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

/** Everything the overview + conversions pages render for a feature+brand. */
export interface RevenueOverview {
  featureSlug: string;
  /** Org-deduped expected pipeline. Null when no funnel is wired / no saved economics. */
  totalPipelineUsd: number | null;
  timeSeries: RevenuePoint[];
  organizations: ConversionOrg[];
  leads: ConversionLead[];
  events: ConversionEvent[];
}
