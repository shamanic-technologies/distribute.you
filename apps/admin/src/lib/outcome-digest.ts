import { z } from "zod";
import { parseFeatureRevenue } from "./revenue-parse";
import type { RevenueOverview } from "./revenue-view";

export const OUTCOME_DIGEST_TEMPLATE = "daily-outcome-digest";
export const OUTCOME_DIGEST_FEATURE_SLUG = "sales-cold-email-outreach";
// PostHog beta-cohort gate for the daily digest send. Reuses the existing
// `beta-campaign-activity` cohort (Kevin) — the live-activity UI that
// originally owned this flag was removed, but the cohort lives on as the
// digest's audience selector.
export const OUTCOME_DIGEST_BETA_FLAG = "beta-campaign-activity";

const PAGE_LIMIT = 100;
const MAX_TOP_OUTCOMES_PER_BRAND = 5;
const CLERK_API_URL = "https://api.clerk.com/v1";

export type DigestFetch = typeof fetch;

interface EnvConfig {
  apiUrl: string;
  adminApiKey: string;
  clerkSecretKey: string;
  posthogHost: string;
  posthogProjectToken: string;
}

export interface OutcomeDigestRuntimeConfig extends EnvConfig {
  fetchFn?: DigestFetch;
}

interface ClerkOrganization {
  id: string;
  name: string | null;
}

interface ApiUser {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface BrandSummary {
  id: string;
  name: string | null;
  url: string | null;
  domain: string | null;
}

export interface DigestOutcomeOrg {
  orgName: string;
  expectedRevenueUsd: number;
  tags: string[];
  topPersonName: string | null;
}

export interface DigestBrandSummary {
  brandName: string;
  brandUrl: string | null;
  totalPipelineUsd: number;
  organizations: DigestOutcomeOrg[];
}

export interface PreparedDigestSend {
  orgId: string;
  orgName: string;
  userExternalId: string;
  recipientEmail: string;
  metadata: Record<string, string>;
}

export interface OutcomeDigestCollection {
  scannedOrgs: number;
  betaUsers: number;
  preparedSends: PreparedDigestSend[];
}

export interface OutcomeDigestSendResult extends OutcomeDigestCollection {
  sent: number;
  deduplicated: number;
}

const ClerkOrganizationsResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
  })),
  total_count: z.number(),
});

const ApiUsersResponseSchema = z.object({
  users: z.array(z.object({
    externalId: z.string(),
    email: z.string().nullable(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
  }).passthrough()),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

const BrandsResponseSchema = z.object({
  brands: z.array(z.object({
    id: z.string(),
    name: z.string().nullable(),
    domain: z.string().nullable(),
    url: z.string().nullable().optional(),
    brandUrl: z.string().nullable().optional(),
  }).passthrough()),
});

const PostHogDecideResponseSchema = z.object({
  featureFlags: z.record(z.string(), z.unknown()),
});

const EmailSendResponseSchema = z.object({
  sent: z.boolean(),
  deduplicated: z.boolean().optional(),
});

export function outcomeDigestConfigFromEnv(): EnvConfig {
  return {
    apiUrl: requireEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL").replace(/\/$/, ""),
    adminApiKey: requireEnv("ADMIN_DISTRIBUTE_API_KEY"),
    clerkSecretKey: requireEnv("CLERK_SECRET_KEY"),
    posthogHost: requireEnv("NEXT_PUBLIC_POSTHOG_HOST").replace(/\/$/, ""),
    posthogProjectToken: requireEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"),
  };
}

export function verifyOutcomeDigestCronRequest(req: Request): boolean {
  const cronSecret = requireEnv("CRON_SECRET");
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function collectOutcomeDigestSends(
  input: OutcomeDigestRuntimeConfig,
): Promise<OutcomeDigestCollection> {
  const fetchFn = input.fetchFn ?? fetch;
  const orgs = await listClerkOrganizations(input, fetchFn);
  const preparedSends: PreparedDigestSend[] = [];
  let betaUsers = 0;

  for (const org of orgs) {
    const users = await listApiUsersForOrg(input, fetchFn, org.id);
    const eligibleUsers: ApiUser[] = [];
    for (const user of users) {
      if (!user.email) continue;
      if (await isUserInPostHogBeta(input, fetchFn, user)) {
        eligibleUsers.push(user);
      }
    }
    betaUsers += eligibleUsers.length;
    if (eligibleUsers.length === 0) continue;

    const summaries = await collectBrandSummaries(input, fetchFn, org.id);
    if (summaries.length === 0) continue;

    const metadata = digestMetadata(org, summaries);
    for (const user of eligibleUsers) {
      if (!user.email) continue;
      preparedSends.push({
        orgId: org.id,
        orgName: org.name ?? org.id,
        userExternalId: user.externalId,
        recipientEmail: user.email,
        metadata,
      });
    }
  }

  return { scannedOrgs: orgs.length, betaUsers, preparedSends };
}

export async function sendOutcomeDigestEmails(
  input: OutcomeDigestRuntimeConfig,
): Promise<OutcomeDigestSendResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const collection = await collectOutcomeDigestSends({ ...input, fetchFn });
  let sent = 0;
  let deduplicated = 0;

  for (const item of collection.preparedSends) {
    const result = await sendDigestEmail(input, fetchFn, item);
    if (result.sent) sent += 1;
    if (result.deduplicated === true) deduplicated += 1;
  }

  return { ...collection, sent, deduplicated };
}

export function renderOutcomeDigestHtml(summaries: DigestBrandSummary[]): string {
  return summaries.map((summary) => {
    const brandLabel = escapeHtml(summary.brandName);
    const brandUrl = summary.brandUrl
      ? ` <span style="color:#64748b;font-size:13px;">${escapeHtml(summary.brandUrl)}</span>`
      : "";
    const rows = summary.organizations.slice(0, MAX_TOP_OUTCOMES_PER_BRAND).map((org) => {
      const person = org.topPersonName ? ` · ${escapeHtml(org.topPersonName)}` : "";
      const tags = org.tags.length > 0
        ? `<div style="color:#64748b;font-size:12px;margin-top:2px;">${escapeHtml(org.tags.join(", "))}${person}</div>`
        : `<div style="color:#64748b;font-size:12px;margin-top:2px;">${person.replace(/^ · /, "")}</div>`;
      return `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e2e8f0;">
            <div style="font-weight:600;color:#0f172a;">${escapeHtml(org.orgName)}</div>
            ${tags}
          </td>
          <td style="padding:10px 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:700;color:#15803d;">
            ${formatUsd(org.expectedRevenueUsd)}
          </td>
        </tr>`;
    }).join("");
    return `
      <section style="margin:24px 0;">
        <h2 style="font-size:18px;color:#0f172a;margin:0 0 4px;">${brandLabel}${brandUrl}</h2>
        <p style="font-size:14px;color:#475569;margin:0 0 12px;">
          ${summary.organizations.length} outcome organization${summary.organizations.length === 1 ? "" : "s"} · ${formatUsd(summary.totalPipelineUsd)} expected revenue
        </p>
        <table role="presentation" style="width:100%;border-collapse:collapse;">${rows}</table>
      </section>`;
  }).join("");
}

function renderOutcomeDigestText(summaries: DigestBrandSummary[]): string {
  return summaries.map((summary) => {
    const header = `${summary.brandName} — ${summary.organizations.length} outcome organization${summary.organizations.length === 1 ? "" : "s"} — ${formatUsd(summary.totalPipelineUsd)} expected revenue`;
    const rows = summary.organizations.slice(0, MAX_TOP_OUTCOMES_PER_BRAND).map((org) => {
      const tags = org.tags.length > 0 ? ` (${org.tags.join(", ")})` : "";
      const person = org.topPersonName ? ` — ${org.topPersonName}` : "";
      return `- ${org.orgName}: ${formatUsd(org.expectedRevenueUsd)}${tags}${person}`;
    });
    return [header, ...rows].join("\n");
  }).join("\n\n");
}

function digestMetadata(
  org: ClerkOrganization,
  summaries: DigestBrandSummary[],
): Record<string, string> {
  const totalExpectedRevenue = summaries.reduce((sum, s) => sum + s.totalPipelineUsd, 0);
  const totalOutcomeOrganizations = summaries.reduce((sum, s) => sum + s.organizations.length, 0);
  return {
    orgName: org.name ?? org.id,
    totalBrandsWithOutcomes: String(summaries.length),
    totalOutcomeOrganizations: String(totalOutcomeOrganizations),
    totalExpectedRevenueUsd: formatUsd(totalExpectedRevenue),
    digestHtml: renderOutcomeDigestHtml(summaries),
    digestText: renderOutcomeDigestText(summaries),
  };
}

async function listClerkOrganizations(
  config: EnvConfig,
  fetchFn: DigestFetch,
): Promise<ClerkOrganization[]> {
  const orgs: ClerkOrganization[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const url = `${CLERK_API_URL}/organizations?limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${config.clerkSecretKey}`,
        "Content-Type": "application/json",
      },
    }, fetchFn, ClerkOrganizationsResponseSchema, "listClerkOrganizations");
    if (data.data.length === 0 && offset < data.total_count) {
      throw new Error("[dashboard-outcome-digest] listClerkOrganizations returned an empty non-terminal page");
    }
    orgs.push(...data.data);
    if (offset + data.data.length >= data.total_count) break;
  }
  return orgs;
}

async function listApiUsersForOrg(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
): Promise<ApiUser[]> {
  const users: ApiUser[] = [];
  for (let offset = 0; ; offset += PAGE_LIMIT) {
    const url = `${config.apiUrl}/v1/users?limit=${PAGE_LIMIT}&offset=${offset}`;
    const data = await fetchJson(url, {
      headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
    }, fetchFn, ApiUsersResponseSchema, "listApiUsersForOrg");
    if (data.users.length === 0 && offset < data.total) {
      throw new Error("[dashboard-outcome-digest] listApiUsersForOrg returned an empty non-terminal page");
    }
    users.push(...data.users);
    if (offset + data.users.length >= data.total) break;
  }
  return users;
}

async function isUserInPostHogBeta(
  config: EnvConfig,
  fetchFn: DigestFetch,
  user: ApiUser,
): Promise<boolean> {
  const data = await fetchJson(`${config.posthogHost}/decide/?v=3`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.posthogProjectToken,
      distinct_id: user.externalId,
      person_properties: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    }),
  }, fetchFn, PostHogDecideResponseSchema, "posthogDecide");
  return data.featureFlags[OUTCOME_DIGEST_BETA_FLAG] === true;
}

async function collectBrandSummaries(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
): Promise<DigestBrandSummary[]> {
  const brands = await listBrandsForOrg(config, fetchFn, orgId);
  const summaries: DigestBrandSummary[] = [];
  for (const brand of brands) {
    const revenue = await fetchBrandRevenue(config, fetchFn, orgId, brand.id);
    if (revenue.organizations.length === 0) continue;
    summaries.push(toDigestBrandSummary(brand, revenue));
  }
  return summaries;
}

async function listBrandsForOrg(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
): Promise<BrandSummary[]> {
  const data = await fetchJson(`${config.apiUrl}/v1/brands`, {
    headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
  }, fetchFn, BrandsResponseSchema, "listBrandsForOrg");
  return data.brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    domain: brand.domain,
    url: brand.url ?? brand.brandUrl ?? null,
  }));
}

async function fetchBrandRevenue(
  config: EnvConfig,
  fetchFn: DigestFetch,
  orgId: string,
  brandId: string,
): Promise<RevenueOverview> {
  const params = new URLSearchParams({ brandId });
  const raw = await fetchJsonUntyped(`${config.apiUrl}/v1/features/${OUTCOME_DIGEST_FEATURE_SLUG}/revenue?${params.toString()}`, {
    headers: adminHeaders(config, orgId, `outcome-digest:${orgId}`),
  }, fetchFn, "fetchBrandRevenue");
  return parseFeatureRevenue(raw, "outcomeDigestRevenue");
}

async function sendDigestEmail(
  config: EnvConfig,
  fetchFn: DigestFetch,
  item: PreparedDigestSend,
): Promise<z.infer<typeof EmailSendResponseSchema>> {
  return fetchJson(`${config.apiUrl}/v1/emails/send`, {
    method: "POST",
    headers: adminHeaders(config, item.orgId, item.userExternalId),
    body: JSON.stringify({
      eventType: OUTCOME_DIGEST_TEMPLATE,
      recipientEmail: item.recipientEmail,
      productId: `${OUTCOME_DIGEST_TEMPLATE}:${new Date().toISOString().slice(0, 10)}`,
      metadata: item.metadata,
    }),
  }, fetchFn, EmailSendResponseSchema, "sendDigestEmail");
}

function toDigestBrandSummary(brand: BrandSummary, revenue: RevenueOverview): DigestBrandSummary {
  const organizations = revenue.organizations
    .map((org): DigestOutcomeOrg => ({
      orgName: org.orgName ?? org.orgDomain ?? org.orgId ?? "Unknown organization",
      expectedRevenueUsd: org.expectedRevenueUsd,
      tags: org.tags,
      topPersonName: org.topPerson
        ? [org.topPerson.firstName, org.topPerson.lastName].filter(Boolean).join(" ") || null
        : null,
    }))
    .sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd);

  return {
    brandName: brand.name ?? brand.domain ?? brand.url ?? brand.id,
    brandUrl: brand.url,
    totalPipelineUsd: revenue.totalPipelineUsd ?? 0,
    organizations,
  };
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  fetchFn: DigestFetch,
  schema: z.ZodSchema<T>,
  label: string,
): Promise<T> {
  const raw = await fetchJsonUntyped(url, init, fetchFn, label);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard-outcome-digest] ${label} response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard-outcome-digest] ${label}: invalid response shape`);
  }
  return parsed.data;
}

async function fetchJsonUntyped(
  url: string,
  init: RequestInit,
  fetchFn: DigestFetch,
  label: string,
): Promise<unknown> {
  const res = await fetchFn(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`[dashboard-outcome-digest] ${label} ${url} returned ${res.status}: ${body.slice(0, 500)}`);
    throw new Error(`[dashboard-outcome-digest] ${label} returned ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

function adminHeaders(config: EnvConfig, orgId: string, userId: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-API-Key": config.adminApiKey,
    "x-external-org-id": orgId,
    "x-external-user-id": userId,
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[dashboard-outcome-digest] ${name} is required`);
  return value;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
