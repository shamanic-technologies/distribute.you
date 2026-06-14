// Which features expose the revenue overview + conversions surfaces.
//
// Gate the FAMILY here, never a per-slug `===` scattered across consumers — when a
// new feature gets its own funnel economics, add its slug here once (CLAUDE.md: a
// slug re-version rots every hardcoded-slug consumer). Today only sales-cold-email
// has saved economics + the visit/reply channels the calc lib understands.

export const REVENUE_FEATURES: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
]);

/** True when a feature has a revenue overview + conversions surface. */
export function isRevenueFeature(featureSlug: string): boolean {
  return REVENUE_FEATURES.has(featureSlug);
}
