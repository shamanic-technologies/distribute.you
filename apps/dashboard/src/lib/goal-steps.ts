import type { BrandOptimizationGoal } from "@/lib/api";

/**
 * Per-goal funnel STEPS — the single source every goal-aware surface reads so the
 * stat cards, Leads-page tabs, table columns, and the Outreach-activity graph all
 * show the SAME steps for a brand's optimization goal (never a step off the goal's
 * funnel, never an omitted one). Replaces the scattered `isVisitDrivenGoal(...)`
 * binary that mis-labelled the newer goals (form_submissions/purchase/positive_replies
 * borrowed the Signups/Sales-Meetings surfaces — the "half-wired goal" trap, CLAUDE.md
 * "~8 dashboard surfaces").
 *
 * A step is ordered base→outcome (Outreach first, the goal's outcome last). Each step
 * declares how it maps onto each surface:
 *  - `signal` / `tab` / `chartKey` — the per-lead engagement signal (Outreach = contacted,
 *    Website Visits = clicked, Positive replies = repliedPositive). These have per-lead
 *    booleans (Leads tabs + table) AND a daily series (activity graph) TODAY.
 *  - `outcome` — a downstream tracker outcome (Signups / Sales Meetings / Form submissions
 *    / Sales). Available as a brand-level aggregate COUNT + COST on the features-service
 *    `/revenue` `spend` block (stat cards). NOT attributed per-lead yet for signup/form, so
 *    outcome steps do NOT drive the Leads tabs / table / graph (per-lead attribution is a
 *    features-service follow-up); `countField: null` when even the aggregate is absent.
 *
 * 1-step goals (website_visits, positive_replies) have NO separate outcome step: the
 * visit / reply IS the outcome, already surfaced by its signal step.
 */

/** Leads-page tab key for a lead-signal step (engagement signals). */
export type LeadTab = "outreach" | "clicks" | "positive-replies";
/** Leads-page tab key for a realized-outcome step (per-lead conversion). */
export type OutcomeTab = "signups" | "meetings" | "form-submissions" | "sales";
/** Any Leads-page tab. */
export type AnyLeadTab = LeadTab | OutcomeTab;
/**
 * Per-lead realized-outcome field names on the features-service `/revenue` `leads[]`
 * rows (features-service#476). The dashboard buckets an outcome tab by the boolean
 * and sorts/dates it by the timestamp.
 */
export type OutcomeLeadField = "signup" | "meetingBooked" | "formSubmission" | "purchased";
export type OutcomeLeadDateField =
  | "signupAt"
  | "meetingBookedAt"
  | "formSubmissionAt"
  | "purchasedAt";
/** Activity-chart metric key for a step with a daily series. */
export type ChartMetricKey = "outreach" | "clicks" | "repliedPositive" | "formSubmissions";
/** Aggregate count/cost fields on the features-service `/revenue` `spend` block. */
type SpendCountField =
  | "signupsCount"
  | "salesMeetingsCount"
  | "formSubmissionsCount"
  | "salesCount";
type SpendCostField = "cpsCents" | "cpsmCents" | "cpfsCents" | "cpSaleCents";

export interface GoalStep {
  /** Stable step id (also the outcome key). */
  key:
    | "outreach"
    | "website_visits"
    | "positive_replies"
    | "signups"
    | "sales_meetings"
    | "form_submissions"
    | "website_purchase"
    | "sales";
  /** User-facing step label. */
  label: string;
  /** Accent colour (activity-chart bar + surface accents). */
  color: string;
  /** Per-lead engagement signal (Leads tab + activity bar). Absent on outcome steps. */
  signal?: "contacted" | "clicked" | "repliedPositive";
  /** Leads-page tab key when this step is a lead signal. */
  tab?: LeadTab;
  /** Activity-chart metric key when this step has a daily series. */
  chartKey?: ChartMetricKey;
  /**
   * Stat-card aggregate binding (downstream tracker outcome). `countField: null`
   * when even the brand-level count is not on the wire yet (purchase) → the card
   * renders "—". `costField: null` likewise → cost card "—".
   */
  outcome?: {
    countField: SpendCountField | null;
    costField: SpendCostField | null;
    costLabel: string;
    /**
     * Realized-outcome Leads-page tab for this step (features-service#476 per-lead
     * attribution). When present, the Leads page prepends this tab — leftmost +
     * default — ONLY when the `/revenue` join actually serves `leadField` for the
     * brand (else the tab is hidden; no empty tab pre-attribution). `leadField` /
     * `dateField` name the per-lead boolean + timestamp on the `/revenue` row.
     */
    tab: OutcomeTab;
    leadField: OutcomeLeadField;
    dateField: OutcomeLeadDateField;
  };
}

const OUTREACH_STEP: GoalStep = {
  key: "outreach",
  label: "Outreach",
  color: "#334155",
  signal: "contacted",
  tab: "outreach",
  chartKey: "outreach",
};
const VISITS_STEP: GoalStep = {
  key: "website_visits",
  label: "Website Visits",
  color: "#0891b2",
  signal: "clicked",
  tab: "clicks",
  chartKey: "clicks",
};
const REPLIES_STEP: GoalStep = {
  key: "positive_replies",
  label: "Positive replies",
  color: "#dc2626",
  signal: "repliedPositive",
  tab: "positive-replies",
  chartKey: "repliedPositive",
};
const SIGNUPS_OUTCOME: GoalStep = {
  key: "signups",
  label: "Signups",
  color: "#7c3aed",
  outcome: {
    countField: "signupsCount",
    costField: "cpsCents",
    costLabel: "CPS",
    tab: "signups",
    leadField: "signup",
    dateField: "signupAt",
  },
};
const MEETINGS_OUTCOME: GoalStep = {
  key: "sales_meetings",
  label: "Sales Meetings",
  color: "#7c3aed",
  outcome: {
    countField: "salesMeetingsCount",
    costField: "cpsmCents",
    costLabel: "CPSM",
    tab: "meetings",
    leadField: "meetingBooked",
    dateField: "meetingBookedAt",
  },
};
// Form submissions have a brand-level aggregate (stat card) AND a daily series
// (features-service serves `metrics.formSubmissions`, so the activity graph plots a
// Form-submissions bar) — but no per-lead attribution yet, so no Leads tab (`tab`
// absent). The `chartKey` gives it the daily bar without a per-lead surface.
const FORM_OUTCOME: GoalStep = {
  key: "form_submissions",
  label: "Form submissions",
  color: "#7c3aed",
  chartKey: "formSubmissions",
  outcome: {
    countField: "formSubmissionsCount",
    costField: "cpfsCents",
    costLabel: "CPFS",
    tab: "form-submissions",
    leadField: "formSubmission",
    dateField: "formSubmissionAt",
  },
};
// The website_purchase terminal outcome — SAME wire fields as the combined-sales SALE
// outcome (salesCount + cpSaleCents, per-lead `purchased`/`purchasedAt`) but its OWN
// user-facing labels: "Website purchase" / "Cost per purchase". Distinct from the
// combined `sales` goal (which keeps "Sales"/"CP Sale") per CLAUDE.md #2921 — the two
// goals are different concepts, so their stat-card boxes must not both read "Sales".
const PURCHASE_OUTCOME: GoalStep = {
  key: "website_purchase",
  label: "Website purchase",
  color: "#7c3aed",
  outcome: {
    countField: "salesCount",
    costField: "cpSaleCents",
    costLabel: "Cost per purchase",
    tab: "sales",
    leadField: "purchased",
    dateField: "purchasedAt",
  },
};
// The terminal SALE outcome — the combined sales goal (paying client via either path).
// The wire spend block serves salesCount + cpSaleCents (features-service combined-sales
// slice); the per-lead boolean/timestamp keep their wire names `purchased`/`purchasedAt`.
const SALE_OUTCOME: GoalStep = {
  key: "sales",
  label: "Sales",
  color: "#7c3aed",
  outcome: {
    countField: "salesCount",
    costField: "cpSaleCents",
    costLabel: "CP Sale",
    tab: "sales",
    leadField: "purchased",
    dateField: "purchasedAt",
  },
};

/** Ordered funnel steps (base → outcome) for a brand's optimization goal. */
export function goalSteps(goal: BrandOptimizationGoal): GoalStep[] {
  switch (goal) {
    case "website_visits":
      return [OUTREACH_STEP, VISITS_STEP];
    case "positive_replies":
      return [OUTREACH_STEP, REPLIES_STEP];
    case "signups":
      return [OUTREACH_STEP, VISITS_STEP, SIGNUPS_OUTCOME];
    case "form_submissions":
      return [OUTREACH_STEP, VISITS_STEP, FORM_OUTCOME];
    case "website_purchase":
      // Multi-step self-serve close: visit → purchase.
      return [OUTREACH_STEP, VISITS_STEP, PURCHASE_OUTCOME];
    case "sales":
      // Combined goal: a sale via EITHER the visit OR the reply path.
      return [OUTREACH_STEP, VISITS_STEP, REPLIES_STEP, SALE_OUTCOME];
    case "sales_meetings":
      return [OUTREACH_STEP, VISITS_STEP, REPLIES_STEP, MEETINGS_OUTCOME];
  }
}

/**
 * Leads-page tabs, OUTCOME-FIRST (deepest on-path signal leftmost = the default),
 * Outreach (the contacted base) last. Only the lead-signal steps (which have a
 * per-lead boolean today); outcome steps are excluded until per-lead attribution
 * lands. e.g. sales_meetings → ["positive-replies","clicks","outreach"],
 * website_visits → ["clicks","outreach"].
 */
export function goalLeadTabs(goal: BrandOptimizationGoal): LeadTab[] {
  return goalSteps(goal)
    .filter((s): s is GoalStep & { tab: LeadTab } => s.tab !== undefined)
    .map((s) => s.tab)
    .reverse();
}

/**
 * Activity-chart metrics, base→outcome (Outreach first). Only steps with a daily
 * series. sales_meetings shows BOTH clicks and positive replies (both on its path);
 * a 1-step goal shows only its single signal alongside Outreach.
 */
export function goalChartMetricKeys(goal: BrandOptimizationGoal): ChartMetricKey[] {
  return goalSteps(goal)
    .filter((s): s is GoalStep & { chartKey: ChartMetricKey } => s.chartKey !== undefined)
    .map((s) => s.chartKey);
}

/**
 * Chart metric keys that come from a downstream tracker OUTCOME step (the daily
 * series only carries data once the brand's site fires the conversion pixel) — so
 * these bars are hidden until the conversion tracker is live, mirroring the
 * signup/form-submission column gate in the audiences table (#2646). Today this is
 * the Form-submissions bar; any future outcome step that gains a `chartKey`
 * inherits the gate automatically. Engagement-signal bars (outreach/clicks/
 * repliedPositive) are NEVER tracker-dependent.
 */
export const TRACKER_DEPENDENT_CHART_KEYS: ReadonlySet<ChartMetricKey> = new Set(
  [SIGNUPS_OUTCOME, MEETINGS_OUTCOME, FORM_OUTCOME, PURCHASE_OUTCOME, SALE_OUTCOME]
    .filter((s): s is GoalStep & { chartKey: ChartMetricKey } => s.chartKey !== undefined)
    .map((s) => s.chartKey),
);

/**
 * The goal's downstream OUTCOME step for the stat card (Signups / Sales Meetings /
 * Form submissions / Purchases), or null for a 1-step goal whose outcome IS its
 * signal (website_visits, positive_replies) — those render no separate outcome card.
 */
export function goalOutcomeStep(goal: BrandOptimizationGoal): GoalStep | null {
  return goalSteps(goal).find((s) => s.outcome !== undefined) ?? null;
}

/**
 * The goal's realized-outcome Leads-page tab (features-service#476 per-lead
 * attribution) — `{ tab, label, leadField, dateField }` — or null for a 1-step goal
 * whose outcome IS its engagement signal (website_visits / positive_replies; already
 * a tab via `goalLeadTabs`). The Leads page prepends this tab leftmost + default,
 * gated on the `/revenue` join actually serving `leadField` for the brand.
 */
export function goalOutcomeTab(
  goal: BrandOptimizationGoal,
): { tab: OutcomeTab; label: string; leadField: OutcomeLeadField; dateField: OutcomeLeadDateField } | null {
  const step = goalOutcomeStep(goal);
  if (!step?.outcome) return null;
  return {
    tab: step.outcome.tab,
    label: step.label,
    leadField: step.outcome.leadField,
    dateField: step.outcome.dateField,
  };
}
