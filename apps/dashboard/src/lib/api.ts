import { z } from "zod";
import {
  buildExpertQuotePitchVariables,
  coerceExtractedToString,
  selectPriorSubmittedPitches,
  type QuoteOpportunityContext,
} from "./quote-pitch-variables";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "./org-desync";
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

// ── Welcome signup gift (platform admin, staff-only) ──
// The welcome gift is a billing-service promo code (`code='welcome'`) whose grant
// amount is re-priced live WITHOUT a deploy. api-service proxies it under
// /v1/promo-codes/welcome (PATCH staff-gated server-side). amount_cents is integer
// cents; the UI displays/edits in dollars. Read at redeem time, so a new amount
// applies to the next signup immediately.
const WelcomePromoSchema = z.object({
  code: z.string(),
  amount_cents: z.number(),
});

export interface WelcomePromo {
  code: string;
  amountCents: number;
}

/** GET /promo-codes/welcome — current welcome gift grant ({ code, amount_cents }). */
export async function getWelcomePromo(token?: string): Promise<WelcomePromo> {
  const raw = await apiCall<unknown>(`/promo-codes/welcome`, { token });
  const parsed = WelcomePromoSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getWelcomePromo: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getWelcomePromo: invalid response shape");
  }
  return { code: parsed.data.code, amountCents: parsed.data.amount_cents };
}

/**
 * PATCH /promo-codes/welcome — re-price the welcome gift. `amountCents` must be a
 * non-negative integer (cents); the gateway gates this to staff and validates.
 * Returns the persisted value.
 */
export async function setWelcomePromo(
  amountCents: number,
  token?: string,
): Promise<WelcomePromo> {
  const raw = await apiCall<unknown>(`/promo-codes/welcome`, {
    token,
    method: "PATCH",
    body: { amountCents },
  });
  const parsed = WelcomePromoSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] setWelcomePromo: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] setWelcomePromo: invalid response shape");
  }
  return { code: parsed.data.code, amountCents: parsed.data.amount_cents };
}

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

const FeatureRevenueByWorkflowSchema = z.object({
  featureSlug: z.string(),
  groupBy: z.literal("workflowSlug"),
  groups: z.array(
    z.object({
      workflowSlug: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: z.object({
        totalCostUsd: z.number(),
        costOfAcquisitionPct: z.number().nullable(),
        roiMultiple: z.number().nullable(),
      }),
    }),
  ),
});

export interface WorkflowRevenueGroup {
  workflowSlug: string;
  totalPipelineUsd: number | null;
  totalCostUsd: number;
  /** totalPipelineUsd / totalCostUsd. Null when cost is 0 or pipeline is null. */
  roiMultiple: number | null;
}

export function parseFeatureRevenueByWorkflow(raw: unknown, label: string): WorkflowRevenueGroup[] {
  const parsed = FeatureRevenueByWorkflowSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${label}: response shape mismatch`, {
      issues: parsed.error.issues,
    });
    throw new Error(`[dashboard] ${label}: invalid response shape`);
  }
  return parsed.data.groups.map((g) => ({
    workflowSlug: g.workflowSlug,
    totalPipelineUsd: g.headline.totalPipelineUsd,
    totalCostUsd: g.costEconomics.totalCostUsd,
    roiMultiple: g.costEconomics.roiMultiple,
  }));
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

/** GET /features/:slug/revenue?groupBy=workflowSlug — per-workflow ROI for a brand+feature. */
export async function getFeatureRevenueByWorkflow(
  featureSlug: string,
  brandId: string,
  token?: string,
): Promise<WorkflowRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "workflowSlug" });
  const raw = await apiCall<unknown>(`/features/${featureSlug}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenueByWorkflow(raw, "getFeatureRevenueByWorkflow");
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
  costPerCloseUsd: z.number().nullable(),
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
 * GET /features/:slug/workflow-projection — per-workflow cost-per-close + funnel projection
 * (at `budgetUsd`) + the recommended workflow/budget, for a brand under one objective.
 * Conversion economics are read server-side from the brand's saved sales-economics.
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
  const query = new URLSearchParams();
  query.set("brandId", params.brandId);
  query.set("objective", params.objective);
  if (params.budgetUsd != null) query.set("budgetUsd", String(params.budgetUsd));
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(params.featureSlug)}/workflow-projection?${query.toString()}`,
    { token },
  );
  const parsed = WorkflowProjectionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getWorkflowProjection: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getWorkflowProjection: invalid response shape");
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
): Promise<OutletListResponse> {
  const params = new URLSearchParams({ brandId });
  if (featureSlug) params.set("featureSlug", featureSlug);
  if (campaignId) params.set("campaignId", campaignId);
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
  | "insufficient_credits";

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
  const { brandId, variables, featureSlug } = body;
  const upstreamBody: Record<string, unknown> = {
    variables,
    brandIds: [brandId],
  };
  if (featureSlug) upstreamBody.featureSlug = featureSlug;
  return apiCall<GenerateQuoteDraftResponse>(
    `/content/generate-expert-quote-pitch`,
    {
      token,
      method: "POST",
      body: upstreamBody,
      headers: { "x-brand-id": brandId },
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
   *  first/plain (re)generation. Threaded into `expertAnswerContext`. */
  revisionInstructions?: string | null;
  featureSlug?: string;
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
  const { brandId, expert, opportunity, revisionInstructions, featureSlug } = args;
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

  return generateQuoteDraft({ brandId, variables, featureSlug }, token);
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

export async function getDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const params = new URLSearchParams({ domains: domains.join(",") });
  const raw = await apiCall<unknown>(
    `/orgs/domains/traffic-history?${params}`,
    { token },
  );
  const parsed = z.array(DomainTrafficHistorySchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getDomainTrafficHistories: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getDomainTrafficHistories: invalid response shape");
  }
  return parsed.data;
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
  const params = new URLSearchParams({ domains: domains.join(",") });
  const raw = await apiCall<unknown>(
    `/orgs/domains/dr-status?${params}`,
    { token },
  );
  const parsed = z.array(DomainDrStatusSchema).safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getDomainDrStatuses: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getDomainDrStatuses: invalid response shape");
  }
  return parsed.data;
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
  const raw = await apiCall<unknown>("/orgs/domains/traffic-compute", {
    token,
    method: "POST",
    body: { domains },
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
  const raw = await apiCall<unknown>("/orgs/domains/dr-compute", {
    token,
    method: "POST",
    body: { domains },
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
