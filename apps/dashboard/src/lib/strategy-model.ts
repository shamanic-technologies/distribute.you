import type { BrandOptimizationGoal, FeatureAudienceStatsGoal, FeatureCandidate, SalesObjective } from "@/lib/api";

/**
 * Pure (no-React) helpers for the brand Strategy page.
 *
 * - `modelAvatar` gives a workflow ("model") a friendly placeholder face + ring
 *   color, derived deterministically from its dynasty slug. This is a pure
 *   DISPLAY affordance (no backend avatar exists yet); the dynasty NAME stays the
 *   source of truth shown next to it.
 * - `selectBestModelEvidence` GROUPS the served candidate rows for one workflow
 *   into its cross-org row + its per-audience rows. It only filters/groups rows
 *   and reads server-provided `costPerOutcomeUsd` — it never computes a metric.
 * - `goalForOptimizationGoal` maps the brand's saved objective onto the
 *   candidates/audience-stats goal enum.
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

/** The brand's saved objective → the candidates / audience-stats goal enum. */
export function goalForOptimizationGoal(goal: BrandOptimizationGoal): FeatureAudienceStatsGoal {
  return goal === "signups" ? "signup" : "meetingBooked";
}

/** Human noun for one outcome of the brand's objective. */
export function outcomeNoun(goal: BrandOptimizationGoal): string {
  return goal === "signups" ? "signup" : "meeting";
}

/** The projection field carrying the brand-level cost per outcome for the objective. */
export function projectionCostKey(
  goal: BrandOptimizationGoal,
): "costPerSignupUsd" | "costPerMeetingBookedUsd" {
  return goal === "signups" ? "costPerSignupUsd" : "costPerMeetingBookedUsd";
}

/** The workflow-projection objective for the brand's saved goal. */
export function objectiveForOptimizationGoal(goal: BrandOptimizationGoal): SalesObjective {
  return goal === "signups" ? "self-serve" : "meeting-booked";
}

export interface BestModelEvidence {
  /** The cross-org prior row for this workflow (cost sampled across all orgs). */
  crossOrg: FeatureCandidate | null;
  /** Per-audience rows for this workflow (cost attributed to one audience). */
  audiences: FeatureCandidate[];
}

/**
 * Group the served candidate rows for ONE workflow into its cross-org prior row
 * and its per-audience rows. Pure filter/group — picks server-provided values,
 * computes nothing.
 */
export function selectBestModelEvidence(
  candidates: FeatureCandidate[],
  bestDynastySlug: string | null,
): BestModelEvidence {
  if (!bestDynastySlug) return { crossOrg: null, audiences: [] };
  const mine = candidates.filter((c) => c.workflow.workflowDynastySlug === bestDynastySlug);
  const crossOrg =
    mine.find((c) => c.cost.grain === "goal-global" && c.audienceId == null) ?? null;
  const audiences = mine.filter((c) => c.cost.grain === "audience" && c.audienceId != null);
  return { crossOrg, audiences };
}
