/**
 * Research's Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023): for one pipe, every
 * workflow x template x LLM combination that sent its emails, all clients pooled, plus the pipe's
 * five since-inception figures and their monthly series. features-service serves every figure
 * (`GET /internal/research/performance`, gateway `/v1/features/research/performance`), each row's
 * status and its order included (RESEARCH-COMBO-STATUS-1023); this module only types the read, splits
 * rows into the Active / Deprecated tabs on the served status, hides the untested ones unless asked
 * (PERF-COST-ORDER-1024) and words the deprecated parts and the served combination's gaps.
 * Alias-free: unit-tested.
 */
import type { ResearchFreshness } from "./freshness";

export interface PerformanceFigure {
  value: number | null;
  display: string | null;
  basis: "measured" | "expected" | null;
  source: string | null;
  unavailableReason: string | null;
}

export interface PerformanceCount {
  value: number;
  display: string;
}

export interface PerformanceFigures {
  roi: PerformanceFigure;
  costPerOutcomeUsd: PerformanceFigure;
  conversionRatePct: PerformanceFigure;
  outcomes: PerformanceCount;
  spentUsd: PerformanceCount;
  contacted: PerformanceCount;
}

/** A served mark (MARKS-1022), present when the catalogue has one. */
export interface PerformanceMark {
  icon?: string | null;
  color?: string | null;
}

export interface PerformanceRow extends PerformanceFigures {
  key: string;
  rank: number;
  workflow: { key: string; label: string; name: string | null } & PerformanceMark;
  /** The template DYNASTY (owner 2026-10-23: a Template column is the dynasty) = its Research page. */
  template: ({ key: string; label: string; dynasty?: ({ key: string; label: string } & PerformanceMark) | null } & PerformanceMark) | null;
  /** The LLM dynasty (= its Research model page). */
  llm: { key: string; label: string; provider: string | null } | null;
  writerUnavailableReason: string | null;
  maturity: { isMature: boolean; matureOutcomes: number | null; outcomesRequired: number };
  learning: boolean;
  /** What the row is ordered on (PERF-COST-ORDER-1024): its cost per outcome, else its $ spent; flash view. */
  sortCostUsd: number;
  /** Spent nothing on the flash view: hidden by default, shown by the "Show untested" toggle. */
  untested: boolean;
  /** Deprecated as soon as one part can no longer run (features-service decides; never re-derived here). */
  status: "active" | "deprecated";
  /** Which parts made it deprecated; [] when active. */
  deprecatedParts: PerformancePart[];
}

export type PerformancePart = "workflow" | "template" | "llm";

export interface PerformanceServedPart {
  key: string;
  label: string;
}

export type ServedNowReason =
  | "pipe_not_read"
  | "workflow_ranking_not_computed_yet"
  | "no_runnable_workflow"
  | "writer_ranking_not_computed_yet"
  | "no_template_picked"
  | "no_llm_picked"
  | "combination_not_listed"
  | "served_pick_unreadable";

export interface PerformanceServedNow {
  workflow: PerformanceServedPart | null;
  template: PerformanceServedPart | null;
  llm: PerformanceServedPart | null;
  /** That combination's row, same shape as `rows[]`; null with `unavailableReason`. */
  row: PerformanceRow | null;
  unavailableReason: ServedNowReason | null;
}

export interface PerformancePoint {
  /** `YYYY-MM`; every figure cumulative to the END of the month. */
  month: string;
  label: string;
  roi: number | null;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
  outcomes: number;
  spentUsd: number;
}

export interface PipePerformance {
  pipe: string;
  /** The bars the figures are read on (features-service names it; "workflow_bars" = the Workflows tab's own). */
  figuresBasis: string;
  /** "cost_per_outcome" (PERF-COST-ORDER-1024): active first, then $ per outcome ascending, else $ spent. */
  rowOrder?: string;
  /** The order is read on this view's figures whatever the view shown ("flash"). */
  orderView?: string;
  featureSlug: string | null;
  legKey: string | null;
  /** The combination the pipe runs today, read live by features-service (never re-derived here). */
  servedNow: PerformanceServedNow;
  outcomeNoun: string;
  outcomeNounPlural: string;
  rows: PerformanceRow[];
  totals: PerformanceFigures | null;
  series: { grain: "month"; points: PerformancePoint[] } | null;
  unpricedBilledUsd: number;
  unavailableReason: string | null;
}

/** The served read: every Research pipe's tab, on one cost basis. */
export interface ResearchPerformance {
  computedAt: string | null;
  /** How old the build is at this read and whether it is stale (RESEARCH-STALE-1024); absent on an older build. */
  freshness?: ResearchFreshness;
  costBasis: string;
  pipes: Record<string, PipePerformance>;
}

export type PerformanceTab = "active" | "deprecated";

/** Rows split into the two tabs on the SERVED status, each in the served order (never re-sorted here). */
export function performanceByTab<T extends { status: PerformanceRow["status"] }>(rows: readonly T[]): Record<PerformanceTab, T[]> {
  const out: Record<PerformanceTab, T[]> = { active: [], deprecated: [] };
  for (const r of rows) out[r.status === "deprecated" ? "deprecated" : "active"].push(r);
  return out;
}

const PART_WORDS: Record<PerformancePart, string> = {
  workflow: "Workflow deprecated",
  template: "Template deprecated",
  llm: "LLM retired",
};

/** Why a deprecated row is deprecated, short and plain ("LLM retired"); null when no part is named. */
export function deprecatedPartsWords(parts: readonly string[] | null | undefined): string | null {
  const words: string[] = [];
  for (const p of parts ?? []) {
    const w = PART_WORDS[p as PerformancePart];
    if (w) words.push(w);
    else console.error("[research-performance] unknown deprecated part", p);
  }
  return words.length ? words.join(" · ") : null;
}

/** The rows a tab shows: untested ones ($0 spent, served flag) hidden unless asked, served order kept. */
export function visibleRows<T extends { untested: boolean }>(rows: readonly T[], showUntested: boolean): T[] {
  return showUntested ? [...rows] : rows.filter((r) => !r.untested);
}

/** How many rows the "Show untested" toggle would add. */
export function untestedCount(rows: readonly { untested: boolean }[]): number {
  return rows.filter((r) => r.untested).length;
}

const SERVED_NOW_WORDS: Record<ServedNowReason, string> = {
  pipe_not_read: "We could not read what this pipe runs right now.",
  workflow_ranking_not_computed_yet: "The workflow ranking is not ready yet.",
  no_runnable_workflow: "No workflow can run on this pipe right now.",
  writer_ranking_not_computed_yet: "The template and LLM pick is not ready yet.",
  no_template_picked: "No template is picked for this pipe yet.",
  no_llm_picked: "No LLM is picked for this pipe yet.",
  combination_not_listed: "This combination has no row in the table yet.",
  served_pick_unreadable: "We could not read the pick for this pipe.",
};

/** Why the running combination has no row, in plain words. */
export function servedNowReasonWords(reason: string | null): string {
  if (reason && reason in SERVED_NOW_WORDS) return SERVED_NOW_WORDS[reason as ServedNowReason];
  console.error("[research-performance] no words for servedNow reason", reason);
  return "This combination has no figures yet.";
}
