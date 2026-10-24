/**
 * Research's Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023): for one pipe, every
 * workflow x template x LLM combination that sent its emails, all clients pooled, plus the pipe's
 * five since-inception figures and their monthly series. features-service serves every figure
 * (`GET /internal/research/performance`, gateway `/v1/features/research/performance`), each row's
 * status and its order included (RESEARCH-COMBO-STATUS-1023); this module only types the read, splits
 * rows into the Active / Deprecated tabs on the served status and words the deprecated parts.
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
  /** The figure the rows are ordered on: own spend and outcomes blended with what its parts predict. */
  estimate: PerformanceEstimate;
  /** Deprecated as soon as one part can no longer run (features-service decides; never re-derived here). */
  status: "active" | "deprecated";
  /** Which parts made it deprecated; [] when active. */
  deprecatedParts: PerformancePart[];
}

export type PerformancePart = "workflow" | "template" | "llm";

export interface PerformanceEstimate {
  costPerOutcomeUsd: number | null;
  display: string | null;
  ownSpentUsd: number;
  ownOutcomes: number;
  priorCostPerOutcomeUsd: number | null;
  priorSource: "own_parts" | "pipe_combinations" | null;
  priorParts?: PerformancePart[];
  priorWeightOutcomes: number;
  unavailableReason: "no_outcome_on_pipe" | null;
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
  /** "estimated_cost": active rows first, each group cheapest estimated cost per outcome first. */
  rowOrder?: string;
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
