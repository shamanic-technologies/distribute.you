import { z } from "zod";
import {
  buildExpertQuotePitchVariables,
  coerceExtractedToString,
  selectPriorSubmittedPitches,
  type QuoteOpportunityContext,
} from "./quote-pitch-variables";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "./org-desync";
import { keepLastGoodFields, keepLastGoodList } from "./keep-last-good";
import type { RevenueOverview } from "./revenue-view";
import { parseFeatureRevenue } from "./revenue-parse";
import { withAverageCampaignRelevanceScores } from "./outlet-relevance";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

interface ApiOptions {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Unified API call function.
 * - With token: direct call to external API (server-side usage)
 * - Without token: routes through /api/v1 proxy (client-side, auth via Clerk cookies)
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function asErrorBody(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { error: "Request failed", body: value };
}

function stringOrNumber(value: unknown): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function readJsonResponse(response: Response, endpoint: string): Promise<unknown> {
  const contentType = response.headers?.get?.("Content-Type") ?? "application/json";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text().catch(() => "");
    throw new ApiError("API returned a non-JSON response", response.status, {
      error: "Non-JSON API response",
      endpoint,
      status: response.status,
      contentType: contentType || null,
      preview: text.trim().slice(0, 200),
    });
  }

  try {
    return await response.json();
  } catch (err) {
    throw new ApiError("API returned invalid JSON", response.status, {
      error: "Invalid JSON API response",
      endpoint,
      status: response.status,
      contentType,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * The org the UI is currently rendering, parsed from the `/orgs/<id>/...` URL.
 * Client-side only. Sent to the proxy as `x-active-org-id` so the proxy can fail
 * closed (409 `org_desync`) when it disagrees with the Clerk session JWT — never
 * a silent cross-org read/write. The JWT remains the org authority server-side.
 */
function activeOrgIdFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/\/orgs\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function apiCall<T>(endpoint: string, options?: ApiOptions): Promise<T> {
  const { token, method = "GET", body, headers: extraHeaders } = options ?? {};

  const send = (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
    let url: string;

    if (token) {
      url = `${API_URL}/v1${endpoint}`;
      headers["X-API-Key"] = token;
    } else {
      url = `/api/v1${endpoint}`;
      const activeOrgId = activeOrgIdFromPath();
      if (activeOrgId) headers["x-active-org-id"] = activeOrgId;
    }

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send();

  // Org-switch rotation lag: the proxy refused because the session JWT hadn't
  // caught up with the UI's org yet. Wait a beat for Clerk to settle, retry once
  // (the path-derived org is re-read on the retry). Proxy-routed calls only.
  if (response.status === ORG_DESYNC_STATUS && !token) {
    const peek = await response.clone().json().catch(() => null);
    if (peek?.error === ORG_DESYNC_ERROR) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      response = await send();
    }
  }

  if (!response.ok) {
    const errorBody = asErrorBody(await readJsonResponse(response, endpoint));
    if (response.status === 402 && typeof window !== "undefined") {
      const { dispatchPaymentRequired } = await import("@/lib/billing-guard");
      dispatchPaymentRequired({
        balance_cents: stringOrNumber(errorBody.balance_cents),
        required_cents: stringOrNumber(errorBody.required_cents),
        error: stringOrUndefined(errorBody.error),
      });
    }
    throw new ApiError(
      stringOrUndefined(errorBody.error) ?? stringOrUndefined(errorBody.message) ?? "Request failed",
      response.status,
      errorBody
    );
  }

  return await readJsonResponse(response, endpoint) as T;
}

// Types
export interface UserInfo {
  userId: string;
  orgId: string;
  authType: "user_key" | "admin";
}

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface NewApiKey {
  id: string;
  key: string; // Full key, only shown once
  keyPrefix: string;
  name: string | null;
  message: string;
}

export interface ByokKey {
  provider: string;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
}

// User/Org info
export async function getMe(token?: string): Promise<UserInfo> {
  return apiCall<UserInfo>("/me", { token });
}

// API Keys
export async function listApiKeys(token?: string): Promise<{ keys: ApiKey[] }> {
  return apiCall<{ keys: ApiKey[] }>("/api-keys", { token });
}

export async function createApiKey(name?: string, token?: string): Promise<NewApiKey> {
  return apiCall<NewApiKey>("/api-keys", { token, method: "POST", body: { name } });
}

export async function deleteApiKey(id: string, token?: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/api-keys/${id}`, { token, method: "DELETE" });
}

// BYOK Keys
export async function listByokKeys(token?: string): Promise<{ keys: ByokKey[] }> {
  return apiCall<{ keys: ByokKey[] }>("/keys", { token });
}

export async function setByokKey(
  provider: string,
  apiKey: string,
  token?: string
): Promise<{ provider: string; maskedKey: string }> {
  return apiCall<{ provider: string; maskedKey: string }>("/keys", {
    token,
    method: "POST",
    body: { provider, apiKey },
  });
}

export async function deleteByokKey(
  provider: string,
  token?: string
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/keys/${provider}`, {
    token,
    method: "DELETE",
  });
}

// Activity tracking
export async function trackActivity(token?: string): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>("/activity", { token, method: "POST" });
}

// Auth event notifications (signup/signin)
export async function sendAuthNotification(
  eventType: string,
  token?: string,
  extra?: Record<string, string>
): Promise<unknown> {
  return apiCall<unknown>("/emails/send", {
    token,
    method: "POST",
    body: { eventType, metadata: { timestamp: new Date().toISOString(), ...extra } },
  });
}

// Campaign email notifications (create/stop)
export async function sendCampaignEmail(
  eventType: "campaign_created" | "campaign_stopped",
  campaign: { brandIds: string[]; id: string; name: string },
  token?: string
): Promise<void> {
  const brandId = campaign.brandIds?.[0];
  if (!brandId) return;
  await apiCall<unknown>("/emails/send", {
    token,
    method: "POST",
    body: {
      eventType,
      brandId,
      campaignId: campaign.id,
      metadata: { campaignName: campaign.name },
    },
  });
}

// User identity resolution
export async function resolveUser(
  params: {
    externalOrgId: string;
    externalUserId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  },
  token?: string
): Promise<{ orgId: string; userId: string }> {
  return apiCall<{ orgId: string; userId: string }>("/users/resolve", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

// Campaigns
export interface Campaign {
  id: string;
  name: string;
  status: string;
  workflowSlug: string | null;
  featureSlug: string | null;
  brandIds: string[];
  // Client-enriched via /v1/brands/by-ids. Raw api-service response no longer
  // carries this field since v0.42.2 (PR #469).
  brandUrls: string[];
  featureInputs: Record<string, string> | null;
  maxBudgetDailyUsd: string | null;
  maxBudgetWeeklyUsd: string | null;
  maxBudgetMonthlyUsd: string | null;
  maxBudgetTotalUsd: string | null;
  endDate: string | null;
  toResumeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostByName {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  totalQuantity: string;
}

export interface RecipientStats {
  contacted: number;
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
  clicked: number;
  unsubscribed: number;
  repliesPositive: number;
  repliesNegative: number;
  repliesNeutral: number;
  repliesAutoReply: number;
  repliesDetail: number;
}

export interface EmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  stepStats: Record<string, number>;
}

export interface CampaignStats {
  campaignId: string;
  totalCostInUsdCents?: string | null;
  costBreakdown?: CostByName[];
  leadsServed: number;
  leadsBuffered: number;
  leadsSkipped: number;
  emailsGenerated: number;
  recipientStats: RecipientStats;
  emailStats: EmailStats;
}

// Raw campaign shape as returned by api-service ≥ v0.42.2 (no brandUrls).
type RawCampaign = Omit<Campaign, "brandUrls">;

/** Batch lookup of brands by UUID. Proxies api-service /v1/brands/by-ids,
 *  which itself proxies brand-service /internal/brands?ids=...
 *  Missing ids are silently omitted from the response; caller maps by id. */
export interface BrandSummary {
  id: string;
  url: string | null;
  name: string | null;
  domain: string | null;
  logoUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getBrandsByIds(
  ids: string[],
  token?: string,
): Promise<{ brands: BrandSummary[] }> {
  if (ids.length === 0) return { brands: [] };
  const query = encodeURIComponent(ids.join(","));
  return apiCall<{ brands: BrandSummary[] }>(`/brands/by-ids?ids=${query}`, { token });
}

/** Attach brandUrls to each raw campaign by resolving brandIds via
 *  /v1/brands/by-ids in a single batched call. Missing ids are logged
 *  loudly and omitted from the resulting urls array. */
async function enrichCampaignsWithBrandUrls(
  rawCampaigns: RawCampaign[],
  token?: string,
): Promise<Campaign[]> {
  const allBrandIds = [...new Set(rawCampaigns.flatMap((c) => c.brandIds))];
  if (allBrandIds.length === 0) {
    return rawCampaigns.map((c) => ({ ...c, brandUrls: [] }));
  }
  const { brands } = await getBrandsByIds(allBrandIds, token);
  const brandById = new Map(brands.map((b) => [b.id, b]));
  return rawCampaigns.map((c) => {
    const brandUrls: string[] = [];
    for (const id of c.brandIds) {
      const brand = brandById.get(id);
      if (!brand) {
        console.error(
          `[dashboard] brand id ${id} missing from /v1/brands/by-ids response (campaign ${c.id})`,
        );
        continue;
      }
      if (brand.url) brandUrls.push(brand.url);
    }
    return { ...c, brandUrls };
  });
}

export async function listCampaigns(token?: string): Promise<{ campaigns: Campaign[] }> {
  const { campaigns } = await apiCall<{ campaigns: RawCampaign[] }>("/campaigns", { token });
  return { campaigns: await enrichCampaignsWithBrandUrls(campaigns, token) };
}

export async function getCampaignStats(campaignId: string, token?: string): Promise<CampaignStats> {
  return apiCall<CampaignStats>(`/campaigns/${campaignId}/stats`, { token });
}

export async function getCampaignBatchStats(
  campaignIds: string[],
  token?: string,
  brandId?: string
): Promise<Record<string, CampaignStats>> {
  const query = brandId ? `?brandId=${brandId}` : "";
  const result = await apiCall<{ campaigns: CampaignStats[] }>(`/campaigns/stats${query}`, { token });
  const byId = Object.fromEntries(result.campaigns.map((s) => [s.campaignId, s]));
  // Only return stats for requested campaign IDs
  return Object.fromEntries(campaignIds.filter((id) => byId[id]).map((id) => [id, byId[id]]));
}

export interface BrandDeliveryStats {
  recipientStats: RecipientStats;
  emailStats: EmailStats;
}

export async function getBrandDeliveryStats(brandId: string, token?: string): Promise<BrandDeliveryStats> {
  return apiCall<BrandDeliveryStats>(`/email-gateway/stats?brandId=${brandId}`, { token });
}

export interface CostStatsGroup {
  dimensions: Record<string, string | null>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostBreakdown(brandId: string, opts?: { featureSlug?: string }, token?: string): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "costName" });
  if (opts?.featureSlug) query.set("featureSlug", opts.featureSlug);
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  const costs: CostByName[] = result.groups.map((g) => ({
    costName: g.dimensions.costName ?? "Unknown",
    totalCostInUsdCents: g.totalCostInUsdCents,
    actualCostInUsdCents: g.actualCostInUsdCents,
    provisionedCostInUsdCents: g.provisionedCostInUsdCents,
    totalQuantity: String(g.runCount),
  }));
  return { costs };
}

export interface FeatureCostGroup {
  featureSlug: string | null;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostsByFeature(brandId: string, token?: string): Promise<{ groups: FeatureCostGroup[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "featureSlug" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  return {
    groups: result.groups.map((g) => ({
      featureSlug: g.dimensions.featureSlug ?? null,
      totalCostInUsdCents: g.totalCostInUsdCents,
      actualCostInUsdCents: g.actualCostInUsdCents,
      provisionedCostInUsdCents: g.provisionedCostInUsdCents,
      runCount: g.runCount,
    })),
  };
}

export interface BrandCostGroup {
  brandId: string | null;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  runCount: number;
}

export async function getOrgCostsByBrand(token?: string): Promise<{ groups: BrandCostGroup[] }> {
  const query = new URLSearchParams({ groupBy: "brandId" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  return {
    groups: result.groups.map((g) => ({
      brandId: g.dimensions.brandId ?? null,
      totalCostInUsdCents: g.totalCostInUsdCents,
      actualCostInUsdCents: g.actualCostInUsdCents,
      provisionedCostInUsdCents: g.provisionedCostInUsdCents,
      runCount: g.runCount,
    })),
  };
}

export async function getOrgCostBreakdown(token?: string): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ groupBy: "costName" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  const costs: CostByName[] = result.groups.map((g) => ({
    costName: g.dimensions.costName ?? "Unknown",
    totalCostInUsdCents: g.totalCostInUsdCents,
    actualCostInUsdCents: g.actualCostInUsdCents,
    provisionedCostInUsdCents: g.provisionedCostInUsdCents,
    totalQuantity: String(g.runCount),
  }));
  return { costs };
}

// Platform price catalog — authoritative `costName -> providerDomain` mapping.
// Public, no auth. Used to show a provider logo next to each cost label.
export interface PlatformPrice {
  name: string;
  provider: string;
  providerDomain: string;
}

const PlatformPriceSchema = z.object({
  name: z.string(),
  provider: z.string(),
  providerDomain: z.string(),
});
const PlatformPricesResponseSchema = z.array(PlatformPriceSchema);

export async function getPlatformPrices(token?: string): Promise<PlatformPrice[]> {
  const raw = await apiCall<unknown>(`/costs/platform-prices`, { token });
  const parsed = PlatformPricesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[dashboard] getPlatformPrices: response shape mismatch",
      { issues: parsed.error.issues, raw },
    );
    throw new Error("[dashboard] getPlatformPrices: invalid response shape");
  }
  return parsed.data;
}

export async function stopCampaign(campaignId: string, token?: string): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>(`/campaigns/${campaignId}/stop`, { token, method: "POST" });
}


// Brands
export interface Brand {
  id: string;
  domain: string | null;
  name: string | null;
  url: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logoUrl: string | null;
}

export type BrandDetail = Brand;

// brand-service /orgs/brands still emits `brandUrl`; /internal/brands/:id and
// /internal/brands?ids= emit `url`. Normalize at the client boundary.
interface BrandWireOrgs {
  id: string;
  domain: string | null;
  name: string | null;
  brandUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logoUrl: string | null;
}

function normalizeBrandFromOrgs(raw: BrandWireOrgs): Brand {
  const { brandUrl, ...rest } = raw;
  return { ...rest, url: brandUrl };
}

export async function listBrands(token?: string): Promise<{ brands: Brand[] }> {
  const { brands } = await apiCall<{ brands: BrandWireOrgs[] }>("/brands", { token });
  return { brands: brands.map(normalizeBrandFromOrgs) };
}

/** GET /brands/:brandId — returns brand detail or null if not found (404) */
export async function getBrand(brandId: string, token?: string): Promise<{ brand: BrandDetail } | null> {
  try {
    return await apiCall<{ brand: BrandDetail }>(`/brands/${brandId}`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Brand sales conversion economics (sales-cold-email funnel) ──
// Persisted per brand in brand-service via api-service /v1/brands/:id/sales-economics.
// READ returns the saved set or null (unset → the page uses its hard-coded defaults).
// WRITE is an idempotent full-set upsert that returns the saved row (never null).
// Conversion rates are integer percents (0–100); lifetimeRevenueUsd is whole US dollars.
// businessModel (b2c | b2b | null) is part of the saved set: it picks which funnel
// the revenue-overview pipeline applies. Both GET and PUT responses always include it.
export type BrandBusinessModel = "b2c" | "b2b";

export interface BrandSalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  visitToClosePct: number;
  businessModel: BrandBusinessModel | null;
  updatedAt: string;
}

// businessModel is a partial-update field on PUT: omit = leave unchanged, null = clear
// (brand-service contract). The campaign form omits it (edits only the 5 metrics); the
// Brand Settings editor sends it explicitly. Hence optional in the input, not required.
export type BrandSalesEconomicsInput = Omit<
  BrandSalesEconomics,
  "updatedAt" | "businessModel"
> & { businessModel?: BrandBusinessModel | null };

const BrandSalesEconomicsSchema = z.object({
  lifetimeRevenueUsd: z.number(),
  replyToMeetingPct: z.number(),
  visitToMeetingPct: z.number(),
  meetingToClosePct: z.number(),
  visitToClosePct: z.number(),
  businessModel: z.union([z.literal("b2c"), z.literal("b2b")]).nullable(),
  updatedAt: z.string(),
});

// READ: salesEconomics is null when nothing is saved yet (unset is a 200, not a 404).
const GetBrandSalesEconomicsResponseSchema = z.object({
  salesEconomics: BrandSalesEconomicsSchema.nullable(),
});

// WRITE: the row was just persisted, so salesEconomics is always present. Per CLAUDE.md
// #1221 the write response DTO is narrower than the read sibling — its own schema.
const SaveBrandSalesEconomicsResponseSchema = z.object({
  salesEconomics: BrandSalesEconomicsSchema,
});

/** GET /brands/:brandId/sales-economics — saved set or { salesEconomics: null } when unset. */
export async function getBrandSalesEconomics(
  brandId: string,
  token?: string,
): Promise<{ salesEconomics: BrandSalesEconomics | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-economics`, { token });
  const parsed = GetBrandSalesEconomicsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandSalesEconomics: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandSalesEconomics: invalid response shape");
  }
  return parsed.data;
}

/** PUT /brands/:brandId/sales-economics — idempotent upsert of the 5 metrics (+ optional businessModel). */
export async function saveBrandSalesEconomics(
  brandId: string,
  input: BrandSalesEconomicsInput,
  token?: string,
): Promise<{ salesEconomics: BrandSalesEconomics }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-economics`, {
    token,
    method: "PUT",
    body: {
      lifetimeRevenueUsd: input.lifetimeRevenueUsd,
      replyToMeetingPct: input.replyToMeetingPct,
      visitToMeetingPct: input.visitToMeetingPct,
      meetingToClosePct: input.meetingToClosePct,
      visitToClosePct: input.visitToClosePct,
      // Partial-update: send businessModel only when the caller set it (settings
      // editor). Omitting it leaves the stored value unchanged; null clears it.
      ...(input.businessModel !== undefined
        ? { businessModel: input.businessModel }
        : {}),
    },
  });
  const parsed = SaveBrandSalesEconomicsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandSalesEconomics: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandSalesEconomics: invalid response shape");
  }
  return parsed.data;
}

// ── Daily budget (per-brand spend pacing) ──
// A per-day spend ceiling campaign-service uses to pace a brand's work. Separate
// from org credit balance / top-up (that's affordability; this is allocation).
// Wire value is cents as a decimal string (Postgres numeric serializes as string,
// per CLAUDE.md numeric-string rule) -> coerce. null = never set (a 200, not a 404).
export interface BrandDailyBudget {
  brandId: string;
  dailyBudgetCents: number | null;
  updatedAt: string | null;
}

// READ: dailyBudgetCents null when unset; updatedAt null until first save.
const GetBrandDailyBudgetResponseSchema = z.object({
  brandId: z.string(),
  dailyBudgetCents: z.coerce.number().nullable(),
  updatedAt: z.string().nullable(),
});

// WRITE: the row was just persisted, so the value + updatedAt are always present;
// the write response adds orgId. Per-verb schema (narrower/different than read).
const SaveBrandDailyBudgetResponseSchema = z.object({
  brandId: z.string(),
  orgId: z.string(),
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

/** GET /brands/:brandId/daily-budget - saved cents or null when never set. */
export async function getBrandDailyBudget(
  brandId: string,
  token?: string,
): Promise<BrandDailyBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/daily-budget`, { token });
  const parsed = GetBrandDailyBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandDailyBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandDailyBudget: invalid response shape");
  }
  return parsed.data;
}

/** PATCH /brands/:brandId/daily-budget - set the per-day cents ceiling (0 = pause). */
export async function saveBrandDailyBudget(
  brandId: string,
  dailyBudgetCents: number,
  token?: string,
): Promise<{ brandId: string; orgId: string; dailyBudgetCents: number; updatedAt: string }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/daily-budget`, {
    token,
    method: "PATCH",
    body: { dailyBudgetCents },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = SaveBrandDailyBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandDailyBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandDailyBudget: invalid response shape");
  }
  return parsed.data;
}

// The welcome signup gift is NOT front-end editable. Its grant amount is
// code-owned and pinned at boot by instrumentation.ts (WELCOME_GIFT_CENTS →
// PATCH /v1/promo-codes/welcome). No dashboard read/write helper exists by design.

// ── Effective sales economics (new-campaign prefill) ──
// brand-service decides the default server-side: the brand's saved set when present
// (source "user"), else the cross-brand average (source "cross-brand-average"), else
// economics null (source null → empty table; caller keeps its hard-coded defaults).
// Replaces the old client-side null→average fallback (two calls) with ONE call.
export interface EffectiveSalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  visitToClosePct: number;
}

export type SalesEconomicsSource = "user" | "cross-brand-average";

// z.coerce.number per CLAUDE.md #1357: the cross-brand average is Postgres
// ROUND(AVG(...)) `numeric`, serialized as a STRING ("40") on the wire — z.number()
// would reject it. coerce parses string OR number, forward-compatible if cast later.
const EffectiveSalesEconomicsSchema = z.object({
  lifetimeRevenueUsd: z.coerce.number(),
  replyToMeetingPct: z.coerce.number(),
  visitToMeetingPct: z.coerce.number(),
  meetingToClosePct: z.coerce.number(),
  visitToClosePct: z.coerce.number(),
});

const GetSalesEconomicsEffectiveResponseSchema = z.object({
  economics: EffectiveSalesEconomicsSchema.nullable(),
  source: z.enum(["user", "cross-brand-average"]).nullable(),
});

/** GET /brands/:brandId/sales-economics-effective — the brand's saved set (source "user"),
 * else the cross-brand average (source "cross-brand-average"), else { economics: null, source: null }. */
export async function getSalesEconomicsEffective(
  brandId: string,
  token?: string,
): Promise<{ economics: EffectiveSalesEconomics | null; source: SalesEconomicsSource | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-economics-effective`, { token });
  const parsed = GetSalesEconomicsEffectiveResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getSalesEconomicsEffective: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getSalesEconomicsEffective: invalid response shape");
  }
  return parsed.data;
}

// Brand field extraction
export interface ExtractFieldDef {
  key: string;
  description: string;
}

/** Per-brand extraction metadata (byBrand[domain] entries) */
export interface BrandFieldExtraction {
  value: unknown;
  cached: boolean;
  extractedAt: string;
  expiresAt: string;
  sourceUrls: string[] | null;
}

export interface ExtractFieldResult {
  value: unknown;
  cached: boolean;
  extractedAt: string;
  expiresAt: string;
  sourceUrls: string[] | null;
  byBrand?: Record<string, BrandFieldExtraction>;
}

/** Brand summary returned in extract-fields response */
export interface ExtractFieldBrandInfo {
  brandId: string;
  domain: string;
  name: string;
}

/** Response shape for POST /brands/extract-fields (multi-brand) */
export interface ExtractFieldsResponse {
  brands: ExtractFieldBrandInfo[];
  fields: Record<string, ExtractFieldResult>;
}

/** A previously extracted and cached field (from GET /brands/:id/extracted-fields) */
export interface CachedField {
  key: string;
  value: unknown;
  sourceUrls: string[] | null;
  extractedAt: string;
  expiresAt: string;
}

/** Core sales profile fields — reproduces the old /sales-profile extraction */
export const SALES_PROFILE_FIELDS: ExtractFieldDef[] = [
  { key: "companyOverview", description: "Company overview" },
  { key: "valueProposition", description: "Core value proposition" },
  { key: "targetAudience", description: "Target audience description" },
  { key: "customerPainPoints", description: "Target pain points" },
  { key: "keyFeatures", description: "Key product features" },
  { key: "productDifferentiators", description: "Key differentiators" },
  { key: "competitors", description: "Known competitors" },
  { key: "leadership", description: "Key leadership team members, their roles and backgrounds" },
  { key: "funding", description: "Funding history: total raised, rounds, notable investors and backers" },
  { key: "awardsAndRecognition", description: "Awards, recognition, and industry accolades" },
  { key: "revenueMilestones", description: "Revenue milestones and key business metrics" },
  { key: "socialProof", description: "Social proof: case studies, testimonials, and results" },
  { key: "callToAction", description: "Primary CTA" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees, refund policy" },
  { key: "additionalContext", description: "Additional context and notable information" },
];


/** Convert extract-fields results map to a key→value map (preserves raw types) */
export function fieldResultsToMap(results: Record<string, ExtractFieldResult>): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const [key, r] of Object.entries(results)) map[key] = r.value;
  return map;
}

/** Flatten any field value to a string (for form pre-fill) */
export function flattenFieldValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => flattenFieldValue(v)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        const flat = flattenFieldValue(v);
        return flat ? `${k}: ${flat}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

/** Convert extract-fields results map to a string map (for form pre-fill) */
export function fieldResultsToStringMap(results: Record<string, ExtractFieldResult>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, r] of Object.entries(results)) map[key] = flattenFieldValue(r.value);
  return map;
}

/** POST /brands/extract-fields — extract specific fields (cached 30 days per field).
 *  brandIds is required and must be a non-empty array. */
export async function extractBrandFields(
  brandIds: string[],
  fields: ExtractFieldDef[],
  opts?: { token?: string; resetCache?: boolean },
): Promise<ExtractFieldsResponse> {
  const { token, resetCache } = opts ?? {};
  return apiCall<ExtractFieldsResponse>(
    `/brands/extract-fields`,
    { token, method: "POST", body: { brandIds, fields, resetCache } },
  );
}

/** GET /brands/:brandId/extracted-fields — list previously extracted and cached fields */
export async function listExtractedFields(
  brandId: string,
  token?: string,
): Promise<{ brandId: string; fields: CachedField[] }> {
  return apiCall<{ brandId: string; fields: CachedField[] }>(
    `/brands/${brandId}/extracted-fields`,
    { token },
  );
}

// ─── Feature prefill ───────────────────────────────────────────────────────

/** format=text response — flat string values */
export interface PrefillResponse {
  slug: string;
  brandId: string;
  prefilled: Record<string, string | null>;
}

/** format=full response — rich objects with byBrand metadata per domain */
export interface PrefillFullFieldResult {
  value: unknown;
  cached: boolean;
  sourceUrls: string[] | null;
  byBrand?: Record<string, BrandFieldExtraction>;
}

export interface PrefillFullResponse {
  slug: string;
  brandId: string;
  prefilled: Record<string, PrefillFullFieldResult>;
}

/** POST /features/:slug/prefill?format=text — get pre-filled input values as plain strings */
export async function prefillFeatureInputs(
  featureSlug: string,
  brandIds: string[],
  token?: string,
): Promise<PrefillResponse> {
  return apiCall<PrefillResponse>(
    `/features/${featureSlug}/prefill?format=text`,
    { token, method: "POST", body: { brandIds } },
  );
}

/** Extract flat string map from prefill response */
export function prefillToStringMap(prefilled: Record<string, string | null>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(prefilled)) {
    map[key] = value ?? "";
  }
  return map;
}

// ─── Features (from features-service) ──────────────────────────────────────

export interface FeatureInput {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  placeholder: string;
  description: string;
  extractKey: string;
  options?: string[];
}

export interface FeatureOutput {
  key: string;
  displayOrder: number;
  defaultSort?: boolean;
  sortDirection?: "asc" | "desc";
}

export interface FeatureEntity {
  name: string;
  countKey?: string;
}

export interface FunnelStep {
  key: string;
}

export interface BreakdownSegment {
  key: string;
  color: "green" | "blue" | "red" | "gray" | "orange";
  sentiment: "positive" | "neutral" | "negative";
}

export type FeatureChart =
  | { key: string; type: "funnel-bar"; title: string; displayOrder: number; steps: FunnelStep[] }
  | { key: string; type: "breakdown-bar"; title: string; displayOrder: number; segments: BreakdownSegment[] };

export interface Feature {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon?: string;
  status: "active" | "draft" | "deprecated";
  implemented: boolean;
  displayOrder?: number;
  inputs: FeatureInput[];
  outputs: FeatureOutput[];
  charts: FeatureChart[];
  entities: FeatureEntity[];
  byokProvider?: string | null;
  workflowSlug?: string | null;
}

// ─── Stats Registry & Stats Types ────────────────────────────────────────────

export interface StatsRegistryEntry {
  type: "count" | "rate" | "currency" | "score";
  label: string;
}

export type StatsRegistry = Record<string, StatsRegistryEntry>;

export interface SystemStats {
  totalCostInUsdCents: number;
  completedRuns: number;
  activeCampaigns: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
}

export interface StatsGroup {
  workflowSlug?: string;
  workflowDynastySlug?: string;
  brandId?: string;
  campaignId?: string;
  featureSlug?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
}

export interface FeatureStatsResponse {
  featureSlug?: string;
  groupBy?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
  groups?: StatsGroup[];
}

export interface GlobalStatsResponse {
  groupBy?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
  groups?: StatsGroup[];
}

/** GET /features — list all features */
export async function listFeatures(
  params?: { implemented?: boolean },
  token?: string,
): Promise<{ features: Feature[] }> {
  const query = new URLSearchParams();
  if (params?.implemented !== undefined) query.set("implemented", String(params.implemented));
  const qs = query.toString();
  return apiCall<{ features: Feature[] }>(`/features${qs ? `?${qs}` : ""}`, { token });
}

/** GET /features/:slug — get a single feature by versioned slug */
export async function getFeature(slug: string, token?: string): Promise<{ feature: Feature }> {
  return apiCall<{ feature: Feature }>(`/features/${slug}`, { token });
}

// ─── Entity Registry ─────────────────────────────────────────────────────────

export interface EntityRegistryEntry {
  label: string;
  icon: string;
  pathSuffix: string;
  description: string;
}

export type EntityRegistry = Record<string, EntityRegistryEntry>;

/** GET /features/entities/registry — entity type registry */
export async function fetchEntityRegistry(token?: string): Promise<{ registry: EntityRegistry }> {
  return apiCall<{ registry: EntityRegistry }>("/features/entities/registry", { token });
}

/** GET /features/stats/registry — stats key registry */
export async function fetchStatsRegistry(token?: string): Promise<{ registry: StatsRegistry }> {
  return apiCall<{ registry: StatsRegistry }>("/features/stats/registry", { token });
}

/** GET /features/:featureSlug/stats — stats for a feature */
export async function fetchFeatureStats(
  featureSlug: string,
  params?: { groupBy?: string; brandId?: string; campaignId?: string; workflowSlug?: string; workflowDynastySlug?: string },
  token?: string,
): Promise<FeatureStatsResponse> {
  const query = new URLSearchParams();
  if (params?.groupBy) query.set("groupBy", params.groupBy);
  if (params?.brandId) query.set("brandId", params.brandId);
  if (params?.campaignId) query.set("campaignId", params.campaignId);
  if (params?.workflowSlug) query.set("workflowSlug", params.workflowSlug);
  if (params?.workflowDynastySlug) query.set("workflowDynastySlug", params.workflowDynastySlug);
  const qs = query.toString();
  return apiCall<FeatureStatsResponse>(`/features/${featureSlug}/stats${qs ? `?${qs}` : ""}`, { token });
}

/** GET /features/stats — global stats cross-features */
export async function fetchGlobalStats(
  params?: { groupBy?: string; brandId?: string },
  token?: string,
): Promise<GlobalStatsResponse> {
  const query = new URLSearchParams();
  if (params?.groupBy) query.set("groupBy", params.groupBy);
  if (params?.brandId) query.set("brandId", params.brandId);
  const qs = query.toString();
  return apiCall<GlobalStatsResponse>(`/features/stats${qs ? `?${qs}` : ""}`, { token });
}

// ─── Feature revenue (expected pipeline) ─────────────────────────────────────
// features-service computes everything (MAX inside an entity, SUM across orgs);
// the dashboard only renders. The wire→view-model parse is shared with the
// public-report server build — see `parseFeatureRevenue` in `./revenue-parse`.
/** GET /features/:slug/revenue — expected pipeline revenue for a brand (optionally one campaign). */
export async function getFeatureRevenue(
  featureSlug: string,
  brandId: string,
  campaignId?: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId });
  if (campaignId) query.set("campaignId", campaignId);
  const raw = await apiCall<unknown>(`/features/${featureSlug}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getFeatureRevenue");
}

// ─── Per-campaign revenue ROI (grouped) ──────────────────────────────────────
// GET /features/:slug/revenue?groupBy=campaignId → one lean group per campaign
// that has runs for the brand+feature: { campaignId, totalPipelineUsd, roiMultiple }.
// A single call returns every campaign's ROI (no per-campaign fan-out). ROI =
// expected pipeline ÷ run cost (features-service is the single source). safeParse
// → shape rot becomes a caught fetch-error, never a render crash (CLAUDE.md #1213).
const FeatureRevenueByCampaignSchema = z.object({
  featureSlug: z.string(),
  groupBy: z.literal("campaignId"),
  groups: z.array(
    z.object({
      campaignId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: z.object({
        totalCostUsd: z.number(),
        costOfAcquisitionPct: z.number().nullable(),
        roiMultiple: z.number().nullable(),
      }),
    }),
  ),
});

export interface CampaignRevenueGroup {
  campaignId: string;
  totalPipelineUsd: number | null;
  totalCostUsd: number;
  /** totalPipelineUsd / totalCostUsd. Null when cost is 0 or pipeline is null. */
  roiMultiple: number | null;
}

/** GET /features/:slug/revenue?groupBy=campaignId — per-campaign ROI for a brand+feature. */
export async function getFeatureRevenueByCampaign(
  featureSlug: string,
  brandId: string,
  token?: string,
): Promise<CampaignRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "campaignId" });
  const raw = await apiCall<unknown>(`/features/${featureSlug}/revenue?${query.toString()}`, { token });
  const parsed = FeatureRevenueByCampaignSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFeatureRevenueByCampaign: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getFeatureRevenueByCampaign: invalid response shape");
  }
  return parsed.data.groups.map((g) => ({
    campaignId: g.campaignId,
    totalPipelineUsd: g.headline.totalPipelineUsd,
    totalCostUsd: g.costEconomics.totalCostUsd,
    roiMultiple: g.costEconomics.roiMultiple,
  }));
}

/** POST /brands — upsert brand by URL, returns brandId */
export async function upsertBrand(
  url: string,
  token?: string
): Promise<{ brandId: string; domain: string | null; name: string | null; created: boolean }> {
  return apiCall<{ brandId: string; domain: string | null; name: string | null; created: boolean }>(
    `/brands`,
    { token, method: "POST", body: { url } }
  );
}

/** POST /brands/:brandId/transfer — transfer brand to another org */
export async function transferBrand(
  brandId: string,
  targetOrgId: string,
  token?: string
): Promise<void> {
  await apiCall(
    `/brands/${brandId}/transfer`,
    { token, method: "POST", body: { targetOrgId } }
  );
}

// Brand transfers

interface TransferServiceSuccess {
  updatedTables: { tableName: string; count: number }[];
}
interface TransferServiceError {
  error: string;
}
interface TransferServiceSkipped {
  skipped: true;
}
type TransferServiceResult = TransferServiceSuccess | TransferServiceError | TransferServiceSkipped;

export interface BrandTransfer {
  id: string;
  brandId: string;
  sourceOrgId: string;
  targetOrgId: string;
  initiatedByUserId: string;
  serviceResults: Record<string, TransferServiceResult>;
  createdAt: string;
}

/** GET /brand-transfers/outgoing — transfers where your org is the source */
export async function listOutgoingTransfers(
  brandId?: string,
  token?: string
): Promise<{ transfers: BrandTransfer[] }> {
  const query = brandId ? `?brandId=${brandId}` : "";
  return apiCall<{ transfers: BrandTransfer[] }>(
    `/brand-transfers/outgoing${query}`,
    { token }
  );
}

/** GET /brand-transfers/incoming — transfers where your org is the target */
export async function listIncomingTransfers(
  brandId?: string,
  token?: string
): Promise<{ transfers: BrandTransfer[] }> {
  const query = brandId ? `?brandId=${brandId}` : "";
  return apiCall<{ transfers: BrandTransfer[] }>(
    `/brand-transfers/incoming${query}`,
    { token }
  );
}

// Brand runs
export interface RunCost {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  quantity: number;
}

export interface DescendantRun {
  serviceName: string;
  taskName: string;
  costs: RunCost[];
  ownCostInUsdCents: string;
}

export interface ErrorSummary {
  failedStep: string;
  message: string;
  rootCause: string;
}

export interface BrandRun {
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  totalCostInUsdCents: string | null;
  costs: RunCost[];
  serviceName: string | null;
  taskName: string | null;
  error?: string;
  errorSummary?: ErrorSummary;
  descendantRuns: unknown[];
}

export interface CampaignRun {
  id: string;
  serviceName: string;
  taskName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  parentRunId: string | null;
  ownCostInUsdCents: string;
}

/** GET /runs?campaignId={id} — returns runs for a campaign via runs-service proxy */
export async function listCampaignRuns(campaignId: string, token?: string): Promise<{ runs: CampaignRun[] }> {
  return apiCall<{ runs: CampaignRun[] }>(`/runs?campaignId=${encodeURIComponent(campaignId)}`, { token });
}

// ─── Run events (logs) ───────────────────────────────────────────────────────

export type EventLevel = "info" | "warn" | "error";

export interface RunEvent {
  id: string;
  runId: string;
  service: string;
  event: string;
  detail: string | null;
  level: EventLevel;
  data: unknown;
  orgId: string | null;
  userId: string | null;
  brandIds: string | null;
  campaignId: string | null;
  workflowSlug: string | null;
  featureSlug: string | null;
  createdAt: string;
}

// Per-field schema verified against runs-service GET /v1/events (api-registry).
// `.passthrough()` keeps every field; the feed only reads id/service/event/level/
// createdAt. safeParse turns wire-rot into a caught fetch-error per CLAUDE.md.
const RunEventSchema = z
  .object({
    id: z.string(),
    service: z.string(),
    event: z.string(),
    level: z.enum(["info", "warn", "error"]),
    createdAt: z.string(),
  })
  .passthrough();

const ListEventsResponseSchema = z.object({ events: z.array(RunEventSchema) });

/** GET /events?campaignId={id} — returns run events for a campaign via runs-service proxy */
export async function listCampaignEvents(
  campaignId: string,
  options?: { level?: EventLevel; limit?: number; offset?: number; token?: string }
): Promise<{ events: RunEvent[] }> {
  const params = new URLSearchParams();
  params.set("campaignId", campaignId);
  if (options?.level) params.set("level", options.level);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const raw = await apiCall<unknown>(`/events?${params.toString()}`, { token: options?.token });
  const parsed = ListEventsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listCampaignEvents: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] listCampaignEvents: invalid response shape");
  }
  return parsed.data as unknown as { events: RunEvent[] };
}

/** GET /brands/:brandId/runs — returns runs or empty list if brand not found (404) */
export async function listBrandRuns(brandId: string, token?: string): Promise<{ runs: BrandRun[] }> {
  try {
    return await apiCall<{ runs: BrandRun[] }>(`/brands/${brandId}/runs`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { runs: [] };
    throw err;
  }
}

// Campaign by brand
export async function listCampaignsByBrand(brandId: string, token?: string): Promise<{ campaigns: Campaign[] }> {
  const { campaigns } = await apiCall<{ campaigns: RawCampaign[] }>(
    `/campaigns?brandId=${brandId}&status=all`,
    { token },
  );
  return { campaigns: await enrichCampaignsWithBrandUrls(campaigns, token) };
}

// Single campaign
export async function getCampaign(campaignId: string, token?: string): Promise<{ campaign: Campaign }> {
  const { campaign } = await apiCall<{ campaign: RawCampaign }>(`/campaigns/${campaignId}`, { token });
  const [enriched] = await enrichCampaignsWithBrandUrls([campaign], token);
  return { campaign: enriched };
}

// Campaign sub-resources

/** Snapshot of the lead's CURRENT employer organization (lead-service OrganizationView). */
export interface LeadOrganizationView {
  id: string;
  apolloOrganizationId: string | null;
  name: string | null;
  primaryDomain: string | null;
  websiteUrl: string | null;
  industry: string | null;
  estimatedNumEmployees: number | null;
  annualRevenue: string | null;
  logoUrl: string | null;
  shortDescription: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  facebookUrl: string | null;
  blogUrl: string | null;
  crunchbaseUrl: string | null;
  foundedYear: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  technologyNames: string[] | null;
  industries: string[] | null;
  secondaryIndustries: string[] | null;
}

/** One contact endpoint attached to a lead (lead-service ContactMethodView). */
export interface LeadContactMethodView {
  channel: string;
  value: string;
  status: string | null;
  source: string;
}

/** One row from the lead's employment history (lead-service EmploymentEntryView). */
export interface LeadEmploymentEntryView {
  organizationId: string;
  organizationName: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  description: string | null;
}

/** Canonical lead payload (lead-service FullLead). */
export interface FullLead {
  leadId: string;
  apolloPersonId: string | null;
  firstName: string;
  lastName: string;
  name: string | null;
  headline: string | null;
  linkedinUrl: string | null;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  seniority: string | null;
  departments: string[] | null;
  subdepartments: string[] | null;
  functions: string[] | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  facebookUrl: string | null;
  enrichedAt: string | null;
  organization: LeadOrganizationView | null;
  contacts: LeadContactMethodView[];
  employmentHistory: LeadEmploymentEntryView[];
}

/** A leads_campaigns row plus the canonical FullLead — mirrors lead-service LeadDetail. */
export interface Lead {
  id: string;
  leadId: string | null;
  namespace: string;
  email: string;
  apolloPersonId: string | null;
  emailStatus: string | null;
  status: "buffered" | "skipped" | "claimed" | "served";
  statusReason: string | null;
  statusDetails: string | null;
  parentRunId: string | null;
  runId: string | null;
  brandIds: string[];
  campaignId: string;
  orgId: string;
  userId: string | null;
  workflowSlug: string | null;
  featureSlug: string | null;
  servedAt: string | null;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  lastDeliveredAt: string | null;
  global: { bounced: boolean; unsubscribed: boolean };
  lead: FullLead | null;
}

export type LeadConsolidatedStatus = "replied" | "clicked" | "opened" | "delivered" | "sent" | "bounced" | "unsubscribed" | "contacted" | "served" | "skipped" | "claimed" | "buffered";

/** Derive consolidated status from email-gateway booleans + local status, matching journalists page pattern */
export function getLeadConsolidatedStatus(lead: Lead): LeadConsolidatedStatus {
  if (lead.replied) return "replied";
  if (lead.clicked) return "clicked";
  if (lead.opened) return "opened";
  if (lead.delivered) return "delivered";
  if (lead.sent) return "sent";
  if (lead.bounced) return "bounced";
  if (lead.unsubscribed) return "unsubscribed";
  if (lead.contacted) return "contacted";
  return lead.status;
}

// Validate the leads envelope + the fields the consolidated-status logic
// dereferences (id/email/status + the 8 delivery booleans — always present from
// lead-service). `.passthrough()` keeps every other field (the nested FullLead,
// `global`, `servedAt`, `campaignId`, …) untouched so we never strip data.
// Per #1213/#1221: a 200 with a non-leads body (proxy redirect, shape rot, a
// missing-booleans partial) now throws → React Query keeps the last-good data
// (keepPreviousData) instead of overwriting the table with a bad success.
const LeadDeliverySchema = z
  .object({
    id: z.string(),
    email: z.string(),
    status: z.string(),
    contacted: z.boolean(),
    sent: z.boolean(),
    delivered: z.boolean(),
    opened: z.boolean(),
    clicked: z.boolean(),
    bounced: z.boolean(),
    unsubscribed: z.boolean(),
    replied: z.boolean(),
  })
  .passthrough();

const ListLeadsResponseSchema = z.object({ leads: z.array(LeadDeliverySchema) });

function parseLeadsResponse(raw: unknown, fn: string): { leads: Lead[] } {
  const parsed = ListLeadsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${fn}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${fn}: invalid response shape`);
  }
  // `.passthrough()` preserves every field at runtime; the validated subset
  // doesn't structurally overlap the full Lead type, so cast through unknown.
  return parsed.data as unknown as { leads: Lead[] };
}

export async function listCampaignLeads(campaignId: string, token?: string): Promise<{ leads: Lead[] }> {
  const raw = await apiCall<unknown>(`/leads?campaignId=${campaignId}`, { token });
  return parseLeadsResponse(raw, "listCampaignLeads");
}

export async function listBrandLeads(brandId: string, token?: string): Promise<{ leads: Lead[] }> {
  const raw = await apiCall<unknown>(`/leads?brandId=${brandId}`, { token });
  return parseLeadsResponse(raw, "listBrandLeads");
}

export interface EmailSequenceStep {
  step: number;
  bodyHtml: string;
  bodyText: string;
  daysSinceLastStep: number;
}

export interface Email {
  id: string;
  campaignId: string;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  leadFirstName: string;
  leadLastName: string;
  leadTitle: string;
  leadCompany: string;
  leadIndustry: string;
  clientCompanyName: string;
  createdAt: string;
  generationRun: {
    status: string;
    startedAt: string;
    completedAt: string | null;
    totalCostInUsdCents: string;
    costs: RunCost[];
    serviceName: string;
    taskName: string;
    descendantRuns: DescendantRun[];
    error?: string;
    errorSummary?: ErrorSummary;
  } | null;
}

export async function listCampaignEmails(campaignId: string, token?: string): Promise<{ emails: Email[] }> {
  return apiCall<{ emails: Email[] }>(`/campaigns/${campaignId}/emails`, { token });
}

export async function listBrandEmails(brandId: string, token?: string): Promise<{ emails: Email[] }> {
  return apiCall<{ emails: Email[] }>(`/emails?brandId=${brandId}`, { token });
}

/** A past generated email surfaced as an EXAMPLE for a workflow (campaigns/new picker).
 *  `scope` is the cascade tier it was pulled from relative to the caller:
 *  "brand" (own brand) · "org" (same org, other brand) · "global" (any org — public examples).
 *  `brandName` labels the source brand for the cross-source tag (null for own brand). */
export interface WorkflowExampleEmail {
  id: string;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadCompany: string | null;
  leadTitle: string | null;
  leadIndustry: string | null;
  clientCompanyName: string | null;
  createdAt: string;
  scope: "brand" | "org" | "global";
  brandName: string | null;
}

/** Recent example emails for a workflow, cascade brand→org→global (api-service →
 *  content-generation /generations/examples). Used to pre-fill the picker's preview so a
 *  user sees real output without running a test. */
export async function listWorkflowExamples(
  workflowSlug: string,
  brandId: string,
  limit = 3,
  token?: string,
): Promise<{ examples: WorkflowExampleEmail[] }> {
  const params = new URLSearchParams({ workflowSlug, brandId, limit: String(limit) });
  return apiCall<{ examples: WorkflowExampleEmail[] }>(`/workflow-examples?${params.toString()}`, { token });
}

// Manual reply qualifications (api-service proxy → email-gateway → instantly-service).
// Wire shape is snake_case (request) + camelCase (response) per the upstream contract;
// helpers below translate camelCase request inputs to snake_case query / body.
export type ManualQualificationStatus =
  | "lead_interested"
  | "lead_meeting_booked"
  | "lead_closed"
  | "lead_not_interested"
  | "lead_wrong_person"
  | "lead_neutral"
  | "lead_out_of_office"
  | "auto_reply_received";

export type ManualQualificationClassification = "positive" | "negative" | "neutral";

export interface ManualQualification {
  id: string;
  orgId: string;
  campaignId: string;
  instantlyCampaignId: string;
  email: string;
  status: ManualQualificationStatus;
  qualifiedBy: string;
  notes: string | null;
  qualifiedAt: string;
}

export interface SetManualQualificationResponse {
  idempotent: boolean;
  qualification: ManualQualification;
}

export interface ListManualQualificationsResponse {
  qualifications: ManualQualification[];
}

export async function setManualQualification(
  body: { campaignId: string; email: string; status: ManualQualificationStatus; notes?: string },
  token?: string,
): Promise<SetManualQualificationResponse> {
  return apiCall<SetManualQualificationResponse>("/emails/manual-qualifications", {
    token,
    method: "POST",
    body: {
      campaign_id: body.campaignId,
      email: body.email,
      status: body.status,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
}

export async function listManualQualifications(
  params: { campaignId?: string; email?: string; limit?: number } = {},
  token?: string,
): Promise<ListManualQualificationsResponse> {
  const qs = new URLSearchParams();
  if (params.campaignId) qs.set("campaign_id", params.campaignId);
  if (params.email) qs.set("email", params.email);
  if (params.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiCall<ListManualQualificationsResponse>(`/emails/manual-qualifications${suffix}`, { token });
}


// Workflows
export interface DAGNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  retries?: number;
}

export interface DAGEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface DAG {
  nodes: DAGNode[];
  edges: DAGEdge[];
  onError?: string;
}

export interface Workflow {
  id: string;
  appId: string;
  workflowName: string;
  workflowSlug: string;
  workflowDynastyName: string;
  workflowDynastySlug: string;
  version: number;
  description: string | null;
  featureSlug: string | null;
  category?: string;
  channel?: string;
  audienceType?: string;
  workflowDynastySignatureName: string;
  dag: DAG | null;
  requiredProviders: string[];
  status?: "active" | "deprecated";
  upgradedTo?: string | null;
  forkedFrom?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  workflowSlug: string;
  summary: string;
  requiredProviders: string[];
  steps: string[];
}

export interface WorkflowKeyStatus {
  workflowSlug: string;
  ready: boolean;
  keys: { provider: string; configured: boolean; maskedKey: string | null; keySource: "org" | "platform" }[];
  missing: string[];
}

// Key source preferences
export interface KeySourcePreference {
  provider: string;
  keySource: "org" | "platform";
}

export async function listKeySources(token?: string): Promise<{ sources: KeySourcePreference[] }> {
  return apiCall<{ sources: KeySourcePreference[] }>("/keys/sources", { token });
}

export async function setKeySource(
  provider: string,
  keySource: "org" | "platform",
  token?: string
): Promise<{ provider: string; orgId: string; keySource: "org" | "platform"; message: string }> {
  return apiCall<{ provider: string; orgId: string; keySource: "org" | "platform"; message: string }>(
    `/keys/${provider}/source`,
    { token, method: "PUT", body: { keySource } }
  );
}

// Provider requirements
export interface ProviderRequirementEndpoint {
  service: string;
  method: string;
  path: string;
}

export interface ProviderRequirementResult {
  service: string;
  method: string;
  path: string;
  provider: string;
}

export async function queryProviderRequirements(
  endpoints: ProviderRequirementEndpoint[],
  token?: string
): Promise<{ requirements: ProviderRequirementResult[]; providers: string[] }> {
  return apiCall<{ requirements: ProviderRequirementResult[]; providers: string[] }>(
    "/keys/provider-requirements",
    { token, method: "POST", body: { endpoints } }
  );
}

export async function listWorkflows(params?: { featureSlug?: string }, token?: string): Promise<{ workflows: Workflow[] }> {
  const query = new URLSearchParams();
  if (params?.featureSlug) query.set("featureSlug", params.featureSlug);
  return apiCall<{ workflows: Workflow[] }>(`/workflows?${query}`, { token });
}

export async function getWorkflow(workflowId: string, token?: string): Promise<Workflow> {
  return apiCall<Workflow>(`/workflows/${workflowId}`, { token });
}

// Set a whole workflow dynasty's lifecycle status (active/deprecated). Dynasty-scoped,
// idempotent. Deprecated dynasties are hidden from selection. Owned by workflow-service.
export async function setWorkflowDynastyStatus(
  workflowDynastySlug: string,
  status: "active" | "deprecated",
  token?: string,
): Promise<{ workflowDynastySlug: string; status: "active" | "deprecated" }> {
  return apiCall<{ workflowDynastySlug: string; status: "active" | "deprecated" }>(
    `/workflows/dynasty/${encodeURIComponent(workflowDynastySlug)}/status`,
    { token, method: "PUT", body: { status } },
  );
}

export async function getWorkflowSummary(workflowId: string, token?: string): Promise<WorkflowSummary> {
  return apiCall<WorkflowSummary>(`/workflows/${workflowId}/summary`, { token });
}

export async function getWorkflowKeyStatus(workflowId: string, token?: string): Promise<WorkflowKeyStatus> {
  return apiCall<WorkflowKeyStatus>(`/workflows/${workflowId}/key-status`, { token });
}

// Platform discovery
export interface PlatformService {
  name: string;
  baseUrl: string;
  openapiUrl: string;
}

export interface LlmEndpointSummary {
  method: string;
  path: string;
  summary: string;
  params?: { name: string; in: string; required: boolean; type?: string }[];
  bodyFields?: string[];
}

export interface LlmServiceSummary {
  service: string;
  baseUrl: string;
  title?: string;
  description?: string;
  error?: string;
  endpoints: LlmEndpointSummary[];
}

export interface LlmContextResponse {
  _description: string;
  _usage: string;
  services: LlmServiceSummary[];
}

export async function getPlatformLlmContext(): Promise<LlmContextResponse> {
  return apiCall<LlmContextResponse>("/platform/llm-context");
}

export async function getPlatformServices(): Promise<{ services: PlatformService[] }> {
  return apiCall<{ services: PlatformService[] }>("/platform/services");
}

export async function getPlatformServiceSpec(service: string): Promise<Record<string, unknown>> {
  return apiCall<Record<string, unknown>>(`/platform/services/${service}`);
}

// Ranked workflows (family-aggregated stats from workflow-service)
export interface RankedWorkflowStats {
  totalCostInUsdCents: number;
  totalOutcomes: number;
  costPerOutcome: number | null;
  completedRuns: number;
}

export interface RankedWorkflowItem {
  workflow: {
    id: string;
    workflowSlug: string;
    workflowName: string;
    workflowDynastyName: string;
    workflowDynastySlug: string;
    version: number;
    createdForBrandId: string | null;
    featureSlug: string | null;
  };
  dag: DAG;
  stats: RankedWorkflowStats;
}

export interface RankedWorkflowResponse {
  results: RankedWorkflowItem[];
}

export async function fetchRankedWorkflows(params: {
  featureSlug: string;
  objective: string;
  groupBy: "workflow" | "brand";
  limit?: number;
}, token?: string): Promise<RankedWorkflowItem[]> {
  const query = new URLSearchParams();
  query.set("featureSlug", params.featureSlug);
  query.set("objective", params.objective);
  query.set("groupBy", params.groupBy);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const data = await apiCall<RankedWorkflowResponse>(`/features/ranked${qs ? `?${qs}` : ""}`, { token });
  return data.results;
}

/** GET /v1/public/features/ranked — cross-org/brand workflow performance leaderboard. */
export interface GlobalRankedWorkflowItem {
  workflow: {
    id: string;
    workflowSlug: string;
    workflowName: string;
    workflowDynastyName: string;
    workflowDynastySlug: string;
    version: number;
    createdForBrandId: string | null;
    featureSlug: string;
  };
  brand?: { id: string; name: string | null; domain: string | null };
  stats: Record<string, number | null>;
}

export interface GlobalRankedResponse {
  objective: string;
  sortDirection: "asc" | "desc";
  results: GlobalRankedWorkflowItem[];
}

export async function fetchGlobalRankedWorkflows(params: {
  featureSlug: string;
  objective: string;
  groupBy: "workflow" | "brand";
  limit?: number;
}, token?: string): Promise<GlobalRankedWorkflowItem[]> {
  const query = new URLSearchParams();
  query.set("featureSlug", params.featureSlug);
  query.set("objective", params.objective);
  query.set("groupBy", params.groupBy);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const data = await apiCall<GlobalRankedResponse>(`/public/features/ranked${qs ? `?${qs}` : ""}`, { token });
  return data.results;
}

// ── Sales-funnel workflow projection ────────────────────────────────────────
// features-service owns the per-workflow GLOBAL unit costs (contacted/reply/click $ — cross-org,
// feature-scoped, econ-INDEPENDENT) + the recommended workflow. It ALSO returns a server-computed
// cost-per-close + funnel projection from the brand's SAVED economics, but the campaigns/new page
// no longer renders those directly: it recomputes cost-per-close + the funnel CLIENT-side from the
// unit costs × the LIVE §2 econ inputs (lib/sales-funnel-projection.ts mirrors the server formula)
// so the budget cards update instantly without a per-edit round-trip through the cold Neon chain.
// On first paint the live econ == the saved econ, so the client numbers equal the server's exactly.
// Wire shape verified against the deployed contract via api-registry. safeParse per CLAUDE.md.
export type SalesObjective = "meeting-booked" | "self-serve";

/** Per-workflow funnel projection at the requested budget. All fields null where the route
 *  doesn't apply (replies/meetings for self-serve, visits with no click cost) or no data. */
const WorkflowFunnelProjectionSchema = z.object({
  contactedLeads: z.number().nullable(),
  replies: z.number().nullable(),
  visits: z.number().nullable(),
  // Expected form submissions (visits × visitToFormSubmissionPct). Optional to decouple the
  // features-service rollout; present once the form_submissions goal is live in prod.
  formSubmissions: z.number().nullable().optional(),
  meetings: z.number().nullable(),
  closes: z.number().nullable(),
  revenue: z.number().nullable(),
  /** (budget / revenue) × 100 — budget-invariant. */
  cacPct: z.number().nullable(),
  /** budget / closes (absolute cost per close) — budget-invariant. */
  cacAbs: z.number().nullable(),
});

const WorkflowProjectionItemSchema = z.object({
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string().nullable(),
  contactedUsd: z.number().nullable(),
  replyUsd: z.number().nullable(),
  clickUsd: z.number().nullable(),
  costPerSignupUsd: z.number().nullable().optional(),
  // Cost per form submission (form_submissions goal). Optional to decouple the rollout.
  costPerFormSubmissionUsd: z.number().nullable().optional(),
  costPerCloseUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable().optional(),
  // Lifetime ROI multiple = LTR / costPerCloseUsd (= 100 / cacPct), budget-
  // independent — rendered VERBATIM instead of inverting cacPct client-side
  // (features-service#396). `.optional()` decouples the backend rollout.
  roiMultiple: z.number().nullable().optional(),
  // null when budgetUsd is absent/≤0 or the workflow has no usable data.
  projection: WorkflowFunnelProjectionSchema.nullable(),
});

const WorkflowProjectionResponseSchema = z.object({
  featureSlug: z.string(),
  objective: z.union([z.literal("meeting-booked"), z.literal("self-serve")]),
  workflows: z.array(WorkflowProjectionItemSchema),
  recommendedWorkflowDynastySlug: z.string().nullable(),
  recommendedBudgetUsd: z.number().nullable(),
});

export type WorkflowFunnelProjection = z.infer<typeof WorkflowFunnelProjectionSchema>;
export type WorkflowProjectionItem = z.infer<typeof WorkflowProjectionItemSchema>;
export type WorkflowProjectionResponse = z.infer<typeof WorkflowProjectionResponseSchema>;

/**
 * `structuralSharing` merge for the workflow-projection query. Every field above is `.nullable()`
 * because a COLD Neon chain (api→features→workflow/runs/email-gateway/brand, all scale-to-zero)
 * can answer a poll/refocus refetch with a VALID 200 whose unit costs / cost-per-close are null,
 * or with fewer workflows, while it half-warms. That degenerate-but-valid payload would otherwise
 * collapse the budget cards + Launch button (which derive off `costPerCloseUsd`). Keep the last-good
 * per-workflow values + recommended pick across such a refetch; a real persistent downgrade still
 * fails loud (console.error in keep-last-good). Opt-in here ONLY — a null is "transient/not-ready",
 * not "removed". See lib/keep-last-good.ts + CLAUDE.md "keep-last-good (cache-write boundary)".
 */
export function keepLastGoodWorkflowProjection(
  prev: WorkflowProjectionResponse | undefined,
  next: WorkflowProjectionResponse,
): WorkflowProjectionResponse {
  if (!prev) return next;
  const top = keepLastGoodFields(
    prev,
    next,
    ["recommendedWorkflowDynastySlug", "recommendedBudgetUsd"],
    "workflowProjection",
  );
  return {
    ...top,
    workflows: keepLastGoodList(prev.workflows, next.workflows, {
      keyFn: (w) => w.workflowDynastySlug,
      fields: [
        "contactedUsd",
        "replyUsd",
        "clickUsd",
        "costPerSignupUsd",
        "costPerFormSubmissionUsd",
        "costPerCloseUsd",
        "costPerMeetingBookedUsd",
        "projection",
        "workflowDynastyName",
      ],
      label: "workflowProjection.workflows",
    }),
  };
}

/**
 * Adapt ONE ladder row (a workflow dynasty's brand-level row) into the legacy
 * `WorkflowProjectionItem`. Every value is read VERBATIM from the row's resolved grain
 * block (the finest present) — no arithmetic. The funnel COUNT projection
 * (contactedLeads/replies/visits/meetings/closes/revenue) no longer exists in the
 * reshaped contract, so those are null (fail to "-", never fabricated); `cacPct`/`cacAbs`
 * carry the resolved values so any consumer reading them stays correct.
 */
function ladderRowToWorkflowItem(row: WorkflowProjectionRow): WorkflowProjectionItem {
  const block = row.estimatesByGrain[row.resolved.grain];
  return {
    workflowDynastySlug: row.workflow.workflowDynastySlug,
    workflowDynastyName: row.workflow.workflowDynastyName,
    contactedUsd: block?.unitCosts.costPerContactedUsd ?? null,
    replyUsd: block?.unitCosts.costPerPositiveReplyUsd ?? null,
    clickUsd: row.resolved.costPerClickUsd,
    costPerSignupUsd: block?.projected.costPerSignupUsd ?? null,
    costPerFormSubmissionUsd: null,
    costPerCloseUsd: row.resolved.costPerPaidClientUsd,
    costPerMeetingBookedUsd: row.resolved.costPerMeetingBookedUsd,
    roiMultiple: row.resolved.roiMultiple,
    projection: {
      contactedLeads: null,
      replies: null,
      visits: null,
      formSubmissions: null,
      meetings: null,
      closes: null,
      revenue: null,
      cacPct: row.resolved.cacPct,
      cacAbs: row.resolved.costPerPaidClientUsd,
    },
  };
}

/**
 * GET /features/:slug/workflow-projection — the recommended workflow + per-workflow
 * economics for a brand under one objective. features-service reshaped the endpoint
 * into a 3-grain ladder (rows[] + resolved); this reader fetches that ladder (via
 * `getWorkflowProjectionLadder`) and maps the brand-level rows (audienceId null) back
 * onto the legacy `workflows[]` shape so existing consumers (campaigns/new, workflows
 * page, top-workflows card) keep reading server values verbatim. `budgetUsd` is
 * accepted for call-site compatibility; the ladder + `recommendedBudgetUsd` carry the
 * projection surface.
 */
export async function getWorkflowProjection(
  params: {
    featureSlug: string;
    brandId: string;
    objective: SalesObjective;
    budgetUsd?: number;
  },
  token?: string,
): Promise<WorkflowProjectionResponse> {
  const ladder = await getWorkflowProjectionLadder(
    { featureSlug: params.featureSlug, brandId: params.brandId, objective: params.objective },
    token,
  );
  return {
    featureSlug: ladder.featureSlug,
    objective: params.objective,
    workflows: ladder.rows
      .filter((r) => r.audienceId == null)
      .map(ladderRowToWorkflowItem),
    recommendedWorkflowDynastySlug: ladder.recommendedWorkflowDynastySlug,
    recommendedBudgetUsd: ladder.recommendedBudgetUsd,
  };
}

// ── Workflow-projection 3-grain ladder ───────────────────────────────────────
// features-service folded the old /candidates grain INTO workflow-projection: one
// call now returns a row per (audienceId, workflow) carrying the cost estimate at
// each grain (crossOrg / brand / audience) PLUS the `resolved` block — the finest
// grain that has real evidence (brand-real when the brand has run enough, else the
// fleet benchmark). Every cost is read VERBATIM from `resolved` — no client-side math.
// Proxied via api-service /v1/features/:slug/workflow-projection.
export type WorkflowProjectionGrain = "crossOrg" | "brand" | "audience";

/** Observed run evidence at one grain — the denominator behind the floor-filled unit
 *  costs. `observedClicks === 0` ⇒ every unit cost is a FLOOR (spentUsd / max(…,1)),
 *  so a cost from that grain renders as a ">$X" lower bound. */
const WorkflowGrainEvidenceSchema = z.object({
  spentUsd: z.number(),
  observedContacted: z.number(),
  observedClicks: z.number(),
  observedPositiveReplies: z.number(),
});

/** Floor-filled unit costs at one grain — NEVER null (spentUsd / max(observed,1)). */
const WorkflowGrainUnitCostsSchema = z.object({
  costPerClickUsd: z.number(),
  costPerPositiveReplyUsd: z.number(),
  costPerContactedUsd: z.number(),
});

/** Projected economics at one grain — null where the objective doesn't apply or the
 *  brand has no saved conversion economics yet. */
const WorkflowGrainProjectedSchema = z.object({
  costPerSignupUsd: z.number().nullable(),
  costPerPaidClientUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  cacPct: z.number().nullable(),
});

const WorkflowGrainBlockSchema = z.object({
  evidence: WorkflowGrainEvidenceSchema,
  unitCosts: WorkflowGrainUnitCostsSchema,
  projected: WorkflowGrainProjectedSchema,
});

/** The grain the backend RESOLVED to (brand-real when available, else fleet benchmark)
 *  + its cost numbers, ready to render. costPerClickUsd is floor-filled (never null);
 *  the projected costs are null where the objective / economics don't apply. */
const WorkflowResolvedSchema = z.object({
  grain: z.union([z.literal("crossOrg"), z.literal("brand"), z.literal("audience")]),
  costPerClickUsd: z.number(),
  costPerOutcomeUsd: z.number().nullable(),
  costPerPaidClientUsd: z.number().nullable(),
  costPerMeetingBookedUsd: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  cacPct: z.number().nullable(),
});

const WorkflowProjectionRowSchema = z.object({
  /** null = the brand-level row for this workflow (the "Your best model" headline);
   *  non-null = a per-audience row (one per active audience). */
  audienceId: z.string().nullable(),
  workflow: z.object({
    workflowDynastySlug: z.string(),
    workflowDynastyName: z.string().nullable(),
  }),
  estimatesByGrain: z.object({
    crossOrg: WorkflowGrainBlockSchema.optional(),
    brand: WorkflowGrainBlockSchema.optional(),
    audience: WorkflowGrainBlockSchema.optional(),
  }),
  resolved: WorkflowResolvedSchema,
});

const WorkflowProjectionLadderResponseSchema = z.object({
  featureSlug: z.string(),
  objective: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  rows: z.array(WorkflowProjectionRowSchema),
  recommendedWorkflowDynastySlug: z.string().nullable(),
  recommendedBudgetUsd: z.number().nullable(),
});

export type WorkflowProjectionGrainBlock = z.infer<typeof WorkflowGrainBlockSchema>;
export type WorkflowProjectionResolved = z.infer<typeof WorkflowResolvedSchema>;
export type WorkflowProjectionRow = z.infer<typeof WorkflowProjectionRowSchema>;
export type WorkflowProjectionLadderResponse = z.infer<
  typeof WorkflowProjectionLadderResponseSchema
>;

/**
 * GET /features/:slug/workflow-projection — the 3-grain ladder (rows[] + resolved).
 * Every cost is read VERBATIM from `resolved` — no client-side CPC / CPS / projection math.
 */
export async function getWorkflowProjectionLadder(
  params: {
    featureSlug: string;
    brandId: string;
    goal?: string;
    objective?: SalesObjective | string;
    audienceId?: string;
  },
  token?: string,
): Promise<WorkflowProjectionLadderResponse> {
  const query = new URLSearchParams();
  query.set("brandId", params.brandId);
  if (params.goal) query.set("goal", params.goal);
  if (params.objective) query.set("objective", params.objective);
  if (params.audienceId) query.set("audienceId", params.audienceId);
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(params.featureSlug)}/workflow-projection?${query.toString()}`,
    { token },
  );
  const parsed = WorkflowProjectionLadderResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getWorkflowProjectionLadder: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] getWorkflowProjectionLadder: invalid response shape");
  }
  return parsed.data;
}

// Create / Upgrade / Fork workflow via AI
export interface CreateWorkflowRequest {
  description: string;
  featureSlug: string;
  hints?: {
    services?: string[];
    nodeTypes?: string[];
    expectedInputs?: string[];
  };
}

export interface CreateWorkflowResult {
  workflow: {
    id: string;
    name: string;
    featureSlug: string;
    signature: string;
    workflowDynastySignatureName: string;
    action: "created" | "updated";
    humanId: string | null;
  };
  dag: { nodes: unknown[]; edges: unknown[] };
  generatedDescription: string;
}

export async function createWorkflow(
  params: CreateWorkflowRequest,
  token?: string,
): Promise<CreateWorkflowResult> {
  return apiCall<CreateWorkflowResult>("/workflows/create", {
    method: "POST",
    body: params as unknown as Record<string, unknown>,
    token,
  });
}

// Create campaign
export async function createCampaign(
  params: {
    name: string;
    workflowSlug: string;
    brandUrls: string[];
    maxBudgetDailyUsd?: string;
    maxBudgetWeeklyUsd?: string;
    maxBudgetMonthlyUsd?: string;
    maxBudgetTotalUsd?: string;
  } & Record<string, unknown>,
  token?: string
): Promise<{ campaign: Campaign }> {
  const { campaign } = await apiCall<{ campaign: RawCampaign }>("/campaigns", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
  const [enriched] = await enrichCampaignsWithBrandUrls([campaign], token);
  return { campaign: enriched };
}

// Billing — wire shape per billing-service post-rename hotfix.
// `*_cents` string fields are full-precision decimal strings (e.g. "100.4200000000").
// Use parseFloat for math; never Number().
// `balance_cents` = spendable funds (credited minus usage); use it for depletion and budget checks.
// `credited_cents` = lifetime credited (paid topups + local promos); display-only for "total credited".
// `topup_amount_cents` and `topup_threshold_cents` are integers in cents (or null).
// Live spec: https://billing.distribute.you/openapi.json
export interface BillingAccount {
  id: string;
  org_id: string;
  credited_cents: string;
  usage_cents: string;
  balance_cents: string;
  // credited minus ACTUALIZED usage only (provisioned holds NOT subtracted). Absent on older
  // billing deploys; used to split Confirmed vs Provisioned in the credit breakdown.
  actual_balance_cents?: string;
  topup_amount_cents: number | null;
  topup_threshold_cents: number | null;
  has_payment_method: boolean;
  has_auto_topup: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingBalance {
  balance_cents: string;
  depleted: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
}

export async function getBillingAccount(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts", { token });
}

export async function getBillingBalance(token?: string): Promise<BillingBalance> {
  return apiCall<BillingBalance>("/billing/accounts/balance", { token });
}

// Org-wide runs ledger (runs-service /v1/runs via api-service proxy).
// Used by the billing page Runs tab. List endpoint returns one item per run with
// own-cost totals only — per-cost-name breakdown is on GET /v1/runs/{id}.
// Per runs-service: id is required, default sort is startedAt DESC.
export interface OrgRun {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  ownCostInUsdCents: string | null;
  serviceName: string | null;
  taskName: string | null;
}

export async function listOrgRuns(
  limit: number,
  offset: number,
  token?: string,
): Promise<{ runs: OrgRun[]; offset: number; limit?: number }> {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiCall<{ runs: OrgRun[]; offset: number; limit?: number }>(
    `/runs?${qs.toString()}`,
    { token },
  );
}

export async function configureAutoTopup(
  topupAmountCents: number,
  topupThresholdCents?: number,
  token?: string
): Promise<BillingAccount> {
  const body: Record<string, unknown> = { topup_amount_cents: topupAmountCents };
  if (topupThresholdCents !== undefined) body.topup_threshold_cents = topupThresholdCents;
  return apiCall<BillingAccount>("/billing/accounts/auto_topup", { token, method: "PATCH", body });
}

export async function disableAutoTopup(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts/auto_topup", { token, method: "DELETE" });
}

// Staff-only free-credit grants (billing-service local_promos via the api-service
// staff-gated proxy). `amountCents` is a full-precision decimal string (e.g.
// "2500.0000000000"); use parseFloat / formatBillingCents, never Number().
// `orgId` is the internal billing org uuid. Live spec: https://billing.distribute.you/openapi.json
export interface CreditGrant {
  id: string;
  orgId: string;
  amountCents: string;
  reason: string;
  note: string | null;
  grantedBy: string | null;
  createdAt: string;
}

// Grant an arbitrary free-credit amount to the active org. `amountCents` is an
// integer number of cents. A fresh idempotencyKey per call lets grants STACK
// while protecting against a double-submit (same key = one row, no double-credit).
export async function grantCredits(
  amountCents: number,
  note: string,
  token?: string,
): Promise<{ ok: boolean; newBalanceCents: string }> {
  return apiCall<{ ok: boolean; newBalanceCents: string }>("/billing/credits/grant", {
    token,
    method: "POST",
    body: { amountCents, note, idempotencyKey: globalThis.crypto.randomUUID() },
  });
}

// Grants made to the currently-active org.
export async function listOrgCreditGrants(token?: string): Promise<{ grants: CreditGrant[] }> {
  return apiCall<{ grants: CreditGrant[] }>("/billing/credits/grants", { token });
}

// Platform-wide ledger — every grant ever made, across all orgs (staff oversight).
export async function listAllCreditGrants(token?: string): Promise<{ grants: CreditGrant[] }> {
  return apiCall<{ grants: CreditGrant[] }>("/billing/credits/grants/all", { token });
}

// `mode: "setup"` mints a no-charge Stripe Checkout that only captures a reusable
// off-session card (omit topup_amount_cents). Default "payment" charges the amount.
export async function createCheckoutSession(
  params:
    | { topup_amount_cents: number; mode?: "payment"; success_url: string; cancel_url: string }
    | { mode: "setup"; success_url: string; cancel_url: string },
  token?: string
): Promise<CheckoutSession> {
  return apiCall<CheckoutSession>("/billing/checkout-sessions", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

export async function createPortalSession(
  returnUrl: string,
  token?: string
): Promise<{ url: string }> {
  return apiCall<{ url: string }>("/billing/portal-sessions", {
    token,
    method: "POST",
    body: { return_url: returnUrl },
  });
}

// Press Kits
export type MediaKitStatus = "drafted" | "generating" | "validated" | "denied" | "failed" | "archived";

/** Summary returned by list endpoints (no mdxPageContent) */
export interface MediaKitSummary {
  id: string;
  title: string | null;
  status: MediaKitStatus;
  contentExcerpt: string | null;
  organizationId: string | null;
  orgId: string | null;
  brandId: string | null;
  campaignId: string | null;
  iconUrl: string | null;
  shareToken: string | null;
  publicUrl: string | null;
  parentMediaKitId: string | null;
  featureSlug: string | null;
  workflowSlug: string | null;
  denialReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Full detail returned by GET /media-kits/:id */
export interface MediaKit extends MediaKitSummary {
  mdxPageContent: string | null;
}

/** View stats for press kits */
export interface MediaKitViewStats {
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
}

export interface MediaKitViewStatsGrouped {
  groups: Array<{
    key: string;
    totalViews: number;
    uniqueVisitors: number;
    lastViewedAt: string | null;
  }>;
}

/** Upsert org in press-kits-service (idempotent, call before listing kits) */
export async function upsertPressKitOrg(
  orgId: string,
  name?: string,
  token?: string
): Promise<void> {
  await apiCall<Record<string, unknown>>("/press-kits/organizations", {
    token,
    method: "POST",
    body: { orgId, ...(name ? { name } : {}) },
  });
}

/** List media kits filtered by org_id */
export async function listMediaKits(orgId: string, token?: string): Promise<MediaKitSummary[]> {
  const res = await apiCall<{ mediaKits: MediaKitSummary[] }>(`/press-kits/media-kits?org_id=${orgId}`, { token });
  return res.mediaKits;
}

/** List media kits filtered by brand_id */
export async function listBrandMediaKits(brandId: string, token?: string): Promise<MediaKitSummary[]> {
  const res = await apiCall<{ mediaKits: MediaKitSummary[] }>(`/press-kits/media-kits?brand_id=${brandId}`, { token });
  return res.mediaKits;
}

export async function getMediaKit(id: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MediaKit> {
  return apiCall<MediaKit>(`/press-kits/media-kits/${id}`, { token: options?.token, headers: options?.headers });
}

/** List media kits associated with a campaign */
export async function listMediaKitsByCampaign(campaignId: string, options?: { token?: string; headers?: Record<string, string> }): Promise<MediaKitSummary[]> {
  const res = await apiCall<{ mediaKits: MediaKitSummary[] }>(`/press-kits/media-kits?campaign_id=${campaignId}`, { token: options?.token, headers: options?.headers });
  return res.mediaKits;
}

/** Initiate media kit generation (org via x-org-id, brand via x-brand-id header) */
export async function editMediaKit(
  params: { instruction: string; headers?: Record<string, string> },
  token?: string
): Promise<{ mediaKitId: string }> {
  const { instruction, headers } = params;
  return apiCall<{ mediaKitId: string }>("/press-kits/media-kits", {
    token,
    method: "POST",
    body: { instruction },
    headers,
  });
}

/** Update MDX content of a media kit */
export async function updateMediaKitMdx(
  mediaKitId: string,
  mdxContent: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/mdx`, {
    token: options?.token,
    method: "PATCH",
    body: { mdxContent },
    headers: options?.headers,
  });
}

/** Update media kit status */
export async function updateMediaKitStatus(
  mediaKitId: string,
  status: MediaKitStatus,
  options?: { denialReason?: string; token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/status`, {
    token: options?.token,
    method: "PATCH",
    body: { status, ...(options?.denialReason ? { denialReason: options.denialReason } : {}) },
    headers: options?.headers,
  });
}

/** Validate a media kit (moves to validated status) */
export async function validateMediaKit(
  mediaKitId: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/validate`, {
    token: options?.token,
    method: "POST",
    headers: options?.headers,
  });
}

/** Cancel a draft media kit */
export async function cancelDraftMediaKit(
  mediaKitId: string,
  options?: { token?: string; headers?: Record<string, string> }
): Promise<void> {
  await apiCall<Record<string, unknown>>(`/press-kits/media-kits/${mediaKitId}/cancel`, {
    token: options?.token,
    method: "POST",
    headers: options?.headers,
  });
}

/** Get view stats for press kits */
export async function getMediaKitViewStats(
  params: { brandId?: string; mediaKitId?: string; from?: string; to?: string; groupBy?: "country" | "mediaKitId" | "day" },
  options?: { token?: string; headers?: Record<string, string> }
): Promise<MediaKitViewStats & Partial<MediaKitViewStatsGrouped>> {
  const qs = new URLSearchParams();
  if (params.brandId) qs.set("brandId", params.brandId);
  if (params.mediaKitId) qs.set("mediaKitId", params.mediaKitId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.groupBy) qs.set("groupBy", params.groupBy);
  return apiCall<MediaKitViewStats & Partial<MediaKitViewStatsGrouped>>(
    `/press-kits/media-kits/stats/views?${qs.toString()}`,
    { token: options?.token, headers: options?.headers },
  );
}


// --- Discovery types ---

/** Cumulative outlet status counts from outlets-service */
export interface OutletStatusCounts {
  open: number;
  served: number;
  skipped: number;
  contacted: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  repliesPositive: number;
  repliesNegative: number;
  repliesNeutral: number;
  bounced: number;
  unsubscribed: number;
}

/** Structured outlet status from outlets-service */
export interface OutletStatus {
  outletStatus: "open" | "served" | "skipped";
  statusReason: "discovered" | "buffer_claimed" | null;
  statusDetail: string | null;
  totalJournalists?: number;
  brand?: OutletStatusCounts | null;
  byCampaign?: Record<string, OutletStatusCounts> | null;
  campaign?: OutletStatusCounts | null;
  global?: { bounced: number; unsubscribed: number };
}

/** Per-campaign data nested inside a deduplicated outlet */
export interface OutletCampaign {
  campaignId: string;
  featureSlug: string;
  brandIds: string[];
  relevanceScore: number;
  whyRelevant?: string;
  whyNotRelevant?: string;
  statusReason: string | null;
  statusDetail: string | null;
  overallRelevance?: string | null;
  relevanceRationale?: string | null;
  runId?: string | null;
  updatedAt: string;
}

/** Deduplicated outlet returned by GET /v1/outlets */
export interface DeduplicatedOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  createdAt: string;
  status: OutletStatus;
  pricing?: {
    sellPriceCents: number | null;
    currency: string | null;
  } | null;
  priceRequestStatus: "ongoing" | "received" | null;
  relevanceScore: number;
  campaigns: OutletCampaign[];
  // Ahrefs enrichment, present only when the request passes `enrich=ahref`
  // (outlets-service joins these server-side, resilient/chunked). null when
  // ahref has no trustworthy cached value for the domain.
  domainRating?: number | null;
  trafficMonthlyAvg?: number | null;
}

export interface OutletPriceRequestResult {
  outletId: string;
  status: "ongoing" | "error";
  editorialEmail?: string;
  messageId?: string;
  error?: string;
}

export interface OutletListResponse {
  outlets: DeduplicatedOutlet[];
  total: number;
  byOutreachStatus?: Record<string, number>;
}

/** Flat outlet returned by GET /v1/campaigns/{id}/outlets */
export interface CampaignOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  relevanceScore: number;
  whyRelevant: string | null;
  outletStatus: "open" | "served" | "contacted" | "delivered" | "replied" | "skipped" | "denied" | "ended" | null;
  replyClassification?: "positive" | "negative" | "neutral" | null;
}

export interface DiscoveredJournalist {
  id: string;
  entityType: "individual" | "organization";
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  outletName?: string;
  outletDomain?: string;
  createdAt: string;
  updatedAt: string;
}

export async function listBrandOutlets(
  brandId: string,
  featureSlug?: string,
  token?: string,
  campaignId?: string,
  enrich?: boolean,
): Promise<OutletListResponse> {
  const params = new URLSearchParams({ brandId });
  if (featureSlug) params.set("featureSlug", featureSlug);
  if (campaignId) params.set("campaignId", campaignId);
  // enrich=ahref → each outlet carries domainRating + trafficMonthlyAvg
  // (server-side resilient join). Opt-in so the high-frequency sidebar count
  // query stays cheap.
  if (enrich) params.set("enrich", "ahref");
  const data = await apiCall<OutletListResponse>(
    `/outlets?${params}`,
    { token },
  );
  return {
    ...data,
    outlets: withAverageCampaignRelevanceScores(data.outlets),
  };
}

export async function listCampaignOutlets(
  campaignId: string,
  token?: string,
): Promise<{ outlets: CampaignOutlet[] }> {
  return apiCall<{ outlets: CampaignOutlet[] }>(
    `/campaigns/${campaignId}/outlets`,
    { token },
  );
}

export async function requestOutletPurchasePrices(
  outletIds: string[],
  token?: string,
): Promise<{ results: OutletPriceRequestResult[] }> {
  return apiCall<{ results: OutletPriceRequestResult[] }>(
    "/outlets/price-requests",
    { token, method: "POST", body: { outletIds } },
  );
}

export interface BrandJournalist {
  id: string;
  journalistId: string;
  campaignId: string;
  outletId: string;
  orgId: string;
  brandId: string;
  featureSlug: string | null;
  relevanceScore: string;
  whyRelevant: string;
  whyNotRelevant: string;
  articleUrls: string[] | null;
  outreachStatus: "buffered" | "claimed" | "served" | "contacted" | "delivered" | "replied" | "bounced" | "skipped";
  createdAt: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
}

// --- Enriched journalist types (from GET /v1/journalists/list) ---

export interface EmailDeliveryScopeStatus {
  contacted: boolean;
  delivered: boolean;
  opened: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  bounced: boolean;
  unsubscribed: boolean;
  lastDeliveredAt: string | null;
}

export interface EmailDeliveryGlobalStatus {
  email: { bounced: boolean; unsubscribed: boolean };
}

export interface EmailStatus {
  broadcast: {
    campaign: EmailDeliveryScopeStatus | null;
    brand: EmailDeliveryScopeStatus | null;
    global: EmailDeliveryGlobalStatus;
  };
  transactional: {
    campaign: EmailDeliveryScopeStatus | null;
    brand: EmailDeliveryScopeStatus | null;
    global: EmailDeliveryGlobalStatus;
  };
}

export interface JournalistCost {
  totalCostInUsdCents: number;
  actualCostInUsdCents: number;
  provisionedCostInUsdCents: number;
  runCount: number;
}

export interface JournalistCampaignEntry {
  id: string;
  campaignId: string;
  featureSlug: string | null;
  workflowSlug: string | null;
  relevanceScore: string;
  whyRelevant: string;
  whyNotRelevant: string;
  articleUrls: string[] | null;
  email: string | null;
  apolloPersonId: string | null;
  statusReason: string | null;
  statusDetail: string | null;
  runId: string | null;
  createdAt: string;
}

export interface JournalistStatusBooleans {
  buffered: boolean;
  claimed: boolean;
  served: boolean;
  skipped: boolean;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  bounced: boolean;
  unsubscribed: boolean;
  lastDeliveredAt: string | null;
}

export interface EnrichedJournalist {
  journalistId: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
  outletId: string;
  outletName: string | null;
  outletDomain: string | null;
  email: string | null;
  apolloPersonId: string | null;
  brand: JournalistStatusBooleans | null;
  byCampaign: Record<string, JournalistStatusBooleans> | null;
  campaign: JournalistStatusBooleans | null;
  global: { bounced: boolean; unsubscribed: boolean } | null;
  cost: JournalistCost | null;
  campaigns: JournalistCampaignEntry[];
}

/** Check if a journalist has been contacted at a given scope */
export function isJournalistContacted(
  emailStatus: EmailStatus | null,
  scope: "campaign" | "brand",
): boolean {
  if (!emailStatus) return false;
  const bc = emailStatus.broadcast[scope];
  const tc = emailStatus.transactional[scope];
  return (
    (bc?.contacted ?? false) ||
    (tc?.contacted ?? false)
  );
}

export async function listJournalistsEnriched(
  brandId: string,
  options?: { campaignId?: string; featureSlug?: string; token?: string },
): Promise<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }> {
  const params = new URLSearchParams({ brandId });
  if (options?.campaignId) params.set("campaignId", options.campaignId);
  if (options?.featureSlug) params.set("featureSlug", options.featureSlug);
  return apiCall<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }>(
    `/journalists/list?${params}`,
    { token: options?.token },
  );
}

export async function listBrandJournalists(
  brandId: string,
  campaignId?: string,
  token?: string,
): Promise<{ campaignJournalists: BrandJournalist[] }> {
  const params = new URLSearchParams({ brandId });
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ campaignJournalists: BrandJournalist[] }>(
    `/journalists?${params}`,
    { token },
  );
}

export async function listCampaignJournalists(
  campaignId: string,
  token?: string,
): Promise<{ journalists: DiscoveredJournalist[] }> {
  return apiCall<{ journalists: DiscoveredJournalist[] }>(
    `/campaigns/${campaignId}/journalists`,
    { token },
  );
}

// --- Discovery actions & cost stats ---

export async function discoverOutlets(
  brandId: string,
  campaignId: string,
  count?: number,
): Promise<{ runId: string; discovered: number }> {
  return apiCall<{ runId: string; discovered: number }>(
    `/outlets/discover`,
    {
      method: "POST",
      body: count ? { count } : {},
      headers: {
        "x-brand-id": brandId,
        "x-campaign-id": campaignId,
      },
    },
  );
}

export async function discoverJournalists(
  brandId: string,
  campaignId: string,
  outletId: string,
  maxArticles?: number,
): Promise<{ runId: string; discovered: number }> {
  return apiCall<{ runId: string; discovered: number }>(
    `/journalists/discover`,
    {
      method: "POST",
      body: { outletId, ...(maxArticles ? { maxArticles } : {}) },
      headers: {
        "x-brand-id": brandId,
        "x-campaign-id": campaignId,
      },
    },
  );
}

export async function getOutletStatsCosts(
  brandId: string,
  groupBy?: string,
  featureSlug?: string,
  token?: string,
  campaignId?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  if (featureSlug) params.set("featureSlug", featureSlug);
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/outlets/stats/costs?${params}`,
    { token },
  );
}

export async function getJournalistStatsCosts(
  brandId: string,
  groupBy?: string,
  campaignId?: string,
  token?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  if (campaignId) params.set("campaignId", campaignId);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/journalists/stats/costs?${params}`,
    { token },
  );
}

export async function getMediaKitStatsCosts(
  brandId: string,
  groupBy?: string,
  token?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  return apiCall<{ groups: CostStatsGroup[] }>(
    `/press-kits/media-kits/stats/costs?${params}`,
    { token },
  );
}

// --- Article discovery types ---

export interface ArticleDiscoveryItem {
  discovery: {
    id: string;
    articleId: string;
    orgId: string;
    brandId: string;
    featureSlug: string;
    campaignId: string;
    outletId: string | null;
    journalistId: string | null;
    topicId: string | null;
    createdAt: string;
  };
  article: {
    id: string;
    articleUrl: string;
    snippet: string | null;
    ogDescription: string | null;
    twitterCreator: string | null;
    newsKeywords: string | null;
    articlePublished: string | null;
    articleChannel: string | null;
    twitterTitle: string | null;
    articleSection: string | null;
    author: string | null;
    ogTitle: string | null;
    articleAuthor: string | null;
    twitterDescription: string | null;
    articleModified: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function listCampaignArticles(
  campaignId: string,
  token?: string,
): Promise<{ discoveries: ArticleDiscoveryItem[] }> {
  return apiCall<{ discoveries: ArticleDiscoveryItem[] }>(
    `/discoveries?campaignId=${campaignId}`,
    { token },
  );
}

export async function listBrandArticles(
  brandId: string,
  featureSlug?: string,
  token?: string,
): Promise<{ discoveries: ArticleDiscoveryItem[] }> {
  const params = new URLSearchParams({ brandId });
  if (featureSlug) params.set("featureSlug", featureSlug);
  return apiCall<{ discoveries: ArticleDiscoveryItem[] }>(
    `/discoveries?${params}`,
    { token },
  );
}

/** Check if orgs exist in press-kits-service */
export async function checkPressKitOrgsExist(
  orgIds: string[],
  token?: string
): Promise<Record<string, boolean>> {
  return apiCall<Record<string, boolean>>(
    `/press-kits/organizations/exists?orgIds=${orgIds.join(",")}`,
    { token },
  );
}

// ─── Expert Quote Outreach (journalists-quotes-service) ──────────────────────

export type QuoteRequestStatus =
  | "fetched"
  | "scored"
  | "skipped"
  | "pitched"
  | "selected"
  | "published"
  | "not_selected"
  | "error";

// Backend openapi: journalists-quotes-service GET /orgs/quote-pitches.
// Verified 2026-05-28 via mcp__api-registry. Do NOT add fields not on the wire.
export type QuotePitchStatus =
  | "drafted"
  | "submitted"
  | "selected"
  | "published"
  | "not_selected"
  | "error"
  | "length_violation"
  | "template_missing"
  | "brand_missing_fields"
  | "insufficient_credits"
  | "question_not_found";

export type QuotePitchDeliveryMethod = "featured_api" | "email_reply";

export interface QuoteRequest {
  id: string;
  provider: string;
  ingestionChannel: string;
  externalId: string;
  featuredQuestionId: number | null;
  mediaOutlet: string | null;
  journalistName: string | null;
  journalistEmail: string | null;
  pitchEmail: string | null;
  category: string | null;
  opportunityText: string;
  pitchUrl: string | null;
  deadline: string | null;
  fetchedAt: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotePitch {
  id: string;
  quoteRequestId: string;
  quoteOpportunityId: string | null;
  featuredQuestionId: number | null;
  featuredProfileId: number | null;
  campaignId: string | null;
  brandIds: string[];
  draft: string | null;
  pitchCharCount: number | null;
  pitchAttempts: number | null;
  contentGenRunId: string | null;
  submittedAt: string | null;
  status: QuotePitchStatus;
  deliveryMethod: QuotePitchDeliveryMethod;
  deliveryTarget: string | null;
  outboundMessageId: string | null;
  replyInThreadMessageId: string | null;
  bounceStatus: string | null;
  featuredArticleUrl: string | null;
  error: string | null;
  errorDetails: unknown;
  parentRunId: string | null;
  runId: string | null;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteRequestStats {
  fetched: number;
  scored: number;
  skipped: number;
  pitched: number;
  selected: number;
  published: number;
  notSelected: number;
  errored: number;
}

export interface ListQuoteRequestsParams {
  campaign_id?: string;
  provider?: string;
  ingestion_channel?: string;
  limit?: number;
  offset?: number;
}

// Wire query params (snake_case). Backend openapi: only campaign_id/status/
// limit/offset are accepted; brand filtering is done client-side via brandIds[].
export interface ListQuotePitchesParams {
  campaign_id?: string;
  status?: QuotePitchStatus;
  limit?: number;
  offset?: number;
}

function buildQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const out = qs.toString();
  return out ? `?${out}` : "";
}

const QuoteRequestSchema = z.object({
  id: z.string(),
  provider: z.string(),
  ingestionChannel: z.string(),
  externalId: z.string(),
  featuredQuestionId: z.number().nullable(),
  mediaOutlet: z.string().nullable(),
  journalistName: z.string().nullable(),
  journalistEmail: z.string().nullable(),
  pitchEmail: z.string().nullable(),
  category: z.string().nullable(),
  opportunityText: z.string(),
  pitchUrl: z.string().nullable(),
  deadline: z.string().nullable(),
  fetchedAt: z.string(),
  orgId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ListQuoteRequestsResponseSchema = z.object({
  providerQuoteRequests: z.array(QuoteRequestSchema),
});

export async function listQuoteRequests(
  params?: ListQuoteRequestsParams,
  token?: string,
): Promise<{ providerQuoteRequests: QuoteRequest[] }> {
  const raw = await apiCall<unknown>(
    `/orgs/quote-requests${buildQuery(params ?? {})}`,
    { token },
  );
  const parsed = ListQuoteRequestsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[dashboard] listQuoteRequests: response shape mismatch",
      { issues: parsed.error.issues, raw },
    );
    throw new Error("[dashboard] listQuoteRequests: invalid response shape");
  }
  return parsed.data;
}

export async function getQuoteRequest(
  id: string,
  token?: string,
): Promise<{ request: QuoteRequest }> {
  return apiCall<{ request: QuoteRequest }>(`/orgs/quote-requests/${id}`, { token });
}

export async function getQuoteRequestStats(
  params?: { brandId?: string; campaignId?: string },
  token?: string,
): Promise<{ stats: QuoteRequestStats }> {
  return apiCall<{ stats: QuoteRequestStats }>(
    `/orgs/quote-requests/stats${buildQuery(params ?? {})}`,
    { token },
  );
}

// journalists-quotes-service GET /orgs/quote-pitches openapi (verified via
// mcp__api-registry 2026-06-02). safeParse on every list/get wrapper per the
// DIS-74 rule — a wire-shape drift surfaces as a caught fetch error, not a
// blank page.
const QuotePitchStatusSchema = z.enum([
  "drafted",
  "submitted",
  "selected",
  "published",
  "not_selected",
  "error",
  "length_violation",
  "template_missing",
  "brand_missing_fields",
  "insufficient_credits",
  "question_not_found",
]);

const QuotePitchSchema = z.object({
  id: z.string(),
  quoteRequestId: z.string(),
  quoteOpportunityId: z.string().nullable(),
  featuredQuestionId: z.number().nullable(),
  featuredProfileId: z.number().nullable(),
  campaignId: z.string().nullable(),
  brandIds: z.array(z.string()),
  draft: z.string().nullable(),
  pitchCharCount: z.number().nullable(),
  pitchAttempts: z.number().nullable(),
  contentGenRunId: z.string().nullable(),
  submittedAt: z.string().nullable(),
  status: QuotePitchStatusSchema,
  deliveryMethod: z.enum(["featured_api", "email_reply"]),
  deliveryTarget: z.string().nullable(),
  outboundMessageId: z.string().nullable(),
  replyInThreadMessageId: z.string().nullable(),
  bounceStatus: z.string().nullable(),
  featuredArticleUrl: z.string().nullable(),
  error: z.string().nullable(),
  errorDetails: z.unknown(),
  parentRunId: z.string().nullable(),
  runId: z.string().nullable(),
  orgId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ListQuotePitchesResponseSchema = z.object({
  quotePitches: z.array(QuotePitchSchema),
});

const GetQuotePitchResponseSchema = z.object({
  quotePitch: QuotePitchSchema,
});

export async function listQuotePitches(
  params?: ListQuotePitchesParams,
  token?: string,
): Promise<{ quotePitches: QuotePitch[] }> {
  const raw = await apiCall<unknown>(
    `/orgs/quote-pitches${buildQuery(params ?? {})}`,
    { token },
  );
  const parsed = ListQuotePitchesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listQuotePitches: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] listQuotePitches: invalid response shape");
  }
  return parsed.data as { quotePitches: QuotePitch[] };
}

/** Fetches EVERY quote-pitch matching the filter by paging through
 *  `GET /orgs/quote-pitches` until exhausted (never a single capped page) —
 *  the pitches analog of `listAllRankedOpportunities`. The sidebar badge + the
 *  Pitches page show the complete set, so a hardcoded `limit` silently hid the
 *  tail (badge stuck at 100). Pages of 200; the response carries NO `total`, so
 *  a short page (`< PAGE`) is the only exhaustion signal. The 10k-offset guard
 *  is a runaway backstop, not a product cap. */
export async function listAllQuotePitches(
  params?: { campaign_id?: string; status?: QuotePitchStatus },
  token?: string,
): Promise<{ quotePitches: QuotePitch[] }> {
  const PAGE = 200;
  const all: QuotePitch[] = [];
  for (let offset = 0; offset <= 10_000; offset += PAGE) {
    const res = await listQuotePitches(
      { ...params, limit: PAGE, offset },
      token,
    );
    all.push(...res.quotePitches);
    if (res.quotePitches.length < PAGE) break;
  }
  return { quotePitches: all };
}

export async function getQuotePitch(
  id: string,
  token?: string,
): Promise<{ quotePitch: QuotePitch }> {
  const raw = await apiCall<unknown>(`/orgs/quote-pitches/${id}`, { token });
  const parsed = GetQuotePitchResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getQuotePitch: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getQuotePitch: invalid response shape");
  }
  return parsed.data as { quotePitch: QuotePitch };
}

// ─── Ranked HITL opportunities (pr-expert-quote-opportunities) ──────────────

export interface RankedOpportunity {
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
  // Pitch status annotated by GET /orgs/opportunities for the brand-set (or the
  // campaign when campaignId is passed). null = no pitch yet. Drives hiding
  // already-pitched opportunities from the queue (lib/quote-pitch-status.ts).
  pitchStatus: QuotePitchStatus | null;
}

const RankedOpportunitySchema = z.object({
  opportunityId: z.string(),
  provider: z.string(),
  ingestionChannel: z.string(),
  featuredQuestionId: z.number().nullable(),
  mediaOutlet: z.string().nullable(),
  journalistName: z.string().nullable(),
  opportunityText: z.string(),
  deadline: z.string().nullable(),
  pitchUrl: z.string().nullable(),
  pitchEmail: z.string().nullable(),
  category: z.string().nullable(),
  score: z.number(),
  whyRelevant: z.string().nullable(),
  // Declared so Zod's .object() keeps it — undeclared keys are stripped from
  // the parsed result even when present on the wire.
  pitchStatus: QuotePitchStatusSchema.nullable(),
});

const ListRankedOpportunitiesResponseSchema = z.object({
  status: z.string(),
  opportunities: z.array(RankedOpportunitySchema),
  total: z.number(),
});

export interface ListRankedOpportunitiesParams {
  brandId: string;
  limit?: number;
  offset?: number;
}

/** Lists scored Gold opportunities for the given brand.
 *  Canonical read surface (DIS-102): GET /orgs/opportunities with
 *  `limit` / `offset` in the query string. Brand identity via the
 *  `x-brand-id` header (multi-brand CSV allowed). */
export async function listRankedOpportunities(
  params: ListRankedOpportunitiesParams,
  token?: string,
): Promise<{ status: string; opportunities: RankedOpportunity[]; total: number }> {
  const { brandId, limit, offset } = params;
  const query = new URLSearchParams();
  if (typeof limit === "number") query.set("limit", String(limit));
  if (typeof offset === "number") query.set("offset", String(offset));
  const qs = query.toString();
  const path = qs ? `/orgs/opportunities?${qs}` : "/orgs/opportunities";
  const raw = await apiCall<unknown>(path, {
    token,
    method: "GET",
    headers: { "x-brand-id": brandId },
  });
  const parsed = ListRankedOpportunitiesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[dashboard] listRankedOpportunities: response shape mismatch",
      { issues: parsed.error.issues, raw },
    );
    throw new Error("[dashboard] listRankedOpportunities: invalid response shape");
  }
  return parsed.data;
}

/** Fetches EVERY scored Gold opportunity for a brand by paging through
 *  `GET /orgs/opportunities` until the catalog is exhausted (never a single
 *  capped page). The HITL queue + sidebar badges show the complete set — the
 *  operator reviews every opportunity, so a 50-row cap silently hid the tail.
 *  Pages of 200; stops when a short page returns or `total` is reached. The
 *  10k-offset guard is a runaway backstop, not a product cap. */
export async function listAllRankedOpportunities(
  params: { brandId: string },
  token?: string,
): Promise<{ status: string; opportunities: RankedOpportunity[]; total: number }> {
  const PAGE = 200;
  const all: RankedOpportunity[] = [];
  let status = "ok";
  let total = 0;
  for (let offset = 0; offset <= 10_000; offset += PAGE) {
    const res = await listRankedOpportunities(
      { brandId: params.brandId, limit: PAGE, offset },
      token,
    );
    status = res.status;
    total = res.total;
    all.push(...res.opportunities);
    if (res.opportunities.length < PAGE || all.length >= res.total) break;
  }
  return { status, opportunities: all, total };
}

/** Body for `generateQuoteDraft`. v0.8.1 contract: variables are caller-
 *  decided shape (matching the `expert-quote-pitch` platform-prompt
 *  template); `brandId` is the brand the pitch is for and is sent both as
 *  the `x-brand-id` header AND as `brandIds: [brandId]` in the body for
 *  content-generation-service tracking. */
export interface GenerateQuoteDraftBody {
  brandId: string;
  variables: Record<string, unknown>;
  featureSlug?: string;
  /** Campaign the pitch is generated under. Threaded so content-gen tags its
   *  run/cost (and the downstream chat-service LLM spend) to the campaign, not
   *  just brand + feature. */
  campaignId?: string;
}

export interface GenerateQuoteDraftResponse {
  pitch: string;
  charCount: number;
  attempts: number;
  tokensInput: number;
  tokensOutput: number;
}

/** Generates a pitch via content-generation-service `/generate-expert-quote-
 *  pitch`, proxied by api-service `POST /v1/content/generate-expert-quote-
 *  pitch`. The legacy `/orgs/quote-requests/:id/draft` endpoint was removed
 *  from journalists-quotes-service in v0.8.1 — composition now lives in the
 *  caller (see `apps/dashboard/src/app/api/report/.../draft/route.ts` for
 *  the public-report variant). */
export async function generateQuoteDraft(
  body: GenerateQuoteDraftBody,
  token?: string,
): Promise<GenerateQuoteDraftResponse> {
  const { brandId, variables, featureSlug, campaignId } = body;
  const upstreamBody: Record<string, unknown> = {
    variables,
    brandIds: [brandId],
  };
  if (featureSlug) upstreamBody.featureSlug = featureSlug;
  // content-gen reads `bodyCampaignId || req.campaignId` → the body value is the
  // reliable path (api-service forwards `req.body` verbatim). x-campaign-id is a
  // belt-and-suspenders mirror of the x-brand-id header pattern.
  if (campaignId) upstreamBody.campaignId = campaignId;
  const headers: Record<string, string> = { "x-brand-id": brandId };
  if (campaignId) headers["x-campaign-id"] = campaignId;
  return apiCall<GenerateQuoteDraftResponse>(
    `/content/generate-expert-quote-pitch`,
    {
      token,
      method: "POST",
      body: upstreamBody,
      headers,
    },
  );
}

/** Brand + expert fields the expert-quote-pitch contract requires but campaign
 *  inputs don't carry. Sourced via brand-service `extract-fields`; descriptions
 *  seed the extraction prompt (quality matters — these ground the pitch). */
const EXPERT_QUOTE_EXTRACT_FIELDS: ExtractFieldDef[] = [
  {
    key: "brandDescription",
    description: "One-line description of what the company does and who it serves.",
  },
  {
    key: "brandHeadquartersLocation",
    description: "City and country/region of the company's headquarters.",
  },
  {
    key: "expertBio",
    description:
      "Short professional bio of the company's spokesperson/expert — role, experience, and credentials that make them a credible source.",
  },
];

/** Expert attribution carried by the campaign `featureInputs` (DIS-136). */
export interface ExpertQuotePitchExpertInputs {
  expertName: string;
  expertTitle: string;
  expertPhotoUrl: string;
  expertLinkedIn: string;
}

export interface GenerateExpertQuotePitchArgs {
  brandId: string;
  expert: ExpertQuotePitchExpertInputs;
  opportunity: QuoteOpportunityContext;
  /** Free-text revision instructions from the "Edit with AI" modal. Null on a
   *  first/plain (re)generation. Threaded into `expert.answerContext`. */
  revisionInstructions?: string | null;
  featureSlug?: string;
  /** Campaign in scope on the calling page (`params.id`). Threaded so the
   *  content-gen run/cost is attributed to the campaign, not just brand+feature. */
  campaignId?: string;
}

/** Authed-side orchestration for the all-required expert-quote-pitch contract
 *  (content-generation-service PR #124 / v0.21.0). Fetches brand identity +
 *  extracts the brand/expert fields campaign inputs don't carry, assembles the
 *  byte-equal `variables` body, and generates. `buildExpertQuotePitchVariables`
 *  throws (fail-loud) before any generate call if a required field is empty —
 *  the dashboard never sends a partial body (the upstream validator 400s on
 *  empties) and never falls back to the legacy contract. */
export async function generateExpertQuotePitch(
  args: GenerateExpertQuotePitchArgs,
  token?: string,
): Promise<GenerateQuoteDraftResponse> {
  const { brandId, expert, opportunity, revisionInstructions, featureSlug, campaignId } = args;
  // Question-driven brand evidence: seed an extract-fields entry with the
  // journalist's question so brand-service mines the brand for facts that
  // answer THIS question. brand-service keys its cache on a hash of the
  // description, so each distinct question gets its own slot (no collision
  // across opportunities) and re-generating the same opportunity reuses it.
  const extractFields: ExtractFieldDef[] = [
    ...EXPERT_QUOTE_EXTRACT_FIELDS,
    { key: "expertAnswerContext", description: opportunity.opportunityText.trim() },
  ];
  const [brandResult, extractRes, priorPitchesRes] = await Promise.all([
    getBrand(brandId, token),
    extractBrandFields([brandId], extractFields, { token }),
    listQuotePitches({}, token),
  ]);
  const brand = brandResult?.brand ?? null;
  const evidence = extractRes.fields.expertAnswerContext;

  const variables = buildExpertQuotePitchVariables({
    identity: {
      brandName: brand?.name ?? null,
      brandUrl: brand?.url ?? null,
      brandLogoUrl: brand?.logoUrl ?? null,
    },
    extracted: {
      brandDescription: coerceExtractedToString(extractRes.fields.brandDescription?.value),
      brandHeadquartersLocation: coerceExtractedToString(
        extractRes.fields.brandHeadquartersLocation?.value,
      ),
      expertBio: coerceExtractedToString(extractRes.fields.expertBio?.value),
    },
    expert: {
      expertName: expert.expertName,
      expertTitle: expert.expertTitle,
      expertPhotoUrl: expert.expertPhotoUrl,
      expertLinkedIn: expert.expertLinkedIn,
    },
    opportunity,
    answerContext: {
      brandEvidence: coerceExtractedToString(evidence?.value),
      evidenceSourceUrls: evidence?.sourceUrls ?? [],
      revisionInstructions: revisionInstructions ?? null,
      priorSubmittedPitches: selectPriorSubmittedPitches(
        priorPitchesRes.quotePitches,
        brandId,
      ),
    },
  });

  return generateQuoteDraft({ brandId, variables, featureSlug, campaignId }, token);
}

// ───────── Prompt assignment (per-feature generation prompt) ────────────────
// The prompt the GENERATE button renders for a feature is resolved by
// content-generation-service: feature assignment ▸ platform default. The editor
// reads the resolved prompt, lets the operator fork-edit it, and the fork
// becomes the feature's prompt going forward. Scope is feature-level (global),
// the prompt is brand-agnostic.

export interface PromptVariable {
  name: string;
  description: string;
}

export interface PromptAssignment {
  featureSlug: string;
  /** The resolved prompt-template type/slug, e.g. `expert-quote-pitch-v2`. */
  promptType: string;
  prompt: string;
  variables: PromptVariable[];
  /** True when no override exists and this is the platform default. */
  isDefault: boolean;
}

const PromptVariableSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const PromptAssignmentSchema = z.object({
  featureSlug: z.string(),
  promptType: z.string(),
  prompt: z.string(),
  variables: z.array(PromptVariableSchema),
  isDefault: z.boolean(),
});

// The deployed content-generation-service PUT /prompt-assignments 200 response
// OMITS isDefault (GET returns it, PUT does not — confirmed against prod +
// staging api-registry). Parse the PUT response with its own schema rather than
// the GET one, then set isDefault explicitly below.
const SavePromptAssignmentResponseSchema = PromptAssignmentSchema.omit({
  isDefault: true,
});

/** Reads the resolved generation prompt for a feature (default or fork). */
export async function getPromptAssignment(
  featureSlug: string,
  token?: string,
): Promise<PromptAssignment> {
  const raw = await apiCall<unknown>(
    `/content/prompt-assignments${buildQuery({ featureSlug })}`,
    { token },
  );
  const parsed = PromptAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getPromptAssignment: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getPromptAssignment: invalid response shape");
  }
  return parsed.data;
}

export interface SavePromptAssignmentBody {
  featureSlug: string;
  prompt: string;
  variables: PromptVariable[];
}

/**
 * Forks the feature's current prompt with the edited text + variables and
 * reassigns the feature to the fork. Backend rejects with 400 if the edited
 * prompt drops/renames/adds a template variable.
 */
export async function savePromptAssignment(
  body: SavePromptAssignmentBody,
  token?: string,
): Promise<PromptAssignment> {
  const requestBody: Record<string, unknown> = {
    featureSlug: body.featureSlug,
    prompt: body.prompt,
    variables: body.variables,
  };
  const raw = await apiCall<unknown>(`/content/prompt-assignments`, {
    token,
    method: "PUT",
    body: requestBody,
  });
  const parsed = SavePromptAssignmentResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] savePromptAssignment: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] savePromptAssignment: invalid response shape");
  }
  // A fork+reassign just created an override, so the feature is definitionally
  // no longer on the platform default — isDefault is false by construction
  // (the PUT response does not carry it). Not a masking fallback: it's the
  // documented post-fork invariant.
  return { ...parsed.data, isDefault: false };
}

export type SubmitQuotePitchStatus =
  | "submitted"
  | "already_submitted"
  | "rate_limited"
  | "error";

export interface SubmitQuotePitchBody {
  pitchContent: string;
  subject?: string;
  // Associates the created quote_pitch with the campaign so it surfaces on the
  // campaign-scoped pitches page (which filters by campaign_id). Omitted on
  // brand-scoped surfaces (feature page, public report) → campaign-less pitch.
  campaignId?: string;
}

export interface SubmitQuotePitchResponse {
  status: SubmitQuotePitchStatus;
  pitchId?: string;
  deliveryMethod?: "featured_api" | "email_reply";
  outboundMessageId?: string | null;
  featuredQuestionId?: number | null;
  retryAfter?: number;
  error?: string;
}

/** Submits a HITL pitch for the given Gold opportunity. v0.8.1 contract:
 *  brand identity flows via `x-brand-id` header; body carries pitchContent
 *  (+ optional subject) only. */
export async function submitQuoteOpportunityReply(
  opportunityId: string,
  body: SubmitQuotePitchBody,
  brandId: string,
  token?: string,
): Promise<SubmitQuotePitchResponse> {
  return apiCall<SubmitQuotePitchResponse>(
    `/orgs/opportunities/${opportunityId}/reply`,
    {
      token,
      method: "POST",
      body: { ...body },
      headers: { "x-brand-id": brandId },
    },
  );
}

// ─── Ahref domain metrics (ahref-service via api-service proxy) ─────────────
// Domain-keyed Ahrefs cache: organic-traffic monthly history, latest DR, and
// latest estimated traffic value. Read-only GET pass-throughs (no paid scrape
// on view — the POST compute/ai-visibility endpoints are intentionally not
// proxied). safeParse per the DIS-74 wire-shape-rot rule: throw on mismatch so
// React Query surfaces a fetch error instead of crashing at render.

const MonthlyOrganicTrafficPointSchema = z.object({
  month: z.string(), // First day of the month (YYYY-MM-DD).
  // ahref-service declares this `integer` but serializes Postgres numeric as a
  // string ("0") on the wire; coerce so a string OR number parses. nullable()
  // short-circuits null before coerce (null -> null, not 0).
  organicTraffic: z.coerce.number().nullable(),
});

const DomainTrafficHistorySchema = z.object({
  domain: z.string(),
  hasData: z.boolean(),
  latestDataCapturedAt: z.string().nullable(),
  // Same numeric-string wire shape as organicTraffic above.
  trafficMonthlyAvg: z.coerce.number().nullable(),
  trafficValueMonthlyAvg: z.coerce.number().nullable(),
  monthlyOrganicTraffic: z.array(MonthlyOrganicTrafficPointSchema),
});

export type DomainTrafficHistory = z.infer<typeof DomainTrafficHistorySchema>;

const DomainDrStatusSchema = z.object({
  domain: z.string(),
  latestValidDr: z.number().nullable(),
  latestValidDrDate: z.string().nullable(),
});

export type DomainDrStatus = z.infer<typeof DomainDrStatusSchema>;

/**
 * GET /v1/orgs/domains/traffic-history — Ahrefs traffic for a single domain:
 * latest snapshot (avg traffic + estimated value) plus the monthly organic
 * series. Returns null when the domain isn't in the cache yet (empty array).
 */
export async function getDomainTrafficHistory(
  domain: string,
  token?: string,
): Promise<DomainTrafficHistory | null> {
  const data = await getDomainTrafficHistories([domain], token);
  return data[0] ?? null;
}

// Both domain cache-readers take a `?domains=a.com,b.com,…` query string. A
// brand can own thousands of outlet domains (12k+ seen in prod), and passing
// every domain in ONE request blows the URL/header size limit → the request
// fails → the DR / Monthly-Visits maps come back empty (blank columns in the
// CSV + cards). Split into bounded chunks fetched with limited concurrency.
//
// ahref-service prod runs on a tiny fixed compute (0.25 CU, small pg pool) with
// Neon scale-to-zero, so a burst of chunk requests hits cold-start +
// pool-saturation transients (ECONNRESET / 5xx / "timeout exceeded when trying
// to connect"). The reads are idempotent GETs, so each chunk RETRIES transient
// failures with backoff; only a chunk that still fails after all attempts
// throws (fail loud). Without the retry, ONE dropped chunk would empty the whole
// enrichment map (the merge awaits every chunk), which is exactly how DR +
// Monthly Visits went blank for the 12k-outlet brand even after chunking.
const DOMAIN_READ_CHUNK_SIZE = 200;
const DOMAIN_READ_CONCURRENCY = 4;
const DOMAIN_READ_RETRIES = 2;
const DOMAIN_READ_BACKOFF_MS = [400, 1200];
const DOMAIN_READ_TIMEOUT_MS = 12_000;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Bound a request so it can never hang forever. ahref-service prod is a tiny
// 0.25 CU compute; a single slow/queued chunk with no timeout left the whole
// enrichment query PENDING indefinitely (blank DR/Visits + a stuck "Loading"
// button), which retry alone could not fix because a hang never throws.
function withTimeout<O>(promise: Promise<O>, ms: number, label: string): Promise<O> {
  return new Promise<O>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[dashboard] ${label}: request timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// Retry an idempotent, time-bounded read on a thrown transport/5xx/timeout
// error. Throws the last error once attempts are exhausted; the CALLER decides
// whether a persistently-failing chunk drops to empty (best-effort enrichment)
// or propagates.
async function retryTransientRead<O>(fn: () => Promise<O>, label: string): Promise<O> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DOMAIN_READ_RETRIES; attempt++) {
    try {
      return await withTimeout(fn(), DOMAIN_READ_TIMEOUT_MS, label);
    } catch (err) {
      lastError = err;
      if (attempt < DOMAIN_READ_RETRIES) {
        await sleep(DOMAIN_READ_BACKOFF_MS[Math.min(attempt, DOMAIN_READ_BACKOFF_MS.length - 1)]);
      }
    }
  }
  throw lastError;
}

async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I) => Promise<O>,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const current = next++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * A value safe to send to ahref-service: a bare dotted host. Drops the junk that
 * 400s the whole chunk (empty string, the "-" no-domain placeholder, paths/spaces)
 * — see CLAUDE.md #2070. Filtering here protects EVERY caller (bulk readers + the
 * on-demand compute mutations), not just one page memo.
 */
export function isQueryableDomain(domain: string): boolean {
  return domain.length > 0 && domain !== "-" && domain.includes(".") && !/[/\s]/.test(domain);
}

export async function getDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length < domains.length) {
    console.warn("[admin] getDomainTrafficHistories: dropped non-queryable domains before ahref call", {
      dropped: domains.filter((d) => !isQueryableDomain(d)),
    });
  }
  if (queryable.length === 0) return [];
  const batches = chunkArray(queryable, DOMAIN_READ_CHUNK_SIZE);
  // Best-effort enrichment: a chunk that stays unreachable after retries drops
  // to [] (those domains render blank) instead of throwing and blanking EVERY
  // domain. The failure is logged loudly, not swallowed silently.
  const batchResults = await mapWithConcurrency(batches, DOMAIN_READ_CONCURRENCY, async (batch) => {
    try {
      const raw = await retryTransientRead(
        () => apiCall<unknown>(`/orgs/domains/traffic-history?${new URLSearchParams({ domains: batch.join(",") })}`, { token }),
        "getDomainTrafficHistories",
      );
      const parsed = z.array(DomainTrafficHistorySchema).safeParse(raw);
      if (!parsed.success) {
        console.error("[dashboard] getDomainTrafficHistories: response shape mismatch", {
          issues: parsed.error.issues,
          raw,
        });
        return [];
      }
      return parsed.data;
    } catch (err) {
      console.error("[dashboard] getDomainTrafficHistories: chunk unreachable, rendering its domains blank", err);
      return [];
    }
  });
  return batchResults.flat();
}

/**
 * GET /v1/orgs/domains/dr-status — Ahrefs Domain Rating status for a single
 * domain. Only the latest DR is exposed (no historical series), so the UI shows
 * it as a single big number. Returns null when the domain isn't cached yet.
 */
export async function getDomainDrStatus(
  domain: string,
  token?: string,
): Promise<DomainDrStatus | null> {
  const data = await getDomainDrStatuses([domain], token);
  return data[0] ?? null;
}

/**
 * GET /v1/orgs/domains/dr-status — Ahrefs Domain Rating status for many
 * domains. Cache read only: this does not trigger a paid Ahrefs scrape.
 */
export async function getDomainDrStatuses(
  domains: string[],
  token?: string,
): Promise<DomainDrStatus[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length < domains.length) {
    console.warn("[admin] getDomainDrStatuses: dropped non-queryable domains before ahref call", {
      dropped: domains.filter((d) => !isQueryableDomain(d)),
    });
  }
  if (queryable.length === 0) return [];
  const batches = chunkArray(queryable, DOMAIN_READ_CHUNK_SIZE);
  // Best-effort enrichment (see getDomainTrafficHistories): an unreachable chunk
  // drops to [] (blank for its domains) instead of blanking every domain.
  const batchResults = await mapWithConcurrency(batches, DOMAIN_READ_CONCURRENCY, async (batch) => {
    try {
      const raw = await retryTransientRead(
        () => apiCall<unknown>(`/orgs/domains/dr-status?${new URLSearchParams({ domains: batch.join(",") })}`, { token }),
        "getDomainDrStatuses",
      );
      const parsed = z.array(DomainDrStatusSchema).safeParse(raw);
      if (!parsed.success) {
        console.error("[dashboard] getDomainDrStatuses: response shape mismatch", {
          issues: parsed.error.issues,
          raw,
        });
        return [];
      }
      return parsed.data;
    } catch (err) {
      console.error("[dashboard] getDomainDrStatuses: chunk unreachable, rendering its domains blank", err);
      return [];
    }
  });
  return batchResults.flat();
}

// ─── On-demand Ahrefs fetch (get-or-fetch-if-never-seen) ────────────────────
// The GET readers above hit ahref-service's CACHE only; for a domain that was
// never scraped the cache is empty forever. These POST endpoints make
// AhrefService actually go check Ahrefs (declares cost + authorizes the scrape
// server-side). The dashboard fires them once per never-seen domain so we at
// least try the source. Compute responses are supersets of the read shapes;
// the read schemas strip the extra fields, so callers get the same type.

/**
 * POST /v1/orgs/domains/traffic-compute — on-demand Ahrefs traffic scrape for a
 * single domain. Returns the post-scrape traffic history (same shape as
 * getDomainTrafficHistory). null when Ahrefs has nothing for the domain.
 */
export async function computeDomainTraffic(
  domain: string,
  token?: string,
): Promise<DomainTrafficHistory | null> {
  const data = await computeDomainTrafficHistories([domain], token);
  return data[0] ?? null;
}

export async function computeDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length === 0) return [];
  const raw = await apiCall<unknown>("/orgs/domains/traffic-compute", {
    token,
    method: "POST",
    body: { domains: queryable },
  });
  const parsed = z.array(DomainTrafficHistorySchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainTrafficHistories: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainTrafficHistories: invalid response shape");
  }
  return parsed.data;
}

export async function computeDomainDrStatuses(
  domains: string[],
  token?: string,
): Promise<DomainDrStatus[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length === 0) return [];
  const raw = await apiCall<unknown>("/orgs/domains/dr-compute", {
    token,
    method: "POST",
    body: { domains: queryable },
  });
  const parsed = z.array(DomainDrStatusSchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainDrStatuses: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainDrStatuses: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /v1/orgs/domains/dr-compute — on-demand Ahrefs Domain Rating scrape for a
 * single domain. Returns the post-scrape DR status (same shape as
 * getDomainDrStatus). null when Ahrefs has nothing for the domain.
 */
export async function computeDomainDr(
  domain: string,
  token?: string,
): Promise<DomainDrStatus | null> {
  const data = await computeDomainDrStatuses([domain], token);
  return data[0] ?? null;
}

// Ahrefs Brand-Radar AI-visibility. Two surfaces, one lean shape (the wire also
// carries per-engine + competitor breakdowns + scrape metadata; the schema strips
// them — the card only surfaces the global mention count):
//   • GET  …/ai-visibility?domains=<csv>  — read-only CACHE (array, one element per
//     domain; fast, no scrape, no cost). The card's display reader.
//   • POST …/ai-visibility {domain}        — get-or-refresh (scrapes on cache-miss,
//     cost-declared + authorized). The getOrFetchIfNeverSeen trigger only.
const DomainAiVisibilitySchema = z.object({
  domain: z.string(),
  snapshotDate: z.string().nullable(),
  mentionsTotal: z.number(),
});

export type DomainAiVisibility = z.infer<typeof DomainAiVisibilitySchema>;

/**
 * GET /v1/orgs/domains/ai-visibility — read-only Ahrefs Brand-Radar cache for a
 * single domain (array response, one element per requested domain). No scrape, no
 * cost. null when the domain has no cached snapshot.
 */
export async function getDomainAiVisibility(
  domain: string,
  token?: string,
): Promise<DomainAiVisibility | null> {
  const raw = await apiCall<unknown>(
    `/orgs/domains/ai-visibility?domains=${encodeURIComponent(domain)}`,
    { token },
  );
  const parsed = z.array(DomainAiVisibilitySchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getDomainAiVisibility: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getDomainAiVisibility: invalid response shape");
  }
  return parsed.data[0] ?? null;
}

/**
 * POST /v1/orgs/domains/ai-visibility — get-or-refresh Ahrefs Brand-Radar
 * AI-visibility for a single domain (scrapes on cache-miss; ahref-service declares
 * cost + authorizes). Used ONLY as the on-demand getOrFetchIfNeverSeen trigger; the
 * card displays the GET cache read above, never this POST on the render path.
 */
export async function computeDomainAiVisibility(
  domain: string,
  token?: string,
): Promise<DomainAiVisibility> {
  const raw = await apiCall<unknown>("/orgs/domains/ai-visibility", {
    token,
    method: "POST",
    body: { domain },
  });
  const parsed = DomainAiVisibilitySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] computeDomainAiVisibility: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] computeDomainAiVisibility: invalid response shape");
  }
  return parsed.data;
}

// ─── AI Visibility Score (ai-visibility-score-service) ──────────────────────

export interface VisibilityRunWeights {
  brandMentionRate: number;
  citationRate: number;
  positionScore: number;
  shareOfVoice: number;
  sentiment: number;
  brandAndUrlRate: number;
}

export interface VisibilityRun {
  id: string;
  orgId: string;
  brandId: string;
  parentRunId: string | null;
  runId: string | null;
  domain: string;
  brandName: string;
  llmProvider: string;
  llmModel: string;
  promptGenModel: string;
  extractionProvider: string;
  extractionModel: string;
  nPrompts: number;
  weights: VisibilityRunWeights;
  visibilityScore: string | null;
  brandMentionRate: string | null;
  shareOfVoice: string | null;
  netSentiment: string | null;
  citationRate: string | null;
  avgPosition: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  judgeKind: "aggregate" | "per_provider";
  aggregateRunId: string | null;
  // ai-visibility-score-service v0.5.2 debug fields: exact strings sent to
  // the prompt-generation LLM call. Null on runs created before v0.5.2.
  // TODO: switch to generated SDK types once api-service hotfix lands.
  promptGenSystemPrompt: string | null;
  promptGenUserMessage: string | null;
}

export interface VisibilityRunWithDelta extends VisibilityRun {
  visibility_score_delta: string | null;
  share_of_voice_delta: string | null;
  net_sentiment_delta: string | null;
  position_delta: string | null;
}

export interface VisibilityRunPrompt {
  id: string;
  promptIndex: number;
  promptText: string;
  responseText: string;
  responseLengthChars: number | null;
  brandFound: boolean | null;
  brandCount: number | null;
  brandPosition: number | null;
  urlFound: boolean | null;
  urlCount: number | null;
  brandAndUrlCoOccurrence: boolean | null;
  maxBrandsInResponse: number | null;
  sentiment: string | null;
  sentimentScore: string | null;
  citationUrls: string[] | null;
  latencyMs: number | null;
  tokensInput: number | null;
  tokensOutput: number | null;
  // ai-visibility-score-service v0.5.2 debug fields: exact strings sent to
  // the judge + extractor LLM calls per prompt. Null on rows created
  // before v0.5.2. TODO: switch to generated SDK types once api-service
  // hotfix lands.
  judgeSystemPrompt: string | null;
  judgeUserMessage: string | null;
  extractorSystemPrompt: string | null;
  extractorUserMessage: string | null;
}

export interface VisibilityRunCompetitor {
  id: string;
  promptIdFk: string;
  competitorName: string;
  competitorUrl: string | null;
  position: number | null;
  sentiment: string | null;
  sentimentScore: string | null;
  citationUrl: string | null;
}

export interface VisibilityRunTopCompetitor {
  name: string;
  url: string | null;
  mention_count: number;
  avg_position: number | null;
  share_of_voice: number;
  net_sentiment: number;
}

export interface VisibilityRunCitationOpportunity {
  domain: string;
  count: number;
}

export interface VisibilityRunByProvider {
  provider: string;
  model: string;
  run: VisibilityRun;
  prompts: VisibilityRunPrompt[];
  competitors: VisibilityRunCompetitor[];
  top_competitors: VisibilityRunTopCompetitor[];
  citation_opportunities: VisibilityRunCitationOpportunity[];
}

export interface VisibilityRunDetail {
  run: VisibilityRun;
  by_provider: VisibilityRunByProvider[];
  top_competitors: VisibilityRunTopCompetitor[];
  citation_opportunities: VisibilityRunCitationOpportunity[];
}

export interface ListVisibilityRunsParams {
  brandId?: string;
  domain?: string;
  campaignId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function listVisibilityRuns(
  params?: ListVisibilityRunsParams,
  token?: string,
): Promise<{ runs: VisibilityRunWithDelta[]; limit: number; offset: number }> {
  return apiCall<{ runs: VisibilityRunWithDelta[]; limit: number; offset: number }>(
    `/orgs/visibility-score-runs${buildQuery(params ?? {})}`,
    { token },
  );
}

export async function getVisibilityRun(
  id: string,
  token?: string,
): Promise<VisibilityRunDetail> {
  return apiCall<VisibilityRunDetail>(`/orgs/visibility-score-runs/${id}`, { token });
}

/**
 * Trigger one execution of the workflow attached to a feature.
 * Resolves the workflow by featureSlug filter and calls
 * /workflows/:id/execute. Throws ApiError(404) when no workflow is
 * registered for the feature yet.
 */
export async function triggerFeatureRun(
  featureSlug: string,
  params: { brandId: string; campaignId: string },
  token?: string,
): Promise<{ workflowRunId: string }> {
  const { workflows } = await listWorkflows({ featureSlug }, token);
  const wf = workflows[0];
  if (!wf) {
    throw new ApiError(
      `No workflow registered for feature \`${featureSlug}\`.`,
      404,
      { error: "workflow_not_registered" },
    );
  }
  return apiCall<{ workflowRunId: string }>(`/workflows/${wf.id}/execute`, {
    token,
    method: "POST",
    body: { inputs: { brandId: params.brandId, campaignId: params.campaignId } },
  });
}

// ---------------------------------------------------------------------------
// Audit — Instantly sending forecast (staff-only, platform-scoped, no org).
// Every field is computed server-side by instantly-service (proxied via the
// gateway staff route); the dashboard renders only, never derives a metric.
// ---------------------------------------------------------------------------
export interface InstantlyForecastDay {
  date: string; // YYYY-MM-DD
  scheduledCount: number;
}

export interface InstantlySendingForecast {
  asOf: string; // ISO8601
  dailyCapacity: number; // emails/day the healthy fleet can send
  healthyAccountCount: number; // accounts passing filterHealthyAccounts
  totalAccountCount: number; // all accounts before filtering
  blockedDomainCount: number; // accounts excluded via BLOCKED_DOMAINS
  days: InstantlyForecastDay[]; // from today forward, chronological
}

/**
 * Fleet-wide cold-email sending forecast: per-day future scheduled volume vs
 * the current available daily capacity (only healthy, non-blacklisted, warmed
 * accounts). Staff-only platform view — no org context.
 */
export async function getInstantlySendingForecast(
  token?: string,
): Promise<InstantlySendingForecast> {
  return apiCall<InstantlySendingForecast>("/instantly/audit/sending-forecast", { token });
}

// ---------------------------------------------------------------------------
// Instantly reconciliation — our LOCAL count vs INSTANTLY's count per fact,
// with the delta (local minus instantly). A non-zero delta is the drift signal
// staff act on (lost webhook, lagging reconcile, missed pause). Every value is
// computed server-side; the dashboard renders exactly what the endpoint returns
// and never derives or fabricates a number.
// ---------------------------------------------------------------------------
export interface InstantlyReconcileMetric {
  key: string; // stable id, e.g. "activeCampaigns"
  label: string; // row title, e.g. "Active campaigns"
  local: number; // our stored count
  instantly: number; // Instantly's reported count
  delta: number; // local minus instantly (0 = in sync)
  sourceOfTruth: "instantly";
}

export interface InstantlyReconcile {
  asOf: string; // ISO8601
  metrics: InstantlyReconcileMetric[]; // ordered, one row per countable fact
}

/**
 * Fleet-wide Instantly reconciliation: for each countable fact, our local
 * number vs Instantly's number plus the delta, so staff can spot data drift.
 * Staff-only platform view. no org context.
 */
export async function getInstantlyReconcile(
  token?: string,
): Promise<InstantlyReconcile> {
  return apiCall<InstantlyReconcile>("/instantly/audit/reconcile", { token });
}

// ---------------------------------------------------------------------------
// Per-account deliverability health (staff-only, platform-scoped, no org).
// One row per sending account across the shared Instantly workspace: identity
// (email/domain), sending config (status, Health Score, daily send limit), and
// blocked state (blocked + reason, from the SAME gate the live send path uses).
// Every field is computed server-side by instantly-service; the dashboard
// renders only, never derives a metric or fabricates an absent field.
//
// NOTE — three requested columns are NOT served yet because Instantly's V2 API
// exposes no such per-account property: "sent today" (per-account daily sent
// count), "queue size" (emails queued), and "account type" (pre-warmed, etc).
// They are tracked as backend requests, not synthesized client-side.
// ---------------------------------------------------------------------------
// Per-account lifecycle state (auto-derived by instantly-service; no manual
// override exists). Send-eligible ⟺ 'in_production'; every other state is held
// out of new sends. 'unclassified' = an account the backend never classified.
export type InstantlyAccountLifecycleStatus =
  | "in_production"
  | "in_recovery"
  | "deactivated_by_instantly"
  | "deactivated_by_user";

export interface InstantlyAccountInboxPlacement {
  inboxPct: number;
  spamPct: number;
  missingPct: number;
  testedAt: string; // ISO8601
}

export interface InstantlyAccountHealthRow {
  email: string;
  domain: string | null; // part after @, null if malformed
  status: string; // "active" when Instantly status > 0, else "inactive"
  warmupScore: number | null; // Instantly Health Score (0-100), null if unknown
  dailyLimit: number | null; // per-account daily send limit, null if unknown
  blocked: boolean; // true when NOT send-eligible (lifecycleStatus !== 'in_production')
  // When blocked, the lifecycle_status behind it, or "unclassified" if never
  // classified. null when in_production. The old manual/warmup/domain reasons are gone.
  blockReason: string | null;
  lifecycleStatus: InstantlyAccountLifecycleStatus | null; // auto-derived send state
  lifecycleReason: string | null; // machine reason for the current lifecycle state
  lifecycleUpdatedAt: string | null; // ISO8601 of the last lifecycle transition
  inboxPlacement: InstantlyAccountInboxPlacement | null; // BSG history; always null in v1
  sentToday: number; // real emails sent today (UTC); honest 0, never null
  queueSize: number; // emails queued to Instantly but not yet sent; honest 0, never null
  accountType: string | null; // "google" | "microsoft" | "imap"; null when unknown
}

export interface InstantlyAccountHealth {
  asOf: string; // ISO8601
  accounts: InstantlyAccountHealthRow[];
}

const InstantlyAccountHealthRowSchema = z.object({
  email: z.string(),
  domain: z.string().nullable(),
  status: z.string(),
  warmupScore: z.number().nullable(),
  dailyLimit: z.number().nullable(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  lifecycleStatus: z
    .enum([
      "in_production",
      "in_recovery",
      "deactivated_by_instantly",
      "deactivated_by_user",
    ])
    .nullable(),
  lifecycleReason: z.string().nullable(),
  lifecycleUpdatedAt: z.string().nullable(),
  inboxPlacement: z
    .object({
      inboxPct: z.number(),
      spamPct: z.number(),
      missingPct: z.number(),
      testedAt: z.string(),
    })
    .nullable(),
  sentToday: z.number(),
  queueSize: z.number(),
  accountType: z.string().nullable(),
});
const InstantlyAccountHealthSchema = z.object({
  asOf: z.string(),
  accounts: z.array(InstantlyAccountHealthRowSchema),
});

/**
 * Per-account deliverability health across the shared Instantly workspace.
 * Staff-only platform view (no org context). safeParse converts wire-rot into a
 * caught fetch error instead of a render crash.
 */
export async function getInstantlyAccountHealth(
  token?: string,
): Promise<InstantlyAccountHealth> {
  const raw = await apiCall<unknown>("/instantly/audit/account-health", { token });
  const parsed = InstantlyAccountHealthSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getInstantlyAccountHealth: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] getInstantlyAccountHealth: invalid response shape");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Sending-capacity over time (staff-only, platform-scoped, no org). One point
// per UTC calendar day: the fleet's `in_production` daily send capacity
// (Σ daily_limit over accounts whose as-of-that-day lifecycle is in_production)
// plus how many accounts contributed. Reconstructed server-side by
// instantly-service from the append-only lifecycle-event + account-snapshot
// Bronze layers — the dashboard renders only, never derives a number.
// ---------------------------------------------------------------------------
export interface InstantlyCapacityHistoryPoint {
  date: string; // UTC calendar day (YYYY-MM-DD), oldest first
  inProductionCount: number; // accounts in_production as of that day
  dailyCapacity: number; // Σ daily_limit over those accounts (emails/day)
}

export interface InstantlyCapacityHistory {
  series: InstantlyCapacityHistoryPoint[];
}

const InstantlyCapacityHistorySchema = z.object({
  series: z.array(
    z.object({
      date: z.string(),
      inProductionCount: z.number(),
      dailyCapacity: z.number(),
    }),
  ),
});

/**
 * Fleet in-production daily send capacity for each of the last `days` UTC days
 * (clamped 1-365 server-side; default 30). Staff-only platform view (no org
 * context). safeParse converts wire-rot into a caught fetch error rather than a
 * render crash.
 */
export async function getInstantlyCapacityHistory(
  days: number,
  token?: string,
): Promise<InstantlyCapacityHistory> {
  const raw = await apiCall<unknown>(
    `/instantly/audit/capacity-history?days=${encodeURIComponent(days)}`,
    { token },
  );
  const parsed = InstantlyCapacityHistorySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getInstantlyCapacityHistory: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] getInstantlyCapacityHistory: invalid response shape");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Global fleet SEND forecast — cross-org, fleet-wide projection of how many
// outreach emails will be SENT per calendar day over a past + future window.
// Stacks three EMAIL-grain series: actualSent (past real sends, follow-ups
// included), inFlightSent (already-scheduled follow-ups for sequences launched
// before today), forecastNew (emails NEW budget-driven sequences launch from
// today onward on the D0/D3/D10 cadence). Every value is computed server-side
// by features-service; the dashboard renders only, never derives a metric.
// null (not 0) means the input is absent for that day → render "-".
// ---------------------------------------------------------------------------
export interface SendForecastDay {
  date: string; // UTC calendar day (YYYY-MM-DD)
  isToday: boolean;
  actualSent: number | null; // past real emails sent that day; null on future days
  inFlightSent: number | null; // scheduled follow-ups (pre-today cohorts); null on past days
  forecastNew: number | null; // projected new-sequence emails (today onward); null on past days
  total: number | null; // predictive total: past = actualSent, today/future = sum of present parts
}

export interface SendForecastSummary {
  totalDailyBudgetUsd: number; // sum of daily budget over active brands (USD)
  remainingTodayUsd: number; // sum of remaining budget today over active brands (USD)
  followupModel: string; // send cadence model, e.g. "D0/D3/D10"
  activeBrandCount: number;
  totalNewSequencesPerDay: number; // fleet new sequences/day at full budget
}

export interface SendForecast {
  days: SendForecastDay[]; // past tail + future horizon, chronological
  summary: SendForecastSummary;
}

/**
 * Global fleet-wide email SEND forecast: per-day stacked actual + in-flight +
 * projected-new volume plus the fleet budget summary. Staff-gated platform view
 * (no org context) — the summary carries cross-org fleet financials (total daily
 * budget, remaining today, active brand count), so it is served only behind the
 * staff audit route, never the public endpoint. Same staff auth path as the
 * other /instantly/audit/* calls on this page. Default 14-day future horizon
 * (max 90), always with a 7-day past tail.
 */
export async function getSendForecast(
  days?: number,
  token?: string,
): Promise<SendForecast> {
  const qs = days ? `?days=${days}` : "";
  return apiCall<SendForecast>(`/features/audit/send-forecast${qs}`, { token });
}

// ---------------------------------------------------------------------------
// Audit → Accounts: one row per customer account across the fleet, with the
// per-brand daily budget + a true active/inactive verdict, plus fleet financial
// stats (total daily budget over ACTIVE brands + its MRR/ARR equivalent). Every
// number is computed server-side by features-service (a displayed stat is never
// derived in the browser); the admin only renders + resolves the Clerk org name
// client-side from `orgExternalId`. Staff-gated platform view (no org context) —
// same auth path as the other /features/audit/* calls.
// A row is "active" iff dailyBudgetUsd > 0 AND orgBalanceUsd > dailyBudgetUsd
// (the org can afford at least one more day); everything else is "inactive"
// (paused / $0 / null budget, or an org whose credits can't cover the budget).
// ---------------------------------------------------------------------------
export interface AuditAccountRow {
  orgId: string; // internal org UUID
  orgExternalId: string | null; // Clerk org id (org_...), resolves the org name client-side
  ownerEmail: string | null;
  brandId: string;
  brandName: string | null;
  brandDomain: string | null;
  dailyBudgetUsd: number | null;
  orgBalanceUsd: number; // org available credit balance (USD)
  // "paused" = brand explicitly paused in campaign-service (brand_pause) — keeps its
  // budget but campaigns are HELD, so it's not spending (wins over active/inactive).
  // "active" = not paused, budget > 0, org can fund the next day. Else "inactive".
  status: "active" | "paused" | "inactive";
}

export interface AuditAccountsStats {
  totalDailyBudgetUsd: number; // sum over ACTIVE rows only (paused excluded — not spending)
  mrrUsd: number; // totalDailyBudgetUsd × 30
  arrUsd: number; // totalDailyBudgetUsd × 365
  activeCount: number;
  pausedCount: number;
  inactiveCount: number;
  totalCount: number;
}

export interface AuditAccounts {
  rows: AuditAccountRow[];
  stats: AuditAccountsStats;
  asOf: string; // ISO timestamp
}

/**
 * Fleet-wide, cross-org customer accounts audit: per-brand daily budget + true
 * active/inactive verdict + fleet financial stats (total daily budget, MRR, ARR).
 * Staff-gated platform view — served only behind the staff audit route, never a
 * public endpoint. Same auth path as getSendForecast. Transparent proxy to
 * features-service GET /internal/stats/accounts.
 */
export async function getAuditAccounts(token?: string): Promise<AuditAccounts> {
  return apiCall<AuditAccounts>(`/features/audit/accounts`, { token });
}

// ── Google CRM (staff console) ───────────────────────────────────────────────
// Typed rows from google-service via the api-service gateway. The clean typed
// fields (fromEmail/subject/…, displayName/primaryEmail/…) are an ADDITIVE
// google-service rollout: they are declared OPTIONAL here and populate once
// google-service ships them to prod — until then they read undefined and the UI
// renders empty. safeParse per the CLAUDE.md wire-shape rule turns shape-rot into
// a caught fetch-error; `.passthrough()` preserves the raw Gmail `payload` (still
// on the wire — the email detail panel parses the message BODY from it, which has
// no typed replacement in the contract).

export interface GoogleAccount {
  email?: string;
  status?: string;
  scopes?: string[];
  connectedAt?: string;
}

export interface GoogleMessageRow {
  id?: string;
  googleAccountId?: string;
  gmailMessageId?: string;
  threadId?: string;
  historyId?: string;
  fetchedAt?: string;
  // Typed fields (optional — additive google-service rollout)
  fromEmail?: string | null;
  fromName?: string | null;
  to?: string[];
  subject?: string | null;
  snippet?: string | null;
  sentAt?: string | null;
  labels?: string[];
  // Raw Gmail payload — still on the wire; detail panel parses body from it.
  payload?: unknown;
}

/** Per-contact links to platform orgs/brands/features (+ reserved lifecycle status). */
export interface GoogleContactLinks {
  orgIds: string[];
  brandIds: string[];
  featureSlugs: string[];
  status: string | null;
}

export interface GoogleContactRow {
  id?: string;
  resourceName?: string;
  // Typed fields (optional — additive google-service rollout)
  displayName?: string | null;
  primaryEmail?: string | null;
  emails?: string[];
  phones?: string[];
  organization?: string | null;
  jobTitle?: string | null;
  photoUrl?: string | null;
  updatedAt?: string | null;
  deleted?: boolean;
  // Contact → platform org/brand/feature links (additive; absent until deployed).
  links?: GoogleContactLinks;
  // Raw People API payload — still on the wire (pre-rollout render fallback).
  payload?: unknown;
}

export interface GoogleMessagesPage {
  items: GoogleMessageRow[];
  nextCursor: string | null;
}

export interface GoogleContactsPage {
  items: GoogleContactRow[];
  nextCursor: string | null;
}

const GoogleMessageRowSchema = z
  .object({
    fromEmail: z.string().nullish(),
    fromName: z.string().nullish(),
    to: z.array(z.string()).optional(),
    subject: z.string().nullish(),
    snippet: z.string().nullish(),
    sentAt: z.string().nullish(),
    labels: z.array(z.string()).optional(),
  })
  .passthrough();

const GoogleContactRowSchema = z
  .object({
    displayName: z.string().nullish(),
    primaryEmail: z.string().nullish(),
    emails: z.array(z.string()).optional(),
    phones: z.array(z.string()).optional(),
    organization: z.string().nullish(),
    jobTitle: z.string().nullish(),
    photoUrl: z.string().nullish(),
    updatedAt: z.string().nullish(),
    deleted: z.boolean().optional(),
    links: z
      .object({
        orgIds: z.array(z.string()),
        brandIds: z.array(z.string()),
        featureSlugs: z.array(z.string()),
        status: z.string().nullable(),
      })
      .nullish(),
  })
  .passthrough();

const GoogleMessagesPageSchema = z.object({
  items: z.array(GoogleMessageRowSchema),
  nextCursor: z.string().nullable(),
});

const GoogleContactsPageSchema = z.object({
  items: z.array(GoogleContactRowSchema),
  nextCursor: z.string().nullable(),
});

const GoogleAccountsResponseSchema = z.object({
  accounts: z.array(z.object({}).passthrough()),
});

export async function listGoogleMessages(
  cursor?: string | null,
  limit = 50,
  token?: string,
  opts?: { participant?: string },
): Promise<GoogleMessagesPage> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  // Filter the thread to one contact's email (from/to/cc); google-service orders
  // by email date desc when participant is set. Ignored by the pre-rollout backend.
  if (opts?.participant) qs.set("participant", opts.participant);
  const raw = await apiCall<unknown>(`/orgs/google/messages?${qs.toString()}`, { token });
  const parsed = GoogleMessagesPageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] listGoogleMessages: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] listGoogleMessages: invalid response shape");
  }
  // `.passthrough()` keeps the raw `payload` + id fields at runtime; the validated
  // subset does not structurally overlap the full row type, so cast via unknown.
  return parsed.data as unknown as GoogleMessagesPage;
}

export async function listGoogleContacts(
  cursor?: string | null,
  limit = 50,
  token?: string,
  opts?: { query?: string },
): Promise<GoogleContactsPage> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set("cursor", cursor);
  if (opts?.query) qs.set("query", opts.query);
  const raw = await apiCall<unknown>(`/orgs/google/contacts?${qs.toString()}`, { token });
  const parsed = GoogleContactsPageSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] listGoogleContacts: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] listGoogleContacts: invalid response shape");
  }
  return parsed.data as unknown as GoogleContactsPage;
}

export async function listGoogleAccounts(token?: string): Promise<GoogleAccount[]> {
  const raw = await apiCall<unknown>(`/orgs/google/accounts`, { token });
  const parsed = GoogleAccountsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] listGoogleAccounts: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[admin] listGoogleAccounts: invalid response shape");
  }
  return parsed.data.accounts as GoogleAccount[];
}

/** Upsert a contact's org/brand/feature links (+ status). Returns the saved set. */
export async function saveContactLinks(body: {
  resourceName: string;
  orgIds: string[];
  brandIds: string[];
  featureSlugs: string[];
  status?: string | null;
}): Promise<GoogleContactLinks & { resourceName: string }> {
  return apiCall<GoogleContactLinks & { resourceName: string }>(`/orgs/google/contact-links`, {
    method: "PUT",
    body,
  });
}

/** All platform brands with their owning orgId (staff view) — for the brand picker. */
export interface AdminBrand {
  id: string;
  name: string;
  domain: string | null;
  orgId: string;
}

export async function listAdminBrands(): Promise<{ brands: AdminBrand[] }> {
  return apiCall<{ brands: AdminBrand[] }>(`/admin/brands`);
}

// ---------------------------------------------------------------------------
// Cross-org feature stats (staff admin — platform-wide, all orgs aggregated).
// These read the features-service cross-org public stats through the api-service
// gateway, which exposes them under `/public/features/*` (the gateway remaps the
// downstream `/public/stats/*` family). Cross-org (no org scope), so we
// call them with a plain `useQuery` — NOT `useAuthQuery` — since there is no
// active org to gate on. Every displayed number is a ready backend field; the
// dashboard renders, it never computes a cost-per-outcome in the browser
// (CLAUDE.md "a displayed stat is features-service-owned").
// ---------------------------------------------------------------------------

/**
 * Feature-wide EXPECTED (projected) average cost per meeting-booked and per
 * purchase, meaned across every client brand's best workflow. USD (not cents).
 * `null` when no brand has usable economics — render as "—", never a false $0.
 */
const CrossOrgCostProjectionSchema = z.object({
  featureSlug: z.string(),
  avgCostPerMeetingBooked: z.coerce.number().nullable(),
  avgCostPerPurchase: z.coerce.number().nullable(),
  brandCount: z.coerce.number(),
});
export type CrossOrgCostProjection = z.infer<typeof CrossOrgCostProjectionSchema>;

export async function getCrossOrgCostProjection(
  featureSlug: string,
): Promise<CrossOrgCostProjection> {
  const query = new URLSearchParams({ featureSlug });
  const raw = await apiCall<unknown>(`/public/features/cost-projection?${query.toString()}`);
  const parsed = CrossOrgCostProjectionSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getCrossOrgCostProjection: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[admin] getCrossOrgCostProjection: invalid response shape");
  }
  return parsed.data;
}

// The optimization objectives (canonical camelCase) the cross-org trend +
// per-workflow endpoints accept. Mirrors the features-service objective set.
export type CrossOrgObjective =
  | "websiteVisit"
  | "positiveReply"
  | "signup"
  | "formSubmission"
  | "meetingBooked"
  | "purchase";

/**
 * Cross-org (fleet-wide) dated MOVING-AVERAGE cost-per-outcome series for one
 * objective. Each point is a trailing window (~`windowOutcomes` outcomes) of
 * fleet spend ÷ outcomes. `costPerOutcomeUsd` is null when the window is
 * unbacked (render blank, never $0). Everything is backend-computed.
 */
const CrossOrgTrendPointSchema = z.object({
  date: z.string(),
  costPerOutcomeUsd: z.coerce.number().nullable(),
  windowOutcomeCount: z.coerce.number(),
  windowSpentUsd: z.coerce.number(),
  windowStartDate: z.string(),
});
const CrossOrgTrendSchema = z.object({
  featureSlug: z.string(),
  objective: z.string(),
  windowOutcomes: z.coerce.number(),
  points: z.array(CrossOrgTrendPointSchema),
});
export type CrossOrgTrendPoint = z.infer<typeof CrossOrgTrendPointSchema>;
export type CrossOrgTrend = z.infer<typeof CrossOrgTrendSchema>;

export async function getCrossOrgCostPerOutcomeTrend(
  featureSlug: string,
  objective: CrossOrgObjective,
  opts?: { days?: number; windowOutcomes?: number },
): Promise<CrossOrgTrend> {
  const query = new URLSearchParams({ featureSlug, objective });
  if (opts?.days) query.set("days", String(opts.days));
  if (opts?.windowOutcomes) query.set("windowOutcomes", String(opts.windowOutcomes));
  const raw = await apiCall<unknown>(`/public/features/cost-per-outcome-trend?${query.toString()}`);
  const parsed = CrossOrgTrendSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getCrossOrgCostPerOutcomeTrend: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[admin] getCrossOrgCostPerOutcomeTrend: invalid response shape");
  }
  return parsed.data;
}

/**
 * Cross-org (fleet-wide) per-workflow-dynasty cost-per-outcome for one
 * objective. `costPerOutcomeUsd` is floored to populate whenever a workflow has
 * spend (max(spend, fleet unit cost) when the outcome denominator is 0), so the
 * table's value column reads reliably. Backend-computed; sorted by spend desc.
 */
const CrossOrgWorkflowCostRowSchema = z.object({
  workflowDynastySlug: z.string(),
  workflowDynastyName: z.string(),
  spentUsd: z.coerce.number(),
  observedClicks: z.coerce.number(),
  observedPositiveReplies: z.coerce.number(),
  costPerOutcomeUsd: z.coerce.number().nullable(),
});
const CrossOrgWorkflowCostSchema = z.object({
  featureSlug: z.string(),
  objective: z.string(),
  workflows: z.array(CrossOrgWorkflowCostRowSchema),
});
export type CrossOrgWorkflowCostRow = z.infer<typeof CrossOrgWorkflowCostRowSchema>;
export type CrossOrgWorkflowCost = z.infer<typeof CrossOrgWorkflowCostSchema>;

export async function getCrossOrgWorkflowCostPerOutcome(
  featureSlug: string,
  objective: CrossOrgObjective,
): Promise<CrossOrgWorkflowCost> {
  const query = new URLSearchParams({ featureSlug, objective });
  const raw = await apiCall<unknown>(`/public/features/workflow-cost-per-outcome?${query.toString()}`);
  const parsed = CrossOrgWorkflowCostSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getCrossOrgWorkflowCostPerOutcome: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[admin] getCrossOrgWorkflowCostPerOutcome: invalid response shape");
  }
  return parsed.data;
}

/**
 * Cross-org (fleet-wide) LIFETIME (all-history) pooled average cost-per-outcome
 * for every objective in one call. Total fleet spend ÷ total fleet outcomes —
 * the window→∞ limit of the moving-average trend. Each objective is `null` when
 * unbacked (render "—", never a false $0). Backend-computed (features-service).
 */
const CrossOrgLifetimeSchema = z.object({
  featureSlug: z.string(),
  avgCostPerOutcomeByObjective: z.object({
    websiteVisit: z.coerce.number().nullable(),
    positiveReply: z.coerce.number().nullable(),
    signup: z.coerce.number().nullable(),
    formSubmission: z.coerce.number().nullable(),
    meetingBooked: z.coerce.number().nullable(),
    purchase: z.coerce.number().nullable(),
  }),
  totalSpentUsd: z.coerce.number(),
  totalClicks: z.coerce.number(),
  totalPositiveReplies: z.coerce.number(),
  brandCount: z.coerce.number(),
});
export type CrossOrgLifetime = z.infer<typeof CrossOrgLifetimeSchema>;

export async function getCrossOrgLifetimeCostPerOutcome(
  featureSlug: string,
): Promise<CrossOrgLifetime> {
  const query = new URLSearchParams({ featureSlug });
  const raw = await apiCall<unknown>(`/public/features/cost-per-outcome-lifetime?${query.toString()}`);
  const parsed = CrossOrgLifetimeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[admin] getCrossOrgLifetimeCostPerOutcome: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[admin] getCrossOrgLifetimeCostPerOutcome: invalid response shape");
  }
  return parsed.data;
}
