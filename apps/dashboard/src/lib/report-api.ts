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

/** GET against api-service with admin auth + org context. Returns the parsed
 *  body on 2xx, null on any failure. Logs full status + body on failure so
 *  Vercel runtime logs surface the real upstream reason. */
async function adminGet<T>(label: string, path: string, orgId: string): Promise<T | null> {
  if (!ADMIN_KEY) {
    console.error(`[dashboard-report] ADMIN_DISTRIBUTE_API_KEY missing; ${label} returns null`);
    return null;
  }
  const url = `${API_URL}/v1${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
        "x-external-org-id": orgId,
        "x-external-user-id": `report-public:${orgId}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[dashboard-report] ${label} ${url} → ${res.status}: ${body.slice(0, 500)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[dashboard-report] ${label} ${url} threw:`, err);
    return null;
  }
}

// All fetchers are wrapped in `react.cache()` so multiple Suspense boundaries
// in the same request share one HTTP roundtrip. Without it, Overview ends up
// firing /v1/leads twice (once for the stats grid, once for the CPA funnel),
// doubling the slowest-path latency.

export const fetchBrand = cache(async (orgId: string, brandId: string): Promise<Brand | null> => {
  const result = await adminGet<{ brand: Brand }>("getBrand", `/brands/${brandId}`, orgId);
  return result?.brand ?? null;
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

export const fetchLeads = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<Lead[]> => {
  const result = await adminGet<{ leads: Lead[] }>("listBrandLeads", `/leads?brandId=${brandId}`, orgId);
  const leads = result?.leads ?? [];
  return leads.filter((l) => !l.featureSlug || l.featureSlug === featureSlug);
});

export const fetchEmails = cache(async (orgId: string, brandId: string): Promise<Email[]> => {
  const result = await adminGet<{ emails: Email[] }>("listBrandEmails", `/emails?brandId=${brandId}`, orgId);
  return result?.emails ?? [];
});

export const fetchCampaigns = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<Campaign[]> => {
  const result = await adminGet<{ campaigns: Campaign[] }>("listCampaignsByBrand", `/campaigns?brandId=${brandId}`, orgId);
  const campaigns = result?.campaigns ?? [];
  return campaigns.filter((c) => c.featureSlug === featureSlug);
});

export const fetchWorkflows = cache(async (orgId: string, featureSlug: string): Promise<Workflow[]> => {
  const result = await adminGet<{ workflows: Workflow[] }>(
    "listWorkflows",
    `/workflows?featureSlug=${encodeURIComponent(featureSlug)}`,
    orgId,
  );
  return result?.workflows ?? [];
});

interface CostStatsResponse {
  groups: { totalCostInUsdCents: string }[];
}

/** Total spend (USD cents) for this brand × feature across all run costs. */
export const fetchTotalCostCents = cache(async (orgId: string, brandId: string, featureSlug: string): Promise<number> => {
  const params = new URLSearchParams({ brandId, groupBy: "costName", featureSlug });
  const result = await adminGet<CostStatsResponse>(
    "runsCostStats",
    `/runs/stats/costs?${params.toString()}`,
    orgId,
  );
  if (!result) return 0;
  return result.groups.reduce((sum, g) => sum + Number(g.totalCostInUsdCents || 0), 0);
});

/** A row representing one company derived from enriched leads. */
export interface CompanyRow {
  name: string;
  domain: string | null;
  industry: string | null;
  employees: number | null;
  country: string | null;
  city: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  leadCount: number;
}

export function deriveCompaniesFromLeads(leads: Lead[]): CompanyRow[] {
  const byKey = new Map<string, CompanyRow>();
  for (const lead of leads) {
    const org = lead.lead?.organization;
    if (!org) continue;
    const key = org.id || org.primaryDomain || org.name || "";
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      existing.leadCount += 1;
      continue;
    }
    byKey.set(key, {
      name: org.name ?? "",
      domain: org.primaryDomain,
      industry: org.industry,
      employees: org.estimatedNumEmployees,
      country: org.country,
      city: org.city,
      websiteUrl: org.websiteUrl,
      linkedinUrl: org.linkedinUrl,
      leadCount: 1,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => b.leadCount - a.leadCount);
}

/** A row representing one individual (lead person) with their max enriched info. */
export interface IndividualRow {
  firstName: string;
  lastName: string;
  email: string;
  headline: string | null;
  title: string | null;
  seniority: string | null;
  department: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  status: string;
  emailStatus: string | null;
}

export function deriveIndividualsFromLeads(leads: Lead[]): IndividualRow[] {
  return leads.map((lead) => {
    const fullLead = lead.lead;
    const org = fullLead?.organization;
    const currentJob = fullLead?.employmentHistory?.find((e) => e.current);
    return {
      firstName: fullLead?.firstName ?? "",
      lastName: fullLead?.lastName ?? "",
      email: lead.email,
      headline: fullLead?.headline ?? null,
      title: currentJob?.title ?? null,
      seniority: fullLead?.seniority ?? null,
      department: fullLead?.departments?.[0] ?? null,
      company: org?.name ?? null,
      city: fullLead?.city ?? null,
      state: fullLead?.state ?? null,
      country: fullLead?.country ?? null,
      linkedinUrl: fullLead?.linkedinUrl ?? null,
      twitterUrl: fullLead?.twitterUrl ?? null,
      status: lead.status,
      emailStatus: lead.emailStatus,
    };
  });
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
