import "server-only";
import { cache } from "react";
import { clerkClient } from "@clerk/nextjs/server";
import type {
  Brand,
  Campaign,
  Email,
  Lead,
  Workflow,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const ADMIN_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

// Per-fetch timeout so a single slow upstream call (cost-stats has been
// observed at 30s+) can't take the whole page past Vercel's function ceiling.
// On timeout the Suspense boundary that requested this data flips to its
// empty/0 render path — the rest of the page is unaffected.
const UPSTREAM_TIMEOUT_MS = 25_000;

/** GET against api-service with admin auth + org context. Returns the parsed
 *  body on 2xx. THROWS on any failure (non-2xx, network error, timeout) so
 *  the Suspense boundary catches it and React renders error.tsx with a
 *  retry button — visually distinct from a real "no rows" result. */
async function adminGet<T>(label: string, path: string, orgId: string): Promise<T> {
  if (!ADMIN_KEY) {
    throw new Error(`[dashboard-report] ADMIN_DISTRIBUTE_API_KEY missing; ${label} failed`);
  }
  const url = `${API_URL}/v1${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
        "x-external-org-id": orgId,
        "x-external-user-id": `report-public:${orgId}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[dashboard-report] ${label} ${url} threw:`, err);
    throw new Error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[dashboard-report] ${label} ${url} → ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`${label} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

// All fetchers are wrapped in `react.cache()` so multiple Suspense boundaries
// in the same request share one HTTP roundtrip. Without it, Overview ends up
// firing /v1/leads twice (once for the stats grid, once for the CPA funnel),
// doubling the slowest-path latency.

export const fetchBrand = cache(async (orgId: string, brandId: string): Promise<Brand | null> => {
  // Brand fetch is allowed to fail silently — header shows brandId fallback.
  try {
    const result = await adminGet<{ brand: Brand }>("getBrand", `/brands/${brandId}`, orgId);
    return result.brand ?? null;
  } catch {
    return null;
  }
});

/** Clerk org display name. Returns the raw orgId on failure so the header
 *  never collapses, but logs the cause. */
export const fetchOrgName = cache(async (orgId: string): Promise<string> => {
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    return org.name || orgId;
  } catch (err) {
    console.error(`[dashboard-report] fetchOrgName(${orgId}) failed:`, err);
    return orgId;
  }
});

// Cap responses tightly so per-call latency fits inside the per-fetch
// 25s upstream abort (lead-service assembles FullLead with multi-table
// joins; even 200 rows routinely exceeded 25s in prod). 50 rows is the
// largest sample we can reliably load. Report shows a "first N of M"
// caveat in the section card when truncated.
export const REPORT_FETCH_LIMIT = 50;

export const fetchLeads = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<Lead[]> => {
  const result = await adminGet<{ leads: Lead[] }>(
    "listBrandLeads",
    `/leads?brandId=${brandId}&limit=${REPORT_FETCH_LIMIT}`,
    orgId,
  );
  const leads = result.leads ?? [];
  return leads.filter((l) => !l.featureSlug || l.featureSlug === featureSlug);
});

export const fetchEmails = cache(async (
  orgId: string,
  brandId: string,
  campaignId?: string,
): Promise<Email[]> => {
  // campaignId filter shrinks the response from "all brand emails" to "one
  // campaign's emails" — drawer-open fetch path uses this so the lead's
  // emails arrive in under a second instead of timing out at 25s on
  // brand-wide fetches. Backend /v1/emails has no per-lead filter
  // (DIS-XX tracks adding one); campaignId is the next-best proxy.
  const campaignQs = campaignId ? `&campaignId=${campaignId}` : "";
  const result = await adminGet<{ emails: Email[] }>(
    "listBrandEmails",
    `/emails?brandId=${brandId}&limit=${REPORT_FETCH_LIMIT}${campaignQs}`,
    orgId,
  );
  const emails = result.emails ?? [];
  // Strip the heavy fields the report never displays but KEEP the small
  // generationRun metadata (taskName, status) so the emails table can
  // attribute the email to its workflow. The killers are `costs` and
  // `descendantRuns` (run cost breakdown + child run tree, ~50KB per row);
  // taskName + status are sub-100B.
  return emails.map((e) => {
    const gr = e.generationRun;
    return {
      ...e,
      generationRun: gr
        ? { ...gr, costs: [], descendantRuns: [] }
        : null,
      bodyHtml: null,
      sequence: null,
    };
  });
});

/** Aggregated stats for a brand × feature. Avoids fetching every lead just
 *  to count statuses on Overview. Returns the raw stats dict — callers know
 *  which keys they need. */
export interface FeatureStats {
  systemStats: { totalCostInUsdCents?: number | string } & Record<string, unknown>;
  stats: Record<string, number>;
}

export const fetchFeatureStats = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<FeatureStats> => {
  return adminGet<FeatureStats>(
    "featureStats",
    `/features/${encodeURIComponent(featureSlug)}/stats?brandId=${brandId}`,
    orgId,
  );
});

/** Per-workflow grouped stats for a brand × feature. Used by the Workflows
 *  page to compute CAC per workflow (A/B comparison). */
export interface FeatureStatsGroupedByWorkflow {
  groups: Array<{
    workflowSlug: string | null;
    systemStats: { totalCostInUsdCents?: number | string } & Record<string, unknown>;
    stats: Record<string, number>;
  }>;
}

export const fetchFeatureStatsByWorkflow = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<FeatureStatsGroupedByWorkflow> => {
  return adminGet<FeatureStatsGroupedByWorkflow>(
    "featureStatsByWorkflow",
    `/features/${encodeURIComponent(featureSlug)}/stats?brandId=${brandId}&groupBy=workflowSlug`,
    orgId,
  );
});

export const fetchCampaigns = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<Campaign[]> => {
  const result = await adminGet<{ campaigns: Campaign[] }>("listCampaignsByBrand", `/campaigns?brandId=${brandId}`, orgId);
  const campaigns = result.campaigns ?? [];
  return campaigns.filter((c) => c.featureSlug === featureSlug);
});

export const fetchWorkflows = cache(async (orgId: string, featureSlug: string): Promise<Workflow[]> => {
  const result = await adminGet<{ workflows: Workflow[] }>(
    "listWorkflows",
    `/workflows?featureSlug=${encodeURIComponent(featureSlug)}`,
    orgId,
  );
  return result.workflows ?? [];
});

/** Extract human-readable prompt strings from a workflow DAG. Looks for
 *  prompt / promptTemplate / systemPrompt / userPrompt fields on any node config. */
export function extractWorkflowPrompts(workflow: Workflow): { nodeId: string; nodeType: string; field: string; value: string }[] {
  const prompts: { nodeId: string; nodeType: string; field: string; value: string }[] = [];
  const nodes = workflow.dag?.nodes ?? [];
  const PROMPT_FIELDS = ["prompt", "promptTemplate", "systemPrompt", "userPrompt", "instructions", "template"];
  for (const node of nodes) {
    const config = node.config ?? {};
    for (const field of PROMPT_FIELDS) {
      const value = config[field];
      if (typeof value === "string" && value.length > 0) {
        prompts.push({ nodeId: node.id, nodeType: node.type, field, value });
      }
    }
  }
  return prompts;
}
