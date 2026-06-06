/**
 * Feature maturity gating — single source of truth.
 *
 * Three maturity levels:
 *   - `alpha` → staff only (PostHog flag targeted at the staff email)
 *   - `beta`  → opt-in cohort (PostHog flag targeted at a beta cohort)
 *   - `ga`    → everyone — INTENTIONALLY ABSENT from this registry (no flag,
 *               always rendered)
 *
 * To gate a surface: add an entry here, then in the component
 *   `const ok = useFeatureFlag(FEATURE_GATES["<key>"].flag); if (!ok) return null;`
 * and render `<MaturityBadge level={FEATURE_GATES["<key>"].maturity} />`.
 *
 * Graduation needs no redeploy for the audience change — flip the flag's
 * targeting in the PostHog UI (email → cohort → 100%). Code only changes to
 * relabel the maturity or to fully GA-ify (delete the flag + drop the gate).
 *
 * Flag naming convention: `<maturity>-<surface>` (e.g. `alpha-services-crm`).
 */

export type Maturity = "alpha" | "beta";

export interface FeatureGate {
  /** PostHog feature-flag key. */
  flag: string;
  /** Maturity level — drives the badge shown to viewers who can see the surface. */
  maturity: Maturity;
}

export const FEATURE_GATES = {
  "services-crm": { flag: "alpha-services-crm", maturity: "alpha" },
  keys: { flag: "alpha-keys", maturity: "alpha" },
  "brand-info": { flag: "alpha-brand-info", maturity: "alpha" },
  "brand-features": { flag: "alpha-brand-features", maturity: "alpha" },
  conversions: { flag: "alpha-conversions", maturity: "alpha" },
  // Workflows page (brand-scoped + app-level) and its sidebar entries. The
  // Feature Settings sub-level that hosts Workflows is GA; only Workflows itself
  // stays staff-only, so the flag is named for the surface it actually gates.
  workflows: { flag: "alpha-workflows", maturity: "alpha" },
} as const satisfies Record<string, FeatureGate>;

export type FeatureGateKey = keyof typeof FEATURE_GATES;

/**
 * Brand-page features that are GA — always rendered, no flag, no badge.
 *
 * Every OTHER feature on a brand overview page (sidebar list + body grid)
 * renders under the `brand-features` alpha gate (staff-only). Consumed by both
 * surfaces so they stay in lockstep — single source of truth. Graduate a
 * feature by adding its slug here (then drop the whole gate once the
 * `brand-features` flag goes GA).
 */
export const GA_BRAND_FEATURES: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
]);

/** Tailwind pill classes per maturity level. Saturated fills so the tag reads
 * clearly against the white sidebar (pale amber-on-amber was too faint). */
export const MATURITY_STYLES: Record<Maturity, string> = {
  alpha: "bg-amber-400 text-amber-950",
  beta: "bg-violet-500 text-white",
};
