/**
 * Research's Performance tab (owner 2026-10-23, RESEARCH-PERFORMANCE-1023): for one pipe, every
 * workflow x template x LLM combination that sent its emails, all clients pooled, plus the pipe's
 * five since-inception figures and their monthly series. features-service serves every figure
 * (`GET /internal/research/performance`, gateway `/v1/features/research/performance`); this module
 * only types the read and sorts rows into the Active / Deprecated tabs. Alias-free: unit-tested.
 */

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
  figuresBasis: "since_inception";
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
  costBasis: string;
  pipes: Record<string, PipePerformance>;
}

export type PerformanceTab = "active" | "deprecated";
export type PartStatus = "active" | "deprecated" | null;

/**
 * A combination is Active only when its workflow, its template and its LLM are all active (owner
 * 2026-10-23); one deprecated part makes it Deprecated. A part not on record (null) blocks nothing.
 * Null while a status a present part needs has not answered.
 */
export function combinationStatus(parts: { workflow: PartStatus | undefined; template?: PartStatus | undefined; llm?: PartStatus | undefined }): PartStatus {
  const all = [parts.workflow, parts.template, parts.llm];
  if (all.some((s) => s === "deprecated")) return "deprecated";
  if (all.some((s) => s === undefined)) return null;
  return "active";
}

/** Rows split into the two tabs, each in the served order (never re-sorted here). */
export function performanceByTab<T>(rows: readonly T[], statusOf: (r: T) => PartStatus): Record<PerformanceTab, T[]> {
  const out: Record<PerformanceTab, T[]> = { active: [], deprecated: [] };
  for (const r of rows) out[statusOf(r) === "deprecated" ? "deprecated" : "active"].push(r);
  return out;
}
