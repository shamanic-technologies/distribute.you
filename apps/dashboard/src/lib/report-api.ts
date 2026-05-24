import "server-only";
import { unstable_cache } from "next/cache";
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

// Per-fetch timeout so a single slow upstream call can't take the whole
// cache-fill request past Vercel's function ceiling. The previous 25s value
// was tuned for live page renders; under unstable_cache the fetch is now
// shared across all visitors within a 4h window, so a longer fill window
// (60s) is acceptable — only one visitor pays it and everyone else gets the
// cached HTML for the next 4h.
const UPSTREAM_TIMEOUT_MS = 60_000;

// Cache lifetime for every public-report data fetch. The recipient sees
// data up to this old; on next visit after expiry, Next.js serves the
// stale HTML and refreshes in the background (stale-while-revalidate),
// so no visitor ever waits for the upstream. Phase 2 (backend webhook +
// revalidateTag) will drop staleness to ~0 without changing this.
const REPORT_REVALIDATE_SECONDS = 4 * 60 * 60;

/** GET against api-service with admin auth + org context. Returns the parsed
 *  body on 2xx. THROWS on any failure (non-2xx, network error, timeout) so
 *  the caller can fall back to an empty/null result rather than poisoning
 *  the unstable_cache entry for the next 4 hours. */
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

// Tag namespace. Phase 2 will let a backend webhook call
// `revalidateTag('report:brand:<brandId>', 'default')` whenever a lead /
// email status changes — flushing this brand's cached HTML across every
// feature/section in one shot. Until then, the 4h TTL drives expiry.
function reportTags(orgId: string, brandId: string, featureSlug: string): string[] {
  return [
    `report:${orgId}:${brandId}:${featureSlug}`,
    `report:brand:${brandId}`,
    `report:org:${orgId}`,
  ];
}

export const REPORT_FETCH_LIMIT = 50;

export async function fetchBrand(orgId: string, brandId: string): Promise<Brand | null> {
  return unstable_cache(
    async () => {
      try {
        const result = await adminGet<{ brand: Brand }>("getBrand", `/brands/${brandId}`, orgId);
        return result.brand ?? null;
      } catch {
        return null;
      }
    },
    [`fetchBrand`, orgId, brandId],
    {
      tags: [`brand:${brandId}`, `report:org:${orgId}`],
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

/** Clerk org display name. Cached for 4h alongside everything else on the
 *  report — org name renames are very rare, so this is fine. */
export async function fetchOrgName(orgId: string): Promise<string> {
  return unstable_cache(
    async () => {
      try {
        const client = await clerkClient();
        const org = await client.organizations.getOrganization({ organizationId: orgId });
        return org.name || orgId;
      } catch (err) {
        console.error(`[dashboard-report] fetchOrgName(${orgId}) failed:`, err);
        return orgId;
      }
    },
    [`fetchOrgName`, orgId],
    {
      tags: [`report:org:${orgId}`],
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

export async function fetchLeads(orgId: string, brandId: string, featureSlug: string): Promise<Lead[]> {
  return unstable_cache(
    async () => {
      const result = await adminGet<{ leads: Lead[] }>(
        "listBrandLeads",
        `/leads?brandId=${brandId}&limit=${REPORT_FETCH_LIMIT}`,
        orgId,
      );
      const leads = result.leads ?? [];
      return leads.filter((l) => !l.featureSlug || l.featureSlug === featureSlug);
    },
    [`fetchLeads`, orgId, brandId, featureSlug],
    {
      tags: reportTags(orgId, brandId, featureSlug),
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

/** Per-campaign email fetch. Each cache entry is small + cheap to fill, so
 *  brand-wide fan-out (see `fetchAllEmails`) stays well under the upstream
 *  abort even on multi-campaign brands. */
async function fetchEmailsForCampaign(orgId: string, brandId: string, campaignId: string): Promise<Email[]> {
  return unstable_cache(
    async () => {
      const result = await adminGet<{ emails: Email[] }>(
        "listCampaignEmails",
        `/emails?brandId=${brandId}&campaignId=${campaignId}&limit=${REPORT_FETCH_LIMIT}`,
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
    },
    [`fetchEmailsForCampaign`, orgId, brandId, campaignId],
    {
      tags: [`emails:campaign:${campaignId}`, `report:brand:${brandId}`, `report:org:${orgId}`],
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

/** All emails for a brand × feature, fanned out per campaign in parallel and
 *  cached at both the per-campaign layer and the per-brand layer. Used by:
 *  - /report/.../leads (server-embeds each lead's emails for instant drawer)
 *  - /report/.../emails (table of every generated email) */
export async function fetchAllEmails(orgId: string, brandId: string, featureSlug: string): Promise<Email[]> {
  return unstable_cache(
    async () => {
      const campaigns = await fetchCampaigns(orgId, brandId, featureSlug);
      if (campaigns.length === 0) return [];
      const buckets = await Promise.all(
        campaigns.map((c) =>
          fetchEmailsForCampaign(orgId, brandId, c.id).catch((err) => {
            console.error(`[dashboard-report] fetchEmailsForCampaign failed for ${c.id}:`, err);
            return [] as Email[];
          }),
        ),
      );
      return buckets.flat();
    },
    [`fetchAllEmails`, orgId, brandId, featureSlug],
    {
      tags: reportTags(orgId, brandId, featureSlug),
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

/** Aggregated stats for a brand × feature. Avoids fetching every lead just
 *  to count statuses on Overview. Returns the raw stats dict — callers know
 *  which keys they need. */
export interface FeatureStats {
  systemStats: { totalCostInUsdCents?: number | string } & Record<string, unknown>;
  stats: Record<string, number>;
}

export async function fetchFeatureStats(orgId: string, brandId: string, featureSlug: string): Promise<FeatureStats> {
  return unstable_cache(
    async () => {
      return adminGet<FeatureStats>(
        "featureStats",
        `/features/${encodeURIComponent(featureSlug)}/stats?brandId=${brandId}`,
        orgId,
      );
    },
    [`fetchFeatureStats`, orgId, brandId, featureSlug],
    {
      tags: reportTags(orgId, brandId, featureSlug),
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

/** Per-workflow grouped stats for a brand × feature. Used by the Workflows
 *  page to compute CAC per workflow (A/B comparison). */
export interface FeatureStatsGroupedByWorkflow {
  groups: Array<{
    workflowSlug: string | null;
    systemStats: { totalCostInUsdCents?: number | string } & Record<string, unknown>;
    stats: Record<string, number>;
  }>;
}

export async function fetchFeatureStatsByWorkflow(orgId: string, brandId: string, featureSlug: string): Promise<FeatureStatsGroupedByWorkflow> {
  return unstable_cache(
    async () => {
      return adminGet<FeatureStatsGroupedByWorkflow>(
        "featureStatsByWorkflow",
        `/features/${encodeURIComponent(featureSlug)}/stats?brandId=${brandId}&groupBy=workflowSlug`,
        orgId,
      );
    },
    [`fetchFeatureStatsByWorkflow`, orgId, brandId, featureSlug],
    {
      tags: reportTags(orgId, brandId, featureSlug),
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

export async function fetchCampaigns(orgId: string, brandId: string, featureSlug: string): Promise<Campaign[]> {
  return unstable_cache(
    async () => {
      const result = await adminGet<{ campaigns: Campaign[] }>("listCampaignsByBrand", `/campaigns?brandId=${brandId}`, orgId);
      const campaigns = result.campaigns ?? [];
      return campaigns.filter((c) => c.featureSlug === featureSlug);
    },
    [`fetchCampaigns`, orgId, brandId, featureSlug],
    {
      tags: reportTags(orgId, brandId, featureSlug),
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

export async function fetchWorkflows(orgId: string, featureSlug: string): Promise<Workflow[]> {
  return unstable_cache(
    async () => {
      const result = await adminGet<{ workflows: Workflow[] }>(
        "listWorkflows",
        `/workflows?featureSlug=${encodeURIComponent(featureSlug)}`,
        orgId,
      );
      return result.workflows ?? [];
    },
    [`fetchWorkflows`, orgId, featureSlug],
    {
      tags: [`workflows:org:${orgId}`, `report:org:${orgId}`],
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

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
