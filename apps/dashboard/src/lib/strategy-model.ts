import type {
  BrandOptimizationGoal,
  FeatureAudienceStatsGoal,
  SalesObjective,
  WorkflowProjectionGrain,
  WorkflowProjectionRow,
} from "@/lib/api";

// Local copy of api.ts's isVisitDrivenGoal — this module is imported+executed by
// vitest (which has no "@/" alias), so a value import of "@/lib/api" fails to resolve.
// Keep in lockstep with the exported api.ts helper.
function isVisitDrivenGoal(goal: BrandOptimizationGoal): boolean {
  return (
    goal === "signups" ||
    goal === "website_visits" ||
    goal === "form_submissions" ||
    goal === "purchase"
  );
}

/**
 * Pure (no-React) helpers for the brand Strategy page.
 *
 * - `modelAvatar` gives a workflow ("model") a friendly placeholder face + ring
 *   color, derived deterministically from its dynasty slug. This is a pure
 *   DISPLAY affordance (no backend avatar exists yet); the dynasty NAME stays the
 *   source of truth shown next to it.
 * - `pickBrandRow` / `pickAudienceRow` PICK the right row out of the
 *   workflow-projection ladder (brand-level row for the headline, per-audience row
 *   for the table). They only filter — every cost is read verbatim from the row's
 *   server-resolved grain; nothing is computed or rescaled client-side.
 * - `goalForOptimizationGoal` maps the brand's saved objective onto the
 *   workflow-projection/audience-stats goal enum.
 */

const MODEL_FACES: ReadonlyArray<{ emoji: string; color: string }> = [
  { emoji: "🦜", color: "#f59e0b" },
  { emoji: "🦊", color: "#ef4444" },
  { emoji: "🦉", color: "#8b5cf6" },
  { emoji: "🐬", color: "#0ea5e9" },
  { emoji: "🦅", color: "#0d9488" },
  { emoji: "🦁", color: "#d97706" },
  { emoji: "🐼", color: "#475569" },
  { emoji: "🦢", color: "#6366f1" },
  { emoji: "🐝", color: "#ca8a04" },
  { emoji: "🦋", color: "#ec4899" },
  { emoji: "🐺", color: "#64748b" },
  { emoji: "🦈", color: "#2563eb" },
];

/** Deterministic placeholder face + ring color for a workflow "model". */
export function modelAvatar(dynastySlug: string): { emoji: string; color: string } {
  let h = 0;
  for (let i = 0; i < dynastySlug.length; i++) {
    h = (h * 31 + dynastySlug.charCodeAt(i)) >>> 0;
  }
  return MODEL_FACES[h % MODEL_FACES.length];
}

/** The brand's saved objective → the candidates / audience-stats goal enum.
 *  The two beta goals borrow the nearest family (visit → signup, reply → meetingBooked);
 *  the enum has no single-step variant. */
export function goalForOptimizationGoal(goal: BrandOptimizationGoal): FeatureAudienceStatsGoal {
  if (goal === "purchase") return "purchase";
  return isVisitDrivenGoal(goal) ? "signup" : "meetingBooked";
}

/** Human noun for one outcome of the brand's objective. */
export function outcomeNoun(goal: BrandOptimizationGoal): string {
  switch (goal) {
    case "signups":
      return "signup";
    case "website_visits":
      return "website visit";
    case "positive_replies":
      return "positive reply";
    case "form_submissions":
      return "form submission";
    case "purchase":
      return "purchase";
    default:
      return "meeting";
  }
}

/** The workflow-projection objective for the brand's saved goal.
 *  Sends features-service's NATIVE objective per goal so the server computes the right
 *  funnel: website_visits + positive_replies are SINGLE-STEP (visit→paid / reply→paid),
 *  form_submissions two-step, signups → self-serve, sales_meetings → meeting-booked.
 *  (features-service supports all five natively — the single-step goals no longer borrow
 *  self-serve, which was serving cost-per-SIGNUP under a website_visits brand.) */
export function objectiveForOptimizationGoal(goal: BrandOptimizationGoal): SalesObjective {
  if (goal === "form_submissions") return "form_submissions";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  if (goal === "purchase") return "purchase";
  if (goal === "sales_meetings") return "meeting-booked";
  return "self-serve";
}

/**
 * The offer levers we optimise conversion against (Alex Hormozi value equation),
 * each mapped to the brand-profile field key that stores it. Same data as the
 * Brand Profile editor — the Strategy page just reads it.
 */
export interface OfferLever {
  key: string;
  label: string;
  tip: string;
}

export const OFFER_LEVERS: OfferLever[] = [
  { key: "services", label: "Services sold", tip: "What you actually deliver to the client." },
  {
    key: "valueProposition",
    label: "Dream outcome",
    tip: "The result your customer wants most.",
  },
  {
    key: "perceivedLikelihood",
    label: "Perceived likelihood of success",
    tip: "Proof it will work for them.",
  },
  {
    key: "socialProof",
    label: "Social proof",
    tip: "Other people who got results.",
  },
  {
    key: "riskReversal",
    label: "Risk reversal",
    tip: "A guarantee that removes their risk.",
  },
  { key: "urgency", label: "Urgency", tip: "A reason to act now." },
  { key: "scarcity", label: "Scarcity", tip: "Limited availability." },
];

/**
 * Display lines for one offer lever from a brand-profile fields bag. Normalises a
 * string or string[] to a string[], and treats empty / "Unknown" (the extractor's
 * placeholder for "not found") as NOT SET (empty array) so the UI can prompt to
 * fill it in rather than printing "Unknown". Pure display normalisation, no metric.
 */
export function offerLeverValue(
  fields: Record<string, string | string[]> | undefined | null,
  key: string,
): string[] {
  const raw = fields?.[key];
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return list
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.toLowerCase() !== "unknown");
}

/** Honest human label for which POPULATION produced a resolved cost number, so the UI
 *  never mislabels a fleet-benchmark or per-audience number as "this brand". */
export const WORKFLOW_GRAIN_LABEL: Record<WorkflowProjectionGrain, string> = {
  crossOrg: "fleet benchmark",
  brand: "this brand",
  audience: "this audience",
};

/**
 * The brand-level row (audienceId null) for one workflow — the source of the
 * "Your best model" headline economics. Pure pick; the row's `resolved` block is
 * rendered verbatim.
 */
export function pickBrandRow(
  rows: readonly WorkflowProjectionRow[],
  workflowDynastySlug: string | null,
): WorkflowProjectionRow | null {
  if (!workflowDynastySlug) return null;
  return (
    rows.find(
      (r) => r.audienceId == null && r.workflow.workflowDynastySlug === workflowDynastySlug,
    ) ?? null
  );
}

/**
 * The BEST workflow for the brand — the cheapest BRAND-LEVEL row (audienceId null),
 * ranked on `resolved.costPerOutcomeUsd` ascending (the goal metric, at the row's
 * server-resolved brand/crossOrg grain). Rows whose metric is null (cold start, no
 * economics) or <= 0 are skipped.
 *
 * We deliberately do NOT drive the headline off `recommendedWorkflowDynastySlug`: that
 * backend argmin spans per-audience rows too (it exists for campaign-service's per-run
 * audience selection, which also picks the cheapest audience leg), so a single cheap
 * 2-click audience row can crown a dynasty whose BRAND-level cost is actually bad and
 * floored. Ranking the brand-level rows here keeps the headline coherent with the
 * per-audience table and the brand's own averages.
 *
 * Fallbacks when no brand-level row ranks (all null/<=0): the recommended dynasty's
 * brand-level row, then the first brand-level row. Pure pick — the chosen row's
 * `resolved` block is rendered verbatim.
 */
export function pickBestBrandRow(
  rows: readonly WorkflowProjectionRow[],
  recommendedDynastySlug: string | null,
): WorkflowProjectionRow | null {
  const brandRows = rows.filter((r) => r.audienceId == null);
  if (brandRows.length === 0) return null;
  let best: WorkflowProjectionRow | null = null;
  let bestCost = Infinity;
  for (const r of brandRows) {
    const c = r.resolved.costPerOutcomeUsd;
    if (c == null || c <= 0) continue;
    if (c < bestCost) {
      bestCost = c;
      best = r;
    }
  }
  if (best) return best;
  return pickBrandRow(rows, recommendedDynastySlug) ?? brandRows[0];
}

/**
 * The per-audience row for one workflow. The backend already resolved that row through
 * the audience → brand → crossOrg grain ladder (see `resolved.grain`); this only PICKS
 * the matching row — no client-side fallback resolution, no metric math.
 */
export function pickAudienceRow(
  rows: readonly WorkflowProjectionRow[],
  workflowDynastySlug: string | null,
  audienceId: string,
): WorkflowProjectionRow | null {
  if (!workflowDynastySlug) return null;
  return (
    rows.find(
      (r) =>
        r.audienceId === audienceId &&
        r.workflow.workflowDynastySlug === workflowDynastySlug,
    ) ?? null
  );
}

/**
 * The per-audience row for a workflow, falling back to the workflow's BRAND-LEVEL row
 * when this audience never ran it (no couple row). So every active audience shows the
 * best workflow's cost — its own audience-grain figure where it has run evidence, else
 * the workflow's brand/crossOrg cost — instead of a bare "-". Pure pick; `resolved` is
 * read verbatim, and the fallback row's grain honestly labels the number ("this brand"
 * / "fleet benchmark"), never claiming a per-audience result the audience doesn't have.
 */
export function pickAudienceOrBrandRow(
  rows: readonly WorkflowProjectionRow[],
  workflowDynastySlug: string | null,
  audienceId: string,
): WorkflowProjectionRow | null {
  return (
    pickAudienceRow(rows, workflowDynastySlug, audienceId) ??
    pickBrandRow(rows, workflowDynastySlug)
  );
}

/**
 * True when the row's RESOLVED grain observed zero clicks → every unit cost at that
 * grain is a FLOOR (spentUsd / max(observed,1)), so a rendered cost is a ">$X" lower
 * bound, not an exact figure. Reads `estimatesByGrain[resolved.grain].evidence`.
 */
export function isRowFloored(row: WorkflowProjectionRow | null): boolean {
  if (!row) return false;
  const block = row.estimatesByGrain[row.resolved.grain];
  return (block?.evidence.observedClicks ?? 0) === 0;
}
