import type { BrandOptimizationGoal } from "@/lib/api";

/**
 * The STEPS a surface shows — the single source every step-aware surface reads so the
 * stat cards, Leads-page tabs, table columns, and the Outreach-activity graph all
 * show the SAME steps (never an unbought step, never an omitted one). Replaces the scattered `isVisitDrivenGoal(...)`
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
     * SINGULAR human noun for this outcome, for copy that prices one of them
     * ("Cost / sales meeting"). Lives on the step because the step is what a
     * leg-keyed surface has in hand — the retired goal cannot name it.
     */
    noun: string;
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
    noun: "signup",
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
    noun: "sales meeting",
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
    noun: "form submission",
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
    noun: "website purchase",
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
    noun: "sale",
    costField: "cpSaleCents",
    costLabel: "CP Sale",
    tab: "sales",
    leadField: "purchased",
    dateField: "purchasedAt",
  },
};

/** Ordered steps (base → outcome) for a brand's optimization goal. */
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

/** The two steps of a LEG, in the producer's step tokens. `fromKey` null = entry leg. */
export type LegSteps = { fromKey: string | null; toKey: string };

/**
 * The surface step each PRODUCER step token maps onto. `meeting_attended` has none:
 * nothing counts or prices an attended meeting per lead or per day on these surfaces.
 * The two form spellings retired on 2026-09-18 read as `form_submitted`.
 */
const STEP_BY_TOKEN: Readonly<Record<string, GoalStep>> = {
  conversation: REPLIES_STEP,
  website_visit: VISITS_STEP,
  meeting_booked: MEETINGS_OUTCOME,
  signup: SIGNUPS_OUTCOME,
  form_submitted: FORM_OUTCOME,
  form_filled: FORM_OUTCOME,
  lead_form_submitted: FORM_OUTCOME,
  purchase: PURCHASE_OUTCOME,
  paid_client: SALE_OUTCOME,
};

/**
 * The goal a leg's landing step stands for — for the surfaces still keyed on the goal
 * vocabulary (projections, audience ranking). A step with no goal of its own (an attended
 * meeting) reads as the meetings goal, the closest outcome anything prices.
 */
const GOAL_BY_TOKEN: Readonly<Record<string, BrandOptimizationGoal>> = {
  conversation: "positive_replies",
  website_visit: "website_visits",
  meeting_booked: "sales_meetings",
  meeting_attended: "sales_meetings",
  signup: "signups",
  form_submitted: "form_submissions",
  form_filled: "form_submissions",
  lead_form_submitted: "form_submissions",
  purchase: "website_purchase",
  paid_client: "sales",
};

export function goalForLeg(leg: LegSteps | null | undefined): BrandOptimizationGoal | null {
  if (!leg) return null;
  return GOAL_BY_TOKEN[leg.toKey] ?? null;
}

/**
 * Ordered steps for ONE LEG — what a campaign-scoped surface shows, because a campaign
 * is (offer x leg x channel) and buys exactly that leg.
 *
 * Outreach first (every lead we contacted), then the step the leg converts FROM when it
 * has one, then the step it lands ON. An entry leg onto a positive reply reads
 * `Outreach → Positive replies`; the AI meeting booker's leg reads `Outreach → Positive
 * replies → Sales Meetings`.
 */
export function legSteps(leg: LegSteps): GoalStep[] {
  const out: GoalStep[] = [OUTREACH_STEP];
  for (const token of [leg.fromKey, leg.toKey]) {
    const step = token ? STEP_BY_TOKEN[token] : undefined;
    if (step && !out.includes(step)) out.push(step);
  }
  return out;
}

/**
 * The steps a surface should show: the LEG's when one is stated, the goal's otherwise.
 *
 * `leg` is null on a brand- or offer-level surface (several legs run at once, so no
 * single leg describes it). Every leg-aware surface reads THIS, never `goalSteps`.
 */
export function stepsFor(
  goal: BrandOptimizationGoal | null | undefined,
  leg?: LegSteps | null,
): GoalStep[] {
  if (leg) return legSteps(leg);
  if (goal) return goalSteps(goal);
  // Neither: `Outreach` is the honest floor — every lead we contacted is in it.
  return [OUTREACH_STEP];
}

/** `goalLeadTabs`, keyed on the leg when one is stated. */
export function leadTabsFor(
  goal: BrandOptimizationGoal | null | undefined,
  leg?: LegSteps | null,
): LeadTab[] {
  return stepsFor(goal, leg)
    .filter((s): s is GoalStep & { tab: LeadTab } => s.tab !== undefined)
    .map((s) => s.tab)
    .reverse();
}

/** `goalOutcomeStep`, keyed on the leg when one is stated: the DEEPEST outcome step. */
export function outcomeStepFor(
  goal: BrandOptimizationGoal | null | undefined,
  leg?: LegSteps | null,
): GoalStep | null {
  const outcomes = stepsFor(goal, leg).filter((s) => s.outcome !== undefined);
  return outcomes[outcomes.length - 1] ?? null;
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
  return outcomeTabFor(goal, null);
}

/** `goalOutcomeTab`, keyed on the leg when one is stated. */
export function outcomeTabFor(
  goal: BrandOptimizationGoal | null | undefined,
  leg?: LegSteps | null,
): { tab: OutcomeTab; label: string; leadField: OutcomeLeadField; dateField: OutcomeLeadDateField } | null {
  const step = outcomeStepFor(goal, leg);
  if (!step?.outcome) return null;
  return {
    tab: step.outcome.tab,
    label: step.label,
    leadField: step.outcome.leadField,
    dateField: step.outcome.dateField,
  };
}

