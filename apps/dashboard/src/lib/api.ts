import { z } from "zod";
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
  suppressPaymentRequired?: boolean;
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

/**
 * True when an error is a 402 insufficient-credits failure. apiCall auto-dispatches
 * the billing-guard modal on a 402 (see the 402 branch above), so callers use this
 * to AVOID treating a credit failure as a hard error (no destructive reset / error
 * banner) — the modal handles it and a `billing:resolved` event signals recovery.
 */
export function isInsufficientCredit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
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

/**
 * This tab's Clerk session token (per-tab active org), via the global `window.Clerk`
 * client — NOT a React hook, so it works from the plain `apiCall` function. Each
 * browser tab has its own `window.Clerk` with its own in-memory active org, so the
 * minted token carries the org THIS tab is viewing, regardless of which tab last
 * wrote the shared session cookie. Returns null on the server, before Clerk loads,
 * or when signed out → caller omits the Authorization header and falls back to the
 * cookie. Cached by Clerk (re-mints only near expiry), so per-request cost is low.
 */
async function getTabSessionToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (
    window as unknown as {
      Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
    }
  ).Clerk;
  try {
    return (await clerk?.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

async function apiCall<T>(endpoint: string, options?: ApiOptions): Promise<T> {
  const { token, method = "GET", body, headers: extraHeaders, suppressPaymentRequired } = options ?? {};

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
    let url: string;

    if (token) {
      url = `${API_URL}/v1${endpoint}`;
      headers["X-API-Key"] = token;
    } else {
      url = `/api/v1${endpoint}`;
      const activeOrgId = activeOrgIdFromPath();
      if (activeOrgId) headers["x-active-org-id"] = activeOrgId;

      // Per-tab org-scoped auth (Clerk multi-tab guidance). The Clerk session
      // COOKIE is a global singleton for the whole browser — it reflects whichever
      // tab was focused LAST, so the proxy's cookie-based `auth()` would scope a
      // background poll / navigation from a NON-focused tab to the WRONG org
      // (cross-org bleed + 409 desync churn + the visible "org switches by itself"
      // across tabs). `window.Clerk` is PER-TAB, so `session.getToken()` returns
      // THIS tab's active-org token; Clerk's `auth()` honors an Authorization
      // Bearer over the cookie, giving the proxy the correct per-tab org.
      // (Clerk docs: "Organizations → multiple browser tabs" + "Making
      // authenticated requests".) Optional-chained: before Clerk loads, or with no
      // session, we fall back to the cookie (and checkProxyOrg still fails closed).
      const tabToken = await getTabSessionToken();
      if (tabToken) headers["Authorization"] = `Bearer ${tabToken}`;
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
    if (response.status === 402 && !suppressPaymentRequired && typeof window !== "undefined") {
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

// Chat session history — restore the "Edit with AI" panel after a refresh.
// Gateway proxies GET /v1/chat/sessions/:sessionId → chat-service /sessions/:id.
// We only render `messages`; the schema stays tolerant of the other session
// metadata fields (org/brand/workflow) the endpoint returns.
const ChatHistoryToolCallSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
  result: z.unknown().optional(),
});
const ChatHistoryMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
  contentBlocks: z.array(z.unknown()).nullable(),
  toolCalls: z.array(ChatHistoryToolCallSchema).nullable(),
});
const ChatSessionHistorySchema = z.object({
  sessionId: z.string(),
  messages: z.array(ChatHistoryMessageSchema),
});
export type ChatSessionHistory = z.infer<typeof ChatSessionHistorySchema>;

export async function getChatSessionHistory(
  sessionId: string,
  token?: string,
): Promise<ChatSessionHistory> {
  const raw = await apiCall<unknown>(`/chat/sessions/${sessionId}`, { token });
  const parsed = ChatSessionHistorySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("getChatSessionHistory: response shape mismatch", parsed.error, raw);
    throw new Error("Invalid chat session history response shape");
  }
  return parsed.data;
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
// The per-campaign goal is the runtime-goal vocabulary (campaign-service), which
// is a DIFFERENT enum from the brand-level `BrandOptimizationGoal`. NULL on a
// campaign = inherit the brand goal.
export type RuntimeGoal = "signup" | "meetingBooked" | "purchase";

/** Map a brand `BrandOptimizationGoal` to the nearest campaign RuntimeGoal
 *  (used to seed the New Campaign goal picker from the brand's inherited goal). */
export function runtimeGoalForOptimizationGoal(goal: BrandOptimizationGoal): RuntimeGoal {
  // website_purchase (renamed purchase) + combined sales both terminate in a paid
  // client → the campaign paces on the `purchase` runtime goal.
  if (goal === "website_purchase" || goal === "sales") return "purchase";
  if (goal === "sales_meetings" || goal === "positive_replies") return "meetingBooked";
  // signups / website_visits / form_submissions → signup (visit-driven default).
  return "signup";
}

/** Map a campaign RuntimeGoal back to a `BrandOptimizationGoal` so the campaign's
 *  OWN goal can drive the goal-labelled display surfaces (which speak the brand
 *  optimization-goal vocabulary). Display-only. */
export function optimizationGoalForRuntimeGoal(goal: RuntimeGoal): BrandOptimizationGoal {
  if (goal === "signup") return "signups";
  if (goal === "purchase") return "website_purchase";
  return "sales_meetings";
}

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
  // Per-campaign config (v2, campaign-service). All nullable; NULL = inherit the
  // brand-level value (goal / active audience set / services / click destination).
  goal: RuntimeGoal | null;
  audienceIds: string[] | null;
  servicesOffered: string[] | null;
  clickDestinationUrl: string | null;
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

export async function getBrandCostBreakdown(
  brandId: string,
  opts?: { featureSlug?: string; startedAfter?: string; startedBefore?: string },
  token?: string,
): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "costName" });
  if (opts?.featureSlug) query.set("featureSlug", opts.featureSlug);
  if (opts?.startedAfter) query.set("startedAfter", opts.startedAfter);
  if (opts?.startedBefore) query.set("startedBefore", opts.startedBefore);
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
  // The page outreach clicks should land on (user-chosen in onboarding / Brand
  // Settings). null = never set → consumers fall back to the brand domain.
  // Optional on the wire so the dashboard ships ahead of the brand-service field
  // (additive rollout) — absent reads as undefined, present populates.
  clickDestinationUrl?: string | null;
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
// Conversion rates are numeric percents (0–100, decimals allowed);
// lifetimeRevenueUsd is whole US dollars.
// businessModel (b2c | b2b | null) is part of the saved set: it picks which funnel
// the revenue-overview pipeline applies. Both GET and PUT responses always include it.
export type BrandBusinessModel = "b2c" | "b2b";

// The single metric the brand wants to optimise for. Server default
// "sales_meetings" when never set; GET/PUT responses always include a non-null value.
// website_visits / positive_replies are the two beta single-step goals (visit→paid,
// reply→paid) — their wire values match the local names 1:1 (no rename).
// website_purchase = the RENAMED former `purchase` goal (multi-step self-serve close);
// sales = the beta COMBINED goal (a paying client won via EITHER the visit→paid OR the
// reply→paid path, valued at CLTV). Both terminate in a `sale`.
export type BrandOptimizationGoal =
  | "signups"
  | "sales_meetings"
  | "website_visits"
  | "positive_replies"
  | "form_submissions"
  | "website_purchase"
  | "sales";
type BrandOptimizationGoalWire =
  | BrandOptimizationGoal
  | "booked_meetings"
  | "combined_sales"
  | "purchase";

function normalizeBrandOptimizationGoal(
  goal: BrandOptimizationGoalWire,
): BrandOptimizationGoal {
  if (goal === "signups") return "signups";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  if (goal === "form_submissions") return "form_submissions";
  // The combined-sales goal is `combined_sales` on the brand-service wire.
  if (goal === "combined_sales") return "sales";
  // The renamed website-purchase goal reads as `website_purchase`. The LEGACY `sales`
  // wire (brand-service used to persist the old purchase goal as `sales`) + the legacy
  // `purchase` spelling both collapse to the renamed website_purchase goal.
  if (goal === "website_purchase" || goal === "sales" || goal === "purchase") return "website_purchase";
  // booked_meetings / sales_meetings collapse to sales_meetings.
  return "sales_meetings";
}

function serializeBrandOptimizationGoal(
  goal: BrandOptimizationGoal,
): "signups" | "booked_meetings" | "website_visits" | "positive_replies" | "form_submissions" | "website_purchase" | "combined_sales" {
  if (goal === "signups") return "signups";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  if (goal === "form_submissions") return "form_submissions";
  // website_purchase serialises 1:1; sales → the combined-sales wire value.
  if (goal === "website_purchase") return "website_purchase";
  if (goal === "sales") return "combined_sales";
  return "booked_meetings";
}

// Most surfaces only distinguish VISIT-driven (website click → outcome) from
// REPLY-driven (positive reply → outcome) behaviour. signups + website_visits +
// form_submissions + website_purchase are visit-driven; sales_meetings + positive_replies
// are reply-driven. The combined `sales` goal is BOTH visit- and reply-driven — it counts
// as visit-driven here so the coarse overview surfaces group it with the paid-client
// (website_purchase) family; the Audiences ranking table handles its cost-per-sale column
// explicitly. Use this instead of `goal === "signups"` so the beta goals route to the
// right family everywhere.
export function isVisitDrivenGoal(goal: BrandOptimizationGoal): boolean {
  return (
    goal === "signups" ||
    goal === "website_visits" ||
    goal === "form_submissions" ||
    goal === "website_purchase" ||
    goal === "sales"
  );
}

export interface BrandSalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  // Self-serve close decomposed into two steps. visitToClosePct is now DERIVED
  // server-side (= visitToSignupPct × signupToPaidClientPct) and stays on the
  // response for the projection engine — never sent on the PUT (see Input).
  visitToSignupPct: number;
  signupToPaidClientPct: number;
  visitToClosePct: number;
  // Single-step conversions for the beta website_visits / positive_replies goals.
  visitToPaidClientPct: number;
  replyToPaidClientPct: number;
  // Two-step conversions for the beta form_submissions goal (visit → form submission → paid),
  // the sibling of signups. brand-service serves them PRESENT-BUT-NULLABLE: a brand that never
  // set form-submission rates gets `null` (not absent). Hence `number | null` — a bare `number`
  // (or a non-nullable schema) makes the GET safeParse throw on every such brand.
  visitToFormSubmissionPct?: number | null;
  formSubmissionToPaidClientPct?: number | null;
  businessModel: BrandBusinessModel | null;
  optimizationGoal: BrandOptimizationGoal;
  updatedAt: string;
}

// businessModel is a partial-update field on PUT: omit = leave unchanged, null = clear
// (brand-service contract). The campaign form omits it (edits only the 5 metrics); the
// Brand Settings editor sends it explicitly. Hence optional in the input, not required.
// businessModel / optimizationGoal are partial-update fields on PUT:
// omit = leave unchanged. Hence optional in the input.
// visitToClosePct is derived server-side, never sent — omit it from the input.
// visitToPaidClientPct / replyToPaidClientPct are partial-update too: omit = leave
// unchanged (brand-service defaults 5 / 25). Only the beta settings card sends them.
export type BrandSalesEconomicsInput = Omit<
  BrandSalesEconomics,
  | "updatedAt"
  | "businessModel"
  | "optimizationGoal"
  | "visitToClosePct"
  | "visitToPaidClientPct"
  | "replyToPaidClientPct"
  | "visitToFormSubmissionPct"
  | "formSubmissionToPaidClientPct"
> & {
  businessModel?: BrandBusinessModel | null;
  optimizationGoal?: BrandOptimizationGoal;
  visitToPaidClientPct?: number;
  replyToPaidClientPct?: number;
  visitToFormSubmissionPct?: number;
  formSubmissionToPaidClientPct?: number;
};

const BrandSalesEconomicsSchema = z.object({
  lifetimeRevenueUsd: z.number(),
  replyToMeetingPct: z.number(),
  visitToMeetingPct: z.number(),
  meetingToClosePct: z.number(),
  visitToSignupPct: z.number(),
  signupToPaidClientPct: z.number(),
  visitToClosePct: z.number(),
  visitToPaidClientPct: z.number(),
  replyToPaidClientPct: z.number(),
  // Present-but-NULLABLE on the wire: brand-service returns these in `required[]` but serves `null`
  // for a brand that never set form-submission rates. `.nullable().optional()` tolerates BOTH null
  // (the common case) and absent (older prod) — a bare `.optional()` rejects null → the whole GET
  // safeParse throws, breaking every econ-reading surface. Consumers already `?? default`-guard.
  visitToFormSubmissionPct: z.number().nullable().optional(),
  formSubmissionToPaidClientPct: z.number().nullable().optional(),
  businessModel: z.union([z.literal("b2c"), z.literal("b2b")]).nullable(),
  optimizationGoal: z.union([
    z.literal("signups"),
    z.literal("sales_meetings"),
    z.literal("booked_meetings"),
    z.literal("website_purchase"),
    z.literal("combined_sales"),
    z.literal("sales"),
    z.literal("website_visits"),
    z.literal("positive_replies"),
    z.literal("form_submissions"),
  ]).transform(normalizeBrandOptimizationGoal),
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
      // Self-serve close as two steps; brand-service derives visitToClosePct.
      visitToSignupPct: input.visitToSignupPct,
      signupToPaidClientPct: input.signupToPaidClientPct,
      // Single-step conversions (partial-update): send only when the caller set them.
      ...(input.visitToPaidClientPct !== undefined
        ? { visitToPaidClientPct: input.visitToPaidClientPct }
        : {}),
      ...(input.replyToPaidClientPct !== undefined
        ? { replyToPaidClientPct: input.replyToPaidClientPct }
        : {}),
      // Two-step form-submission conversions (partial-update): send only when set.
      ...(input.visitToFormSubmissionPct !== undefined
        ? { visitToFormSubmissionPct: input.visitToFormSubmissionPct }
        : {}),
      ...(input.formSubmissionToPaidClientPct !== undefined
        ? { formSubmissionToPaidClientPct: input.formSubmissionToPaidClientPct }
        : {}),
      // Partial-update: send businessModel only when the caller set it (settings
      // editor). Omitting it leaves the stored value unchanged; null clears it.
      ...(input.businessModel !== undefined
        ? { businessModel: input.businessModel }
        : {}),
      // Same partial-update semantics for the sales goal: omit = leave unchanged.
      ...(input.optimizationGoal !== undefined
        ? { optimizationGoal: serializeBrandOptimizationGoal(input.optimizationGoal) }
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

// ── Brand click-destination URL (where outreach clicks land) ──
// Per-brand config persisted in brand-service via api-service
// PUT /v1/brands/:brandId/click-destination. Idempotent set; returns the
// saved value. Defaults to the brand domain at onboarding when unset.
const SaveBrandClickDestinationResponseSchema = z.object({
  clickDestinationUrl: z.string().nullable(),
});

export async function saveBrandClickDestination(
  brandId: string,
  clickDestinationUrl: string,
  token?: string,
): Promise<{ clickDestinationUrl: string | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/click-destination`, {
    token,
    method: "PUT",
    body: { clickDestinationUrl },
  });
  const parsed = SaveBrandClickDestinationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandClickDestination: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandClickDestination: invalid response shape");
  }
  return parsed.data;
}

// ── Attach a website to a no-website brand (one-time domain setup) ──
// A brand created via the "I have no website" onboarding path has domain === null.
// This attaches a website URL, which brand-service sets as brands.url + domain; the
// next post-cache-expiry field extraction re-sources from the site automatically.
// Reached via api-service PATCH /v1/brands/:brandId { url } → response { brandId,
// domain, name, url } (owned by brand-service). Downstream 4xx validation + 409
// domain-conflict propagate verbatim (fail-loud — surfaced in the settings card).
// One-time: the setup section is hidden once domain !== null.
const AttachBrandWebsiteResponseSchema = z.object({
  brandId: z.string().optional(),
  domain: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

export async function attachBrandWebsite(
  brandId: string,
  url: string,
  token?: string,
): Promise<{ domain: string | null; url: string | null }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}`, {
    token,
    method: "PATCH",
    body: { url },
  });
  const parsed = AttachBrandWebsiteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] attachBrandWebsite: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] attachBrandWebsite: invalid response shape");
  }
  return { domain: parsed.data.domain ?? null, url: parsed.data.url ?? null };
}

// ── Conversion tracking token (per-brand publishable write-key) ──
// A per-brand token the client embeds in a snippet on their own site to fire
// "Signup" / "Meeting Booked" events back to us; lead-service ingests them and
// attributes each to a lead we emailed for the brand. The token is a PUBLISHABLE
// write-key (it lives in a client-side JS pixel, so it is not a secret): it can
// ONLY POST conversion events for its one brand, never read. Rotate is the abuse
// remedy. `ingestUrl` is the full public URL the client's site POSTs to.
// Reached via api-service GET/POST /v1/brands/:brandId/conversion-token[/rotate].
const BrandConversionTokenSchema = z.object({
  token: z.string(),
  ingestUrl: z.string(),
  // Liveness/status — ADDED by lead-service (additive). Declared OPTIONAL so the
  // dashboard ships ahead of the producer and auto-populates once it lands (a
  // required field would strip via safeParse before the backend deploys). `status`
  // is server-computed; the timestamps + `eventTypesSeen` are the raw signals
  // behind it. `.nullish()` tolerates the server's `null` for "never seen".
  //   not_set_up   — no ping and no real conversion ever received
  //   live_waiting — a tag-loaded ping seen (tracker alive) but no conversion yet
  //   live         — at least one real conversion received
  status: z.enum(["not_set_up", "live_waiting", "live"]).optional(),
  lastEventAt: z.string().nullish(),
  lastPingAt: z.string().nullish(),
  // Distinct REAL conversion events actually received (excludes "ping").
  eventTypesSeen: z.array(z.string()).optional(),
});
export type BrandConversionToken = z.infer<typeof BrandConversionTokenSchema>;

export async function getBrandConversionToken(
  brandId: string,
  token?: string,
): Promise<BrandConversionToken> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/conversion-token`, { token });
  const parsed = BrandConversionTokenSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandConversionToken: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandConversionToken: invalid response shape");
  }
  return parsed.data;
}

export async function rotateBrandConversionToken(
  brandId: string,
  token?: string,
): Promise<BrandConversionToken> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/conversion-token/rotate`, {
    token,
    method: "POST",
  });
  const parsed = BrandConversionTokenSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] rotateBrandConversionToken: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] rotateBrandConversionToken: invalid response shape");
  }
  return parsed.data;
}

// ── Daily budget (per-brand spend pacing) ──
// A per-day spend ceiling campaign-service uses to pace a brand's work. Separate
// from org credit balance / top-up (that's affordability; this is allocation).
// Wire value is cents as a decimal string (Postgres numeric serializes as string,
// per CLAUDE.md numeric-string rule) → coerce. null = never set (a 200, not a 404).
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

/** GET /brands/:brandId/daily-budget — saved cents or null when never set. */
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

/** PATCH /brands/:brandId/daily-budget — set the per-day cents ceiling (0 = pause). */
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

// ── Brand pause (per-brand Pause / Restart) ──
// A single brand-level boolean honored by campaign-service's scheduler: when
// paused, none of the brand's ongoing campaigns are run (HELD, not stopped) so a
// Restart resumes them with zero re-launch. No outreach = no usage = no auto-topup
// charge, so this also "pauses the spend". paused defaults false when never set.
export interface BrandPause {
  brandId: string;
  orgId: string;
  paused: boolean;
  updatedAt: string | null;
}

const BrandPauseSchema = z.object({
  brandId: z.string(),
  orgId: z.string(),
  paused: z.boolean(),
  updatedAt: z.string().nullable(),
});

/** GET /brands/:brandId/pause — current pause state (paused=false when never set). */
export async function getBrandPause(
  brandId: string,
  token?: string,
): Promise<BrandPause> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/pause`, { token });
  const parsed = BrandPauseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandPause: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandPause: invalid response shape");
  }
  return parsed.data;
}

/** PATCH /brands/:brandId/pause — pause (true) or restart (false) the brand. */
export async function setBrandPause(
  brandId: string,
  paused: boolean,
  token?: string,
): Promise<BrandPause> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/pause`, {
    token,
    method: "PATCH",
    body: { paused },
  });
  const parsed = BrandPauseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] setBrandPause: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] setBrandPause: invalid response shape");
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
  visitToSignupPct: number;
  signupToPaidClientPct: number;
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
  visitToSignupPct: z.coerce.number(),
  signupToPaidClientPct: z.coerce.number(),
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

// ── Audiences (human-service via gateway /orgs/audiences/*) ──────────
// A saved people-filter-set, brand-scoped, generated from a natural-language
// prompt by human-service `/suggest` (apollo + apify candidates, dry-run
// counted). This is the unified "audience" concept that replaces the legacy
// brand-service persona. human-service OWNS these rows; the dashboard reaches
// them through the api-service gateway, never brand-service.

export type AudienceStatus = "suggested" | "active" | "paused" | "archived" | "deprecated";

export interface AudienceCandidate {
  // The PERSISTED audience row id — /suggest creates each candidate at status
  // "suggested" (inactive). Activating a pick = PATCH this id's status to "active".
  audienceId: string;
  name: string;
  rationale: string;
  provider: "apollo" | "apify";
  filters: Record<string, unknown>;
  // The winning provider's free dry-run match count (0 = no valid non-empty filters).
  count: number;
  status: AudienceStatus;
  validationError: string | null;
  truncated: boolean;
}

const AudienceStatusSchema = z.union([
  z.literal("suggested"),
  z.literal("active"),
  z.literal("paused"),
  z.literal("archived"),
  z.literal("deprecated"),
]);

const AudienceCandidateSchema = z.object({
  audienceId: z.string(),
  name: z.string(),
  rationale: z.string(),
  provider: z.union([z.literal("apollo"), z.literal("apify")]),
  filters: z.record(z.string(), z.unknown()),
  count: z.number(),
  status: AudienceStatusSchema,
  validationError: z.string().nullable(),
  truncated: z.boolean(),
});

const SuggestAudiencesResponseSchema = z.object({
  candidates: z.array(AudienceCandidateSchema),
});

/**
 * POST /orgs/audiences/suggest — natural-language prompt → candidate audiences.
 * ONE candidate per audience (the winning provider, larger free dry-run count).
 * Each candidate is PERSISTED at status "suggested" (inactive); the user picks
 * one or more, which are ACTIVATED via `setAudienceStatus(audienceId, "active")`.
 * Unpicked candidates remain suggested/inactive.
 */
// Cold human-service (audience suggest) + brand-service (ICP) calls can HANG,
// not just fail — a backend 502/partial-failure that never closes the socket
// leaves the request PENDING forever. The onboarding audience step's loaders
// (the prewarm `.finally`, `runSuggest`'s `finally`) only clear on settle, and a
// hang never settles → eternal "Generating…" spinner. Bounding the request turns
// a hang into a rejection so the existing catch/finally clears the loader + shows
// the error. 2 min is generous for a slow cold suggest but finite.
const SUGGEST_TIMEOUT_MS = 120_000;

export async function suggestAudiences(
  brandId: string,
  nlPrompt: string,
  token?: string,
): Promise<{ candidates: AudienceCandidate[] }> {
  const raw = await withTimeout(
    apiCall<unknown>(`/orgs/audiences/suggest`, {
      token,
      method: "POST",
      body: { brandId, nlPrompt },
    }),
    SUGGEST_TIMEOUT_MS,
    "suggestAudiences",
  );
  const parsed = SuggestAudiencesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] suggestAudiences: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] suggestAudiences: invalid response shape");
  }
  return parsed.data;
}

export interface AudienceWire {
  id: string;
  orgId: string;
  brandId: string;
  name: string;
  nlPrompt: string | null;
  /** Per-audience one-sentence description (what THIS audience targets). Distinct
   *  from `nlPrompt` (the shared multi-audience batch request). Optional until
   *  human-service serves it in prod (decoupled rollout). */
  description?: string | null;
  provider: string | null;
  status: AudienceStatus;
  source: string | null;
  filters: Record<string, unknown> | null;
  /** AI-generated avatar as a self-contained data: URI. Null = none yet. */
  avatarUrl: string | null;
  apolloCount: number | null;
  apifyCount: number | null;
  /** Total contactable audience pool (the "Size" column). Backend-computed;
   *  the denominator `availableToContactPct` divides by. Optional until
   *  human-service serves it in prod (decoupled rollout). */
  sizeCount?: number;
  /** Pool members currently contactable (not suppressed within the 3-month
   *  re-contact window). Backend-owned; never computed client-side. */
  availableToContactCount?: number;
  /** availableToContactCount / sizeCount * 100, integer 0–100 (the "Remaining"
   *  column). Backend-computed so Size and this % stay coherent. */
  availableToContactPct?: number;
  countedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

const AudienceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  brandId: z.string(),
  name: z.string(),
  nlPrompt: z.string().nullable(),
  description: z.string().nullable().optional(),
  provider: z.string().nullable(),
  status: AudienceStatusSchema,
  source: z.string().nullable(),
  filters: z.record(z.string(), z.unknown()).nullable(),
  avatarUrl: z.string().nullable(),
  apolloCount: z.number().nullable(),
  apifyCount: z.number().nullable(),
  // Postgres count columns can serialize as string → coerce. Optional until
  // human-service ships the fields (decoupled rollout); absent renders "—".
  sizeCount: z.coerce.number().optional(),
  availableToContactCount: z.coerce.number().optional(),
  availableToContactPct: z.coerce.number().optional(),
  countedAt: z.string().nullable(),
  createdByUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const AudienceResponseSchema = z.object({ audience: AudienceSchema });

/**
 * PATCH /orgs/audiences/:audienceId/status — change an audience's lifecycle status
 * (mutates only status). Used to ACTIVATE a suggested candidate ("suggested" →
 * "active") so it's selected for the brand; unpicked candidates stay suggested.
 */
export async function setAudienceStatus(
  audienceId: string,
  status: AudienceStatus,
  token?: string,
): Promise<{ audience: AudienceWire }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/${audienceId}/status`, {
    token,
    method: "PATCH",
    body: { status },
  });
  const parsed = AudienceResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] setAudienceStatus: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] setAudienceStatus: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /orgs/audiences/:audienceId/avatar — (re)generate the audience's avatar
 * image via chat-service (which owns the cost). Optional `prompt` steers the
 * image; omitted ⟹ derived from the audience's own descriptors. Returns the
 * updated audience with `avatarUrl` populated (a self-contained data: URI).
 * May 402 (insufficient credits) — surface via the billing guard at the call site.
 */
export async function generateAudienceAvatar(
  audienceId: string,
  prompt?: string,
  token?: string,
): Promise<{ audience: AudienceWire }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/${audienceId}/avatar`, {
    token,
    method: "POST",
    body: prompt ? { prompt } : {},
  });
  const parsed = AudienceResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] generateAudienceAvatar: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] generateAudienceAvatar: invalid response shape");
  }
  return parsed.data;
}

const ListAudiencesResponseSchema = z.object({
  audiences: z.array(AudienceSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

/** GET /orgs/audiences?brandId= — saved audiences for a brand. */
export async function listAudiences(
  brandId: string,
  params?: { status?: AudienceStatus; limit?: number; offset?: number },
  token?: string,
): Promise<{ audiences: AudienceWire[]; total: number }> {
  const query = new URLSearchParams({ brandId });
  if (params?.status) query.set("status", params.status);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const raw = await apiCall<unknown>(`/orgs/audiences?${query.toString()}`, { token });
  const parsed = ListAudiencesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listAudiences: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] listAudiences: invalid response shape");
  }
  return { audiences: parsed.data.audiences, total: parsed.data.total };
}

/** One person matched to their audience memberships (audience id + name). */
export interface AudienceMembershipMatch {
  personId: string;
  emailNorm: string | null;
  fullName: string | null;
  audiences: { audienceId: string; name: string }[];
}

const AudienceMembershipMatchSchema = z.object({
  personId: z.string(),
  emailNorm: z.string().nullable(),
  fullName: z.string().nullable(),
  audiences: z.array(z.object({ audienceId: z.string(), name: z.string() })),
});

// Only `matched` is consumed (lead → audience membership); `unmatched`/`byAudience`
// are passthrough — `.passthrough()` keeps them without re-declaring.
const AudienceStatsResponseSchema = z
  .object({ matched: z.array(AudienceMembershipMatchSchema) })
  .passthrough();

/**
 * POST /orgs/audiences/stats — per-audience membership for a list of emails (or
 * personIds). Used by the overview lead detail panel to answer "which audience
 * does this lead belong to" on-demand: pass the clicked lead's email, get back
 * its audience memberships, then join `audienceId` to `listAudiences` for the
 * audience name / description / avatar / targeting filters. human-service owns
 * the mapping; the dashboard never derives it.
 */
export async function getAudienceMembershipStats(
  args: { emails?: string[]; personIds?: string[] },
  token?: string,
): Promise<{ matched: AudienceMembershipMatch[] }> {
  const raw = await apiCall<unknown>(`/orgs/audiences/stats`, {
    token,
    method: "POST",
    body: args,
  });
  const parsed = AudienceStatsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getAudienceMembershipStats: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getAudienceMembershipStats: invalid response shape");
  }
  return { matched: parsed.data.matched };
}

const SuggestBrandIcpResponseSchema = z.object({ icp: z.string() });

/**
 * POST /brands/:brandId/icp/suggest — brand-service writes ONE short plain-language
 * ICP line for the brand (seeded from its profile + sales economics). Used to
 * pre-fill the onboarding audience-step prompt. `existingIcps` lets the caller ask
 * for an ICP distinct from / complementary to ones already chosen.
 */
export async function suggestBrandIcp(
  brandId: string,
  existingIcps?: string[],
  token?: string,
): Promise<{ icp: string }> {
  // Same hang class as suggestAudiences — the prewarm awaits this FIRST, so a
  // hung ICP call stalls the audience prewarm before suggestAudiences even runs.
  const raw = await withTimeout(
    apiCall<unknown>(`/brands/${brandId}/icp/suggest`, {
      token,
      method: "POST",
      body: existingIcps && existingIcps.length > 0 ? { existingIcps } : {},
    }),
    SUGGEST_TIMEOUT_MS,
    "suggestBrandIcp",
  );
  const parsed = SuggestBrandIcpResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] suggestBrandIcp: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] suggestBrandIcp: invalid response shape");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Confirmed brand USER-FIELDS (2-layer brand-fields model, brand-service).
//
// The 7 user-facing fields a user validates for their brand. Each carries a
// provenance tag:
//   - "confirmed"  — the user saved this value.
//   - "suggested"  — a user-facing field not yet confirmed; the value is the AI
//                    prefill (from extraction). The UI surfaces this as
//                    "AI-suggested" so the user knows it is a draft.
//   - "extracted"  — backend-only auto-extracted field (should not appear in the
//                    7 user-facing keys, but tolerated in the schema).
//
// Everything OUTSIDE this set is auto-extracted + ephemeral (3-day cache) and is
// NOT user-editable — read it via the extract-fields endpoints, never here.
// `dreamOutcome` REPLACES the old `valueProposition` (label "Dream outcome").
// ---------------------------------------------------------------------------
export const USER_FIELD_KEYS = [
  "services",
  "dreamOutcome",
  "perceivedLikelihood",
  "socialProof",
  "riskReversal",
  "urgency",
  "scarcity",
] as const;
export type UserFieldKey = (typeof USER_FIELD_KEYS)[number];

export type FieldProvenance = "confirmed" | "suggested" | "extracted";
export type UserFieldValue = string | string[];
export interface UserField {
  /**
   * The confirmed value OR the AI-suggested prefill. `null` when the field is
   * unconfirmed and its prefill is empty/expired (or a legacy/degenerate row).
   */
  value: UserFieldValue | null;
  provenance: FieldProvenance;
}
/** The confirmed user-fields map, keyed by user-field key. */
export type BrandUserFields = Record<string, UserField>;

/**
 * A user-field VALUE as it can arrive on the wire. The deployed backend contract
 * types it LOOSELY — `string | string[] (items may be null) | object | null` —
 * because a "suggested" (unconfirmed / expired) prefill resolves to `null`, and
 * legacy rows can be an array-with-null-items or an object. A CONFIRMED value is
 * always a string or string[]. We normalize ANY non-(string | non-empty string[])
 * shape to `null` so a single unconfirmed/degenerate field can NEVER throw the
 * whole read and hide the sibling CONFIRMED values.
 *
 * This is the data-loss-recovery bug: a brand with 6 recovered confirmed fields +
 * 1 unconfirmed field whose suggested prefill was `null` rendered the Strategy
 * offer levers EMPTY, because the old `z.union([z.string(), z.array(z.string())])`
 * rejected that one `null` → `safeParse` threw → the entire query errored → NONE
 * of the confirmed values reached the page (and clearing browser storage never
 * helped, because the network read itself threw on every load).
 */
const UserFieldValueSchema = z.unknown().transform((v): UserFieldValue | null => {
  if (typeof v === "string") return v.trim().length > 0 ? v : null;
  if (Array.isArray(v)) {
    const strings = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return strings.length > 0 ? strings : null;
  }
  return null;
});
const UserFieldSchema = z.object({
  value: UserFieldValueSchema,
  provenance: z.enum(["confirmed", "suggested", "extracted"]),
});
export const BrandUserFieldsResponseSchema = z.object({
  fields: z.record(z.string(), UserFieldSchema),
});

/**
 * GET /brands/:brandId/user-fields — the 7 confirmed user-facing fields, each
 * with its value + provenance ("confirmed" | "suggested"). A "suggested" value
 * is the AI prefill the user has not yet confirmed.
 */
export async function getBrandUserFields(
  brandId: string,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/user-fields`, { token });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getBrandUserFields: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/user-fields — save (confirm) one or more user-fields.
 * Body is `{ fields: { <key>: value } }`; every key sent is marked "confirmed".
 * Omit a key to leave its current value/provenance untouched. Returns the full
 * user-fields map (with the saved keys now "confirmed").
 */
export async function saveBrandUserFields(
  brandId: string,
  fields: Partial<Record<UserFieldKey, UserFieldValue>>,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/user-fields`, { token, method: "PUT", body: { fields } });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] saveBrandUserFields: invalid response shape");
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
  { key: "services", description: "The distinct paid services or products the brand explicitly sells to customers — exclude internal process steps, delivery sub-tasks and capabilities. Said differently, what package / product / service customers will pay for when they think about it. If one offering, list one. If different offerings appear in the content provided, list all. List each as a short phrase." },
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
  { key: "perceivedLikelihood", description: "Perceived likelihood of success: proof the outcome is achievable — track record, data, guarantees, named results and outcomes" },
  { key: "callToAction", description: "Primary CTA" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees, refund policy" },
  { key: "additionalContext", description: "Additional context and notable information" },
];

/**
 * The 7 USER-FACING fields (services + the 6 Hormozi offer levers) that onboarding
 * prefills and the user confirms — the exact `USER_FIELD_KEYS` set. Onboarding extracts
 * ONLY these (in `mode:"suggest"`, so every lever gets a best-effort inferred value and
 * never "Unknown"); it does NOT extract the backend-only fields in SALES_PROFILE_FIELDS
 * (funding/competitors/leadership/...), which the onboarding flow never reads (the
 * brand-info alpha page regenerates those on demand). `dreamOutcome` MUST be here — it is
 * a user-field key that SALES_PROFILE_FIELDS never listed (it kept the legacy
 * `valueProposition`), so the Dream-outcome lever had no extraction source and prefilled empty.
 */
export const USER_PROFILE_FIELDS: ExtractFieldDef[] = [
  { key: "services", description: "The distinct paid services or products the brand explicitly sells to customers — exclude internal process steps, delivery sub-tasks and capabilities. Said differently, what package / product / service customers will pay for when they think about it. If one offering, list one. If different offerings appear in the content provided, list all. List each as a short phrase." },
  { key: "dreamOutcome", description: "Dream outcome: the specific end result or transformation the customer most wants from this brand — the core promise every outreach email is written around. Make it concrete and worth wanting." },
  { key: "perceivedLikelihood", description: "Perceived likelihood of success: proof the outcome is achievable — track record, data, guarantees, named results and outcomes" },
  { key: "socialProof", description: "Social proof: case studies, testimonials, and results" },
  { key: "riskReversal", description: "Risk reversal: trials, guarantees, refund policy" },
  { key: "urgency", description: "Urgency elements and time pressure" },
  { key: "scarcity", description: "Scarcity and limited availability" },
];


/**
 * Persists the user's OPTIONAL onboarding phone number to Clerk user
 * publicMetadata via the in-repo server route (which holds CLERK_SECRET_KEY).
 * Fail-loud: a non-2xx throws so the caller surfaces it.
 */
export async function savePhoneNumber(input: {
  countryCode: string;
  dialCode: string;
  national: string;
}): Promise<void> {
  const res = await fetch("/api/onboarding/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to save phone number (${res.status})`);
  }
}

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
  opts?: { token?: string; resetCache?: boolean; urlStrategy?: "url_map" | "landing"; mode?: "extract" | "suggest" },
): Promise<ExtractFieldsResponse> {
  const { token, resetCache, urlStrategy, mode } = opts ?? {};
  // `mode` (brand-service): omitted/"extract" = site-grounded (returns "Unknown" when
  // absent); "suggest" = a generative Hormozi + top-3-expert persona that infers a
  // best-effort value where the source is silent and never returns "Unknown". Onboarding
  // passes "suggest" for the user-facing offer levers + services (USER_PROFILE_FIELDS).
  return apiCall<ExtractFieldsResponse>(
    `/brands/extract-fields`,
    { token, method: "POST", body: { brandIds, fields, resetCache, urlStrategy, mode } },
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

export type PipelineActivityMetricKey =
  | "outreach"
  | "clicks"
  | "signups"
  | "formSubmissions";

export interface PipelineActivityMetric {
  actual: number | null;
  expected: number | null;
  conversionPct?: number | null;
}

export interface PipelineActivityDay {
  date: string;
  isToday: boolean;
  metrics: Record<PipelineActivityMetricKey, PipelineActivityMetric>;
}

export interface PipelineActivitySummary {
  dailyBudgetUsd: number | null;
  clickToSignupPct: number | null;
  /** Brand effective visit→form-submission rate (form-submission projection rate).
   *  Null when economics absent or the brand carries no form-submission rate. */
  clickToFormSubmissionPct?: number | null;
}

export interface PipelineActivityResponse {
  featureSlug: string;
  brandId: string;
  timezone: string;
  generatedAt: string;
  days: PipelineActivityDay[];
  summary: PipelineActivitySummary;
}

export type FeatureAudienceStatsGoal =
  | "signup"
  | "meetingBooked"
  | "websitePurchase"
  | "sales"
  | "formSubmission";
export type FeatureAudienceStatsSortMetric = "cpc" | "cppr";

export interface FeatureAudienceStatsRow {
  audienceId: string;
  brandProfileId: string | null;
  audience: {
    id: string;
    name: string;
    status: "active" | "paused" | "archived";
    filters: Record<string, unknown> | null;
    avatarUrl?: string | null;
  };
  evidence: {
    totalCostInUsdCents: number;
    completedRuns: number;
    firstRunAt: string | null;
    lastRunAt: string | null;
    contacted: number;
    websiteClicks: number;
    positiveReplies: number;
    /** REAL per-audience form-submission conversions (attributed, deduped). Present
     *  ONLY for the form_submissions goal; absent otherwise — never a fabricated 0. */
    formSubmissions?: number;
    /** REAL per-audience signup conversions (attributed by audience-member-email ∩
     *  signup-converted-lead emails, deduped). Present ONLY for the signups goal;
     *  absent otherwise / when the signup emails weren't served — never a fabricated
     *  0. Optional to decouple the rollout: renders "-" until features-service ships. */
    signups?: number;
    /** REAL per-audience SALES — paying clients won (lead-service conversion tracker,
     *  event=sale), attributed by the same membership join as signups. Present ONLY for
     *  the website_purchase OR combined-sales goals (both terminate in a `sale`); absent
     *  otherwise / when the emails weren't served — never a fabricated 0. */
    sales?: number | null;
  };
  metrics: {
    cpcCents: number | null;
    cpprCents: number | null;
    /** REAL cost per form submission = spend ÷ formSubmissions. Null when 0/absent
     *  (not the form_submissions goal, or emails not served). Never a false $0. */
    cpfsCents?: number | null;
    /** REAL cost per signup = spend ÷ signups. Null when 0/absent (not the signups
     *  goal, or emails not served). Never a false $0. Optional until the producer ships. */
    cpsCents?: number | null;
    /** REAL cost per sale = spend ÷ sales. Null when 0/absent (not the website_purchase
     *  / combined-sales goal, or emails not served). Never a false $0. */
    cpsaleCents?: number | null;
  };
}

export interface FeatureAudienceStatsResponse {
  featureSlug: string;
  brandId: string;
  goal: FeatureAudienceStatsGoal;
  brandProfileId: string | null;
  sortMetric: FeatureAudienceStatsSortMetric;
  audiences: FeatureAudienceStatsRow[];
}

const FeatureAudienceStatsRowSchema = z.object({
  audienceId: z.string(),
  brandProfileId: z.string().nullable(),
  audience: z.object({
    id: z.string(),
    name: z.string(),
    status: z.union([z.literal("active"), z.literal("paused"), z.literal("archived")]),
    filters: z.record(z.string(), z.unknown()).nullable(),
    avatarUrl: z.string().nullable().optional(),
  }),
  evidence: z.object({
    totalCostInUsdCents: z.number(),
    completedRuns: z.number(),
    firstRunAt: z.string().nullable(),
    lastRunAt: z.string().nullable(),
    contacted: z.number(),
    websiteClicks: z.number(),
    positiveReplies: z.number(),
    formSubmissions: z.number().optional(),
    signups: z.number().optional(),
    sales: z.coerce.number().nullable().optional(),
  }),
  metrics: z.object({
    cpcCents: z.number().nullable(),
    cpprCents: z.number().nullable(),
    cpfsCents: z.number().nullable().optional(),
    cpsCents: z.number().nullable().optional(),
    cpsaleCents: z.coerce.number().nullable().optional(),
  }),
});

const FeatureAudienceStatsResponseSchema = z.object({
  featureSlug: z.string(),
  brandId: z.string(),
  goal: z.union([
    z.literal("signup"),
    z.literal("meetingBooked"),
    z.literal("websitePurchase"),
    z.literal("sales"),
    z.literal("formSubmission"),
  ]),
  brandProfileId: z.string().nullable(),
  sortMetric: z.union([z.literal("cpc"), z.literal("cppr")]),
  audiences: z.array(FeatureAudienceStatsRowSchema),
});

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

/** GET /features/:featureSlug/audience-stats — real audience-level cost/outcome evidence. */
export async function fetchFeatureAudienceStats(
  featureSlug: string,
  params: {
    brandId: string;
    goal: FeatureAudienceStatsGoal;
    brandProfileId?: string;
    limit?: number;
    /** Audience lifecycle statuses to include. Comma-separated subset of
     *  `active,paused,archived`. Omitted → features-service defaults to active-only
     *  (preserves the Top-audiences ranking card). The Audiences page passes all
     *  three so archived audiences show their historical outreach stats. */
    statuses?: string;
    /** Optional campaign scope (v2). Audiences stay brand-wide, but their stats can
     *  be filtered to a single campaign's outreach — the campaign overview passes it.
     *  Omitted → brand-wide numbers as before. (api-service forwards ?campaignId=.) */
    campaignId?: string;
  },
  token?: string,
): Promise<FeatureAudienceStatsResponse> {
  const query = new URLSearchParams({ brandId: params.brandId, goal: params.goal });
  if (params.brandProfileId) query.set("brandProfileId", params.brandProfileId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.statuses) query.set("statuses", params.statuses);
  if (params.campaignId) query.set("campaignId", params.campaignId);
  // pricing=net → per-audience MONEY metrics (metrics.cpcCents / cpprCents /
  // cpfsCents / cpsCents) reflect the org's FROZEN post-usage-discount cost, so the
  // Top-audiences card + Audiences ranking match the net brand-overview cost cards.
  // Ranking order is unchanged (uniform scale) and net == gross for a non-discounted
  // org. Frozen server-side — no client discount math.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(`/features/${featureSlug}/audience-stats?${query.toString()}`, { token });
  const parsed = FeatureAudienceStatsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] fetchFeatureAudienceStats: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] fetchFeatureAudienceStats: invalid response shape");
  }
  return parsed.data;
}

// NOTE: The old `GET /features/:slug/candidates` reader (FeatureCandidate*, the
// audience/brand-goal/goal-global grain ladder) was REMOVED — features-service folded
// that grain into `GET /features/:slug/workflow-projection` (the 3-grain ladder above,
// `getWorkflowProjectionLadder`). The Strategy page reads the server-resolved grain
// verbatim; there is no separate candidates fetch or client-side ladder resolution.

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
  // pricing=net → every MONEY metric (spend block, costEconomics actualCostUsd,
  // CAC, ROI, cps/cpsm/cpfs) reflects the org's FROZEN post-usage-discount cost
  // (frozen at cost-write in runs-service; features-service does NOT recompute the
  // discount — never multiply client-side). Coherent with the NET-paced campaign
  // budget so "Budget spent today / <budget>" can't exceed 100% for a discounted
  // brand. net == gross for a non-discounted org, so this is a no-op there. Every
  // consumer of the shared `["featureRevenue", …]` key gets net → the dedupe stays
  // consistent (do not make it a per-caller toggle).
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(`/features/${featureSlug}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getFeatureRevenue");
}

/**
 * `structuralSharing` merge for the `["featureRevenue", ...]` query. The
 * server-computed `spend` block (cost card) and the actual series
 * (`outreachContacted`, `clicked`, `repliedPositive`, `meetingsBooked`,
 * `purchased`) are `.optional()` on the wire to decouple the backend rollout — but
 * a transient degenerate refetch can drop them back to `undefined`/`null` on a
 * VALID 200, which would collapse the cost card / chart actuals mid-session.
 * Keep the last-good series across such a refetch (fail-loud console.error in
 * keep-last-good); a real persistent absence still logs. Opt-in here ONLY —
 * absence is "transient/not-ready", never "removed".
 */
export function keepLastGoodFeatureRevenue(
  prev: RevenueOverview | undefined,
  next: RevenueOverview,
): RevenueOverview {
  return keepLastGoodFields(
    prev,
    next,
    ["spend", "sequences", "outreachContacted", "opened", "clicked", "repliedPositive", "meetingsBooked", "purchased"],
    "featureRevenue",
  );
}

// ─── Per-campaign revenue (grouped) ──────────────────────────────────────────
// features-service `GET /features/:slug/revenue?groupBy=campaignId` returns one
// LEAN group per campaign that has runs for the brand+feature: campaignId +
// headline.totalPipelineUsd + costEconomics only (no timeSeries/orgs/leads/events).
// Each group is byte-equal to the standalone ?campaignId= call. Every displayed
// stat (pipeline / $CAC / ROI / %CAC) is a ready features-service field — the
// dashboard renders, never computes (CLAUDE.md: a displayed stat is
// features-service-owned). One call powers the whole Campaigns table.
const CampaignRevenueCostEconomicsSchema = z.object({
  // Accept both the current `actualCostUsd` and legacy `totalCostUsd` name for
  // rollout tolerance (mirrors CostEconomicsSchema in revenue-parse.ts).
  actualCostUsd: z.number().optional(),
  totalCostUsd: z.number().optional(),
  costOfAcquisitionPct: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  expectedConversions: z.number().nullish(),
  costPerConversionUsd: z.number().nullish(),
});
const FeatureRevenueByCampaignSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({
      campaignId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
    }),
  ),
});

export interface CampaignRevenueGroup {
  campaignId: string;
  totalPipelineUsd: number | null;
  actualCostUsd: number;
  costOfAcquisitionPct: number | null;
  roiMultiple: number | null;
  expectedConversions: number | null;
  costPerConversionUsd: number | null;
}

/** GET /features/:slug/revenue?groupBy=campaignId — one lean revenue group per campaign. */
export async function getFeatureRevenueByCampaign(
  featureSlug: string,
  brandId: string,
  token?: string,
): Promise<CampaignRevenueGroup[]> {
  const query = new URLSearchParams({ brandId, groupBy: "campaignId", pricing: "net" });
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(featureSlug)}/revenue?${query.toString()}`,
    { token },
  );
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
    actualCostUsd: g.costEconomics.actualCostUsd ?? g.costEconomics.totalCostUsd ?? 0,
    costOfAcquisitionPct: g.costEconomics.costOfAcquisitionPct,
    roiMultiple: g.costEconomics.roiMultiple,
    expectedConversions: g.costEconomics.expectedConversions ?? null,
    costPerConversionUsd: g.costEconomics.costPerConversionUsd ?? null,
  }));
}

const PipelineActivityMetricSchema = z.object({
  actual: z.number().nullable(),
  expected: z.number().nullable(),
  conversionPct: z.number().nullable().optional(),
});

const PipelineActivityResponseSchema = z.object({
  featureSlug: z.string(),
  brandId: z.string(),
  timezone: z.string(),
  generatedAt: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      isToday: z.boolean(),
      metrics: z.object({
        outreach: PipelineActivityMetricSchema,
        clicks: PipelineActivityMetricSchema,
        signups: PipelineActivityMetricSchema,
        formSubmissions: PipelineActivityMetricSchema,
      }),
    }),
  ),
  summary: z.object({
    dailyBudgetUsd: z.number().nullable(),
    clickToSignupPct: z.number().nullable(),
    clickToFormSubmissionPct: z.number().nullable().optional(),
  }),
});

/** GET /features/:slug/pipeline-activity — 7-day actual + expected funnel activity. */
export async function getFeaturePipelineActivity(
  featureSlug: string,
  params: { brandId: string; days?: number; timezone?: string },
  token?: string,
): Promise<PipelineActivityResponse> {
  const query = new URLSearchParams({ brandId: params.brandId });
  if (params.days != null) query.set("days", String(params.days));
  if (params.timezone) query.set("timezone", params.timezone);
  const raw = await apiCall<unknown>(
    `/features/${encodeURIComponent(featureSlug)}/pipeline-activity?${query.toString()}`,
    { token },
  );
  const parsed = PipelineActivityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFeaturePipelineActivity: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getFeaturePipelineActivity: invalid response shape");
  }
  return parsed.data;
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

// ── No-website brand creation (beta) ──────────────────────────────
// Creates a brand with NO website URL from a user-typed name + a large free-form block
// the user pasted about their business, then persists that context so field extraction
// reads it instead of scraping a site (brand-service #366, api-service #760 + business-
// context passthrough). MUST persist the context BEFORE extract-fields runs.
export async function createBrandWithoutWebsite(
  name: string,
  context: string,
  token?: string,
): Promise<{ brandId: string }> {
  // POST /orgs/brands accepts EITHER { url } OR { name }; no-website brand = { name }.
  const { brandId } = await apiCall<{ brandId: string }>(`/brands`, {
    token,
    method: "POST",
    body: { name },
  });
  // PUT /orgs/brands/:id/business-context { content } — the extraction source.
  await apiCall(`/brands/${brandId}/business-context`, {
    token,
    method: "PUT",
    body: { content: context },
  });
  return { brandId };
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

/**
 * PATCH /v1/campaigns/:id — update ONE campaign's per-campaign config (v2). Every
 * field is optional; passing null (or omitting) makes the campaign INHERIT the
 * brand-level value (goal / active audience set / services / click destination /
 * daily budget). `maxBudgetDailyUsd` is a whole-USD string. campaign-service paces
 * the sales feature on `campaign ?? brand`, so writing a field overrides the brand;
 * writing null clears it back to inheriting.
 */
export async function updateCampaign(
  campaignId: string,
  patch: {
    goal?: RuntimeGoal | null;
    audienceIds?: string[] | null;
    servicesOffered?: string[] | null;
    clickDestinationUrl?: string | null;
    maxBudgetDailyUsd?: string | null;
  },
  token?: string,
): Promise<{ campaign: Campaign }> {
  const { campaign } = await apiCall<{ campaign: RawCampaign }>(`/campaigns/${campaignId}`, {
    token,
    method: "PATCH",
    body: patch as unknown as Record<string, unknown>,
  });
  const [enriched] = await enrichCampaignsWithBrandUrls([campaign], token);
  return { campaign: enriched };
}

/**
 * Set ONE campaign's daily budget (v2 per-campaign budget). Thin wrapper over
 * `updateCampaign`. Writing null clears it back to inheriting the brand budget.
 */
export async function updateCampaignDailyBudget(
  campaignId: string,
  maxBudgetDailyUsd: string | null,
  token?: string,
): Promise<{ campaign: Campaign }> {
  return updateCampaign(campaignId, { maxBudgetDailyUsd }, token);
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
  // Current employer's job title (lead-service derives it from the lead's
  // current employment row). The LinkedIn-style `headline` above is a separate,
  // often-null field — render `currentTitle` for the "Title" label, not headline.
  // Optional: present on the full FullLead today; the slim `view=basic`
  // projection populates it once lead-service ships the slim-field add.
  currentTitle?: string | null;
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
  // Optional: omitted by the slim `view=basic` projection (brand leads list).
  // Present in the full payload (campaign leads, feature leads). #1620
  contacts?: LeadContactMethodView[];
  employmentHistory?: LeadEmploymentEntryView[];
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
  // Per-event first-occurrence ISO timestamps from email-gateway, forwarded by
  // lead-service. Optional: present once lead-service ships them; `.passthrough()`
  // on LeadDeliverySchema keeps them at runtime. Drive the lead detail-panel
  // event timeline. #audiences-leads-date / lead-event-timeline
  firstClickedAt?: string | null;
  firstContactedAt?: string | null;
  firstSentAt?: string | null;
  firstDeliveredAt?: string | null;
  firstRepliedAt?: string | null;
  firstBouncedAt?: string | null;
  firstUnsubscribedAt?: string | null;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  lastDeliveredAt: string | null;
  global: { bounced: boolean; unsubscribed: boolean };
  // Audience attribution stored on the leads_campaigns row by lead-service —
  // `audienceId` = human-service audience.id (null = unattributed), `audience`
  // the resolved {id,name,avatarUrl} for direct render. The Audience column
  // reads `lead.audience` straight from the wire (no client-side membership
  // join). Optional: `.passthrough()` on LeadDeliverySchema keeps them at
  // runtime; typed optional so a not-yet-attributed lead renders "-".
  audienceId?: string | null;
  audience?: { id: string; name: string; avatarUrl: string | null } | null;
  lead: FullLead | null;
}

export type LeadConsolidatedStatus = "replied" | "clicked" | "delivered" | "sent" | "bounced" | "unsubscribed" | "contacted" | "served" | "skipped" | "claimed" | "buffered";

/** Derive consolidated status from email-gateway booleans + local status, matching journalists page pattern */
export function getLeadConsolidatedStatus(lead: Lead): LeadConsolidatedStatus {
  if (lead.replied) return "replied";
  if (lead.clicked) return "clicked";
  if (lead.delivered) return "delivered";
  if (lead.sent) return "sent";
  if (lead.bounced) return "bounced";
  if (lead.unsubscribed) return "unsubscribed";
  if (lead.contacted) return "contacted";
  return lead.status;
}

// Validate the leads envelope + the fields the consolidated-status logic
// dereferences (id/email/status + the 7 delivery booleans — always present from
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
  // `view=basic` returns the slim lead projection (thin person + thin org, no
  // employmentHistory / extra org columns). The brand leads page renders the
  // table, status tabs, search, and detail panel from thin fields only, so the
  // full payload (~150 MB for a 50k-lead brand, pulled every poll) is wasteful.
  // Requires api-service to forward the `view` param. listCampaignLeads +
  // feature leads stay full-fat. See shamanic-technologies/distribute.you#1620.
  const raw = await apiCall<unknown>(`/leads?brandId=${brandId}&view=basic`, { token });
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

/** The generated email for ONE lead — initial body + follow-up `sequence` steps —
 *  read by leadId from content-generation-service via the api-service proxy.
 *  Powers the email content interleaved into the lead detail timeline. */
export interface LeadEmailGeneration {
  id: string;
  campaignId: string | null;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  createdAt: string | null;
  leadId: string | null;
}

const LeadEmailGenerationSchema = z
  .object({
    id: z.string(),
    subject: z.string().nullable().optional(),
    bodyHtml: z.string().nullable().optional(),
    bodyText: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .passthrough();

const GetLeadEmailResponseSchema = z.object({ generation: LeadEmailGenerationSchema.nullable() });

/** GET /v1/emails/by-lead/:leadId?brandId= → { generation } (null when the lead has no
 *  generated email yet). 404 is mapped to { generation: null } by the gateway.
 *  `brandId` scopes the generation to the brand being viewed: the same person can be a
 *  lead under several brands in one org (each with its OWN generated email), so without
 *  the scope the by-lead read returns whichever generation it finds — the wrong brand's
 *  email under the current brand's lead. Pass the viewed brand's id to disambiguate. */
export async function getLeadEmail(leadId: string, brandId?: string, token?: string): Promise<{ generation: LeadEmailGeneration | null }> {
  const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : "";
  const raw = await apiCall<unknown>(`/emails/by-lead/${leadId}${qs}`, { token });
  const parsed = GetLeadEmailResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadEmail: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getLeadEmail: invalid response shape");
  }
  return parsed.data as unknown as { generation: LeadEmailGeneration | null };
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
// feature-scoped, econ-INDEPENDENT) + the recommended workflow, AND returns a server-computed
// cost-per-close + funnel projection from the brand's SAVED economics. Consumers (brand overview,
// workflows page, onboarding) render those server values directly via getWorkflowProjection.
// Wire shape verified against the deployed contract via api-registry. safeParse per CLAUDE.md.
export type SalesObjective =
  | "meeting-booked"
  | "self-serve"
  | "form_submissions"
  | "website_visits"
  | "positive_replies"
  | "website_purchase"
  | "sales";

export function salesObjectiveForOptimizationGoal(
  goal: BrandOptimizationGoal,
): SalesObjective {
  // Each goal maps to features-service's native objective so the server computes the
  // right funnel: website_visits + positive_replies are SINGLE-STEP (visit→paid /
  // reply→paid, using visitToPaidClientPct / replyToPaidClientPct); form_submissions is
  // its own two-step; signups → self-serve (visit→signup→paid); sales_meetings →
  // meeting-booked. (features-service natively supports all — the old "borrow the
  // nearest family" workaround is gone; sending the real goal fixes cost-per-outcome,
  // cost-per-paid-client, ROI + CAC for the single-step goals.)
  if (goal === "form_submissions") return "form_submissions";
  if (goal === "website_visits") return "website_visits";
  if (goal === "positive_replies") return "positive_replies";
  // website_purchase → the native multi-step close funnel (cost-per-paid-client).
  if (goal === "website_purchase") return "website_purchase";
  // sales → the combined goal (paying client via visit→paid OR reply→paid).
  if (goal === "sales") return "sales";
  if (goal === "sales_meetings") return "meeting-booked";
  return "self-serve";
}

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
  // The GOAL metric the projection was queried for (resolved.costPerOutcomeUsd) — the
  // native per-goal cost features-service ranks on. Used by the form_submissions +
  // purchase unit-cost path where no dedicated grain field exists. Optional to decouple.
  costPerOutcomeUsd: z.number().nullable().optional(),
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
  objective: z.union([
    z.literal("meeting-booked"),
    z.literal("self-serve"),
    z.literal("form_submissions"),
    z.literal("website_visits"),
    z.literal("positive_replies"),
    z.literal("website_purchase"),
    z.literal("sales"),
  ]),
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
        "costPerOutcomeUsd",
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
    costPerOutcomeUsd: row.resolved.costPerOutcomeUsd,
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
 * onto the legacy `workflows[]` shape so existing consumers (brand overview, workflows
 * page, onboarding, brand-status) keep reading server values verbatim. `budgetUsd` is
 * accepted for call-site compatibility; the ladder + `recommendedBudgetUsd` carry the
 * projection surface. New surfaces that want the per-audience grains (Strategy) should
 * call `getWorkflowProjectionLadder` directly.
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

// ── Strategy: 3-grain workflow-projection ladder ─────────────────────────────
// features-service folded the old /candidates grain INTO workflow-projection: one
// call now returns a row per (audienceId, workflow) carrying the cost estimate at
// each grain (crossOrg / brand / audience) PLUS the `resolved` block — the finest
// grain that has real evidence (brand-real when the brand has run enough, else the
// fleet benchmark). The Strategy page renders `resolved` VERBATIM; it never scales
// or recomputes a cost. Proxied via api-service /v1/features/:slug/workflow-projection.
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
 * GET /features/:slug/workflow-projection — the 3-grain ladder: one row per
 * (audienceId, workflow) with its cost estimate at each grain plus the `resolved`
 * grain (brand-real when the brand has evidence, else the fleet benchmark). Powers
 * the Strategy "Your best model" card + "Estimates by audience" table. Every cost is
 * read VERBATIM from `resolved` — no client-side CPC / CPS / projection math.
 */
export async function getWorkflowProjectionLadder(
  params: {
    featureSlug: string;
    brandId: string;
    goal?: FeatureAudienceStatsGoal;
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
    console.error("[dashboard] getWorkflowProjectionLadder: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getWorkflowProjectionLadder: invalid response shape");
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

export async function createCampaignWithoutBrandEnrichment(
  params: {
    name: string;
    workflowSlug: string;
    // Exactly one of brandUrls (website brand) or brandIds (no-website brand,
    // already created by name) — the gateway resolves/forwards accordingly.
    brandUrls?: string[];
    brandIds?: string[];
    maxBudgetDailyUsd?: string;
    maxBudgetWeeklyUsd?: string;
    maxBudgetMonthlyUsd?: string;
    maxBudgetTotalUsd?: string;
  } & Record<string, unknown>,
  token?: string
): Promise<{ campaign: RawCampaign }> {
  return apiCall<{ campaign: RawCampaign }>("/campaigns", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

// Billing — wire shape per billing-service post-rename hotfix.
// `*_cents` string fields are full-precision decimal strings (e.g. "100.4200000000").
// Use parseFloat for math; never Number().
// `balance_cents` = spendable funds (credited minus usage incl. provisioned holds);
// use it for depletion and budget checks.
// `actual_balance_cents` = credited minus actualized usage only; use it for the
// user-facing Credit Balance display when billing-service exposes it.
// `credited_cents` = lifetime credited (paid topups + local promos); display-only for "total credited".
// `topup_amount_cents` and `topup_threshold_cents` are integers in cents (or null).
// Live spec: https://billing.distribute.you/openapi.json
export interface BillingAccount {
  id: string;
  org_id: string;
  credited_cents: string;
  usage_cents: string;
  balance_cents: string;
  actual_balance_cents?: string;
  topup_amount_cents: number | null;
  topup_threshold_cents: number | null;
  has_payment_method: boolean;
  has_auto_topup: boolean;
  // Additive (billing-service v0.40.0+): off_session auto-reload is impossible for cards
  // issued in some countries (e.g. India / RBI e-mandates). Absent on older billing deploys
  // => treat as supported (default to today's behavior); only an explicit `false` blocks it.
  auto_reload_supported?: boolean;
  auto_reload_unsupported_reason?: string | null;
  card_country?: string | null;
  // Saved-card display fields, sourced from the Stripe PaymentMethod. Additive
  // (billing-service): absent on older deploys => the Payment method section falls
  // back to the connected/country-only display. Never derived client-side.
  card_brand?: string | null;
  card_last4?: string | null;
  card_exp_month?: number | null;
  card_exp_year?: number | null;
  // Per-org usage discount rate (integer 0-100), frozen upstream at cost-declaration so
  // the balance/usage/next-charge numbers above are ALREADY net of it. null = no discount.
  // Absent on older billing deploys.
  usage_discount_pct?: number | null;
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

export interface EmbeddedCheckoutSession {
  client_secret: string;
  session_id: string;
}

export type WalletSetupResult = BillingAccount & {
  initial_load_amount_cents: number;
  initial_load_payment_intent_id: string;
  first_load_match_applied: boolean;
  first_load_match_cents: string;
  first_load_match_local_promo_id: string | null;
};

export async function getBillingAccount(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts", { token });
}

export async function getBillingBalance(token?: string): Promise<BillingBalance> {
  return apiCall<BillingBalance>("/billing/accounts/balance", { token });
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

// ── Credit grants ("gifts received") ──
// The org's own credit-grants ledger: welcome gift, first-deposit match, staff
// bonuses, referral credits, promo redemptions. Source: billing-service
// GET /v1/credits/grants (scoped to x-org-id) via api-service gateway
// GET /v1/billing/credits/grants. `reason` is the grant kind (welcome,
// first_load_match, admin_grant, invite_*) or a promo code; `amountCents` is a
// string (Postgres numeric). Per-field schema verified against api-registry;
// safeParse turns wire-rot into a caught fetch-error per CLAUDE.md.
export interface CreditGrant {
  id: string;
  orgId: string;
  amountCents: string;
  reason: string;
  note: string | null;
  grantedBy: string | null;
  createdAt: string;
}

const CreditGrantSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    amountCents: z.string(),
    reason: z.string(),
    note: z.string().nullable(),
    grantedBy: z.string().nullable(),
    createdAt: z.string(),
  })
  .passthrough();

const ListCreditGrantsResponseSchema = z.object({ grants: z.array(CreditGrantSchema) });

/** GET /billing/credits/grants — the active org's own credit-grants ledger. */
export async function getCreditGrants(token?: string): Promise<{ grants: CreditGrant[] }> {
  const raw = await apiCall<unknown>("/billing/credits/grants", { token });
  const parsed = ListCreditGrantsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getCreditGrants: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getCreditGrants: invalid response shape");
  }
  return parsed.data as unknown as { grants: CreditGrant[] };
}

// A single customer payment (a Stripe PaymentIntent = a one-off top-up the
// customer paid). Read from the api-service gateway payments route, which
// forwards the org's PaymentIntents mirrored server-side in stripe-service.
// NOTE: shape verified against api-registry (live) before merge — the gateway
// owns the wire shape; this reader conforms to the deployed route.
export interface Payment {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string; // ISO 8601
  description: string | null;
}

// stripe-service mirrors raw Stripe PaymentIntents; `amount` is cents (number),
// `created` is unix-seconds. `.passthrough()` keeps unmodeled Stripe fields.
const PaymentIntentSchema = z
  .object({
    id: z.string(),
    amount: z.coerce.number(),
    currency: z.string(),
    status: z.string(),
    created: z.coerce.number(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

const ListPaymentsResponseSchema = z.object({
  object: z.literal("list"),
  data: z.array(PaymentIntentSchema),
  has_more: z.boolean(),
  url: z.string(),
});

/**
 * GET /billing/payments — the active org's payment history (its Stripe
 * PaymentIntents / top-ups). Backs the billing page "Payments" card.
 */
export async function getBillingPayments(token?: string): Promise<{ payments: Payment[] }> {
  const raw = await apiCall<unknown>("/billing/payments", { token });
  const parsed = ListPaymentsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBillingPayments: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBillingPayments: invalid response shape");
  }
  const payments: Payment[] = parsed.data.data.map((pi) => ({
    id: pi.id,
    amountCents: pi.amount,
    currency: (pi.currency ?? "usd").toUpperCase(),
    status: pi.status,
    createdAt: new Date(pi.created * 1000).toISOString(),
    description: pi.description ?? null,
  }));
  // Most recent first.
  payments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { payments };
}

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

/**
 * Create an EMBEDDED Stripe Checkout session — card is captured in an in-app modal
 * (iframe), no redirect to a hosted Stripe page. Returns a `client_secret` the
 * front-end mounts via @stripe/react-stripe-js <EmbeddedCheckout>. The card is saved
 * off-session (auto-topup) and `topup_amount_cents` charged; credit lands via the
 * existing checkout.session.completed webhook (same accounting as the hosted path).
 */
export async function createEmbeddedCheckoutSession(
  topup_amount_cents: number,
  token?: string
): Promise<EmbeddedCheckoutSession> {
  return apiCall<EmbeddedCheckoutSession>("/billing/checkout-sessions", {
    token,
    method: "POST",
    body: { ui_mode: "embedded", topup_amount_cents },
  });
}

export async function setupBillingWallet(
  params: {
    initial_load_amount_cents: number;
    topup_amount_cents: number;
    topup_threshold_cents: number;
  },
  token?: string
): Promise<WalletSetupResult> {
  return apiCall<WalletSetupResult>("/billing/accounts/wallet_setup", {
    token,
    method: "POST",
    body: params,
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

// ahref-service `normalizeDomain` rejects anything that isn't a bare host with a
// 400 ("not a valid domain: -"), and that 400 fails the ENTIRE chunk it lands in
// — blanking DR / Monthly Visits for up to DOMAIN_READ_CHUNK_SIZE valid domains
// sharing the chunk. Outlet records carry a "-" placeholder for "no domain" and
// occasionally a path-bearing value (a.com/section); `.sort()` puts "-" first, so
// it poisons chunk 0 on every load. Filter to bare, dotted hosts BEFORE chunking
// so one junk value can't take down its chunk-mates. Dropping a non-domain loses
// nothing — ahref can't enrich it anyway.
function isQueryableDomain(domain: string): boolean {
  return domain.length > 0 && domain !== "-" && domain.includes(".") && !/[/\s]/.test(domain);
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

export async function getDomainTrafficHistories(
  domains: string[],
  token?: string,
): Promise<DomainTrafficHistory[]> {
  const queryable = domains.filter(isQueryableDomain);
  if (queryable.length < domains.length) {
    console.warn("[dashboard] getDomainTrafficHistories: dropped non-queryable domains before ahref call", {
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
    console.warn("[dashboard] getDomainDrStatuses: dropped non-queryable domains before ahref call", {
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
