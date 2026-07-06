import type {
  BrandOptimizationGoal,
  FeatureAudienceStatsGoal,
  SalesObjective,
  WorkflowProjectionGrain,
  WorkflowProjectionLadderRow,
} from "@/lib/api";

// Local copy of api.ts's isVisitDrivenGoal — this module is imported+executed by
// vitest (which has no "@/" alias), so a value import of "@/lib/api" fails to resolve.
// Keep in lockstep with the exported api.ts helper.
function isVisitDrivenGoal(goal: BrandOptimizationGoal): boolean {
  return goal === "signups" || goal === "website_visits" || goal === "form_submissions";
}

/**
 * Pure (no-React) helpers for the brand Strategy page.
 *
 * - `modelAvatar` gives a workflow ("model") a friendly placeholder face + ring
 *   color, derived deterministically from its dynasty slug. This is a pure
 *   DISPLAY affordance (no backend avatar exists yet); the dynasty NAME stays the
 *   source of truth shown next to it.
 * - `bestModelRow` / `buildAudienceEstimateRows` PICK rows from the served
 *   workflow-projection ladder (rows[] + resolved) and read `resolved` VERBATIM —
 *   they never compute a CPC / projection client-side.
 * - `grainLabel` / `isFlooredRow` describe the resolved number honestly (which
 *   grain it came from; whether it is a zero-outcome floor → render ">$X").
 * - `goalForOptimizationGoal` maps the brand's saved objective onto the
 *   projection/audience-stats goal enum.
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
    default:
      return "meeting";
  }
}

/** The workflow-projection objective for the brand's saved goal. */
export function objectiveForOptimizationGoal(goal: BrandOptimizationGoal): SalesObjective {
  if (goal === "form_submissions") return "form_submissions";
  return isVisitDrivenGoal(goal) ? "self-serve" : "meeting-booked";
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

/** Honest source label for a resolved number, keyed by the grain it came from. */
export function grainLabel(grain: WorkflowProjectionGrain): string {
  switch (grain) {
    case "crossOrg":
      return "fleet benchmark";
    case "brand":
      return "this brand";
    case "audience":
      return "this audience";
  }
}

/**
 * True when the resolved grain observed ZERO clicks. The server floors every unit
 * cost to `spentUsd / max(observed, 1)`, so a 0-click grain reports the whole spend
 * as its cost-per-click — a LOWER BOUND, not a measured average. The UI renders that
 * as ">$X". The resolved grain block is always present (resolved picks a present grain).
 */
export function isFlooredRow(row: WorkflowProjectionLadderRow): boolean {
  const block = row.estimatesByGrain[row.resolved.grain];
  return block != null && block.evidence.observedClicks === 0;
}

/**
 * The recommended workflow's BRAND-LEVEL row (audienceId null) — the source for the
 * "Your best model" headline economics. Its `resolved` block already carries the
 * finest grain present (audience > brand > crossOrg), read verbatim.
 */
export function bestModelRow(
  rows: WorkflowProjectionLadderRow[],
  recommendedSlug: string | null,
): WorkflowProjectionLadderRow | null {
  if (!recommendedSlug) return null;
  return (
    rows.find(
      (r) => r.workflow.workflowDynastySlug === recommendedSlug && r.audienceId == null,
    ) ?? null
  );
}

/** One audience's estimate for the best workflow, read verbatim from `resolved`. */
export interface AudienceEstimateRow {
  id: string;
  name: string;
  /** Which grain the resolved values came from (finest present). */
  grain: WorkflowProjectionGrain;
  /** The resolved grain saw 0 clicks → its unit cost is a floor → render ">$X". */
  floored: boolean;
  /** CPC — cost per click (USD). */
  clickUsd: number | null;
  /** CPS — cost per goal-outcome (signup / meeting, USD). */
  costPerOutcomeUsd: number | null;
  /** ROI — lifetime return multiple. */
  roiMultiple: number | null;
  /** CAC% — cost to win one paying client as a share of lifetime revenue (%). */
  cacPct: number | null;
}

/**
 * One estimate row per active audience for the best workflow. Picks the audience's
 * own ladder row (audienceId × recommended workflow) when present, else the
 * recommended workflow's brand-level row, and reads that row's server-`resolved`
 * verbatim. No client-side CPC / projection math — this only SELECTS which row.
 */
export function buildAudienceEstimateRows(
  activeAudiences: ReadonlyArray<{ id: string; name: string }>,
  rows: WorkflowProjectionLadderRow[],
  recommendedSlug: string | null,
): AudienceEstimateRow[] {
  const ownById = new Map<string, WorkflowProjectionLadderRow>();
  if (recommendedSlug) {
    for (const r of rows) {
      if (r.workflow.workflowDynastySlug === recommendedSlug && r.audienceId != null) {
        ownById.set(r.audienceId, r);
      }
    }
  }
  const brandFallback = bestModelRow(rows, recommendedSlug);
  return activeAudiences.map((a) => {
    const row = ownById.get(a.id) ?? brandFallback;
    if (!row) {
      return {
        id: a.id,
        name: a.name,
        grain: "crossOrg",
        floored: false,
        clickUsd: null,
        costPerOutcomeUsd: null,
        roiMultiple: null,
        cacPct: null,
      };
    }
    return {
      id: a.id,
      name: a.name,
      grain: row.resolved.grain,
      floored: isFlooredRow(row),
      clickUsd: row.resolved.costPerClickUsd,
      costPerOutcomeUsd: row.resolved.costPerOutcomeUsd,
      roiMultiple: row.resolved.roiMultiple,
      cacPct: row.resolved.cacPct,
    };
  });
}
