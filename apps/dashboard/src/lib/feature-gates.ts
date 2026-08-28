/**
 * What survives of the dashboard's maturity gating.
 *
 * The FEATURE_GATES registry and `useFeatureFlag` are GONE from this app. Since the
 * admin/dashboard split (2026-06-14) the hook returned `false` unconditionally here,
 * so a gate did not STAGE a surface, it REMOVED it: every gated entry was hidden from
 * everyone, staff included, and its page was reachable only by typing a URL. Brand
 * Info, Workflows and the Google CRM console all sat that way for months and were
 * deleted; they live in `apps/admin`, where the gate resolves against PostHog.
 *
 * So there is no way to alpha-gate a dashboard surface, and that is deliberate: the
 * public dashboard is GA-only. A surface that needs a limited audience here goes
 * behind the EMAIL allowlist (`beta-allowlist.ts` + `useIsBetaUser`), which actually
 * evaluates, and carries a visible `<MaturityBadge level="beta" />`.
 */

/** Maturity levels a badge can state. `alpha` is admin-only; the dashboard ships beta and GA. */
export type Maturity = "alpha" | "beta";

/**
 * Brand-page features that are GA — always rendered, no gate, no badge.
 *
 * Read by `sole-feature.ts` to resolve the one feature a brand's surfaces are about.
 * A feature graduates by being added here.
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
