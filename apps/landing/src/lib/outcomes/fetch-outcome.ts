import { URLS } from "@distribute/content";
import { unstable_cache } from "next/cache";
import type { OutcomeObjective } from "./outcomes";

// Public cross-org cost-per-outcome stats, read from the api-service public
// gateway (no auth). Same source the homepage ticker + admin feature-stats page
// use. Every fetch is timeout-bounded and fails soft to null so a slow cold
// endpoint can never abort the build-time prerender (mirrors the ticker fetch +
// the /benchmarks bounded fetch).

const FEATURE_SLUG = "sales-cold-email-outreach";
const FETCH_TIMEOUT_MS = 8_000;
const TREND_DAYS = 90;

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL ?? URLS.api;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl()}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[landing] outcome stat ${path} failed: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[landing] outcome stat ${path} unreachable`, error);
    return null;
  }
}

export interface TrendPoint {
  date: string;
  costPerOutcomeUsd: number | null;
}
export interface WorkflowCostRow {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  spentUsd: number;
  costPerOutcomeUsd: number | null;
}

export interface HistogramBucket {
  minUsd: number;
  maxUsd: number;
  count: number;
}
export interface OutcomeDistribution {
  brandCount: number;
  buckets: HistogramBucket[];
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
}

export interface OutcomeStats {
  /** Lifetime pooled average (all history), null when unbacked. */
  lifetimeAvgUsd: number | null;
  /** Current 100-outcome moving average = latest backed trend point. */
  currentAvgUsd: number | null;
  /** Number of brands with usable economics (fleet size). */
  brandCount: number | null;
  /** Dated moving-average series (backed points only). */
  trend: TrendPoint[];
  /** Per-workflow cost, cheapest first = our best model. */
  workflows: WorkflowCostRow[];
  /** Cross-brand price spread (histogram). Null until the endpoint is live. */
  distribution: OutcomeDistribution | null;
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function latestBacked(points: TrendPoint[]): number | null {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) return points[i].costPerOutcomeUsd;
  }
  return null;
}

async function fetchOutcomeStatsUncached(
  objective: OutcomeObjective,
): Promise<OutcomeStats> {
  const slug = encodeURIComponent(FEATURE_SLUG);
  const [lifetime, trendRaw, workflowRaw, distRaw] = await Promise.all([
    getJson<{
      avgCostPerOutcomeByObjective?: Record<string, unknown>;
      brandCount?: unknown;
    }>(`/v1/public/features/cost-per-outcome-lifetime?featureSlug=${slug}`),
    getJson<{ points?: Array<{ date?: string; costPerOutcomeUsd?: unknown }> }>(
      `/v1/public/features/cost-per-outcome-trend?featureSlug=${slug}&objective=${objective}&days=${TREND_DAYS}`,
    ),
    getJson<{
      workflows?: Array<{
        workflowDynastySlug?: string;
        workflowDynastyName?: string;
        spentUsd?: unknown;
        costPerOutcomeUsd?: unknown;
      }>;
    }>(
      `/v1/public/features/workflow-cost-per-outcome?featureSlug=${slug}&objective=${objective}`,
    ),
    getJson<{
      brandCount?: unknown;
      buckets?: Array<{ minUsd?: unknown; maxUsd?: unknown; count?: unknown }>;
      mean?: unknown;
      median?: unknown;
      min?: unknown;
      max?: unknown;
      p25?: unknown;
      p75?: unknown;
    }>(
      `/v1/public/features/cost-per-outcome-distribution?featureSlug=${slug}&objective=${objective}&buckets=12`,
    ),
  ]);

  const distBuckets = (distRaw?.buckets ?? []).flatMap((b) => {
    const min = numOrNull(b?.minUsd);
    const max = numOrNull(b?.maxUsd);
    const count = numOrNull(b?.count);
    return min !== null && max !== null && count !== null
      ? [{ minUsd: min, maxUsd: max, count }]
      : [];
  });
  const distribution: OutcomeDistribution | null =
    distRaw && distBuckets.length > 0
      ? {
          brandCount: numOrNull(distRaw.brandCount) ?? 0,
          buckets: distBuckets,
          mean: numOrNull(distRaw.mean),
          median: numOrNull(distRaw.median),
          min: numOrNull(distRaw.min),
          max: numOrNull(distRaw.max),
          p25: numOrNull(distRaw.p25),
          p75: numOrNull(distRaw.p75),
        }
      : null;

  const trend: TrendPoint[] = (trendRaw?.points ?? []).flatMap((p) =>
    typeof p?.date === "string"
      ? [{ date: p.date, costPerOutcomeUsd: numOrNull(p.costPerOutcomeUsd) }]
      : [],
  );

  const workflows: WorkflowCostRow[] = (workflowRaw?.workflows ?? [])
    .flatMap((w) =>
      typeof w?.workflowDynastyName === "string" && w.workflowDynastyName
        ? [
            {
              workflowDynastySlug: String(w.workflowDynastySlug ?? ""),
              workflowDynastyName: w.workflowDynastyName,
              spentUsd: numOrNull(w.spentUsd) ?? 0,
              costPerOutcomeUsd: numOrNull(w.costPerOutcomeUsd),
            },
          ]
        : [],
    )
    // Cheapest first = our best model; unpriced rows sink to the bottom.
    .sort(
      (a, b) =>
        (a.costPerOutcomeUsd ?? Infinity) - (b.costPerOutcomeUsd ?? Infinity),
    );

  return {
    lifetimeAvgUsd: numOrNull(
      lifetime?.avgCostPerOutcomeByObjective?.[objective],
    ),
    currentAvgUsd: latestBacked(trend),
    brandCount: numOrNull(lifetime?.brandCount),
    trend,
    workflows,
    distribution,
  };
}

export function fetchOutcomeStats(
  objective: OutcomeObjective,
): Promise<OutcomeStats> {
  return unstable_cache(
    () => fetchOutcomeStatsUncached(objective),
    ["outcome-stats", objective],
    { revalidate: 300, tags: ["outcome-stats"] },
  )();
}
