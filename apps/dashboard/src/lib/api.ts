import { z } from "zod";
import type { PublicChannelLegsWire } from "./stated-campaign-leg";
import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "./org-desync";
import { keepLastGoodFields, keepLastGoodList } from "./keep-last-good";
import type { RevenueOverview } from "./revenue-view";
import type { LeadStanding } from "./lead-standing";
import type { ReplyKind } from "./reply-kind";
import type { OptOutChannel } from "./opt-out-channel";
import { parseFeatureRevenue } from "./revenue-parse";
import { withAverageCampaignRelevanceScores } from "./outlet-relevance";
import { measuredProjectionRows } from "./workflow-projection-measured";
// `normalizeSalesFunnelKey` is a RUNTIME import; the rest is type-only. No cycle
// survives the build: sales-funnels.ts reads this module's goal types with
// `import type`, which is erased, so the edge only runs in this direction.
import {
  canonicalSalesFunnelKey,
  normalizeSalesFunnelKey,
  type SalesFunnelKeyWire,
} from "./sales-funnels";

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
    const preview = text.trim().slice(0, 200);
    // Carry the status + body preview in the MESSAGE, not only in the error body:
    // most call sites render `err.message` alone, and a bare "non-JSON response"
    // hides whether the platform 500'd (Vercel HTML error page), the gateway
    // timed out, or the route is missing.
    throw new ApiError(
      `API returned a non-JSON response (HTTP ${response.status}, ${contentType || "no content-type"}) from ${endpoint}${preview ? `: ${preview}` : ""}`,
      response.status,
      {
        error: "Non-JSON API response",
        endpoint,
        status: response.status,
        contentType: contentType || null,
        preview,
      },
    );
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
async function getTabSessionToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (
    window as unknown as {
      Clerk?: {
        session?: {
          getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>;
        } | null;
      };
    }
  ).Clerk;
  try {
    // `getToken()` is CACHED by Clerk, and the cached token carries the org claim
    // it was minted with. So a retry after an org-desync 409 that re-sends the
    // cached token re-sends the STALE org and 409s again, deterministically —
    // the retry was a no-op for the one case it exists to fix. `skipCache` mints
    // a fresh token carrying this tab's current active org.
    return (await clerk?.session?.getToken(forceRefresh ? { skipCache: true } : undefined)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Backoff between org-desync retries. Three attempts, not one: a switch has to
 * get through `setActive` → Clerk's token endpoint → the cookie before the JWT's
 * org claim matches the URL, and on a slow connection that is comfortably longer
 * than half a second. Every attempt re-mints (see `getTabSessionToken`), so each
 * one asks a genuinely different question.
 */
const ORG_DESYNC_BACKOFF_MS = [400, 900, 2000] as const;

async function apiCall<T>(endpoint: string, options?: ApiOptions): Promise<T> {
  const { token, method = "GET", body, headers: extraHeaders, suppressPaymentRequired } = options ?? {};

  const send = async (forceFreshToken = false): Promise<Response> => {
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
      // authenticated requests".) Read with `?.`: before Clerk loads, or with no
      // session, we fall back to the cookie (and checkProxyOrg still fails closed).
      const tabToken = await getTabSessionToken(forceFreshToken);
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
  // caught up with the UI's org yet. Wait for Clerk to settle, then retry with a
  // FRESHLY MINTED token — the cached one carries the org claim that was just
  // refused, so re-sending it is guaranteed to be refused again. Proxy-routed
  // calls only. Give up after the backoff table and let the 409 surface: a
  // desync that outlives ~3s is not rotation lag, it is Clerk being unreachable,
  // and every surface fails visibly rather than skeletoning forever.
  if (!token) {
    for (let attempt = 0; attempt < ORG_DESYNC_BACKOFF_MS.length; attempt++) {
      if (response.status !== ORG_DESYNC_STATUS) break;
      const peek = await response.clone().json().catch(() => null);
      if (peek?.error !== ORG_DESYNC_ERROR) break;
      await new Promise((resolve) => setTimeout(resolve, ORG_DESYNC_BACKOFF_MS[attempt]));
      response = await send(true);
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
/**
 * The goal a campaign paces on. campaign-service provisions one campaign per
 * FUNDED sales funnel and forwards that funnel's goal VERBATIM from brand-service
 * (`funnel-campaigns.ts`: "forwarded verbatim from brand-service, never mapped"),
 * so the vocabulary here is brand-service's canonical set — the same one
 * `CANONICAL_GOALS` pins, which its own DB constrains. `purchase` rides along as
 * the pre-rename spelling of `websitePurchase`, exactly as on the brand wire.
 *
 * NULL on a campaign = inherit the brand goal.
 */
export type RuntimeGoal = CanonicalGoal | "purchase";

/**
 * Map a campaign's own goal onto this app's local brand-goal vocabulary, which is
 * what every goal-labelled surface speaks. Display-only.
 *
 * It delegates rather than re-deciding: the campaign goal and the brand goal are
 * the SAME vocabulary, so a second mapping here is a second place to go stale —
 * which is exactly what happened. This used to be a three-token union ending in a
 * bare `return "sales_meetings"`, so `formSubmission` (what campaign-service sends
 * for a Form Magnet funnel) printed "Sales Meeting from Conversation": a funnel
 * the brand had never declared, on a page sitting beside Settings that declared
 * one. `normalizeBrandOptimizationGoal` is exhaustive and throws on an unmapped
 * spelling, so the next vocabulary the producer adds fails loud instead.
 */
export function optimizationGoalForRuntimeGoal(goal: RuntimeGoal): BrandOptimizationGoal {
  return normalizeBrandOptimizationGoal(goal);
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
  /**
   * The sales funnel this campaign runs, when campaign-service provisioned it for
   * one. NULL = the pre-funnel campaign, which predates the model and pursues the
   * brand-level goal. It is the RICHER field of the two: the goal cannot tell a
   * meeting won from a reply apart from one won on the website, and the funnel
   * key can, so every surface naming what a campaign buys should read this.
   */
  funnelKey: SalesFunnelKeyWire | null;
  /**
   * The single funnel LEG this campaign is bought for — features-service's own
   * canonical identifier for it, carried verbatim by campaign-service.
   *
   * A campaign is (brand x offer x channel x leg): a funnel is sold leg by leg and
   * the customer buys the leg, so this is the RICHEST of the three fields naming what
   * a campaign does. `funnelKey` cannot get there on its own — two arrows of two
   * different funnels land on the same step — and the derivation that stood in for it
   * (intersect the funnel with the channel's arrows) only works while a campaign names
   * a funnel at all.
   *
   * NULL for every campaign created before campaign-service carried the column, which
   * keeps reading through that derivation exactly as before. The token is OPAQUE:
   * resolve it through `stated-campaign-leg`, never by splitting it.
   */
  legKey: string | null;
  /**
   * The OFFER this campaign sells. A campaign is (offer x sales funnel x
   * acquisition channel), so the offer is what says WHICH proposition the funnel
   * and the channel are selling. Nullable on the wire for a campaign created
   * before campaign-service carried the column; such a campaign belongs to no
   * offer and is left out of an offer-scoped list rather than guessed into one.
   */
  offerId: string | null;
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
  // The brand's own colours, read off logo.dev by brand-service. Optional for
  // the same additive-rollout reason: the dashboard renders the charter blue
  // until the producer ships the field, and for every brand logo.dev has not
  // indexed after it does. `BrandTint` decides whether any of them is a usable
  // accent — a palette is often three neutrals, so having colours is NOT having
  // a tint. Never read `colors[0]` as "the brand colour": the dominant colour
  // of a logo is usually its background.
  colors?: (string | { hex?: unknown })[] | null;
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
  colors?: (string | { hex?: unknown })[] | null;
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
/**
 * The ONE goal vocabulary the fleet is converging on — camelCase runtime tokens,
 * owned by brand-service (it owns what a brand declares).
 *
 * Three lists describe these same goals today and each carries translation layers
 * for the other two: brand-service's `CurrentGoal` (camelCase) beside its own
 * `LegacyOptimizationGoal` (snake, and named "legacy" in its own source),
 * features-service's `Goal` (camelCase), and this file's `BrandOptimizationGoal`
 * (snake). They do not agree — `websitePurchase` is `purchase` in one of them, and
 * the bare token `sales` means WEBSITE PURCHASE to brand-service while it means
 * COMBINED sales here and in features-service. That collision is not theoretical:
 * it put every website-purchase brand in the combined-sales bucket of the fleet
 * benchmark (distribute.you#3214).
 *
 * This list is the target. It is pinned by `tests/goal-vocabulary.test.ts` so the
 * three lists cannot drift further apart while the migration is in flight.
 */
export const CANONICAL_GOALS = [
  "signup",
  "meetingBooked",
  "websitePurchase",
  "combinedSales",
  "websiteVisit",
  "positiveReply",
  "formSubmission",
  "whatsappConversation",
] as const;

export type CanonicalGoal = (typeof CANONICAL_GOALS)[number];

/**
 * Every spelling this app may receive for a brand's optimization goal: its own
 * local snake vocabulary, brand-service's current wire spellings, and the
 * canonical camelCase tokens above.
 *
 * The canonical tokens are here AHEAD of brand-service emitting them. That is the
 * point: brand-service switching its emission is a breaking change for any
 * consumer that cannot already read the new spelling, so the dashboard learns to
 * read both BEFORE the producer flips. Reading a spelling nobody sends yet costs
 * nothing; failing to parse the day it arrives takes down every economics surface.
 */
type BrandOptimizationGoalWire =
  | BrandOptimizationGoal
  | "booked_meetings"
  | "combined_sales"
  | "purchase"
  | CanonicalGoal;

/**
 * Collapse any wire spelling onto this app's local goal vocabulary.
 *
 * `whatsappConversation` is deliberately ABSENT from the return type: no brand
 * carries that goal today and adding it here would mean adding a member to
 * `BrandOptimizationGoal`, which several exhaustive `Record`s key on. It is a
 * separate change, and the schema union below does not accept it either — so a
 * whatsapp brand fails LOUD at parse rather than reading as a sales meeting.
 */
export function normalizeBrandOptimizationGoal(
  goal: BrandOptimizationGoalWire,
): BrandOptimizationGoal {
  switch (goal) {
    case "signups":
    case "signup":
      return "signups";
    case "website_visits":
    case "websiteVisit":
      return "website_visits";
    case "positive_replies":
    case "positiveReply":
      return "positive_replies";
    case "form_submissions":
    case "formSubmission":
      return "form_submissions";
    // The combined-sales goal is `combined_sales` on the brand-service wire today
    // and `combinedSales` once it speaks canonical.
    case "combined_sales":
    case "combinedSales":
      return "sales";
    // The renamed website-purchase goal reads as `website_purchase`. The LEGACY `sales`
    // wire (brand-service still persists the old purchase goal as `sales`, and its
    // internal read emits `sales` for EVERY purchase brand) + the `purchase` runtime
    // spelling + the canonical `websitePurchase` all collapse to it.
    case "website_purchase":
    case "sales":
    case "purchase":
    case "websitePurchase":
      return "website_purchase";
    case "sales_meetings":
    case "booked_meetings":
    case "meetingBooked":
      return "sales_meetings";
  }
  // Exhaustive above. A value reaching here is a spelling added to the wire union
  // without being mapped — fail loud rather than silently reading as a sales
  // meeting, which is what the old catch-all `return "sales_meetings"` did.
  throw new Error(`Unmapped brand optimization goal: ${goal as string}`);
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
  // OPTIONAL because brand-service retired the goal from this payload (#434):
  // the declared funnel set is the only vocabulary for what a brand sells
  // through. A consumer that needs a goal reads the arbitrated one, and a
  // reader that requires this field here takes every econ surface down.
  optimizationGoal?: BrandOptimizationGoal;
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
  // Both vocabularies: the snake spellings brand-service used to emit, and the
  // canonical camelCase it migrated to. Accepting both is what let the producer
  // flip its emission without breaking this app — see `CANONICAL_GOALS`.
  // `whatsappConversation` is absent on purpose: this app has no local goal for
  // it, so it must fail loud here rather than be mapped.
  //
  // `.optional()` because brand-service has RETIRED the goal from this payload
  // (#434): the declared funnel set is the only vocabulary for what a brand
  // sells through, and the goal was the poorer word (both meeting funnels
  // collapsed onto one). Keeping it REQUIRED is what took every econ-reading
  // surface down the day that promoted — the Sales Funnels card rendered blank
  // rates and a blank lifetime revenue on brands whose numbers were sitting
  // untouched on the wire, and it read as lost data. Same retirement as the
  // `goal` / `currentGoal` pair on the declared-funnel payload above; this one
  // was the straggler. Delete it outright once no brand-service in any
  // environment still sends it.
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
    z.literal("signup"),
    z.literal("meetingBooked"),
    z.literal("websitePurchase"),
    z.literal("combinedSales"),
    z.literal("websiteVisit"),
    z.literal("positiveReply"),
    z.literal("formSubmission"),
  ]).transform(normalizeBrandOptimizationGoal).optional(),
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

// ── Brand sales funnels (the ways a brand sells) ──
// brand-service owns the store and the shape; api-service proxies it verbatim
// under /v1/brands/:brandId/sales-funnels, beside the sales-economics routes it
// mirrors. A funnel is one sequence from the first signal outreach can buy (a
// positive reply, or a click onto the site) down to a paid client, and it owns
// everything that funnel needs priced: the rate of each of its legs, the lifetime
// revenue of a client won through it, the page a click lands on and, when a
// meeting sits in the funnel, a booking link.
//
// NOTHING IS DEFAULTED upstream: a value the brand never declared reads `null`,
// and `null` is how a consumer knows not to rank on it. Never turn one into a 0.

/**
 * Both funnel-key spellings: the four brand-service stores today and the four it
 * is renaming to. `lib/sales-funnels.ts` already carried this pair; THIS file did
 * not, so the reader would have rejected the new keys while the catalogue beside
 * it accepted them — the same two-lists drift the goal retirement exists to end.
 *
 * The value is normalised on the way in, so everything downstream keeps seeing
 * the key the catalogue is written on.
 */
const SALES_FUNNEL_KEYS_WIRE = [
  "reply_meeting",
  "visit_meeting",
  "visit_signup",
  "visit_form",
  "sales_meetings_from_conversation",
  "sales_meetings_from_website",
  "website_purchases",
  "form_magnet",
] as const;

const DeclaredSalesFunnelSchema = z.object({
  funnelKey: z.enum(SALES_FUNNEL_KEYS_WIRE).transform(normalizeSalesFunnelKey),
  /**
   * Whether the org SELLS through this funnel right now.
   *
   * The set lists active and inactive funnels ALIKE, on purpose: switching one
   * off keeps every number on it, so the screen can show what the user entered
   * and switching it back on returns it. Which means a consumer that ignores
   * this flag renders a switched-off funnel as though it were still selected.
   *
   * `.optional()` reading as TRUE covers a brand-service older than the flag: it
   * listed only the funnels the brand sold through, so every row it returned was
   * active by construction.
   */
  active: z.boolean().optional(),
  name: z.string(),
  steps: z.array(z.string()),
  // brand-service's own goal spellings, and they are being RETIRED: the funnel
  // key is becoming the one word for what a brand sells through, because the goal
  // was the poorer one (both meeting funnels collapsed onto `meetingBooked`, so
  // no consumer could price a meeting won from a reply apart from one won from
  // the website).
  //
  // `.optional()` because brand-service has already dropped them from the
  // declared-funnel payload on its staging. Required here, a promote takes the
  // whole Sales Funnels card down on a safeParse throw. Nothing branches on them,
  // so tolerating their absence costs nothing and they can be deleted outright
  // once no brand-service in any environment still sends them.
  goal: z.string().optional(),
  currentGoal: z.string().optional(),
  // Exactly the legs of THIS funnel's steps. A leg the brand never gave us is
  // null; a rate the funnel does not price is absent entirely.
  rates: z.record(z.string(), z.number().nullable()),
  lifetimeRevenueUsd: z.number().nullable(),
  destinationUrl: z.string().nullable(),
  bookingUrl: z.string().nullable(),
  updatedAt: z.string(),
});

export type DeclaredSalesFunnel = z.infer<typeof DeclaredSalesFunnelSchema>;

// An EMPTY list means the org has NEVER answered. It cannot mean "sells through
// nothing": brand-service refuses to switch off the last active funnel, so an org
// that answered always keeps one on, and the two readings can no longer collide.
//
// That is what retired the `declared` flag, which existed only to tell them
// apart. It is still read `.optional()` for a brand-service that predates its
// removal; nothing branches on it.
const GetBrandSalesFunnelsResponseSchema = z.object({
  declared: z.boolean().optional(),
  funnels: z.array(DeclaredSalesFunnelSchema),
});

export type BrandSalesFunnelSet = z.infer<typeof GetBrandSalesFunnelsResponseSchema>;

/**
 * A PARTIAL patch, exactly as brand-service reads it: an OMITTED field is left
 * as stored, an explicit `null` CLEARS the value back to never-declared. Send
 * only what changed — restating a field from a possibly-stale copy is how a
 * value the user confirmed elsewhere gets overwritten.
 */
export type SalesFunnelPatch = {
  rates?: Record<string, number | null>;
  lifetimeRevenueUsd?: number | null;
  destinationUrl?: string | null;
  bookingUrl?: string | null;
};

/** GET /brands/:brandId/sales-funnels — what the brand has said about how it sells. */
export async function getBrandSalesFunnels(
  brandId: string,
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-funnels`, { token });
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandSalesFunnels: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandSalesFunnels: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/sales-funnels — state the WHOLE set at once: exactly
 * these funnels, no others.
 *
 * DISTINCT from declaring one funnel. Declaring adds; this REPLACES the set, so
 * it is what removes a funnel the brand no longer sells through, and it is the
 * only way to answer "I sell through NONE of these" (`[]`) — a real answer, and
 * a different one from never having said anything.
 *
 * A funnel already in the set KEEPS the economics it was priced with, so
 * restating a set never wipes what a brand confirmed; a funnel dropped from it
 * loses its declaration and its economics together. The set is validated whole
 * before anything is written, so a rejected set leaves nothing half-applied.
 */
export async function stateBrandSalesFunnels(
  brandId: string,
  funnelKeys: string[],
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-funnels`, {
    token,
    method: "PUT",
    body: { funnelKeys },
  });
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] stateBrandSalesFunnels: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] stateBrandSalesFunnels: invalid response shape");
  }
  return parsed.data;
}

// WRITE: the row was just persisted, so the funnel is always present. Per the
// per-verb schema rule the write DTO is its own, narrower than the read sibling.
const DeclareBrandSalesFunnelResponseSchema = z.object({
  funnel: DeclaredSalesFunnelSchema,
});

/**
 * PUT /brands/:brandId/sales-funnels/:funnelKey — declare the funnel and write
 * what the patch carries. Idempotent: the declaration IS the row. brand-service
 * rejects a rate outside this funnel's steps, a destination it has no use for,
 * and a website-led funnel on a brand with no website — those 400s reach the
 * caller intact and are the answer, not something to pre-empt here.
 */
export async function declareBrandSalesFunnel(
  brandId: string,
  funnelKey: string,
  patch: SalesFunnelPatch,
  token?: string,
): Promise<{ funnel: DeclaredSalesFunnel }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-funnels/${funnelKey}`, {
    token,
    method: "PUT",
    body: patch,
  });
  const parsed = DeclareBrandSalesFunnelResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] declareBrandSalesFunnel: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] declareBrandSalesFunnel: invalid response shape");
  }
  return parsed.data;
}

/**
 * DELETE /brands/:brandId/sales-funnels/:funnelKey — the brand no longer sells
 * through this funnel, and its economics go with the declaration. Returns the
 * set still declared. Dropping the LAST funnel does not un-state the set: a
 * brand that stopped selling through everything has still answered.
 */
export async function undeclareBrandSalesFunnel(
  brandId: string,
  funnelKey: string,
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/sales-funnels/${funnelKey}`, {
    token,
    method: "DELETE",
  });
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] undeclareBrandSalesFunnel: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] undeclareBrandSalesFunnel: invalid response shape");
  }
  return parsed.data;
}

// ─── Offers (Org > Brand > Offer > Campaign) ─────────────────────────────────
//
// A BRAND is an identity: a name, a domain, a logo, a conversion-tracking snippet.
// An OFFER is a PROPOSITION: what it promises (the 7 Hormozi user-fields) and the
// sales funnels it is sold through, with their conversion rates, lifetime revenue
// and destinations. A brand selling a $200 self-serve plan and a $20k enterprise
// contract has two offers, and everything that used to hang off the brand and is
// really about the proposition — audiences, leads, campaigns, funnels — hangs off
// the offer.
//
// brand-service owns the level. There is no `active` flag and no DELETE route, so
// nothing here invents either.
const OfferSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Offer = z.infer<typeof OfferSchema>;

const ListBrandOffersResponseSchema = z.object({ offers: z.array(OfferSchema) });
const BrandOfferResponseSchema = z.object({ offer: OfferSchema });

/** GET /brands/:brandId/offers — every proposition this brand sells. */
export async function listBrandOffers(
  brandId: string,
  token?: string,
): Promise<{ offers: Offer[] }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers`, { token });
  const parsed = ListBrandOffersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] listBrandOffers: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] listBrandOffers: invalid response shape");
  }
  return parsed.data;
}

/** GET /brands/:brandId/offers/:offerId — one offer, by id. */
export async function getBrandOffer(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}`, { token });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandOffer: invalid response shape");
  }
  return parsed.data;
}

/**
 * POST /brands/:brandId/offers — a new proposition under this brand.
 *
 * The name is at most two words and 20 characters, and unique per brand;
 * brand-service enforces all three and its 400 is the answer, so nothing is
 * pre-empted here.
 */
export async function createBrandOffer(
  brandId: string,
  name: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers`, {
    token,
    method: "POST",
    body: { name },
  });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] createBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] createBrandOffer: invalid response shape");
  }
  return parsed.data;
}

/** PATCH /brands/:brandId/offers/:offerId — rename. The only mutable field. */
export async function renameBrandOffer(
  brandId: string,
  offerId: string,
  name: string,
  token?: string,
): Promise<{ offer: Offer }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}`, {
    token,
    method: "PATCH",
    body: { name },
  });
  const parsed = BrandOfferResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] renameBrandOffer: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] renameBrandOffer: invalid response shape");
  }
  return parsed.data;
}

// The offer's funnels and user-fields are the SAME payloads the brand-scoped
// routes serve — brand-service reuses the schemas upstream — so these readers
// reuse the brand schemas verbatim rather than declaring a second copy that could
// drift from them.

/** GET /brands/:brandId/offers/:offerId/sales-funnels — how THIS offer is sold. */
export async function getOfferSalesFunnels(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/sales-funnels`, { token });
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferSalesFunnels: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getOfferSalesFunnels: invalid response shape");
  }
  return parsed.data;
}

/** PUT /brands/:brandId/offers/:offerId/sales-funnels — state the WHOLE set. */
export async function stateOfferSalesFunnels(
  brandId: string,
  offerId: string,
  funnelKeys: string[],
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/sales-funnels`, {
    token,
    method: "PUT",
    body: { funnelKeys },
  });
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] stateOfferSalesFunnels: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] stateOfferSalesFunnels: invalid response shape");
  }
  return parsed.data;
}

/** PUT /brands/:brandId/offers/:offerId/sales-funnels/:funnelKey — declare + price one. */
export async function declareOfferSalesFunnel(
  brandId: string,
  offerId: string,
  funnelKey: string,
  patch: SalesFunnelPatch,
  token?: string,
): Promise<{ funnel: DeclaredSalesFunnel }> {
  const raw = await apiCall<unknown>(
    `/brands/${brandId}/offers/${offerId}/sales-funnels/${funnelKey}`,
    { token, method: "PUT", body: patch },
  );
  const parsed = DeclareBrandSalesFunnelResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] declareOfferSalesFunnel: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] declareOfferSalesFunnel: invalid response shape");
  }
  return parsed.data;
}

/** DELETE /brands/:brandId/offers/:offerId/sales-funnels/:funnelKey — stop selling through it. */
export async function undeclareOfferSalesFunnel(
  brandId: string,
  offerId: string,
  funnelKey: string,
  token?: string,
): Promise<BrandSalesFunnelSet> {
  const raw = await apiCall<unknown>(
    `/brands/${brandId}/offers/${offerId}/sales-funnels/${funnelKey}`,
    { token, method: "DELETE" },
  );
  const parsed = GetBrandSalesFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] undeclareOfferSalesFunnel: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] undeclareOfferSalesFunnel: invalid response shape");
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

// ── Per-funnel daily ceilings ──
// A brand funds each SALES FUNNEL separately: a $200 self-serve plan and a $20k
// contract are not worth the same daily spend, so each funnel carries its own
// ceiling. billing-service owns the store; api-service proxies it verbatim.
//
// TWO STATES, MUTUALLY EXCLUSIVE, and billing enforces it: a brand is either on
// the legacy single brand-level budget, or on per-funnel ceilings. The first
// per-funnel write retires the brand-level row, and the brand-level write then
// answers 409. So a stale scalar can never sit beside the ceilings contradicting
// their sum — and `dailyBudgetCents` below is ALWAYS the number the rest of the
// fleet reads, whichever state the brand is in.
//
// `funnels: []` therefore means "this brand has never set per-funnel ceilings",
// NOT "it funds nothing" — a brand that funds nothing has rows, all at zero.

const FunnelBudgetRowSchema = z.object({
  // Both spellings, normalised in — same reason as the declared-funnel reader
  // above. A per-funnel budget row is keyed on the funnel, so the rename reaches
  // this schema too, and pinning only the old keys drops every budget row on the
  // day brand-service promotes.
  funnelKey: z.enum(SALES_FUNNEL_KEYS_WIRE).transform(normalizeSalesFunnelKey),
  // Postgres `numeric` serializes as a STRING on the wire even though the field
  // is declared integer-ish upstream. Coerce rather than pin `z.number()`, which
  // would reject every real response.
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

// ONE (funnel, acquisition-channel) pair's own ceiling. A channel IS a
// features-service feature slug, so this row keys on the slug and nothing else.
const FunnelChannelBudgetRowSchema = z.object({
  funnelKey: z.enum(SALES_FUNNEL_KEYS_WIRE).transform(normalizeSalesFunnelKey),
  featureSlug: z.string(),
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

// ONE (funnel, channel, offer) triple's own ceiling — a CAMPAIGN's ceiling, the
// campaign being that triple. `offerId` is null on every row stated before
// billing carried the offer dimension.
const FunnelOfferBudgetRowSchema = z.object({
  funnelKey: z.enum(SALES_FUNNEL_KEYS_WIRE).transform(normalizeSalesFunnelKey),
  featureSlug: z.string(),
  offerId: z.string().nullable(),
  dailyBudgetCents: z.coerce.number(),
  updatedAt: z.string(),
});

const BrandFunnelBudgetsResponseSchema = z.object({
  brandId: z.string(),
  // Null only for a brand that has neither a brand-level budget nor ceilings.
  dailyBudgetCents: z.coerce.number().nullable(),
  funnels: z.array(FunnelBudgetRowSchema),
  // The finer grain: one row per (funnel, channel). `funnels` above is its
  // per-funnel SUM, served, so nothing here ever adds these up itself.
  //
  // `.optional()` because billing shipped it additively and this app merges to
  // prod with no staging buffer: an older billing serves the set without it, and
  // a required field would drop every budget row on that deploy. Absent reads as
  // "one channel per funnel", which is what every brand was before the split.
  channels: z.array(FunnelChannelBudgetRowSchema).optional(),
  // The finest grain, and the one a campaign is actually funded at: one row per
  // (funnel, channel, offer). `channels` above is its per-pair SUM and `funnels`
  // the per-funnel one — both served, so nothing here adds any of them up.
  //
  // `.optional()` for the same reason `channels` is, and `offerId` is NULLABLE
  // because every ceiling stated before billing carried the dimension names no
  // offer. Such a row is not "for no offer": it is the money of a brand that had
  // exactly one, which is every brand today.
  offers: z.array(FunnelOfferBudgetRowSchema).optional(),
});

export type BrandFunnelBudgets = z.infer<typeof BrandFunnelBudgetsResponseSchema>;

/**
 * Every leg the platform can name, as features-service publishes them.
 *
 * `GET /public/channels` is the ONE authority on a leg's identity: it mints the
 * `legKey` a campaign and a budget are keyed on and serves the two steps it connects
 * beside it, so a consumer names a leg with one value and reads its parts as data
 * rather than taking the token apart. Public, no auth, no org scope.
 *
 * Declared narrow ON PURPOSE: this reader exists to build a lookup table, so every
 * field it does not use is left undeclared rather than mirrored. The channel
 * CATALOGUE this app renders (marks, names, funnels) is a different read entirely —
 * it is projected off the features the session already holds — and nothing here
 * replaces it.
 */
const PublicChannelLegsSchema = z.object({
  channels: z.array(
    z.object({
      slug: z.string(),
      stepTransitions: z
        .array(
          z.object({
            legKey: z.string(),
            from: z.object({ key: z.string() }).nullable(),
            to: z.object({ key: z.string() }),
          }),
        )
        .optional(),
    }),
  ),
});

/** GET /public/channels — read for the leg identities alone. */
export async function getPublicChannelLegs(token?: string): Promise<PublicChannelLegsWire[]> {
  const raw = await apiCall<unknown>(`/public/channels`, { token });
  const parsed = PublicChannelLegsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getPublicChannelLegs: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getPublicChannelLegs: invalid response shape");
  }
  return parsed.data.channels;
}

/** GET /brands/:brandId/funnel-budgets — the ceilings, plus the total they sum to. */
export async function getBrandFunnelBudgets(
  brandId: string,
  token?: string,
): Promise<BrandFunnelBudgets> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/funnel-budgets`, { token });
  const parsed = BrandFunnelBudgetsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandFunnelBudgets: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandFunnelBudgets: invalid response shape");
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// What a brand may actually spend TODAY — campaign-service, through the gateway.
//
// The question is a JOIN and neither producer can answer it alone: billing keys a
// ceiling on (funnel x channel x offer) and stores no campaign status, while
// campaign-service stores the status and no money. billing's brand total is
// therefore status-BLIND — a brand running one campaign at $50 beside one paused
// at $10 answers $60 — so every surface that divided by it, or projected a month
// from it, counted ceilings nobody can spend against.
//
// The dashboard used to make that join itself, in the browser, from the campaign
// list and the funnel budgets. campaign-service serves it now, decomposed by
// offer / campaign / ceiling so no consumer sums anything.
// ---------------------------------------------------------------------------

/** ONE campaign inside the answer: whether it is running, and what it may spend. */
const SpendableCampaignSchema = z.object({
  campaignId: z.string(),
  status: z.string(),
  running: z.boolean(),
  funnelKey: z.string().nullable(),
  featureSlug: z.string().nullable(),
  offerId: z.string().nullable(),
  configuredDailyBudgetCents: z.coerce.number(),
  runningDailyBudgetCents: z.coerce.number(),
});

/** ONE offer's own totals, plus the campaigns that produced them. */
const SpendableOfferSchema = z.object({
  offerId: z.string().nullable(),
  configuredDailyBudgetCents: z.coerce.number(),
  runningDailyBudgetCents: z.coerce.number(),
  campaignIds: z.array(z.string()),
});

const BrandSpendableBudgetResponseSchema = z.object({
  brandId: z.string(),
  // Which billing width the figures were computed at. Read only to explain a
  // figure; exactly one width is ever counted, since the coarser ones are
  // billing's own sums of the finer.
  grain: z.string(),
  // What the customer SET. A paused campaign's settings screen must still be able
  // to state this, which is why the producer serves both rather than one.
  configuredDailyBudgetCents: z.coerce.number(),
  // The part of it standing behind a campaign that is ONGOING right now.
  runningDailyBudgetCents: z.coerce.number(),
  offers: z.array(SpendableOfferSchema),
  campaigns: z.array(SpendableCampaignSchema),
});

export type BrandSpendableBudget = z.infer<typeof BrandSpendableBudgetResponseSchema>;

/**
 * GET /brands/:brandId/spendable-budget — both daily-budget figures for a brand,
 * with the per-offer and per-campaign decompositions.
 *
 * Fail loud on a shape mismatch, like every other reader here: a money figure that
 * silently parsed to nothing would render as "this brand spends nothing", which is
 * a different statement from "we could not read it".
 */
export async function getBrandSpendableBudget(
  brandId: string,
  token?: string,
): Promise<BrandSpendableBudget> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/spendable-budget`, { token });
  const parsed = BrandSpendableBudgetResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandSpendableBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getBrandSpendableBudget: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/funnel-budgets — state the WHOLE set at once, atomically.
 * What signup checkout uses: the customer funds several funnels in one decision
 * and pays their sum, so a half-applied set would charge for something it did
 * not fund. A funnel absent from the body is removed.
 *
 * `offerId` names the PROPOSITION each ceiling funds, the same third coordinate
 * the single-ceiling PATCH below takes: a ceiling is keyed on (org, brand, funnel,
 * channel, offer), so one that names no offer addresses every offer selling that
 * pair rather than the campaign it actually funds. Optional, because a brand whose
 * offer cannot be resolved must still be able to fund its funnels.
 */
export async function stateBrandFunnelBudgets(
  brandId: string,
  funnels: { funnelKey: string; dailyBudgetCents: number; offerId?: string }[],
  token?: string,
): Promise<BrandFunnelBudgets> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/funnel-budgets`, {
    token,
    method: "PUT",
    body: { funnels },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = BrandFunnelBudgetsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] stateBrandFunnelBudgets: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] stateBrandFunnelBudgets: invalid response shape");
  }
  return parsed.data;
}

/**
 * PATCH /brands/:brandId/funnel-budgets/:funnelKey — one ceiling, which is what
 * brand Settings edits. Zero is an ordinary value: it means the brand is not
 * funding that funnel right now, which is how a customer pauses one without
 * losing what they told us about how it sells.
 *
 * `featureSlug` and `offerId` name the other two coordinates of the campaign the
 * money funds: a ceiling is keyed on (org, brand, funnel, channel, offer), so a
 * write naming fewer of them addresses a group rather than one campaign. billing
 * resolves a missing coordinate to the single member when there is one and
 * REFUSES (409) when there are several — guessing which campaign the money was
 * for would move it onto the wrong one. So a caller that can name them should.
 *
 * `offerId` is optional on the wire (billing v0.64.0) rather than required,
 * because the ceilings stated before it existed carry none.
 */
export async function saveBrandFunnelBudget(
  brandId: string,
  funnelKey: string,
  dailyBudgetCents: number,
  featureSlug?: string,
  offerId?: string,
  token?: string,
): Promise<BrandFunnelBudgets> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/funnel-budgets/${funnelKey}`, {
    token,
    method: "PATCH",
    body: {
      dailyBudgetCents,
      ...(featureSlug ? { featureSlug } : {}),
      ...(offerId ? { offerId } : {}),
    },
    headers: { "x-run-id": globalThis.crypto.randomUUID() },
  });
  const parsed = BrandFunnelBudgetsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveBrandFunnelBudget: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] saveBrandFunnelBudget: invalid response shape");
  }
  return parsed.data;
}

// ── Per-lead funnel step statements (lead-service v0.57.0 via the api-service proxy) ──
//
// What happened to ONE lead at each step of its campaign's sales funnel, stated by a
// person rather than measured. lead-service writes an `outcome` into the SAME conversion
// ledger every consumer already counts, so a statement moves the brand's outcome counts
// on the next read with nothing to change downstream; a `never` goes to a store no count
// reads, so it can never move a number.
//
// `id` here is the leads_campaigns ROW id — the `id` a leads-table row already carries,
// NOT `lead.leadId` (the person). The row is what carries the campaign, which is how a
// statement made on a campaign screen is attributable to that campaign.

/** The steps lead-service accepts a statement on. Its spelling, not ours. */
export type LeadStepName = "signup" | "meeting_booked" | "meeting_attended" | "form_submission" | "sale";

export type LeadStepState = "outcome" | "never" | "pending";

const LeadStepEntrySchema = z.object({
  step: z.string(),
  state: z.enum(["outcome", "never", "pending"]),
  /**
   * Whether a PERSON stated this step or the FUNNEL implies it (lead-service v0.60.0).
   * An implied step carries no author, no note and no date, and it moves on its own when
   * the statement behind it is retracted — so it must not be offered as a control, and
   * must not read as something somebody said.
   *
   * `.optional()` only to decouple the rollout; it is required on the producer.
   */
  origin: z.enum(["stated", "implied"]).nullable().optional(),
  /** The STATED step an implied one follows from. */
  impliedBy: z.string().nullable().optional(),
  /**
   * What a person actually stated about THIS step, whatever the funnel concluded — so a
   * real statement is never lost to satisfy the funnel. A `never` later contradicted by
   * an outcome reads state=outcome, origin=implied, statedState=never.
   */
  statedState: z.enum(["outcome", "never"]).nullable().optional(),
  /**
   * Whether the step is on this lead's funnel at all. Off it, no rule reaches it.
   *
   * `inFunnel` says whether the step is on the lead's funnel at all.
   * below — a producer-owned key this app reads and does not name.
   */
  inFunnel: z.boolean().optional(),
  source: z.enum(["tracker", "manual"]).nullable(),
  valueCents: z.number().nullable(),
  /**
   * What the CUSTOMER stated getting through this step cost THEM, in cents. Their own
   * money: we record it because they told us, we never charge it, and it never enters
   * the platform's spend ledger or their billing.
   *
   * Required-and-nullable, matching the producer. `0` is a STATED zero. `null` means
   * nobody answered: a pending step, a step the funnel implied, a tracker-reported one,
   * or a statement made before the cost became mandatory. Declaring it `.optional()`
   * would read `undefined` on a body that legitimately carries a null, which is the one
   * distinction this field exists to hold.
   */
  costCents: z.number().nullable(),
  note: z.string().nullable(),
  statedByUserId: z.string().nullable(),
  at: z.string().nullable(),
});

// `.passthrough()` on the envelope, not a narrowed object: lead-service owns this shape
// and a field it adds later must reach a consumer rather than being stripped at the
// parse boundary. `step` is a bare string on purpose — the producer serves a legacy
// "purchase" spelling alongside "sale", and an enum here would throw the whole read
// away over a value we simply do not render.
const LeadStepStatementsSchema = z
  .object({
    leadCampaignId: z.string(),
    leadId: z.string(),
    campaignId: z.string(),
    brandId: z.string(),
    steps: z.array(LeadStepEntrySchema),
    /**
     * The funnel this lead's CAMPAIGN sells through, and its steps IN ORDER, both read
     * from campaign-service by the producer and never guessed. `.optional()` only to
     * decouple the rollout.
     *
     * `funnelSteps` is the funnel's steps, in the producer's order.
     */
    funnelKey: z.string().optional(),
    funnelSteps: z.array(z.string()).optional(),
  })
  .passthrough();

export type LeadStepStatements = z.infer<typeof LeadStepStatementsSchema>;

export async function getLeadStepStatements(
  leadRowId: string,
  token?: string,
): Promise<LeadStepStatements> {
  const raw = await apiCall<unknown>(`/leads/${leadRowId}/step-statements`, { token });
  const parsed = LeadStepStatementsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getLeadStepStatements: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getLeadStepStatements: invalid response shape");
  }
  return parsed.data;
}

/**
 * State what happened at one step, or that it never will.
 *
 * Correcting one is a WITHDRAWAL (below), not the opposite statement: stating the other
 * thing to undo a mistake is itself a false statement, and it keeps counting. An outcome
 * still supersedes an earlier `never` on its own — that is the funnel resolving a
 * contradiction, a different fact from somebody taking their own words back.
 */
export async function setLeadStepStatement(
  leadRowId: string,
  body: {
    step: LeadStepName;
    kind: "outcome" | "never";
    /**
     * What the step cost the CUSTOMER, in cents. MANDATORY on every statement, outcome
     * and "never" alike: lead-service 400s with code `cost_required` without it, and a
     * meeting that was run and went nowhere still cost what it cost. `0` is a legal
     * answer and is recorded as a stated zero; there is no default, because an absent
     * answer and a stated zero are different statements.
     */
    costCents: number;
    valueCents?: number;
    note?: string;
    occurredAt?: string;
  },
  token?: string,
): Promise<unknown> {
  return apiCall<unknown>(`/leads/${leadRowId}/step-statements`, {
    token,
    method: "POST",
    body,
  });
}

/**
 * Take back a statement somebody made by hand about one funnel step of one lead.
 *
 * The undo for the write above, and the ONLY one: a person who picked the wrong lead,
 * the wrong step, or misread a reply had no way out, and the statement kept counting —
 * the outcome stayed on the ledger and the cost they stated for that leg stayed in their
 * spend, so every cost of acquisition and return downstream carried money nobody spent.
 *
 * It is the ABSENCE of a statement, not a third kind of one: nothing new to count, and
 * nothing is deleted (what was stated and the fact it was withdrawn both stay readable).
 *
 * Only a statement a PERSON made can be withdrawn. A tracker-reported outcome is a 409
 * `not_a_statement` and a step that merely READS as reached because the funnel implies it
 * is a 409 `nothing_stated` — the panel does not offer the control in either case, so
 * those refusals are a backstop rather than something a customer should meet.
 *
 * The response is the SAME per-step shape the read serves, re-derived after the
 * withdrawal — so a caller writes it straight into the read's cache instead of guessing
 * what its own withdrawal did to the rest of the funnel.
 */
export async function withdrawLeadStepStatement(
  leadRowId: string,
  step: LeadStepName,
  token?: string,
): Promise<LeadStepStatements> {
  const raw = await apiCall<unknown>(`/leads/${leadRowId}/step-statements/${step}`, {
    token,
    method: "DELETE",
  });
  const parsed = LeadStepStatementsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] withdrawLeadStepStatement: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] withdrawLeadStepStatement: invalid response shape");
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
  // apollo-service's own verdict on the filter set it built: true when its refine
  // loop judged no candidate a good fit and returned the best attempt anyway rather
  // than failing. INFORMATION, never a gate — a degraded audience is served,
  // persisted and activatable exactly like any other, and the customer decides.
  // OPTIONAL in the reader although the producer marks it required: an older
  // human-service deploy does not send it, and absent means not degraded. Never
  // infer it from counts or filter shapes; render the flag the backend sends.
  degraded?: boolean;
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
  degraded: z.boolean().optional(),
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
  /** The OFFER (Org > Brand > Offer > Campaign) this audience belongs to. An audience is
   *  assembled for one distinct thing the brand sells, so its detail page lives under that
   *  offer — this is what a link to it is built from, at every scope. `null` = never filed
   *  under an offer (rows predating the offer level), so there is no page to send a reader
   *  to. Required on the wire, so required here: a renamed or absent field would read
   *  `undefined` forever and every audience link would quietly disappear. */
  offerId: string | null;
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
  offerId: z.string().nullable(),
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

/** GET /orgs/audiences?brandId= — saved audiences for a brand, or for one OFFER.
 *
 *  An audience belongs to an offer (human-service carries `offerId` on the row),
 *  so an offer-scoped surface passes it and gets exactly that proposition's
 *  audiences. Omitting it is the brand-wide read, unchanged. */
export async function listAudiences(
  brandId: string,
  params?: { status?: AudienceStatus; limit?: number; offset?: number; offerId?: string },
  token?: string,
): Promise<{ audiences: AudienceWire[]; total: number }> {
  const query = new URLSearchParams({ brandId });
  if (params?.offerId) query.set("offerId", params.offerId);
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
// `dreamOutcome` REPLACES the old `valueProposition` (label "Dream outcome"); it is
// extracted under its OWN key (see USER_PROFILE_FIELDS), never seeded from the
// valueProposition extraction — that is a separate backend-only field.
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

/**
 * GET /brands/:brandId/offers/:offerId/user-fields — the 7 user-facing fields for
 * ONE proposition. Byte-identical payload to the brand-scoped route (brand-service
 * reuses the schema), so the reader reuses the schema rather than declaring a
 * second copy that could drift from it.
 */
export async function getOfferUserFields(
  brandId: string,
  offerId: string,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/user-fields`, { token });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] getOfferUserFields: invalid response shape");
  }
  return parsed.data;
}

/**
 * PUT /brands/:brandId/offers/:offerId/user-fields — confirm one or more fields
 * for ONE proposition. Same body and same semantics as the brand-scoped write: a
 * key sent is confirmed, a key omitted is left as stored, and an emptied field is
 * sent (never omitted) so clearing it is expressible.
 */
export async function saveOfferUserFields(
  brandId: string,
  offerId: string,
  fields: Partial<Record<UserFieldKey, UserFieldValue>>,
  token?: string,
): Promise<{ fields: BrandUserFields }> {
  const raw = await apiCall<unknown>(`/brands/${brandId}/offers/${offerId}/user-fields`, {
    token,
    method: "PUT",
    body: { fields },
  });
  const parsed = BrandUserFieldsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] saveOfferUserFields: response shape mismatch", { issues: parsed.error.issues, raw });
    throw new Error("[dashboard] saveOfferUserFields: invalid response shape");
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
  opts?: {
    token?: string;
    resetCache?: boolean;
    urlStrategy?: "url_map" | "landing";
    mode?: "extract" | "suggest";
    /**
     * Keys to write again from scratch, ignoring whatever the user already confirmed
     * for them: their confirmed value is neither shown to the model as authoritative
     * context nor overlaid onto the response. Confirmed values for keys NOT listed
     * still reach the model, so regenerating the offer levers still sees the brand's
     * confirmed services. Nothing is persisted — the caller saves the reviewed draft.
     * Every key must also appear in `fields` or brand-service 400s.
     */
    regenerateFieldKeys?: string[];
  },
): Promise<ExtractFieldsResponse> {
  const { token, resetCache, urlStrategy, mode, regenerateFieldKeys } = opts ?? {};
  // `mode` (brand-service): omitted/"extract" = site-grounded (returns "Unknown" when
  // absent); "suggest" = a generative Hormozi + top-3-expert persona that infers a
  // best-effort value where the source is silent and never returns "Unknown". Onboarding
  // passes "suggest" for the user-facing offer levers + services (USER_PROFILE_FIELDS).
  return apiCall<ExtractFieldsResponse>(
    `/brands/extract-fields`,
    { token, method: "POST", body: { brandIds, fields, resetCache, urlStrategy, mode, regenerateFieldKeys } },
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
  /**
   * Which sales funnels this feature may be SOLD THROUGH, in brand-service's
   * funnel vocabulary. features-service states it per feature, because not every
   * acquisition channel can sell every funnel: the feedback-request offer buys a
   * conversation, while the website-led funnels start with a click it cannot sell.
   *
   * An EMPTY array is a statement ("sells through none", every non-sales
   * feature); ABSENT means the producer has not shipped the field to this
   * environment yet. The two are read apart deliberately, so a consumer never
   * mistakes "we could not ask" for "it sells through nothing".
   *
   * `listFeatures` runs no Zod, so declaring it here is enough for it to arrive.
   */
  salesFunnels?: string[];
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

/** features-service's canonical Goal enum, minus the goals no brand can pick today.
 *  `websiteVisit` + `positiveReply` are the SINGLE-STEP goals (visit -> paid, reply -> paid);
 *  they are native on audience-stats, so a brand on either MUST send its own goal rather than
 *  borrow the nearest multi-step family — the borrow ranked workflows on the wrong outcome. */
export type FeatureAudienceStatsGoal =
  | "signup"
  | "meetingBooked"
  | "websitePurchase"
  | "sales"
  | "websiteVisit"
  | "positiveReply"
  | "formSubmission";
/** `returnPerDollar` is the BRAND-level order (descending, unmeasurable last); the two
 *  cost metrics order a funnel-scoped read (ascending, cheapest first). */
export type FeatureAudienceStatsSortMetric = "cpc" | "cppr" | "returnPerDollar";

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
  /** PROJECTED return for this audience, on the brand's own economics. See
   *  {@link AudienceProjection}. Optional only for rollout tolerance — features-service
   *  v0.127.0 requires it on every row. */
  projection?: AudienceProjection;
}

/**
 * What an audience is PROJECTED to return, on the brand's own declared economics.
 *
 * Rank a brand's audiences on `returnPerDollar`, never on cost per outcome: cost per
 * outcome ranks by CHEAPNESS, so an audience that converts to nothing outranks an
 * expensive one that pays. It is the identical definition `funnel-ranking` ranks a
 * brand's declared funnels on, so an audience's return and the brand's return are one
 * statistic at two grains.
 *
 * Distinct from `/revenue`'s REALIZED `costEconomics.roiMultiple`, which divides
 * measured pipeline by measured spend — this is what the evidence projects.
 */
export interface AudienceProjection {
  /** PROJECTED cost to win ONE paying client from this audience — the denominator of
   *  `returnPerDollar`. Null (never 0) when the funnel has no path to a paying client. */
  costPerPaidClientUsd: number | null;
  /** PROJECTED dollars of lifetime revenue per dollar spent. Null (never 0) when
   *  unmeasurable. An audience with no measured grain inherits `brandProjection`. */
  returnPerDollar: number | null;
  /** Brand-level read only: the declared funnel this row was priced through — the
   *  best-returning one for THIS audience, which is routinely not the brand's. */
  basisFunnelKey?: string | null;
  /** Brand-level read only: the lifetime revenue that funnel values a client at. */
  lifetimeRevenueUsd?: number | null;
  /**
   * PROJECTED cost of winning a customer as a SHARE of what that customer is worth —
   * `100 / returnPerDollar`, served rather than divided here so two surfaces cannot
   * print two numbers for one statistic.
   *
   * Do NOT pair it with `/revenue`'s `costEconomics.costOfAcquisitionPct`, which is
   * REALIZED (measured spend over measured pipeline). Same projected-vs-realized split
   * the return already carries against `roiMultiple`.
   */
  costOfAcquisitionPct?: number | null;
}

export interface FeatureAudienceStatsResponse {
  featureSlug: string;
  brandId: string;
  /** Null on the brand-level read — there is no goal there, only the return. */
  goal: FeatureAudienceStatsGoal | null;
  brandProfileId: string | null;
  sortMetric: FeatureAudienceStatsSortMetric;
  audiences: FeatureAudienceStatsRow[];
  /** The BRAND-level twin of every row's projection, on the same economics and the same
   *  formula — read a row's return against it ("this audience beats the brand"). */
  brandProjection?: AudienceProjection & {
    /** The lifetime revenue per paying client this whole payload was projected on,
     *  surfaced so a consumer can never pair a return with an LTR it did not use. */
    lifetimeRevenueUsd: number | null;
  };
}

const AudienceProjectionSchema = z.object({
  costPerPaidClientUsd: z.coerce.number().nullable(),
  returnPerDollar: z.coerce.number().nullable(),
  costOfAcquisitionPct: z.coerce.number().nullable().optional(),
  // Brand-level read only: an audience's best funnel is routinely NOT the brand's, and
  // two audiences can be priced through funnels the brand values differently.
  basisFunnelKey: z.string().nullable().optional(),
  lifetimeRevenueUsd: z.coerce.number().nullable().optional(),
});

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
  projection: AudienceProjectionSchema.optional(),
});

const FeatureAudienceStatsResponseSchema = z.object({
  featureSlug: z.string(),
  brandId: z.string(),
  goal: z.union([
    z.literal("signup"),
    z.literal("meetingBooked"),
    z.literal("websitePurchase"),
    z.literal("sales"),
    z.literal("websiteVisit"),
    z.literal("positiveReply"),
    z.literal("formSubmission"),
  ]).nullable(),
  brandProfileId: z.string().nullable(),
  sortMetric: z.union([
    z.literal("cpc"),
    z.literal("cppr"),
    z.literal("returnPerDollar"),
  ]),
  audiences: z.array(FeatureAudienceStatsRowSchema),
  brandProjection: AudienceProjectionSchema.extend({
    lifetimeRevenueUsd: z.coerce.number().nullable(),
  }).optional(),
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
  params?: { groupBy?: string; brandId?: string; offerId?: string; campaignId?: string; workflowSlug?: string; workflowDynastySlug?: string },
  token?: string,
): Promise<FeatureStatsResponse> {
  const query = new URLSearchParams();
  if (params?.groupBy) query.set("groupBy", params.groupBy);
  if (params?.brandId) query.set("brandId", params.brandId);
  // An OFFER narrows the brand to one proposition. features-service refuses an
  // `offerId` stated together with a `campaignId` (400) — a campaign already
  // belongs to exactly one offer, so the pair would be two answers to one
  // question — so a caller states one grain, never both.
  if (params?.offerId) query.set("offerId", params.offerId);
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
    /**
     * The SALES FUNNEL to price the cost columns on — the canonical parameter, and what
     * a CAMPAIGN-scoped surface sends, since a campaign sells exactly one funnel and
     * states which on its own row.
     */
    funnel?: SalesFunnelKeyWire;
    /**
     * DEPRECATED. The retired brand goal, kept only for a caller that still has one.
     * It cannot name a funnel — `reply_meeting` and `visit_meeting` both answer to
     * `meetingBooked` — so prefer `funnel`.
     */
    goal?: FeatureAudienceStatsGoal;
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
    /** Optional OFFER scope. An audience belongs to one proposition, so an
     *  offer-scoped page narrows both the rows and the outreach they are priced
     *  on. Mutually exclusive with `campaignId` (features-service 400s the pair). */
    offerId?: string;
  },
  token?: string,
): Promise<FeatureAudienceStatsResponse> {
  // Sending NEITHER is the BRAND-LEVEL read, and it is a first-class request rather
  // than a missing parameter: features-service then prices every audience through the
  // best-returning funnel the brand declared and sorts on return descending. That is
  // the only honest answer at brand level — a brand runs several funnels at once, so
  // naming one would denominate the whole table in one funnel's terms.
  const query = new URLSearchParams({ brandId: params.brandId });
  if (params.funnel) query.set("funnel", params.funnel);
  else if (params.goal) query.set("goal", params.goal);
  if (params.brandProfileId) query.set("brandProfileId", params.brandProfileId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.statuses) query.set("statuses", params.statuses);
  if (params.offerId) query.set("offerId", params.offerId);
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
/**
 * GET /features/:slug/revenue — expected pipeline revenue for a brand, or for ONE
 * grain under it.
 *
 * `scope` names at most one narrower grain: an OFFER (one proposition) or a
 * CAMPAIGN (one offer x funnel x channel). Stating both is a 400 — a campaign
 * already belongs to exactly one offer, so the pair would be two answers to one
 * question — so this sends whichever the caller asked for and never both.
 */
export async function getFeatureRevenue(
  featureSlug: string,
  brandId: string,
  scope?: { campaignId?: string; offerId?: string },
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId });
  if (scope?.campaignId) query.set("campaignId", scope.campaignId);
  else if (scope?.offerId) query.set("offerId", scope.offerId);
  // pricing=net → every MONEY metric (spend block, costEconomics committedCostUsd,
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
 * An offer's money, ONE ROW PER SALES FUNNEL.
 *
 * The grain under the offer, and the reason it exists: the product sells a funnel one
 * LEG at a time, so a campaign buys a single link and has no return of its own — the
 * lifetime revenue sits at the END of the funnel's steps. The funnel is the finest
 * scope whose money divides into a return at all.
 *
 * ROWS DO NOT SUM TO THE OFFER, deliberately. Money adds (a run belongs to exactly one
 * funnel) but people do not (a lead worked through two funnels is ONE lead to the offer
 * and sits in both rows) and no ratio does. The offer's own read stays the number to
 * trust for "what did this offer do", and `unattributedCampaignIds` names the campaigns
 * whose spend is in the offer and in no row.
 *
 * ⚠️ `costCoverage` states which dollars the cost is made of. It reads
 * `platform_spend_only` today: a funnel whose last legs are worked by the customer's own
 * team reads CHEAPER here than it truly is, because what those legs cost THEM is
 * declared per lead against lead-service and this read does not yet fold it in. The
 * field is on the wire precisely so a consumer states the gap rather than presenting an
 * optimistic return as the whole answer.
 */
/**
 * A channel carrying a funnel, as features-service states it: the feature slug it IS,
 * and the campaigns of this offer running on it.
 *
 * It carries NO display name. A channel's name is resolved from the catalogue this app
 * already fetches, which is where every other surface reads it — asking the producer
 * for a second copy of it is how the two come to disagree.
 */
const OfferFunnelChannelSchema = z.object({
  featureSlug: z.string(),
  campaignIds: z.array(z.string()),
});
/**
 * What the CUSTOMER states their own legs cost them. Never charged, in no ledger of
 * ours, and it never reaches billing.
 *
 * NULL means the statements could not be READ. Zeros mean nobody has stated one. Two
 * different things a reader acts on differently, so they are never collapsed.
 */
const CustomerDeclaredCostSchema = z.object({
  declaredCostUsd: z.number(),
  /** How many statements carried a cost. A stated zero is an answer and is counted. */
  statedCount: z.number(),
  /** How many did not, because nobody was ever asked. Above 0 = cannot be fully costed. */
  unstatedCount: z.number(),
});
const OfferFunnelRowSchema = z.object({
  funnelKey: z.string(),
  name: z.string(),
  steps: z.array(z.string()),
  campaignIds: z.array(z.string()),
  channels: z.array(OfferFunnelChannelSchema),
  /** False leaves every money-derived figure null and names the missing ingredient. */
  priced: z.boolean(),
  unpricedReason: z.string().nullable(),
  headline: z.object({ totalPipelineUsd: z.number().nullable() }),
  /** What the customer was CHARGED. Reported apart, never blended into the block below. */
  costEconomics: z.object({
    committedCostUsd: z.number().optional(),
    costOfAcquisitionPct: z.number().nullable(),
    roiMultiple: z.number().nullable(),
    costPerAcquisitionUsd: z.number().nullish(),
  }),
  customerCost: CustomerDeclaredCostSchema.nullish(),
  /** Which dollars THIS ROW's figures are made of. */
  costCoverage: z.string().nullish(),
  /**
   * The funnel's cost of acquisition WITH the customer's own legs in it, and the return
   * that divides by it. The byte-same three ratios off the summed basis, so with nothing
   * declared this block is identical to the charged one and the whole ladder moves
   * together the day a cost is stated.
   *
   * `.nullish()` for rollout tolerance only: required on the wire today.
   */
  combinedCostEconomics: z
    .object({
      platformCommittedCostUsd: z.number(),
      customerDeclaredCostUsd: z.number(),
      committedCostUsd: z.number(),
      costOfAcquisitionPct: z.number().nullable(),
      roiMultiple: z.number().nullable(),
      costPerAcquisitionUsd: z.number().nullable(),
    })
    .nullish(),
});
const OfferFunnelsResponseSchema = z.object({
  offerId: z.string(),
  brandId: z.string(),
  costBasis: z.string(),
  /** Which dollars the cost is made of. Rendered, never hidden. */
  costCoverage: z.string(),
  funnels: z.array(OfferFunnelRowSchema),
  unattributedCampaignIds: z.array(z.string()),
});
export type OfferFunnelRow = z.infer<typeof OfferFunnelRowSchema>;
export type OfferFunnels = z.infer<typeof OfferFunnelsResponseSchema>;

export async function getOfferFunnels(
  offerId: string,
  brandId: string,
  token?: string,
): Promise<OfferFunnels> {
  const query = new URLSearchParams({ brandId });
  // Same NET basis as every other money read on this app. Never a per-caller toggle.
  query.set("pricing", "net");

  const raw = await apiCall<unknown>(
    `/offers/${offerId}/funnels?${query.toString()}`,
    { token },
  );

  const parsed = OfferFunnelsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferFunnels: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getOfferFunnels: invalid response shape");
  }
  return parsed.data;
}

/**
 * What an OFFER returned — across every acquisition channel it is sold through.
 *
 * The read above names ONE channel, because a feature IS a channel in this fleet.
 * An offer is sold through several at once, so a screen scoped to an offer that
 * asks the per-feature read describes whichever channel it happened to name and
 * understates the offer by whatever the others did. Silently: nothing errors, the
 * figures are simply about less than they claim. Measured on the brand that
 * surfaced this — `$40.07` from the per-feature read against `$50.38` here, on the
 * same day, for the same offer.
 *
 * features-service combines the parts; this only asks. Money adds because a run
 * belongs to exactly one channel, but people do not (a lead worked through two
 * channels is one lead) and no ratio does (a ratio of sums is neither the sum nor
 * the average of ratios) — which is why summing per-channel reads in the browser
 * would be wrong as well as banned.
 *
 * Same body as the per-feature read plus `brandId`, `offerId` and a per-channel
 * `channels` breakdown, minus `featureSlug`. The parser is shared deliberately: the
 * money block a consumer renders is identical, so a second one would be a second
 * place for it to drift. The breakdown is not read yet and is stripped on parse.
 */
export async function getOfferRevenue(
  offerId: string,
  brandId: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId });
  // Same NET basis and the same reason as the per-feature read above — see its
  // comment. Never a per-caller toggle.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(`/offers/${offerId}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getOfferRevenue");
}

/**
 * What ONE SALES FUNNEL of an offer returned.
 *
 * The grain a customer's funnel screen asks about, and the same realized-money answer
 * the offer read gives one level up: the spend breakdown the cost card reads,
 * `roiHistory` over the brand's whole life, the dated series and the leads ledger.
 * features-service prices the funnel on its OWN declared terms, so a $200 self-serve
 * funnel and a $20k contract funnel are never blended.
 *
 * The SAME parser as every other grain. It carries no `featureSlug` — a funnel spans
 * the channels carrying its legs — which is exactly the field that must not be
 * required in a parser shared across grains.
 *
 * A funnel this offer does not sell answers 404 rather than the offer's own numbers
 * under a funnel's name; the caller renders that, never a fabricated zero.
 */
export async function getOfferFunnelRevenue(
  offerId: string,
  funnelKey: string,
  brandId: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ brandId });
  // Same NET basis as every other money read on this app. Never a per-caller toggle.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(
    `/offers/${offerId}/funnels/${encodeURIComponent(funnelKey)}/revenue?${query.toString()}`,
    { token },
  );
  return parseFeatureRevenue(raw, "getOfferFunnelRevenue");
}

/** GET /offers/:offerId/funnels/:funnelKey/pipeline-activity — the funnel's own days. */
export async function getOfferFunnelPipelineActivity(
  offerId: string,
  funnelKey: string,
  params: { brandId: string; days?: number; timezone?: string },
  token?: string,
): Promise<PipelineActivityResponse> {
  const query = new URLSearchParams({ brandId: params.brandId });
  if (params.days != null) query.set("days", String(params.days));
  if (params.timezone) query.set("timezone", params.timezone);
  // Net, for the reason the per-feature reader states at length: the forecast bar
  // divides a budget the org really spends, so a gross divisor understates it.
  query.set("pricing", "net");
  const raw = await apiCall<unknown>(
    `/offers/${offerId}/funnels/${encodeURIComponent(funnelKey)}/pipeline-activity?${query.toString()}`,
    { token },
  );
  const parsed = PipelineActivityResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getOfferFunnelPipelineActivity: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getOfferFunnelPipelineActivity: invalid response shape");
  }
  return parsed.data;
}

/**
 * What a BRAND returned — across every acquisition channel it runs.
 *
 * The offer read above, one level further up, and NOT the sum of it: a brand holds
 * several offers and each runs several channels, so the same non-additivity applies
 * one grain higher and features-service owns it there too.
 *
 * This is what a brand-scoped surface must ask. Asking the per-feature read there
 * is what produced a fraction with two grains in it — one channel's spend over
 * billing's brand-wide ceiling, `$40 / 50` for a brand whose channels had spent
 * $40.07 and $10.32 against their own $40 and $10.
 */
export async function getBrandRevenue(
  brandId: string,
  token?: string,
): Promise<RevenueOverview> {
  const query = new URLSearchParams({ pricing: "net" });
  const raw = await apiCall<unknown>(`/brands/${brandId}/revenue?${query.toString()}`, { token });
  return parseFeatureRevenue(raw, "getBrandRevenue");
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
  // COMMITTED (billed + open holds) — features-service's single spend basis, and the
  // exact number ROI and %CAC divide by, so a row cannot contradict its own return.
  // `.optional()` for rollout tolerance only; it is required on the wire today.
  //
  // The billed-only sibling is deliberately NOT read here and NOT used as a fallback:
  // actual means actual and committed means committed, so rendering billed spend under
  // a committed label would reprint the very contradiction this replaced. Absent →
  // null → the cell reads "—".
  committedCostUsd: z.number().optional(),
  costOfAcquisitionPct: z.number().nullable(),
  roiMultiple: z.number().nullable(),
  expectedConversions: z.number().nullish(),
  costPerConversionUsd: z.number().nullish(),
});
/**
 * The VOLUME half of a campaign group: how much real outcome evidence its money rests on.
 *
 * features-service serves it under its own names (the same block it already serves on
 * `?groupBy=workflow`), so those names are read verbatim rather than renamed here. Only
 * the two counts a consumer gates on are declared — the block carries its own cost
 * figures too, and this repo renders those from `costEconomics` instead, on one basis.
 *
 * NULLISH, and both halves of that are load-bearing. ABSENT covers a producer that
 * predates the block. NULL is the producer's own word, served on a required field, for
 * "no funnel is wired for this channel and the leads were never read" — a state a real
 * brand reaches, because an offer is sold through channels that state sales funnels and
 * have none wired yet (prod: `pr-expert-quote-opportunities`). Reading that as `.optional()`
 * refuses the null, so ONE such channel in an offer's fan-out threw the whole read and
 * blanked every campaign row on the page. Either way the row states its figures exactly
 * as it did before, which is "we cannot tell how thin this is", never "it is fine".
 */
const CampaignRevenueOutcomesSchema = z.object({
  recipientsRepliesPositive: z.number().nullish(),
  recipientsClicked: z.number().nullish(),
  // What this campaign identity paid for one of each, SERVED. The funnel walk states a
  // per-campaign cost from these rather than the funnel-wide rung, so a row's price
  // divides the same spend its `$ Invested` states and the same count in the cell
  // before it. Measured in prod: the rung read $164 (whole funnel, including a
  // feedback-request campaign that produced none) beside $2,889 and 18 on one row.
  cpprCents: z.number().nullish(),
  cpcCents: z.number().nullish(),
});
const FeatureRevenueByCampaignSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({
      campaignId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
      outcomes: CampaignRevenueOutcomesSchema.nullish(),
    }),
  ),
});

export interface CampaignRevenueGroup {
  campaignId: string;
  totalPipelineUsd: number | null;
  /** COMMITTED spend for this campaign — the number ROI and %CAC divide by. Null means
   *  "we have no figure", never "it cost nothing", so the cell reads "—" rather than $0. */
  committedCostUsd: number | null;
  costOfAcquisitionPct: number | null;
  roiMultiple: number | null;
  expectedConversions: number | null;
  costPerConversionUsd: number | null;
  /** Positive replies attributed to this campaign identity. Undefined = the producer did
   *  not answer the volume half, which is not the same as zero. */
  positiveReplies?: number | null;
  /** Website visits attributed to it, same rule. */
  websiteClicks?: number | null;
  /** What one positive reply cost this campaign. Undefined = not answered; null = the
   *  producer measured none, which is not a zero price. */
  cpprCents?: number | null;
  /** What one website visit cost it, same rule. */
  cpcCents?: number | null;
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
    committedCostUsd: g.costEconomics.committedCostUsd ?? null,
    costOfAcquisitionPct: g.costEconomics.costOfAcquisitionPct,
    roiMultiple: g.costEconomics.roiMultiple,
    expectedConversions: g.costEconomics.expectedConversions ?? null,
    costPerConversionUsd: g.costEconomics.costPerConversionUsd ?? null,
    positiveReplies: g.outcomes?.recipientsRepliesPositive,
    websiteClicks: g.outcomes?.recipientsClicked,
    cpprCents: g.outcomes?.cpprCents,
    cpcCents: g.outcomes?.cpcCents,
  }));
}

// ─── Per-offer revenue, at the OFFER grain ───────────────────────────────────
// features-service `GET /brands/:brandId/offers` returns one LEAN row per offer,
// each combined across EVERY acquisition channel that offer is sold through.
//
// The read this replaced was `/features/:slug/revenue?groupBy=offerId`, which
// groups by offer but answers for ONE channel — a feature IS a channel here. So a
// brand running several printed an offer's single-channel figures under the offer's
// name, directly beneath brand cards showing the whole thing. Both real, about
// different things, nothing erroring. Measured on the brand that surfaced it, whose
// one offer runs four channels: $2,625.44 / 2.67x from the old read against
// $2,670.44 / 2.62x here, the second being what the cards above it already said.
//
// features-service combines the channels; nothing is combined here. Money adds
// across an offer's channels because a run belongs to exactly one, but people do
// not (a lead worked through two channels is one lead) and no ratio does (a ratio
// of sums is neither the sum nor the average of ratios).
//
// The gateway path carries the service segment because `/v1/brands/:id/offers` is
// already the brand's offer CATALOG from brand-service — two different questions
// sharing a noun (api-service#855).
const BrandOfferMoneySchema = z.object({
  brandId: z.string(),
  offers: z.array(
    z.object({
      offerId: z.string(),
      headline: z.object({ totalPipelineUsd: z.number().nullable() }),
      costEconomics: CampaignRevenueCostEconomicsSchema,
    }),
  ),
});

export interface OfferRevenueGroup {
  offerId: string;
  totalPipelineUsd: number | null;
  /** COMMITTED spend for this offer — the number ROI and %CAC divide by. Null means
   *  "we have no figure", never "it cost nothing", so the cell reads "—" rather than $0. */
  committedCostUsd: number | null;
  costOfAcquisitionPct: number | null;
  roiMultiple: number | null;
}

/**
 * GET /features/brands/:brandId/offers — one lean money row per offer of a brand,
 * each across every channel it sells through.
 *
 * An EMPTY `offers` array is a real answer and NOT the same as the 404: it means
 * campaign-service lists campaigns for this brand but none states an offer yet.
 */
export async function getBrandOfferMoney(
  brandId: string,
  token?: string,
): Promise<OfferRevenueGroup[]> {
  // Same NET basis as every other money read — coherent with the NET-paced budget.
  const query = new URLSearchParams({ pricing: "net" });
  const raw = await apiCall<unknown>(
    `/features/brands/${encodeURIComponent(brandId)}/offers?${query.toString()}`,
    { token },
  );
  const parsed = BrandOfferMoneySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getBrandOfferMoney: response shape mismatch", {
      issues: parsed.error.issues,
    });
    throw new Error("[dashboard] getBrandOfferMoney: invalid response shape");
  }
  return parsed.data.offers.map((o) => ({
    offerId: o.offerId,
    totalPipelineUsd: o.headline.totalPipelineUsd,
    committedCostUsd: o.costEconomics.committedCostUsd ?? null,
    costOfAcquisitionPct: o.costEconomics.costOfAcquisitionPct,
    roiMultiple: o.costEconomics.roiMultiple,
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
  // pricing=net — the forecast bar is `daily budget / cost per outreach`, and the
  // budget is money the org really spends, i.e. already discounted. Reading the
  // divisor at gross therefore promised a discounted org roughly half the sends
  // its budget buys, right beside actual bars twice as tall (a 50%-off brand read
  // 15.88 expected against 30 real). Net is also what every other money surface on
  // this page asks for — `getFeatureRevenue`, `fetchFeatureAudienceStats` and
  // `getWorkflowProjectionLadder` all send it, and this was the last reader left out.
  query.set("pricing", "net");
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

/** GET /brands/:brandId/runs — returns runs or empty list if brand not found (404) */
export async function listBrandRuns(brandId: string, token?: string): Promise<{ runs: BrandRun[] }> {
  try {
    return await apiCall<{ runs: BrandRun[] }>(`/brands/${brandId}/runs`, { token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { runs: [] };
    throw err;
  }
}

/**
 * Every campaign of a brand, whatever its status.
 *
 * `status` is OMITTED on purpose, and that is what "every status" means to
 * campaign-service. It accepts exactly `ongoing` and `stopped`, and 400s
 * anything else — so the `status=all` this used to send was a value the
 * dashboard invented and the producer never accepted. The 400 surfaced as a 500
 * through the gateway, the query threw, and every surface reading it rendered
 * its empty state: a brand with a live campaign read "No campaign yet".
 *
 * The lesson is the general one about a filter value: an enum belongs to the
 * service that validates it, and "all" is almost never a member — it is the
 * ABSENCE of the filter. Do not reintroduce it here, and do not teach
 * campaign-service to accept it: omitting the parameter already means this.
 */
export async function listCampaignsByBrand(brandId: string, token?: string): Promise<{ campaigns: Campaign[] }> {
  const { campaigns } = await apiCall<{ campaigns: RawCampaign[] }>(
    `/campaigns?brandId=${brandId}`,
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
 * There is NO per-campaign settings write.
 *
 * A campaign used to carry four editable fields — its name, its audiences, its
 * services and its click destination — and each of them is a statement about the
 * OFFER, which has its own Settings page. Editing them per campaign put four
 * copies of the offer's answer one click below the offer itself, and a customer
 * reading two of them had no way to know which one the send would use. They are
 * gone, and `updateCampaign` / `CampaignSettingsPatch` went with them rather than
 * being left unrendered.
 *
 * What IS per-campaign is the money: a campaign is (offer x funnel x channel) and
 * billing keys a ceiling on exactly that triple, so Campaign Settings edits it
 * through `saveBrandFunnelBudget` above — billing's row, not a campaign-service
 * mirror of one.
 *
 * ...and its STATUS, which is `setCampaignStatus` below. That is not one of the
 * four offer fields: whether a campaign runs is a fact about the campaign and
 * nothing else, and it is the one thing an offer-level answer could never state.
 */

/**
 * PATCH /campaigns/:id — start or stop ONE campaign.
 *
 * The whole reason this exists beside `saveBrandFunnelBudget`: stopping a
 * campaign and defunding it are different actions, and only one of them is
 * reversible for free. Dropping a ceiling to zero throws the amount away, and
 * billing's per-funnel floor only lets a funnel funded under its minimum be KEPT
 * or RAISED — so a campaign grandfathered under the floor, stopped that way,
 * could never be restarted at the figure it was running. A status flag keeps the
 * ceiling untouched, so restarting is one click and the amount is still there.
 *
 * campaign-service maps `activate` to `ongoing` and `stop` to `stopped`, and
 * stamps `stopReason: manual` on a stop — which its own code documents as NOT
 * resumable, so nothing brings the campaign back on its own. That is the point:
 * a person stopped it, a person restarts it.
 *
 * ⚠️ `activate` FIRES THE WORKFLOW IMMEDIATELY (`executeCampaignWorkflow` +
 * `wakeScheduler`), so restarting spends now rather than at the next tick. The
 * surface offering it says so.
 *
 * `x-brand-id` / `x-feature-slug` are REQUIRED for an activate: campaign-service
 * validates the workflow's seven tracking headers before flipping the row and
 * 400s naming the missing ones. api-service reads both off the inbound request
 * and forwards them, so they are sent here rather than assumed.
 */
export async function setCampaignStatus(
  campaignId: string,
  status: "activate" | "stop",
  identity: { brandId: string; featureSlug: string },
  token?: string,
): Promise<void> {
  await apiCall<unknown>(`/campaigns/${campaignId}`, {
    token,
    method: "PATCH",
    body: { status },
    headers: {
      "x-run-id": globalThis.crypto.randomUUID(),
      "x-brand-id": identity.brandId,
      "x-feature-slug": identity.featureSlug,
    },
  });
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
  /**
   * The OFFER this lead belongs to — the offer named by the CAMPAIGN it was
   * served under, resolved by lead-service off the attribution it froze on the
   * membership row. Read straight from the wire, never joined here: the
   * dashboard holds neither the campaign→offer map nor the offer's name, and
   * the Audience field above is the precedent for why a client-side join is the
   * wrong layer even when it is possible.
   *
   * `null` = the campaign names no offer (a campaign that stopped before offers
   * existed), or lead-service could not resolve one — it is fail-soft there, so
   * an absent offer is "we could not say", never "there is none". Either way
   * the section is dropped rather than showing a guess.
   *
   * `name` can be null on a present id: lead-service states the id it was given
   * even when brand-service does not list the offer back. Render the id's
   * section without a name rather than hiding a real attribution.
   *
   * Optional because `LeadDeliverySchema.passthrough()` keeps it at runtime and
   * a lead read before lead-service v0.55.0 carries none.
   */
  offer?: { id: string; name: string | null } | null;
  /**
   * WHERE THIS PERSON STANDS on the campaign they were served under, decided by
   * lead-service (v0.64.0) and by nobody else.
   *
   * The leads board renders `standing.state` instead of deriving one from the reply
   * signals below. Those signals stay on the wire and stay read — they are what the
   * table's status badge and the lead panel's timeline are about — but "is this
   * person still a live prospect" is commercial policy, it is funnel-aware, and it
   * has ONE owner now. See `lib/lead-standing.ts` for why.
   *
   * OPTIONAL, and only that: a payload written before v0.64.0 carries none, which in
   * practice is a snapshot restored from the local-first cache for the second before
   * the poll lands. Its FIELDS are required-and-nullable, so they are `T | null` and
   * never `.optional()` — the producer means to send those nulls.
   */
  standing?: LeadStanding | null;
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

/**
 * When the status the badge SHOWS actually happened.
 *
 * The leads table's Date column is per-TAB (Outreach reads the first-contacted
 * timestamp for every row it lists), while the badge states the lead's
 * most-advanced state — so a row reading "Replied" sat next to a contact date
 * from days earlier, two numbers about two different events with nothing on the
 * row saying so. The Status cell states its own date instead, taken from the
 * same status it renders.
 *
 * Exhaustive over `LeadConsolidatedStatus`, so a new status cannot ship without
 * deciding which timestamp proves it. The three pre-serve states carry no
 * timestamp on the wire and return null: the cell then renders nothing, because
 * a dash reads as a value we looked for and found empty.
 */
export function leadDateForStatus(lead: Lead, status: LeadConsolidatedStatus): string | null {
  switch (status) {
    case "replied": return lead.firstRepliedAt ?? null;
    case "clicked": return lead.firstClickedAt ?? null;
    case "delivered": return lead.firstDeliveredAt ?? null;
    case "sent": return lead.firstSentAt ?? null;
    case "bounced": return lead.firstBouncedAt ?? null;
    case "unsubscribed": return lead.firstUnsubscribedAt ?? null;
    case "contacted": return lead.firstContactedAt ?? null;
    case "served": return lead.servedAt;
    case "skipped":
    case "claimed":
    case "buffered":
      return null;
  }
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
    // The two fields the BOARD dereferences, validated for the same reason the
    // booleans above are: a 200 whose standing is the wrong shape must fail loudly
    // rather than place every card in "Not placed".
    //
    // `z.string()`, never `z.enum`: lead-service owns this vocabulary and can widen it
    // before this app ships, and closing the set here would turn a state it ADDS into
    // a thrown parse — which reveal-on-settle paints as headings with nothing under
    // them. `leadBoardColumnFor` renders a word it does not know as "we cannot place
    // this", which is the honest read and costs nobody the page.
    //
    // `.optional()` on the OBJECT (a payload written before lead-service v0.64.0
    // carries none) but never on its fields, which the producer marks required — most
    // of them nullable, so `.nullable()` is what those need, and they ride the
    // passthrough rather than being restated.
    standing: z
      .object({ state: z.string(), signal: z.string() })
      .passthrough()
      .nullish(),
  })
  .passthrough();

const ListLeadsResponseSchema = z.object({ leads: z.array(LeadDeliverySchema) });

/**
 * Exported so a guard can run the REAL parser over a REAL body — a claim that a field
 * survives the parse is a claim about what this function returns, and reading the
 * schema back is not evidence of it.
 */
export function parseLeadsResponse(raw: unknown, fn: string): { leads: Lead[] } {
  const parsed = ListLeadsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[dashboard] ${fn}: response shape mismatch`, { issues: parsed.error.issues, raw });
    throw new Error(`[dashboard] ${fn}: invalid response shape`);
  }
  // `.passthrough()` preserves every field at runtime; the validated subset
  // doesn't structurally overlap the full Lead type, so cast through unknown.
  return parsed.data as unknown as { leads: Lead[] };
}

// `view=basic` returns the slim lead projection (thin person + thin org, no
// employmentHistory / extra org columns). Both readers feed the SAME
// `EngagedLeadsPage`, which renders its table, status tabs, search and detail
// panel from thin fields only — so neither scope has a use for the full one.
//
// The campaign read went without it for as long as a campaign scope meant one
// stored campaign row and a handful of leads. lead-service now answers a
// campaign-scoped read for the whole campaign IDENTITY, so its size matches the
// brand's: one production brand measured 53,777 rows / 156 MB / 54s on the full
// projection against 102 MB / 6.6s on the slim one. The page polls this every
// 30 seconds per open tab, and the gateway used to buffer the whole body into
// memory, which is what OOM-crash-looped api-service.
// Requires api-service to forward the `view` param.
// See shamanic-technologies/distribute.you#1620.
export async function listCampaignLeads(campaignId: string, token?: string): Promise<{ leads: Lead[] }> {
  const raw = await apiCall<unknown>(`/leads?campaignId=${campaignId}&view=basic`, { token });
  return parseLeadsResponse(raw, "listCampaignLeads");
}

export async function listBrandLeads(brandId: string, token?: string): Promise<{ leads: Lead[] }> {
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

// Manual reply qualifications (api-service proxy → email-gateway → instantly-service).
// Wire shape is snake_case (request) + camelCase (response) per the upstream contract;
// helpers below translate camelCase request inputs to snake_case query / body.
/**
 * What a person states about a reply, as instantly-service accepts it on the write.
 *
 * The nine REPLY KINDS, plus the two retired deal-progress spellings it still accepts
 * while the consoles migrate their pickers. This app writes only reply kinds; the two
 * retired values are here so a historical row still types, and they resolve to a reply
 * kind upstream at WRITE time, never on read.
 *
 * `lead_meeting_booked` and `lead_closed` are facts about the DEAL, not the reply, and
 * they are stated on the funnel stages instead (see `lead-funnel-stages.ts`). They used
 * to share this one statement per lead, where only the latest survived — so booking a
 * meeting erased the reply sentiment that led to it.
 */
/**
 * ⚠️ READ from the one catalogue, never re-listed. This used to spell the nine reply
 * kinds out again, which is a second copy of a vocabulary instantly-service owns — and
 * it had already gone stale: `lead_changed_job` shipped upstream and this list did not
 * carry it, so a person who had left the role could not be stated even though the
 * gateway would have accepted the write. A copy of somebody else's enum rots in the
 * direction that silently removes a capability.
 */
export type ManualQualificationStatus =
  | ReplyKind
  // Retired, accepted upstream during the migration. Do NOT write these.
  | "lead_meeting_booked"
  | "lead_closed";

export type ManualQualificationClassification = "positive" | "negative" | "neutral";

export interface ManualQualification {
  id: string;
  orgId: string;
  campaignId: string;
  instantlyCampaignId: string;
  email: string;
  /** The RAW statement a person made. Kept as provenance; not what to render. */
  status: ManualQualificationStatus;
  /**
   * What kind of reply that statement resolves to (instantly-service v0.74.0). This is
   * the value to render: the two retired deal-progress spellings still accepted on the
   * write path are resolved to a reply kind HERE, at write, so a reader never has to
   * translate one. Distinct from `status` rather than a rename of it — both are served,
   * they mean different things, and coalescing them would render one under the other's
   * name. Optional only because an older row predates the column.
   */
  replyKind?: string;
  qualifiedBy: string;
  notes: string | null;
  qualifiedAt: string;
  /**
   * When a person TOOK THIS BACK, or null while it still stands (instantly-service
   * v0.75.1). The list serves withdrawn statements alongside standing ones — they are
   * the audit of what was asserted — so a reader that takes the newest row verbatim
   * renders a kind nobody stands behind. Filter on this, never on recency alone.
   *
   * `.optional()` in spirit: a row written before the column existed carries neither
   * field, which reads as standing, exactly as it did before withdrawal existed.
   */
  withdrawnAt?: string | null;
  withdrawnBy?: string | null;
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

/**
 * Take back the standing reply-kind statement for one (campaign, lead) pair.
 *
 * The undo for the write above. Picking the wrong kind was permanent: the vocabulary has
 * no "nothing stated" member, the store is append-only, and the write is idempotent on
 * the current value, so re-picking the same kind was a no-op rather than a way back.
 *
 * Afterwards the lead reads as it did before anybody spoke — no standing human statement
 * — and the AUTOMATIC classification takes over again, because the manual pin that kept
 * later webhook events from reclassifying the reply is released.
 *
 * NOT an erasure: nothing is deleted and no sentinel kind enters the vocabulary. It also
 * does not retract the separate fact that a reply ARRIVED, nor undo the sequence stop a
 * stopping statement already caused — those are actions already taken.
 *
 * 404 `no_standing_qualification` when nothing stands (never stated, or already
 * withdrawn — withdrawing twice is that same refusal, not a success).
 */
export async function withdrawManualQualification(
  body: { campaignId: string; email: string; notes?: string },
  token?: string,
): Promise<{ qualification: ManualQualification }> {
  return apiCall<{ qualification: ManualQualification }>(
    "/emails/manual-qualifications/withdrawals",
    {
      token,
      method: "POST",
      body: {
        campaign_id: body.campaignId,
        email: body.email,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    },
  );
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


/**
 * Record that a named person asked us to stop being contacted, and how they said it.
 *
 * ⚠️ SCOPED TO THE PERSON, not to a campaign — which is why this body carries no
 * campaign id even though the board card that triggers it belongs to one. Honouring
 * "stop contacting me" in one campaign while another keeps sending is precisely the
 * outcome the law cares about (CAN-SPAM, GDPR), so instantly-service applies it to
 * every campaign the org holds for that address.
 *
 * It STOPS THE SENDING as well as recording the statement: the sequence is stopped, the
 * open holds are cancelled, and the campaign is paused at the sender. A clicked
 * unsubscribe gets that last part for free because the provider served the link; a
 * statement made over SMS or on a call does not, so it is done explicitly.
 *
 * Idempotent: a person who already has a standing opt-out writes nothing and fires no
 * side effect a second time (`idempotent: true` on the response). The record is written
 * even when the org holds no campaign for the address — refusing to record a consent
 * statement because we have nothing to stop is the wrong direction to be wrong in, and
 * the response then reports `campaignsAffected: 0`.
 */
export async function recordLeadOptOut(
  body: { email: string; channel: OptOutChannel; notes?: string },
  token?: string,
): Promise<RecordLeadOptOutResponse> {
  return apiCall<RecordLeadOptOutResponse>("/emails/opt-outs", {
    token,
    method: "POST",
    body: {
      email: body.email,
      channel: body.channel,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
}

/**
 * Take back an opt-out somebody recorded — the wrong lead, or a person who has since
 * asked to be contacted again.
 *
 * NOT an erasure. The withdrawal is appended, the original record stands as the audit of
 * what was asserted, and only the unsubscribe events THIS record produced are released —
 * an unsubscribe the prospect produced by clicking the link is never touched, because
 * nobody withdrew that.
 *
 * ⚠️ It does NOT resume the sequences that were stopped. The holds were cancelled and the
 * campaigns paused, and silently restarting outreach at somebody who asked us to stop is
 * the one mistake worth being unable to make by accident. A new send is a new decision.
 *
 * 404 `no_standing_optout` when nothing stands (never recorded, or already withdrawn —
 * withdrawing twice is that same refusal, not a success).
 */
export async function withdrawLeadOptOut(
  body: { email: string; notes?: string },
  token?: string,
): Promise<{ optOut: LeadOptOut }> {
  return apiCall<{ optOut: LeadOptOut }>("/emails/opt-outs/withdrawals", {
    token,
    method: "POST",
    body: {
      email: body.email,
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });
}

/** One recorded opt-out, as the consent record it is: who, when, and through what. */
export interface LeadOptOut {
  id: string;
  email: string;
  channel: string;
  notes: string | null;
  recordedBy?: string;
  recordedAt?: string;
  withdrawnAt?: string | null;
}

export interface RecordLeadOptOutResponse {
  /** True when a standing opt-out already existed — nothing written, nothing re-fired. */
  idempotent: boolean;
  /** Campaigns of this org holding that address. */
  campaignsAffected: number;
  /**
   * How many of them could be stopped AT THE SENDER. Below `campaignsAffected` means a
   * pause failed upstream and was logged; the local stop and the record still hold.
   */
  campaignsStopped: number;
  optOut: LeadOptOut;
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
 * because a COLD Neon path (api→features→workflow/runs/email-gateway/brand, all scale-to-zero)
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
    /** The funnel this surface sells, when it states one. Wins over `objective` at the
     *  producer, which is the whole point: a campaign runs exactly ONE funnel, and the
     *  objective it derives from a goal cannot say which of the two meeting funnels that
     *  is. Absent on a brand-level surface, which states no funnel by design. */
    funnel?: SalesFunnelKeyWire;
    budgetUsd?: number;
  },
  token?: string,
): Promise<WorkflowProjectionResponse> {
  const ladder = await getWorkflowProjectionLadder(
    {
      featureSlug: params.featureSlug,
      brandId: params.brandId,
      objective: params.objective,
      funnel: params.funnel,
    },
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

// Every row reaching this schema is MEASURED — `measuredProjectionRows` drops the
// unmeasured ones on the way in, so `measured` itself is deliberately NOT declared here
// (it would parse as an always-true field nothing may branch on). That also means
// `resolved.grain` / `resolved.costPerClickUsd` stay non-nullable: only an unmeasured row
// nulls them, and one never gets this far.
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
  /** The SALES FUNNEL the projection was priced on — present ONLY on a `?funnel=`
   *  request, and the authoritative answer to what was priced. The two meeting
   *  funnels carry the SAME `goal`/`objective` echo and DIFFERENT numbers, which is
   *  why the goal is retired as an identity: reading the echo tells you nothing
   *  about which funnel produced the money. Declared here or zod STRIPS it. */
  funnelKey: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  /** MEASURED rows only. An UNMEASURED row (`measured: false`) is the backend's own
   *  serving affordance — an explore allowance so an active workflow with no history is
   *  reachable and can earn a first run — and it is the CHEAPEST row by construction,
   *  with no grain and no return. Ranking it would hand the "Your best model" headline
   *  to an unproven workflow. Dropped HERE, before the row schema, so every surface
   *  reads evidence-backed rows and no consumer type has to model a null grain. See
   *  lib/workflow-projection-measured.ts. */
  rows: z.preprocess(measuredProjectionRows, z.array(WorkflowProjectionRowSchema)),
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
    /**
     * The SALES FUNNEL to price on — the ONLY param that separates a meeting bought
     * with a positive reply from one bought with a click onto the site. A goal cannot:
     * `reply_meeting` and `visit_meeting` both echo `meetingBooked`, so a goal-keyed
     * request is priced from BOTH channels at once (its outcome count is literally
     * `clicks·visitToMeeting + replies·replyToMeeting`). Per dollar that buys ~86×
     * more clicks than replies, so the click leg supplies nearly every projected
     * outcome — and both the RANKING (`recommendedWorkflowDynastySlug` is an argmin on
     * that mixed cost) and the economics then describe the website funnel. A brand
     * selling through conversation read `$26` per meeting and `26.8×` return where its
     * own reply funnel gives `$283` and `2.1×`. features-service wins `funnel` over
     * `goal`, so send this and nothing else; a funnel the brand never declared 404s
     * rather than being silently priced.
     */
    funnel?: SalesFunnelKeyWire;
    /**
     * DEPRECATED — the retired vocabulary, kept only for the brand-level callers that
     * state no funnel (a brand sells through several at once, so no single funnel
     * describes it) and for the legacy `getWorkflowProjection` wrapper. A surface that
     * KNOWS its funnel must send `funnel` and neither of these. Removing them outright
     * would not make those callers funnel-aware, it would silently drop them onto
     * features-service's `meeting-booked` default — a worse wrong number than the one
     * they send today. They go when the last sender does.
     */
    goal?: FeatureAudienceStatsGoal;
    /** DEPRECATED — see `goal`. */
    objective?: SalesObjective | string;
    audienceId?: string;
  },
  token?: string,
): Promise<WorkflowProjectionLadderResponse> {
  const query = new URLSearchParams();
  query.set("brandId", params.brandId);
  // funnel WINS over goal/objective at the producer, so a caller that states one gets
  // its own funnel priced whatever else it sends.
  if (params.funnel) query.set("funnel", canonicalSalesFunnelKey(params.funnel));
  if (params.goal) query.set("goal", params.goal);
  if (params.objective) query.set("objective", params.objective);
  if (params.audienceId) query.set("audienceId", params.audienceId);
  // pricing=net — MUST match `fetchFeatureAudienceStats`. At 0 outcomes a
  // per-audience cost floors at max(own spend, best-workflow fleet cost), and
  // that fleet cost is the very number this ladder serves, so the Audiences
  // table and the Strategy page render the SAME benchmark. Omitting pricing
  // here defaulted the ladder to GROSS while audience-stats asked for NET, so
  // one benchmark showed at two prices (~9% apart once other orgs' frozen usage
  // discounts land in the fleet spend). Net is also what the org actually pays.
  query.set("pricing", "net");
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

// Create campaign
//
// `funnelKey` states which sales funnel the campaign sells, and it is REQUIRED
// rather than optional so a new caller has to answer the question: a sales
// campaign is paced on that funnel's own ceiling in billing and priced on its own
// economics, and campaign-service 400s one that states none. A feature that sells
// through no sales funnel (PR, hiring, VC, AI visibility) states an explicit null.
export async function createCampaignWithoutBrandEnrichment(
  params: {
    name: string;
    workflowSlug: string;
    // Exactly one of brandUrls (website brand) or brandIds (no-website brand,
    // already created by name) — the gateway resolves/forwards accordingly.
    brandUrls?: string[];
    brandIds?: string[];
    // Which sales funnel this campaign sells — required for the same reason as on
    // createCampaign above; an explicit null means it sells through none.
    funnelKey: SalesFunnelKeyWire | null;
    // The single funnel LEG this campaign is bought for, as features-service spells it.
    // A campaign is (brand x offer x channel x leg) and the leg is the richest of the
    // four: the funnel cannot name which arrow of itself a campaign performs. NULL is
    // legitimate — campaign-service reads such a campaign exactly as it reads every one
    // created before the column existed — so this states the leg when the launch could
    // resolve one and says nothing rather than guessing when it could not.
    legKey?: string | null;
    // There is deliberately no maxBudget* field here. A sales campaign's money is
    // billing's, stated per (sales funnel, acquisition channel, offer) on the
    // brand's daily ceilings, and campaign-service 400s a sales-family campaign
    // that states a per-campaign ceiling. Declaring the fields invited a caller
    // to send one; the only caller did, and every launch failed.
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
// The org's own credit-grants ledger: welcome gift, staff bonuses, referral
// credits, promo redemptions. Source: billing-service
// GET /v1/credits/grants (scoped to x-org-id) via api-service gateway
// GET /v1/billing/credits/grants. `reason` is the grant kind (welcome,
// admin_grant, invite_*) or a promo code; `amountCents` is a
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

// --- Referral invites ---------------------------------------------------------
//
// The invite code is the org's slug, owned by client-service and reached through
// the gateway's org-scoped passthrough. BOTH routes take the org's INTERNAL UUID
// in the path (verified against the deployed registry: "Org UUID (must match
// authenticated org)"), NOT the Clerk org id the dashboard URL carries — so the
// caller sources it from `BillingAccount.org_id`, which is already fetched on
// every dashboard page and therefore dedupes.
//
// The gateway is a passthrough and publishes no response schema for either
// route, so these readers conform to what client-service actually serves and
// declare everything they do not themselves need as optional. That is
// load-bearing right now: a sibling workspace is lifting the three-invite cap,
// which retires the quota fields. Only `code` is required, because only `code`
// builds the link.

export interface InviteStatus {
  /** The org's own invite code. */
  code: string;
}

const InviteStatusResponseSchema = z
  .object({
    code: z.string(),
    // Quota fields from the capped era. Optional on purpose: the cap is being
    // lifted, and a reader that required them would break the moment it lands.
    used: z.number().optional(),
    total: z.number().optional(),
    expired: z.boolean().optional(),
  })
  .passthrough();

/** GET /orgs/:orgId/invites/status — this org's referral code. `orgId` is the internal UUID. */
export async function getInviteStatus(orgId: string, token?: string): Promise<InviteStatus> {
  const raw = await apiCall<unknown>(`/orgs/${encodeURIComponent(orgId)}/invites/status`, {
    token,
  });
  const parsed = InviteStatusResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getInviteStatus: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getInviteStatus: invalid response shape");
  }
  return { code: parsed.data.code };
}

/**
 * POST /orgs/:orgId/invites/claim — record that this org signed up through `code`.
 *
 * The response is not read. What matters is whether it succeeded, because that
 * is what decides if the stored code may be dropped (see `isTerminalClaimRejection`
 * in lib/invite-link). Errors propagate as `ApiError` carrying the status.
 */
export async function claimInvite(orgId: string, code: string, token?: string): Promise<void> {
  await apiCall<unknown>(`/orgs/${encodeURIComponent(orgId)}/invites/claim`, {
    method: "POST",
    body: { code },
    token,
  });
}

export interface InviteValidation {
  valid: boolean;
  /** The inviter's org name, when client-service has one. Usually absent. */
  inviterOrgName: string | null;
}

const ValidateInviteResponseSchema = z
  .object({ valid: z.boolean(), inviterOrgName: z.string().optional() })
  .passthrough();

/**
 * POST /invites/validate — is this code owned by a real org?
 *
 * Used before onboarding promises a referred signup the larger total, so the
 * promise is only ever made on a code that resolves. Since the invite cap was
 * lifted, `valid: false` means one thing only: no org owns this code.
 *
 * The gateway route is public, so this works before the org exists.
 */
export async function validateInvite(code: string, token?: string): Promise<InviteValidation> {
  const raw = await apiCall<unknown>("/invites/validate", {
    method: "POST",
    body: { code },
    token,
  });
  const parsed = ValidateInviteResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] validateInvite: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] validateInvite: invalid response shape");
  }
  return { valid: parsed.data.valid, inviterOrgName: parsed.data.inviterOrgName ?? null };
}

// --- Free-credit promises -----------------------------------------------------
//
// Every free credit this org is still WAITING on: the welcome remainder, plus a
// $500 promise for each converting referral. A promise is a promise, not money —
// billing keeps it out of `credited` / `balance` / spendable until it is granted,
// so this never double-counts against the balance shown beside it.
//
// Shape conforms to the deployed billing-service route (verified in the prod
// registry, v0.59.0). Cents are STRINGS on this wire, as everywhere in billing.

export interface FreeCreditPromise {
  id: string;
  /** Which offer opened it, e.g. the welcome remainder or a referral reward. */
  kind: string;
  amountCents: string;
  /** Cumulative payments that unlock it. */
  paidTriggerCents: string;
  paidSoFarCents: string;
  remainingToUnlockCents: string;
  progressPct: number;
  /** The org whose conversion opened this promise, when it came from a referral. */
  referredOrgId: string | null;
  /** The org that referred us, on the invitee's own referral promise. */
  referrerOrgId: string | null;
  /**
   * Display identity for the org named above, so a row can show WHO earned it
   * rather than three identical $500 lines. Optional because billing resolves it
   * in a follow-up: absent until that ships, and absent for good whenever the
   * other org has no brand to resolve. Never fabricated, so a missing name simply
   * renders no name.
   */
  referredOrgName?: string | null;
  referredOrgDomain?: string | null;
  createdAt: string;
}

const FreeCreditPromiseSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    amount_cents: z.string(),
    paid_trigger_cents: z.string(),
    paid_so_far_cents: z.string(),
    remaining_to_unlock_cents: z.string(),
    progress_pct: z.coerce.number(),
    referred_org_id: z.string().nullable(),
    referrer_org_id: z.string().nullable(),
    // Additive, shipping in a billing follow-up. Optional so this reader works
    // against both the current deploy and the next one, with no rollout gate.
    referred_org_name: z.string().nullable().optional(),
    referred_org_domain: z.string().nullable().optional(),
    created_at: z.string(),
  })
  .passthrough();

const FreeCreditPromisesResponseSchema = z.object({
  org_id: z.string(),
  paid_topups_cents: z.string(),
  // The TOTAL still outstanding across the promises below, summed by billing on
  // the same basis and in the same units as the rows it ships with, so a heading
  // reading this can never disagree with the list under it. Optional because it
  // is additive and shipped after the rows did; absent simply means the deploy
  // serving this body predates it. Never summed here.
  outstanding_total_cents: z.string().optional(),
  promises: z.array(FreeCreditPromiseSchema),
});

/** GET /billing/free-credit-promises — the free credits this org is still waiting on. */
export async function getFreeCreditPromises(
  token?: string,
): Promise<{
  paidTopupsCents: string;
  outstandingTotalCents: string | null;
  promises: FreeCreditPromise[];
}> {
  const raw = await apiCall<unknown>("/billing/free-credit-promises", { token });
  const parsed = FreeCreditPromisesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getFreeCreditPromises: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getFreeCreditPromises: invalid response shape");
  }
  return {
    paidTopupsCents: parsed.data.paid_topups_cents,
    outstandingTotalCents: parsed.data.outstanding_total_cents ?? null,
    promises: parsed.data.promises.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountCents: p.amount_cents,
      paidTriggerCents: p.paid_trigger_cents,
      paidSoFarCents: p.paid_so_far_cents,
      remainingToUnlockCents: p.remaining_to_unlock_cents,
      progressPct: p.progress_pct,
      referredOrgId: p.referred_org_id,
      referrerOrgId: p.referrer_org_id,
      referredOrgName: p.referred_org_name ?? null,
      referredOrgDomain: p.referred_org_domain ?? null,
      createdAt: p.created_at,
    })),
  };
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
  // Settled refunds + lost disputes on this payment, minor units. Stripe leaves a
  // refunded payment `succeeded` at its full amount, so this is the only signal
  // that the money came back. See lib/payment-return.ts.
  amountReturnedCents: number;
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
    // stripe-service v0.27.0 derives this on every mirrored PaymentIntent. Required
    // on purpose: an absent value would silently read as "nothing came back", which
    // is exactly the wrong story to tell. Absent => loud shape mismatch.
    amount_returned: z.coerce.number(),
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
    amountReturnedCents: pi.amount_returned,
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

/**
 * How this org's customer adds a card.
 *
 * Not a URL, because not every payment provider does this the same way: some
 * host a page we redirect to, others have no hosted page at all and save a card
 * only through a widget this app mounts itself. The backend resolves which one
 * applies and describes the mechanism; the UI switches on `mode` and never
 * needs to know which provider is behind it.
 *
 * The hosted case still carries `url` where it always did, so this stayed
 * backwards compatible while the backend rolled out.
 */
export type CardSetup =
  | { object: "card_setup"; mode: "hosted_redirect"; url: string }
  | {
      object: "card_setup";
      mode: "embedded_widget";
      public_key: string;
      token: string;
      save_payment_method_for: "merchant";
      /** Prefilled so the provider does not ask for what we already know. */
      customer_name?: string | null;
      customer_email?: string | null;
    };

export async function createPortalSession(
  returnUrl: string,
  token?: string
): Promise<CardSetup> {
  return apiCall<CardSetup>("/billing/portal-sessions", {
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

