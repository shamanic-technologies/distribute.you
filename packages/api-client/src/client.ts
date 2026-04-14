import type {
  UserInfo,
  ApiKey,
  NewApiKey,
  Brand,
  BrandDetail,
  UpsertBrandResult,
  ExtractFieldDef,
  ExtractFieldsResponse,
  CachedField,
  Feature,
  UpdateFeatureResult,
  StatsRegistry,
  FeatureStatsResponse,
  GlobalStatsResponse,
  PrefillResponse,
  Campaign,
  CampaignStats,
  CreateCampaignParams,
  Lead,
  Email,
  Workflow,
  WorkflowSummary,
  WorkflowKeyStatus,
  DeduplicatedOutlet,
  CampaignOutlet,
  EnrichedJournalist,
  DiscoveredJournalist,
  ArticleDiscoveryItem,
  MediaKitSummary,
  MediaKit,
  MediaKitViewStats,
  BillingAccount,
  BillingBalance,
  BillingTransaction,
  CostStatsGroup,
  BrandDeliveryStats,
  CostByName,
} from "./types.js";

export class DistributeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DistributeApiError";
  }
}

export interface DistributeClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class DistributeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: DistributeClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.distribute.you").replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
      ...extraHeaders,
    };

    const response = await fetch(`${this.baseUrl}/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
      throw new DistributeApiError(
        errorBody.error || errorBody.message || `HTTP ${response.status}`,
        response.status,
        errorBody,
      );
    }

    return response.json();
  }

  // ─── Identity ────────────────────────────────────────────────────────────

  async getMe(): Promise<UserInfo> {
    return this.request<UserInfo>("GET", "/me");
  }

  async listApiKeys(): Promise<{ keys: ApiKey[] }> {
    return this.request<{ keys: ApiKey[] }>("GET", "/api-keys");
  }

  async createApiKey(name?: string): Promise<NewApiKey> {
    return this.request<NewApiKey>("POST", "/api-keys", { name });
  }

  async deleteApiKey(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>("DELETE", `/api-keys/${id}`);
  }

  // ─── Brands ──────────────────────────────────────────────────────────────

  async listBrands(): Promise<{ brands: Brand[] }> {
    return this.request<{ brands: Brand[] }>("GET", "/brands");
  }

  async getBrand(brandId: string): Promise<{ brand: BrandDetail }> {
    return this.request<{ brand: BrandDetail }>("GET", `/brands/${brandId}`);
  }

  async createBrand(url: string): Promise<UpsertBrandResult> {
    return this.request<UpsertBrandResult>("POST", "/brands", { url });
  }

  async extractBrandFields(
    brandIds: string[],
    fields: ExtractFieldDef[],
  ): Promise<ExtractFieldsResponse> {
    return this.request<ExtractFieldsResponse>("POST", "/brands/extract-fields", { brandIds, fields });
  }

  async listExtractedFields(
    brandId: string,
  ): Promise<{ brandId: string; fields: CachedField[] }> {
    return this.request<{ brandId: string; fields: CachedField[] }>(
      "GET",
      `/brands/${brandId}/extracted-fields`,
    );
  }

  // ─── Features ────────────────────────────────────────────────────────────

  async listFeatures(params?: { implemented?: boolean }): Promise<{ features: Feature[] }> {
    const query = new URLSearchParams();
    if (params?.implemented !== undefined) query.set("implemented", String(params.implemented));
    const qs = query.toString();
    return this.request<{ features: Feature[] }>("GET", `/features${qs ? `?${qs}` : ""}`);
  }

  async getFeature(slug: string): Promise<{ feature: Feature }> {
    return this.request<{ feature: Feature }>("GET", `/features/${slug}`);
  }

  async createFeature(params: {
    name: string;
    description: string;
    icon: string;
    category: string;
    channel: string;
    audienceType: string;
    inputs: Feature["inputs"];
    outputs: Feature["outputs"];
    charts: Feature["charts"];
    entities: Feature["entities"];
    slug?: string;
  }): Promise<{ feature: Feature }> {
    return this.request<{ feature: Feature }>("POST", "/features", params as unknown as Record<string, unknown>);
  }

  async updateFeature(
    slug: string,
    params: Partial<{
      name: string;
      description: string;
      icon: string;
      category: string;
      channel: string;
      audienceType: string;
      inputs: Feature["inputs"];
      outputs: Feature["outputs"];
      charts: Feature["charts"];
      entities: Feature["entities"];
      status: "active" | "draft" | "deprecated";
    }>,
  ): Promise<UpdateFeatureResult> {
    return this.request<UpdateFeatureResult>("PUT", `/features/${slug}`, params as unknown as Record<string, unknown>);
  }

  async prefillFeatureInputs(
    featureDynastySlug: string,
    brandIds: string[],
  ): Promise<PrefillResponse> {
    return this.request<PrefillResponse>(
      "POST",
      `/features/${featureDynastySlug}/prefill?format=text`,
      { brandIds },
    );
  }

  async getFeatureStats(
    featureDynastySlug: string,
    params?: { groupBy?: string; brandId?: string; campaignId?: string },
  ): Promise<FeatureStatsResponse> {
    const query = new URLSearchParams();
    if (params?.groupBy) query.set("groupBy", params.groupBy);
    if (params?.brandId) query.set("brandId", params.brandId);
    if (params?.campaignId) query.set("campaignId", params.campaignId);
    const qs = query.toString();
    return this.request<FeatureStatsResponse>(
      "GET",
      `/features/${featureDynastySlug}/stats${qs ? `?${qs}` : ""}`,
    );
  }

  async getGlobalStats(params?: { groupBy?: string; brandId?: string }): Promise<GlobalStatsResponse> {
    const query = new URLSearchParams();
    if (params?.groupBy) query.set("groupBy", params.groupBy);
    if (params?.brandId) query.set("brandId", params.brandId);
    const qs = query.toString();
    return this.request<GlobalStatsResponse>("GET", `/features/stats${qs ? `?${qs}` : ""}`);
  }

  async getStatsRegistry(): Promise<{ registry: StatsRegistry }> {
    return this.request<{ registry: StatsRegistry }>("GET", "/features/stats/registry");
  }

  // ─── Campaigns ───────────────────────────────────────────────────────────

  async listCampaigns(params?: { brandId?: string }): Promise<{ campaigns: Campaign[] }> {
    const query = new URLSearchParams();
    if (params?.brandId) {
      query.set("brandId", params.brandId);
      query.set("status", "all");
    }
    const qs = query.toString();
    return this.request<{ campaigns: Campaign[] }>("GET", `/campaigns${qs ? `?${qs}` : ""}`);
  }

  async getCampaign(campaignId: string): Promise<{ campaign: Campaign }> {
    return this.request<{ campaign: Campaign }>("GET", `/campaigns/${campaignId}`);
  }

  async createCampaign(params: CreateCampaignParams): Promise<{ campaign: Campaign }> {
    return this.request<{ campaign: Campaign }>("POST", "/campaigns", params as unknown as Record<string, unknown>);
  }

  async stopCampaign(campaignId: string): Promise<{ campaign: Campaign }> {
    return this.request<{ campaign: Campaign }>("POST", `/campaigns/${campaignId}/stop`);
  }

  async getCampaignStats(campaignId: string): Promise<CampaignStats> {
    return this.request<CampaignStats>("GET", `/campaigns/${campaignId}/stats`);
  }

  async getBatchCampaignStats(params?: { brandId?: string }): Promise<{ campaigns: CampaignStats[] }> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set("brandId", params.brandId);
    const qs = query.toString();
    return this.request<{ campaigns: CampaignStats[] }>("GET", `/campaigns/stats${qs ? `?${qs}` : ""}`);
  }

  // ─── Leads ───────────────────────────────────────────────────────────────

  async listLeads(params: { campaignId?: string; brandId?: string }): Promise<{ leads: Lead[] }> {
    const query = new URLSearchParams();
    if (params.campaignId) query.set("campaignId", params.campaignId);
    if (params.brandId) query.set("brandId", params.brandId);
    return this.request<{ leads: Lead[] }>("GET", `/leads?${query}`);
  }

  // ─── Emails ──────────────────────────────────────────────────────────────

  async listCampaignEmails(campaignId: string): Promise<{ emails: Email[] }> {
    return this.request<{ emails: Email[] }>("GET", `/campaigns/${campaignId}/emails`);
  }

  async listBrandEmails(brandId: string): Promise<{ emails: Email[] }> {
    return this.request<{ emails: Email[] }>("GET", `/emails?brandId=${brandId}`);
  }

  // ─── Workflows ───────────────────────────────────────────────────────────

  async listWorkflows(params?: { featureDynastySlug?: string }): Promise<{ workflows: Workflow[] }> {
    const query = new URLSearchParams();
    if (params?.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
    const qs = query.toString();
    return this.request<{ workflows: Workflow[] }>("GET", `/workflows${qs ? `?${qs}` : ""}`);
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    return this.request<Workflow>("GET", `/workflows/${workflowId}`);
  }

  async getWorkflowSummary(workflowId: string): Promise<WorkflowSummary> {
    return this.request<WorkflowSummary>("GET", `/workflows/${workflowId}/summary`);
  }

  async getWorkflowKeyStatus(workflowId: string): Promise<WorkflowKeyStatus> {
    return this.request<WorkflowKeyStatus>("GET", `/workflows/${workflowId}/key-status`);
  }

  // ─── Outlets ─────────────────────────────────────────────────────────────

  async listBrandOutlets(
    brandId: string,
    params?: { featureDynastySlug?: string; campaignId?: string },
  ): Promise<{ outlets: DeduplicatedOutlet[]; total: number; byOutreachStatus?: Record<string, number> }> {
    const query = new URLSearchParams({ brandId });
    if (params?.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
    if (params?.campaignId) query.set("campaignId", params.campaignId);
    return this.request<{ outlets: DeduplicatedOutlet[]; total: number; byOutreachStatus?: Record<string, number> }>(
      "GET",
      `/outlets?${query}`,
    );
  }

  async listCampaignOutlets(campaignId: string): Promise<{ outlets: CampaignOutlet[] }> {
    return this.request<{ outlets: CampaignOutlet[] }>("GET", `/campaigns/${campaignId}/outlets`);
  }

  // ─── Journalists ─────────────────────────────────────────────────────────

  async listJournalists(
    brandId: string,
    params?: { campaignId?: string; featureDynastySlug?: string },
  ): Promise<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }> {
    const query = new URLSearchParams({ brandId });
    if (params?.campaignId) query.set("campaignId", params.campaignId);
    if (params?.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
    return this.request<{ journalists: EnrichedJournalist[]; total?: number; byOutreachStatus?: Record<string, number> }>(
      "GET",
      `/journalists/list?${query}`,
    );
  }

  async listCampaignJournalists(campaignId: string): Promise<{ journalists: DiscoveredJournalist[] }> {
    return this.request<{ journalists: DiscoveredJournalist[] }>("GET", `/campaigns/${campaignId}/journalists`);
  }

  // ─── Articles ────────────────────────────────────────────────────────────

  async listArticles(
    params: { campaignId?: string; brandId?: string; featureDynastySlug?: string },
  ): Promise<{ discoveries: ArticleDiscoveryItem[] }> {
    const query = new URLSearchParams();
    if (params.campaignId) query.set("campaignId", params.campaignId);
    if (params.brandId) query.set("brandId", params.brandId);
    if (params.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
    return this.request<{ discoveries: ArticleDiscoveryItem[] }>("GET", `/discoveries?${query}`);
  }

  // ─── Press Kits ──────────────────────────────────────────────────────────

  async listPressKits(params?: { brandId?: string; campaignId?: string }): Promise<{ mediaKits: MediaKitSummary[] }> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set("brand_id", params.brandId);
    if (params?.campaignId) query.set("campaign_id", params.campaignId);
    return this.request<{ mediaKits: MediaKitSummary[] }>("GET", `/press-kits/media-kits?${query}`);
  }

  async getPressKit(id: string): Promise<MediaKit> {
    return this.request<MediaKit>("GET", `/press-kits/media-kits/${id}`);
  }

  async generatePressKit(
    instruction: string,
    headers?: { brandId?: string; campaignId?: string },
  ): Promise<{ mediaKitId: string }> {
    const extraHeaders: Record<string, string> = {};
    if (headers?.brandId) extraHeaders["x-brand-id"] = headers.brandId;
    if (headers?.campaignId) extraHeaders["x-campaign-id"] = headers.campaignId;
    return this.request<{ mediaKitId: string }>("POST", "/press-kits/media-kits", { instruction }, extraHeaders);
  }

  async getPressKitViewStats(
    params?: { brandId?: string; mediaKitId?: string; groupBy?: "country" | "mediaKitId" | "day" },
  ): Promise<MediaKitViewStats> {
    const query = new URLSearchParams();
    if (params?.brandId) query.set("brandId", params.brandId);
    if (params?.mediaKitId) query.set("mediaKitId", params.mediaKitId);
    if (params?.groupBy) query.set("groupBy", params.groupBy);
    return this.request<MediaKitViewStats>("GET", `/press-kits/media-kits/stats/views?${query}`);
  }

  // ─── Billing ─────────────────────────────────────────────────────────────

  async getBillingBalance(): Promise<BillingBalance> {
    return this.request<BillingBalance>("GET", "/billing/accounts/balance");
  }

  async getBillingAccount(): Promise<BillingAccount> {
    return this.request<BillingAccount>("GET", "/billing/accounts");
  }

  async listBillingTransactions(): Promise<{ transactions: BillingTransaction[]; has_more: boolean }> {
    return this.request<{ transactions: BillingTransaction[]; has_more: boolean }>(
      "GET",
      "/billing/accounts/transactions",
    );
  }

  // ─── Cost Analytics ──────────────────────────────────────────────────────

  async getCostBreakdown(params: {
    brandId?: string;
    groupBy: string;
    featureDynastySlug?: string;
  }): Promise<{ groups: CostStatsGroup[] }> {
    const query = new URLSearchParams({ groupBy: params.groupBy });
    if (params.brandId) query.set("brandId", params.brandId);
    if (params.featureDynastySlug) query.set("featureDynastySlug", params.featureDynastySlug);
    return this.request<{ groups: CostStatsGroup[] }>("GET", `/runs/stats/costs?${query}`);
  }

  async getBrandDeliveryStats(brandId: string): Promise<BrandDeliveryStats> {
    return this.request<BrandDeliveryStats>("GET", `/email-gateway/stats?brandId=${brandId}`);
  }
}
