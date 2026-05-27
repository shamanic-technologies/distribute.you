import "server-only";
import { unstable_cache } from "next/cache";
import type {
  Brand,
  Campaign,
  Email,
  Lead,
  StatsRegistry,
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
 *  the unstable_cache entry for the next 4 hours.
 *
 *  `extraHeaders` lets callers add identity headers like `x-brand-id` that
 *  api-service forwards to downstream services (per the multi-brand CSV
 *  header convention shipped in api-service PR #270). */
export async function adminGet<T>(
  label: string,
  path: string,
  orgId: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
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
        ...extraHeaders,
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

/** POST against api-service with admin auth + org context. Symmetric to
 *  `adminGet` but for write proxies used by the public report Route
 *  Handlers (draft generation, pitch submission). The Next.js Route
 *  Handlers in `/api/report/.../{draft,reply}` use this so the public page
 *  never holds an admin key client-side.
 *
 *  `extraHeaders` lets callers add identity headers like `x-brand-id` that
 *  api-service forwards to downstream services (per api-service PR #270
 *  multi-brand CSV header convention). */
export async function adminPost<T>(
  label: string,
  path: string,
  orgId: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  if (!ADMIN_KEY) {
    throw new Error(`[dashboard-report] ADMIN_DISTRIBUTE_API_KEY missing; ${label} failed`);
  }
  const url = `${API_URL}/v1${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
        "x-external-org-id": orgId,
        "x-external-user-id": `report-public:${orgId}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[dashboard-report] ${label} ${url} threw:`, err);
    throw new Error(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[dashboard-report] ${label} ${url} → ${res.status}: ${text.slice(0, 500)}`);
    throw new Error(`${label} returned ${res.status}: ${text.slice(0, 200)}`);
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

/** Clerk org display name. Cached for 4h — org renames are rare and we
 *  don't need fresher than that for a public report header.
 *
 *  Calls the Clerk Backend REST API directly with `CLERK_SECRET_KEY`
 *  instead of `clerkClient()` from `@clerk/nextjs/server`. The SDK
 *  client transparently failed when called from inside `unstable_cache`
 *  (caught here and silently fell back to the raw orgId, which is what
 *  the recipient saw as "Prepared by org_3ANN…"). A bare fetch has no
 *  request-context dependency and surfaces real failures in the log. */
export async function fetchOrgName(orgId: string): Promise<string> {
  return unstable_cache(
    async () => {
      const secret = process.env.CLERK_SECRET_KEY;
      if (!secret) {
        console.error(`[dashboard-report] fetchOrgName(${orgId}): CLERK_SECRET_KEY missing`);
        return orgId;
      }
      try {
        const res = await fetch(`https://api.clerk.com/v1/organizations/${orgId}`, {
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`[dashboard-report] fetchOrgName(${orgId}) → ${res.status}: ${body.slice(0, 300)}`);
          return orgId;
        }
        const org = (await res.json()) as { name?: string | null };
        return org.name || orgId;
      } catch (err) {
        console.error(`[dashboard-report] fetchOrgName(${orgId}) threw:`, err);
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
 *  abort even on multi-campaign brands. Exported so the lazy-drawer
 *  Route Handler (`/api/report/.../lead-emails`) can reuse the same
 *  cached entries the server-rendered fan-out would hit. */
export async function fetchEmailsForCampaign(orgId: string, brandId: string, campaignId: string): Promise<Email[]> {
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

/** Stats key registry — `key -> { type, label }`. Single source of truth for
 *  every stats label rendered on the public report; mirrors the operator-side
 *  `useFeatures().registry` consumption pattern (see
 *  `components/campaign/leads-stats-panel.tsx`). Registry is org-agnostic but
 *  the api-service gateway requires `x-org-id`; `adminGet` supplies it. */
export async function fetchStatsRegistry(orgId: string): Promise<StatsRegistry> {
  return unstable_cache(
    async () => {
      const result = await adminGet<{ registry: StatsRegistry }>(
        "statsRegistry",
        `/features/stats/registry`,
        orgId,
      );
      return result.registry ?? {};
    },
    [`fetchStatsRegistry`, orgId],
    {
      tags: [`stats-registry`, `report:org:${orgId}`],
      revalidate: REPORT_REVALIDATE_SECONDS,
    },
  )();
}

// ─── HITL — pr-expert-quote-opportunities ───────────────────────────────────
// The public report for this feature is interactive: the client sees a
// ranked queue and triggers draft generation + pitch submission. All three
// surfaces are brand-scoped (not campaign-scoped) — the public URL has no
// campaignId. journalists-quotes-service accepts brand-only requests and
// auto-resolves generation inputs (spokesperson, expertiseTopics, …) from
// brand-service `extract-fields`.

export interface RankedOpportunityRow {
  opportunityId: string;
  provider: string;
  ingestionChannel: string;
  featuredQuestionId: number | null;
  mediaOutlet: string | null;
  journalistName: string | null;
  opportunityText: string;
  deadline: string | null;
  pitchUrl: string | null;
  pitchEmail: string | null;
  category: string | null;
  score: number;
  whyRelevant: string | null;
}

export interface RankedOpportunitiesResponse {
  status: string;
  opportunities: RankedOpportunityRow[];
  total: number;
}

/** Ranked HITL queue, BRAND-SCOPED. The public report URL is
 *  `/report/{orgId}/{brandId}/pr-expert-quote-opportunities` — there is no
 *  campaignId in the path. journalists-quotes-service dedups + scores at
 *  the brand level. Brand identity flows via the `x-brand-id` header (CSV
 *  for multi-brand, per the v0.8.1 contract); body carries only `limit` /
 *  `offset`. Cached for 4h via unstable_cache; mutations on this brand
 *  should call revalidateTag from the corresponding route handler. */
export async function fetchRankedOpportunitiesByBrand(
  orgId: string,
  brandId: string,
  limit = 50,
): Promise<RankedOpportunityRow[]> {
  return unstable_cache(
    async () => {
      try {
        const result = await adminPost<RankedOpportunitiesResponse>(
          "rankedOpportunitiesByBrand",
          `/orgs/opportunities/ranked`,
          orgId,
          { limit },
          { "x-brand-id": brandId },
        );
        return result.opportunities ?? [];
      } catch (err) {
        console.error(
          `[dashboard-report] fetchRankedOpportunitiesByBrand(${brandId}) failed:`,
          err,
        );
        return [];
      }
    },
    [`fetchRankedOpportunitiesByBrand`, orgId, brandId, String(limit)],
    {
      tags: [
        `opportunities:brand:${brandId}`,
        `report:brand:${brandId}`,
        `report:org:${orgId}`,
      ],
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

