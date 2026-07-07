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
 *    / Purchases). Available as a brand-level aggregate COUNT + COST on the features-service
 *    `/revenue` `spend` block (stat cards). NOT attributed per-lead yet for signup/form, so
 *    outcome steps do NOT drive the Leads tabs / table / graph (per-lead attribution is a
 *    features-service follow-up); `countField: null` when even the aggregate is absent
 *    (purchase — no `purchasesCount` on the wire yet).
 *
 * 1-step goals (website_visits, positive_replies) have NO separate outcome step: the
 * visit / reply IS the outcome, already surfaced by its signal step.
 */

/** Leads-page tab key for a lead-signal step. */
export type LeadTab = "outreach" | "clicks" | "positive-replies";
/** Activity-chart metric key for a step with a daily series. */
export type ChartMetricKey = "outreach" | "clicks" | "repliedPositive";
/** Aggregate count/cost fields on the features-service `/revenue` `spend` block. */
type SpendCountField = "signupsCount" | "salesMeetingsCount" | "formSubmissionsCount";
type SpendCostField = "cpsCents" | "cpsmCents" | "cpfsCents";

export interface GoalStep {
  /** Stable step id (also the outcome key). */
  key:
    | "outreach"
    | "website_visits"
    | "positive_replies"
    | "signups"
    | "sales_meetings"
    | "form_submissions"
    | "purchases";
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
  outcome: { countField: "signupsCount", costField: "cpsCents", costLabel: "CPS" },
};
const MEETINGS_OUTCOME: GoalStep = {
  key: "sales_meetings",
  label: "Sales Meetings",
  color: "#7c3aed",
  outcome: { countField: "salesMeetingsCount", costField: "cpsmCents", costLabel: "CPSM" },
};
const FORM_OUTCOME: GoalStep = {
  key: "form_submissions",
  label: "Form submissions",
  color: "#7c3aed",
  outcome: { countField: "formSubmissionsCount", costField: "cpfsCents", costLabel: "CPFS" },
};
// Purchases are attributed per-lead upstream but have no brand-level aggregate
// count/cost on the wire yet → the card renders "—" until features-service exposes it.
const PURCHASE_OUTCOME: GoalStep = {
  key: "purchases",
  label: "Purchases",
  color: "#7c3aed",
  outcome: { countField: null, costField: null, costLabel: "CPP" },
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
    case "purchase":
      return [OUTREACH_STEP, VISITS_STEP, PURCHASE_OUTCOME];
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
 * The goal's downstream OUTCOME step for the stat card (Signups / Sales Meetings /
 * Form submissions / Purchases), or null for a 1-step goal whose outcome IS its
 * signal (website_visits, positive_replies) — those render no separate outcome card.
 */
export function goalOutcomeStep(goal: BrandOptimizationGoal): GoalStep | null {
  return goalSteps(goal).find((s) => s.outcome !== undefined) ?? null;
}
