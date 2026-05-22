import "server-only";
import {
  getBrand,
  listBrandLeads,
  listBrandEmails,
  listCampaignsByBrand,
  listWorkflows,
  type Brand,
  type Campaign,
  type Email,
  type Lead,
  type Workflow,
} from "@/lib/api";

const ADMIN_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

/** Wraps an api-service call with the admin API key so the public report
 *  page can fetch data without a Clerk session. Returns `null` on failure
 *  instead of throwing — placeholder rendering takes over downstream. */
async function safeFetch<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  if (!ADMIN_KEY) {
    console.error(`[dashboard-report] ADMIN_DISTRIBUTE_API_KEY missing; ${label} returns null`);
    return null;
  }
  try {
    return await fn();
  } catch (err) {
    console.error(`[dashboard-report] ${label} failed:`, err);
    return null;
  }
}

export async function fetchBrand(brandId: string): Promise<Brand | null> {
  const result = await safeFetch("getBrand", () => getBrand(brandId, ADMIN_KEY));
  return result?.brand ?? null;
}

export async function fetchLeads(brandId: string, featureSlug: string): Promise<Lead[]> {
  const result = await safeFetch("listBrandLeads", () => listBrandLeads(brandId, ADMIN_KEY));
  const leads = result?.leads ?? [];
  return leads.filter((l) => !l.featureSlug || l.featureSlug === featureSlug);
}

export async function fetchEmails(brandId: string): Promise<Email[]> {
  const result = await safeFetch("listBrandEmails", () => listBrandEmails(brandId, ADMIN_KEY));
  return result?.emails ?? [];
}

export async function fetchCampaigns(brandId: string, featureSlug: string): Promise<Campaign[]> {
  const result = await safeFetch("listCampaignsByBrand", () => listCampaignsByBrand(brandId, ADMIN_KEY));
  const campaigns = result?.campaigns ?? [];
  return campaigns.filter((c) => c.featureSlug === featureSlug);
}

export async function fetchWorkflows(featureSlug: string): Promise<Workflow[]> {
  const result = await safeFetch("listWorkflows", () => listWorkflows({ featureSlug }, ADMIN_KEY));
  return result?.workflows ?? [];
}

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
