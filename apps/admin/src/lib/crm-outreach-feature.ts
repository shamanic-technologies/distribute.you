// The feature whose people come from the org's OWN uploaded CRM contacts
// (crm-service) rather than a provider search. Byte-equal to the slug
// features-service seeds and to human-service's CRM_OUTREACH_FEATURE_SLUG.
//
// Gate every CRM-specific surface on this helper, never on a `slug === "..."`
// literal scattered per component — a slug re-version rots every hardcoded copy
// silently (tsc + tests stay green on a stale literal).
export const CRM_OUTREACH_FEATURE_SLUG = "sales-crm-email-outreach";

export function isCrmOutreachFeature(slug: string | null | undefined): boolean {
  return slug === CRM_OUTREACH_FEATURE_SLUG;
}
