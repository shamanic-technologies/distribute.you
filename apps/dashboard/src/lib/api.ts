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

async function apiCall<T>(endpoint: string, options?: ApiOptions): Promise<T> {
  const { token, method = "GET", body, headers: extraHeaders } = options ?? {};

  const headers: Record<string, string> = { "Content-Type": "application/json", ...extraHeaders };
  let url: string;

  if (token) {
    url = `${API_URL}/v1${endpoint}`;
    headers["X-API-Key"] = token;
  } else {
    url = `/api/v1${endpoint}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
    if (response.status === 402 && typeof window !== "undefined") {
      const { dispatchPaymentRequired } = await import("@/lib/billing-guard");
      dispatchPaymentRequired({
        balance_cents: errorBody.balance_cents,
        required_cents: errorBody.required_cents,
        error: errorBody.error,
      });
    }
    throw new ApiError(
      errorBody.error || errorBody.message || "Request failed",
      response.status,
      errorBody
    );
  }

  return response.json();
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
  token?: string
): Promise<unknown> {
  return apiCall<unknown>("/emails/send", {
    token,
    method: "POST",
    body: { eventType, metadata: { timestamp: new Date().toISOString() } },
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
  brandUrls: string[];
  featureInputs: Record<string, string> | null;
  maxBudgetDailyUsd: string | null;
  maxBudgetWeeklyUsd: string | null;
  maxBudgetMonthlyUsd: string | null;
  maxBudgetTotalUsd: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApolloStats {
  enrichedLeadsCount: number;
  searchCount: number;
  fetchedPeopleCount: number;
  totalMatchingPeople: number;
}

export interface CostByName {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  totalQuantity: string;
}

export interface CampaignStats {
  campaignId: string;
  totalCostInUsdCents?: string | null;
  costBreakdown?: CostByName[];
  leadsServed: number;
  leadsBuffered: number;
  leadsSkipped: number;
  apollo?: ApolloStats;
  emailsGenerated: number;
  emailsContacted: number;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  // Reply classifications
  repliesWillingToMeet?: number;
  repliesInterested?: number;
  repliesNotInterested?: number;
  repliesOutOfOffice?: number;
  repliesUnsubscribe?: number;
}

export async function listCampaigns(token?: string): Promise<{ campaigns: Campaign[] }> {
  return apiCall<{ campaigns: Campaign[] }>("/campaigns", { token });
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
  emailsContacted: number;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  repliesWillingToMeet: number;
  repliesInterested: number;
  repliesNotInterested: number;
  repliesOutOfOffice: number;
  repliesUnsubscribe: number;
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

export async function getBrandCostBreakdown(brandId: string, opts?: { featureDynastySlug?: string }, token?: string): Promise<{ costs: CostByName[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "costName" });
  if (opts?.featureDynastySlug) query.set("featureDynastySlug", opts.featureDynastySlug);
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
  featureDynastySlug: string | null;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostsByFeature(brandId: string, token?: string): Promise<{ groups: FeatureCostGroup[] }> {
  const query = new URLSearchParams({ brandId, groupBy: "featureDynastySlug" });
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?${query}`, { token });
  return {
    groups: result.groups.map((g) => ({
      featureDynastySlug: g.dimensions.featureDynastySlug ?? null,
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

export async function stopCampaign(campaignId: string, token?: string): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>(`/campaigns/${campaignId}/stop`, { token, method: "POST" });
}


// Brands
export interface Brand {
  id: string;
  domain: string | null;
  name: string | null;
  brandUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logoUrl: string | null;
  elevatorPitch: string | null;
}

export interface BrandDetail extends Brand {
  bio: string | null;
  mission: string | null;
  location: string | null;
  categories: string | null;
}

export async function listBrands(token?: string): Promise<{ brands: Brand[] }> {
  return apiCall<{ brands: Brand[] }>("/brands", { token });
}

/** GET /brands/:brandId — returns brand detail or null if not found (404/500 from missing brand) */
export async function getBrand(brandId: string, token?: string): Promise<{ brand: BrandDetail } | null> {
  try {
    return await apiCall<{ brand: BrandDetail }>(`/brands/${brandId}`, { token });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 500)) return null;
    throw err;
  }
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
  token?: string,
): Promise<ExtractFieldsResponse> {
  return apiCall<ExtractFieldsResponse>(
    `/brands/extract-fields`,
    { token, method: "POST", body: { brandIds, fields } },
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
  featureDynastySlug: string,
  brandIds: string[],
  token?: string,
): Promise<PrefillResponse> {
  return apiCall<PrefillResponse>(
    `/features/${featureDynastySlug}/prefill?format=text`,
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

export interface FeatureRef {
  id: string;
  slug: string;
  status: "active" | "draft" | "deprecated";
}

export interface Feature {
  id: string;
  slug: string;
  name: string;
  dynastyName?: string;
  dynastySlug?: string;
  version?: number;
  description: string;
  icon?: string;
  category: string;
  channel: string;
  audienceType: string;
  status: "active" | "draft" | "deprecated";
  implemented: boolean;
  displayOrder?: number;
  inputs: FeatureInput[];
  outputs: FeatureOutput[];
  charts: FeatureChart[];
  entities: FeatureEntity[];
  forkedFrom?: FeatureRef;
  upgradedTo?: FeatureRef;
}

/** 200 = metadata-only update; 201 = inputs/outputs changed, feature was forked */
export type UpdateFeatureResult =
  | { feature: Feature; forkedFrom?: undefined }
  | { feature: Feature; forkedFrom: FeatureRef };

// ─── Stats Registry & Stats Types ────────────────────────────────────────────

export interface StatsRegistryEntry {
  type: "count" | "rate" | "currency";
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
  featureDynastySlug?: string;
  systemStats: SystemStats;
  stats: Record<string, number>;
}

export interface FeatureStatsResponse {
  featureSlug: string;
  groupBy?: string;
  systemStats: SystemStats;
  stats?: Record<string, number>;
  groups?: StatsGroup[];
}

export interface GlobalStatsResponse {
  groupBy?: string;
  systemStats: SystemStats;
  stats?: Record<string, number>;
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

/** GET /features/:slug — get a single feature */
export async function getFeature(slug: string, token?: string): Promise<{ feature: Feature }> {
  return apiCall<{ feature: Feature }>(`/features/${slug}`, { token });
}

/** POST /features — create a new feature */
export async function createFeature(
  params: {
    name: string;
    description: string;
    icon: string;
    category: string;
    channel: string;
    audienceType: string;
    inputs: FeatureInput[];
    outputs: FeatureOutput[];
    charts: FeatureChart[];
    entities: FeatureEntity[];
    slug?: string;
  },
  token?: string,
): Promise<{ feature: Feature }> {
  return apiCall<{ feature: Feature }>("/features", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

/** PUT /features/:slug — update an existing feature.
 *  Returns 200 for metadata-only updates, 201 when inputs/outputs changed (fork). */
export async function updateFeature(
  slug: string,
  params: Partial<{
    name: string;
    description: string;
    icon: string;
    category: string;
    channel: string;
    audienceType: string;
    inputs: FeatureInput[];
    outputs: FeatureOutput[];
    charts: FeatureChart[];
    entities: FeatureEntity[];
    status: "active" | "draft" | "deprecated";
  }>,
  token?: string,
): Promise<UpdateFeatureResult> {
  return apiCall<UpdateFeatureResult>(`/features/${slug}`, {
    token,
    method: "PUT",
    body: params as unknown as Record<string, unknown>,
  });
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
  featureDynastySlug: string,
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
  return apiCall<FeatureStatsResponse>(`/features/${featureDynastySlug}/stats${qs ? `?${qs}` : ""}`, { token });
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

/** GET /brands/:brandId/runs — returns runs or empty list if brand not found (404/500) */
export async function listBrandRuns(brandId: string, token?: string): Promise<{ runs: BrandRun[] }> {
  try {
    return await apiCall<{ runs: BrandRun[] }>(`/brands/${brandId}/runs`, { token });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 500)) return { runs: [] };
    throw err;
  }
}

// Campaign by brand
export async function listCampaignsByBrand(brandId: string, token?: string): Promise<{ campaigns: Campaign[] }> {
  return apiCall<{ campaigns: Campaign[] }>(`/campaigns?brandId=${brandId}&status=all`, { token });
}

// Single campaign
export async function getCampaign(campaignId: string, token?: string): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>(`/campaigns/${campaignId}`, { token });
}

// Campaign sub-resources
export interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  emailStatus: string | null;
  title: string | null;
  namespace: string | null;
  organizationName: string | null;
  organizationDomain: string | null;
  organizationIndustry: string | null;
  organizationSize: string | null;
  linkedinUrl: string | null;
  status: string;
  createdAt: string;
  enrichmentRun: {
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

export async function listCampaignLeads(campaignId: string, token?: string): Promise<{ leads: Lead[] }> {
  return apiCall<{ leads: Lead[] }>(`/campaigns/${campaignId}/leads`, { token });
}

export async function listBrandLeads(brandId: string, token?: string): Promise<{ leads: Lead[] }> {
  return apiCall<{ leads: Lead[] }>(`/leads?brandId=${brandId}`, { token });
}

export interface EmailSequenceStep {
  step: number;
  bodyHtml: string;
  bodyText: string;
  daysSinceLastStep: number;
}

export interface Email {
  id: string;
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
  name: string;
  slug: string;
  dynastyName: string;
  dynastySlug: string;
  version: number;
  description: string | null;
  featureSlug: string | null;
  category?: string;
  channel?: string;
  audienceType?: string;
  signatureName: string;
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

export async function listWorkflows(params?: { featureDynastySlug?: string }, token?: string): Promise<{ workflows: Workflow[] }> {
  const query = new URLSearchParams();
  if (params?.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
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

// Workflow performance
export interface WorkflowPerformance {
  workflowId: string;
  workflowSlug: string;
  dynastyName: string;
  signatureName: string;
  featureSlug: string;
  runCount: number;
  emailsSent: number;
  emailsReplied: number;
  replyRate: number;
  costPerReplyCents: number | null;
}

export interface BestWorkflowRecord {
  workflowSlug: string;
  workflowName: string;
  createdForBrandId: string | null;
  value: number;
}

export interface BestWorkflowResponse {
  best: { [metricKey: string]: BestWorkflowRecord | null };
}

export async function getBestWorkflow(
  params: { featureDynastySlug: string; groupBy: "workflow" | "brand" },
  token?: string
): Promise<BestWorkflowResponse> {
  const query = new URLSearchParams();
  query.set("featureDynastySlug", params.featureDynastySlug);
  query.set("groupBy", params.groupBy);
  const qs = query.toString();
  return apiCall(`/features/best${qs ? `?${qs}` : ""}`, { token });
}

// Leaderboard (public performance data)
export interface WorkflowLeaderboardEntry {
  workflowSlug: string;
  dynastyName: string;
  signatureName: string | null;
  category: string | null;
  featureSlug: string | null;
  runCount: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

/** @deprecated Use fetchRankedWorkflows instead. */
export async function fetchFeatureLeaderboard(featureSlug: string): Promise<WorkflowLeaderboardEntry[]> {
  try {
    const res = await fetch("/api/performance/leaderboard");
    if (!res.ok) return [];
    const data = await res.json();
    const section = data.featureGroups?.find(
      (s: { featureSlug: string }) => s.featureSlug === featureSlug
    );
    return section?.workflows ?? [];
  } catch {
    return [];
  }
}

// Ranked workflows (family-aggregated stats from workflow-service)
export interface RankedEmailStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  recipients: number;
}

export interface RankedWorkflowStats {
  totalCostInUsdCents: number;
  totalOutcomes: number;
  costPerOutcome: number | null;
  completedRuns: number;
}

export interface RankedWorkflowItem {
  workflow: {
    id: string;
    slug: string;
    name: string;
    dynastyName: string;
    dynastySlug: string;
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
  featureDynastySlug: string;
  objective: string;
  groupBy: "workflow" | "brand";
  limit?: number;
}, token?: string): Promise<RankedWorkflowItem[]> {
  const query = new URLSearchParams();
  query.set("featureDynastySlug", params.featureDynastySlug);
  query.set("objective", params.objective);
  query.set("groupBy", params.groupBy);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const data = await apiCall<RankedWorkflowResponse>(`/features/ranked${qs ? `?${qs}` : ""}`, { token });
  return data.results;
}

// Generate workflow via AI
export interface GenerateWorkflowRequest {
  description: string;
  featureSlug: string;
  hints?: {
    services?: string[];
    nodeTypes?: string[];
    expectedInputs?: string[];
  };
}

export interface GenerateWorkflowResult {
  workflow: {
    id: string;
    name: string;
    featureSlug: string;
    signature: string;
    signatureName: string;
    action: "created" | "updated";
    humanId: string | null;
    styleName: string | null;
  };
  dag: { nodes: unknown[]; edges: unknown[] };
  generatedDescription: string;
}

export async function generateWorkflow(
  params: GenerateWorkflowRequest,
  token?: string,
): Promise<GenerateWorkflowResult> {
  return apiCall<GenerateWorkflowResult>("/workflows/generate", {
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
  return apiCall<{ campaign: Campaign }>("/campaigns", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

// Billing
export interface BillingAccount {
  creditBalanceCents: number;
  reloadAmountCents: number | null;
  reloadThresholdCents: number | null;
  hasPaymentMethod: boolean;
  hasAutoReload: boolean;
}

export interface BillingBalance {
  balance_cents: number;
  depleted: boolean;
}

export interface BillingTransaction {
  id: string;
  amount_cents: number;
  description: string;
  created_at: string;
  type: "deduction" | "credit" | "reload";
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

export async function listBillingTransactions(
  token?: string
): Promise<{ transactions: BillingTransaction[]; has_more: boolean }> {
  return apiCall<{ transactions: BillingTransaction[]; has_more: boolean }>(
    "/billing/accounts/transactions",
    { token }
  );
}

export async function configureAutoReload(
  reloadAmountCents: number,
  reloadThresholdCents?: number,
  token?: string
): Promise<BillingAccount> {
  const body: Record<string, unknown> = { reload_amount_cents: reloadAmountCents };
  if (reloadThresholdCents !== undefined) body.reload_threshold_cents = reloadThresholdCents;
  return apiCall<BillingAccount>("/billing/accounts/auto-reload", { token, method: "PATCH", body });
}

export async function disableAutoReload(token?: string): Promise<BillingAccount> {
  return apiCall<BillingAccount>("/billing/accounts/auto-reload", { token, method: "DELETE" });
}

export async function createCheckoutSession(
  params: { reload_amount_cents: number; success_url: string; cancel_url: string },
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

/** Per-campaign data nested inside a deduplicated outlet */
export interface OutletCampaign {
  campaignId: string;
  featureSlug: string;
  brandIds: string[];
  relevanceScore: number;
  status: "open" | "ended" | "denied" | "served" | "skipped" | "contacted" | "delivered" | "replied";
  replyClassification?: "positive" | "negative" | "neutral" | null;
  whyRelevant?: string;
  whyNotRelevant?: string;
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
  latestStatus: "open" | "ended" | "denied" | "served" | "skipped" | "contacted" | "delivered" | "replied";
  replyClassification?: "positive" | "negative" | "neutral" | null;
  latestRelevanceScore: number;
  campaigns: OutletCampaign[];
}

/** Flat outlet returned by GET /v1/campaigns/{id}/outlets */
export interface CampaignOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  relevanceScore: number;
  whyRelevant: string | null;
  outletStatus: "open" | "ended" | "denied" | "served" | "skipped" | "contacted" | "delivered" | "replied" | null;
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
  featureDynastySlug?: string,
  token?: string,
): Promise<{ outlets: DeduplicatedOutlet[]; total: number }> {
  const params = new URLSearchParams({ brandId });
  if (featureDynastySlug) params.set("featureDynastySlug", featureDynastySlug);
  return apiCall<{ outlets: DeduplicatedOutlet[]; total: number }>(
    `/outlets?${params}`,
    { token },
  );
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
  status: "buffered" | "claimed" | "served" | "contacted" | "skipped";
  createdAt: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
}

// --- Enriched journalist types (from GET /v1/journalists/list) ---

export interface EmailDeliveryLeadStatus {
  contacted: boolean;
  delivered: boolean;
  replied: boolean;
  replyClassification: "positive" | "negative" | "neutral" | null;
  lastDeliveredAt: string | null;
}

export interface EmailDeliveryEmailStatus {
  contacted: boolean;
  delivered: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  lastDeliveredAt: string | null;
}

export interface EmailDeliveryGlobalStatus {
  email: { bounced: boolean; unsubscribed: boolean };
}

export interface EmailDeliveryScope {
  lead: EmailDeliveryLeadStatus;
  email: EmailDeliveryEmailStatus;
}

export interface EmailStatus {
  broadcast: {
    campaign: EmailDeliveryScope | null;
    brand: EmailDeliveryScope | null;
    global: EmailDeliveryGlobalStatus;
  };
  transactional: {
    campaign: EmailDeliveryScope | null;
    brand: EmailDeliveryScope | null;
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
  status: "buffered" | "claimed" | "served" | "contacted" | "skipped";
  relevanceScore: string;
  whyRelevant: string;
  whyNotRelevant: string;
  articleUrls: string[] | null;
  email: string | null;
  apolloPersonId: string | null;
  runId: string | null;
  createdAt: string;
}

export interface EnrichedJournalist {
  journalistId: string;
  journalistName: string;
  firstName: string | null;
  lastName: string | null;
  entityType: "individual" | "organization";
  outletId: string;
  email: string | null;
  apolloPersonId: string | null;
  emailStatus: EmailStatus | null;
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
    (bc?.lead.contacted ?? false) ||
    (bc?.email.contacted ?? false) ||
    (tc?.lead.contacted ?? false) ||
    (tc?.email.contacted ?? false)
  );
}

export async function listJournalistsEnriched(
  brandId: string,
  options?: { campaignId?: string; featureDynastySlug?: string; token?: string },
): Promise<{ journalists: EnrichedJournalist[] }> {
  const params = new URLSearchParams({ brandId });
  if (options?.campaignId) params.set("campaignId", options.campaignId);
  if (options?.featureDynastySlug) params.set("featureDynastySlug", options.featureDynastySlug);
  return apiCall<{ journalists: EnrichedJournalist[] }>(
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
  featureDynastySlug?: string,
  token?: string,
): Promise<{ groups: CostStatsGroup[] }> {
  const params = new URLSearchParams({ brandId });
  if (groupBy) params.set("groupBy", groupBy);
  if (featureDynastySlug) params.set("featureDynastySlug", featureDynastySlug);
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
  featureDynastySlug?: string,
  token?: string,
): Promise<{ discoveries: ArticleDiscoveryItem[] }> {
  const params = new URLSearchParams({ brandId });
  if (featureDynastySlug) params.set("featureDynastySlug", featureDynastySlug);
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

