// Shape definitions for the public-report leads view.
//
// The actual view component is `./public-leads-view.tsx`, which is a
// bespoke port of the operator-side `(authed)/(dashboard)/.../leads/page.tsx`
// layout (flex container + in-container right side panel, mutually
// exclusive max-milestone tabs).
//
// These types live here (not next to the view) so the SERVER-side page at
// `app/report/[orgId]/[brandId]/[featureSlug]/leads/page.tsx` can import
// them without dragging the `"use client"` module graph into the server
// render path.

export interface LeadEmailSummary {
  subject: string;
  bodyText: string;
  sentAt: string;
  workflow: string;
}

export interface LeadRow {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  companyDomain: string;
  industry: string;
  country: string;
  city: string;
  /** Employee count on the lead's organization (FullLead.organization.estimatedNumEmployees).
   *  Used by the right-side panel "Organization" card. Null when unknown. */
  companyEmployees: number | null;
  linkedinUrl: string | null;
  /** Most-advanced milestone reached. Used by the table StatusBadge and the
   *  view's mutually-exclusive tab bucketing — a replied lead lives only
   *  in the Replied tab, not also in Clicked / Opened / Delivered / Sent.
   *  Mirror of `getLeadConsolidatedStatus(lead)` on the operator side. */
  status: string;
  /** Raw intake status (served / skipped / claimed / buffered). Tracked
   *  separately so the intake-side tabs and CSV stay distinguishable
   *  from the consolidated status, which shadows intake once an email
   *  milestone is hit. */
  intakeStatus: "buffered" | "skipped" | "claimed" | "served";
  emailStatus: string;
  workflow: string;
  campaignId: string;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: string | null;
  /** Lead's global suppression flags (lead-service `LeadDetail.global`).
   *  Surfaced as chips in the side panel next to the status row — same
   *  treatment as the operator-side `/orgs/.../leads` page. */
  globalBounced: boolean;
  globalUnsubscribed: boolean;
  /** Intake date. The only true per-milestone timestamp lead-service
   *  currently exposes — drives the default sort (most-recently intaken
   *  first) and the "Found" column. */
  servedAt: string | null;
  /** Last delivery / status event from lead-service. Kept on the row for
   *  CSV export + as a tooltip fallback. When backend ships per-milestone
   *  timestamps (DIS-28) the per-tab sort can switch to literal columns;
   *  until then, `servedAt` drives the global table sort. */
  lastDeliveredAt: string | null;
}
