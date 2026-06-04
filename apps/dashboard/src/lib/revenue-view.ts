// View-model types for the feature revenue overview + conversions page.
//
// These are what the UI renders. They are produced today by `revenue-sample.ts`
// (sample data driven through the `revenue.ts` calc lib) and will be produced for
// real by an adapter over features-service `GET /v1/features/{slug}/revenue` once
// that endpoint deploys (verify the wire shape via api-registry, then `safeParse`).
//
// Identity/display fields (names, photos, org logo) come from lead-service; EV
// numbers come from the calc lib; per-event dates come from email-gateway (pending).

import type { RevenuePoint } from "./revenue";

/** One person row (lead table) with the org they belong to. */
export interface ConversionLead {
  personId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  orgId: string;
  orgName: string;
  orgLogoUrl: string | null;
  /** Channels this person triggered (multi-tag). */
  channels: string[];
  /** person_EV — max across their channels. */
  expectedRevenueUsd: number;
  /** Most-advanced event date for the person. */
  eventDate: string | null;
}

/** One organisation row (org table = overview + Organizations tab), deduped. */
export interface ConversionOrg {
  orgId: string;
  orgName: string;
  orgLogoUrl: string | null;
  /** The most-likely person — argmax person_EV. */
  topLead: ConversionLead | null;
  /** Union of channels across the org (multi-tag). */
  channels: string[];
  /** org_EV — max across the org's people (1 org = 1 client). */
  expectedRevenueUsd: number;
  /** Most-advanced event date across the org. */
  mostAdvancedDate: string | null;
}

/** One raw conversion event (Events tab), single channel tag. */
export interface ConversionEvent {
  eventId: string;
  personId: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  orgName: string;
  orgLogoUrl: string | null;
  /** Single channel for this event. */
  channel: string;
  eventDate: string;
  /** This event's EV contribution = LTR × P(paid | channel). */
  contributionUsd: number;
}

/** Everything the revenue overview + conversions page renders for a feature+brand. */
export interface RevenueOverview {
  /** SUM of org EVs across distinct orgs. */
  totalPipelineUsd: number;
  /** Cumulative revenue-over-time points (sorted by date). */
  series: RevenuePoint[];
  /** Pipeline that has no date yet (can't be placed on the time axis) — surfaced, not dropped. */
  undatedPipelineUsd: number;
  /** Org-level rows (deduped) — the overview table + Organizations tab. */
  orgs: ConversionOrg[];
  /** Person-level rows — the Leads tab. */
  leads: ConversionLead[];
  /** Raw event rows — the Events tab. */
  events: ConversionEvent[];
}
