import { URLS } from "@distribute/content";
import { unstable_cache } from "next/cache";
import type { OutcomeObjective } from "./outcomes";

// Public cross-org cost-per-outcome stats, read from the api-service public
// gateway (no auth). The landing headlines the BEST cross-org workflow's cost
// per outcome — the model we deploy to new clients by default — NOT a pooled
// average (pooled averages get diluted as brands/workflows oscillate between
// goals). The fetch is timeout-bounded and fails soft to null so a slow cold
// endpoint can never abort the build-time prerender (mirrors the ticker fetch +
// the /benchmarks bounded fetch).

const FEATURE_SLUG = "sales-cold-email-outreach";
const FETCH_TIMEOUT_MS = 8_000;

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

export interface WorkflowCostRow {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  spentUsd: number;
  observedClicks: number;
  observedPositiveReplies: number;
  costPerOutcomeUsd: number | null;
}

export interface OutcomeStats {
  /**
   * Cost of our BEST cross-org workflow for this outcome = the cheapest
   * workflow whose OBJECTIVE outcome was actually observed > 0. This is the
   * model we deploy to new clients by default. Null when no workflow has
   * produced the outcome yet.
   */
  bestCostUsd: number | null;
  /**
   * Per-workflow cost, cheapest first, FILTERED to workflows that actually
   * produced the outcome (observed count > 0). 0-outcome "husk" workflows
   * (spent money, produced nothing) are excluded so one can never be crowned
   * "best".
   */
  workflows: WorkflowCostRow[];
}

function numOrNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// Observed count for the objective the page is about. We filter on the OBSERVED
// COUNT, never on a cost threshold: a features-service change makes a 0-outcome
// workflow's cost drop to its own spend (~$46) instead of the pooled ~$162, so a
// cost-based exclusion would silently break the moment that backend deploys.
function observedForObjective(
  w: WorkflowCostRow,
  objective: OutcomeObjective,
): number {
  return objective === "websiteVisit"
    ? w.observedClicks
    : w.observedPositiveReplies;
}

async function fetchOutcomeStatsUncached(
  objective: OutcomeObjective,
): Promise<OutcomeStats> {
  const slug = encodeURIComponent(FEATURE_SLUG);
  const workflowRaw = await getJson<{
    workflows?: Array<{
      workflowDynastySlug?: string;
      workflowDynastyName?: string;
      spentUsd?: unknown;
      observedClicks?: unknown;
      observedPositiveReplies?: unknown;
      costPerOutcomeUsd?: unknown;
    }>;
  }>(
    `/v1/public/features/workflow-cost-per-outcome?featureSlug=${slug}&objective=${objective}`,
  );

  const workflows: WorkflowCostRow[] = (workflowRaw?.workflows ?? [])
    .flatMap((w) =>
      typeof w?.workflowDynastyName === "string" && w.workflowDynastyName
        ? [
            {
              workflowDynastySlug: String(w.workflowDynastySlug ?? ""),
              workflowDynastyName: w.workflowDynastyName,
              spentUsd: numOrNull(w.spentUsd) ?? 0,
              observedClicks: numOrNull(w.observedClicks) ?? 0,
              observedPositiveReplies: numOrNull(w.observedPositiveReplies) ?? 0,
              costPerOutcomeUsd: numOrNull(w.costPerOutcomeUsd),
            },
          ]
        : [],
    )
    // Keep only workflows that actually PRODUCED this outcome — exclude the
    // 0-outcome husks BEFORE the cheapest-first sort so one can never be "best".
    .filter((w) => observedForObjective(w, objective) > 0)
    // Cheapest first = our best model; unpriced rows sink to the bottom.
    .sort(
      (a, b) =>
        (a.costPerOutcomeUsd ?? Infinity) - (b.costPerOutcomeUsd ?? Infinity),
    );

  return {
    bestCostUsd: workflows[0]?.costPerOutcomeUsd ?? null,
    workflows,
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
