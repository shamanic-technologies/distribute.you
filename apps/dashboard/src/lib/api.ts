const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

interface ApiOptions {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
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
  const { token, method = "GET", body } = options ?? {};

  const headers: Record<string, string> = { "Content-Type": "application/json" };
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
  authType: string;
  user: {
    id: string;
    createdAt: string;
  } | null;
  org: {
    id: string;
    plan: string;
    createdAt: string;
  } | null;
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
  campaign: { brandId: string | null; id: string; name: string },
  token?: string
): Promise<void> {
  if (!campaign.brandId) return;
  await apiCall<unknown>("/emails/send", {
    token,
    method: "POST",
    body: {
      eventType,
      brandId: campaign.brandId,
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
  workflowName: string | null;
  brandId: string | null;
  brandUrl: string | null;
  targetAudience: string | null;
  targetOutcome: string | null;
  valueForTarget: string | null;
  urgency: string | null;
  scarcity: string | null;
  riskReversal: string | null;
  socialProof: string | null;
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

interface CostStatsGroup {
  dimensions: Record<string, string | null>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

export async function getBrandCostBreakdown(brandId: string, token?: string): Promise<{ costs: CostByName[] }> {
  const result = await apiCall<{ groups: CostStatsGroup[] }>(`/runs/stats/costs?brandId=${brandId}&groupBy=costName`, { token });
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
  domain: string;
  name: string | null;
  brandUrl: string;
  createdAt: string;
}

export async function listBrands(token?: string): Promise<{ brands: Brand[] }> {
  return apiCall<{ brands: Brand[] }>("/brands", { token });
}

/** GET /brands/:brandId — returns brand or null if not found (404/500 from missing brand) */
export async function getBrand(brandId: string, token?: string): Promise<{ brand: Brand } | null> {
  try {
    return await apiCall<{ brand: Brand }>(`/brands/${brandId}`, { token });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 500)) return null;
    throw err;
  }
}

// Brand sales profile
export interface LeadershipMember {
  name: string;
  role: string;
  bio: string | null;
  notableBackground: string | null;
}

export interface FundingRound {
  type: string;
  amount: string | null;
  date: string | null;
  notableInvestors: string[];
}

export interface FundingInfo {
  totalRaised: string | null;
  rounds: FundingRound[];
  notableBackers: string[];
}

export interface Award {
  title: string;
  issuer: string | null;
  year: string | null;
  description: string | null;
}

export interface RevenueMilestone {
  metric: string;
  value: string;
  date: string | null;
  context: string | null;
}

export type Testimonial = string | {
  quote: string;
  name: string | null;
  role: string | null;
  company: string | null;
};

export interface SalesProfile {
  valueProposition: string | null;
  companyOverview: string | null;
  targetAudience: string | null;
  customerPainPoints: string[];
  keyFeatures: string[];
  productDifferentiators: string[];
  competitors: string[];
  socialProof: {
    caseStudies: string[];
    testimonials: Testimonial[];
    results: string[];
  };
  callToAction: string | null;
  additionalContext: string | null;
  leadership: LeadershipMember[];
  funding: FundingInfo;
  awardsAndRecognition: Award[];
  revenueMilestones: RevenueMilestone[];
  urgency: { elements: string[]; summary: string | null } | null;
  scarcity: { elements: string[]; summary: string | null } | null;
  riskReversal: { guarantees: string[]; trialInfo: string | null; refundPolicy: string | null } | null;
  extractedAt: string;
}

/** GET /brands/:brandId/sales-profile — returns profile or null if none exists (404) */
export async function getBrandSalesProfile(
  brandId: string,
  token?: string
): Promise<{ profile: SalesProfile; cached: boolean; brandId: string } | null> {
  try {
    return await apiCall<{ profile: SalesProfile; cached: boolean; brandId: string }>(
      `/brands/${brandId}/sales-profile`,
      { token }
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/** POST /brands/:brandId/sales-profile — triggers AI extraction (409 if already exists) */
export async function createBrandSalesProfile(
  brandId: string,
  token?: string
): Promise<{ profile: SalesProfile; brandId: string }> {
  return apiCall<{ profile: SalesProfile; brandId: string }>(
    `/brands/${brandId}/sales-profile`,
    { token, method: "POST" }
  );
}

/** PUT /brands/:brandId/sales-profile — forces re-extraction */
export async function refreshBrandSalesProfile(
  brandId: string,
  token?: string
): Promise<{ profile: SalesProfile; brandId: string }> {
  return apiCall<{ profile: SalesProfile; brandId: string }>(
    `/brands/${brandId}/sales-profile`,
    { token, method: "PUT" }
  );
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
  quantity: string;
  unitCostInUsdCents: string;
  totalCostInUsdCents: string;
}

export interface DescendantRun {
  serviceName: string;
  taskName: string;
  costs: RunCost[];
  ownCostInUsdCents: string;
}

export interface BrandRun {
  id: string;
  taskName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalCostInUsdCents: string | null;
  costs: RunCost[];
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
  } | null;
}

export async function listCampaignLeads(campaignId: string, token?: string): Promise<{ leads: Lead[] }> {
  return apiCall<{ leads: Lead[] }>(`/campaigns/${campaignId}/leads`, { token });
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
  } | null;
}

export async function listCampaignEmails(campaignId: string, token?: string): Promise<{ emails: Email[] }> {
  return apiCall<{ emails: Email[] }>(`/campaigns/${campaignId}/emails`, { token });
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
  displayName: string | null;
  description: string | null;
  category: string;
  channel: string;
  audienceType: string;
  signatureName: string;
  dag: DAG | null;
  requiredProviders: string[];
  status: "active" | "deprecated";
  upgradedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  workflowName: string;
  summary: string;
  requiredProviders: string[];
  steps: string[];
}

export interface WorkflowKeyStatus {
  workflowName: string;
  ready: boolean;
  keys: { provider: string; configured: boolean; maskedKey: string | null; keySource?: "org" | "platform" }[];
  missing: string[];
}

export async function listWorkflows(token?: string): Promise<{ workflows: Workflow[] }> {
  return apiCall<{ workflows: Workflow[] }>("/workflows?status=all", { token });
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

// Workflow required providers (with domain mapping for logos)
export interface WorkflowProvider {
  provider: string;
  domain: string | null;
}

export interface WorkflowRequiredProviders {
  workflowId: string;
  workflowName: string;
  providers: WorkflowProvider[];
}

export async function getWorkflowRequiredProviders(
  workflowId: string,
  token?: string
): Promise<WorkflowRequiredProviders> {
  return apiCall<WorkflowRequiredProviders>(
    `/workflows/${workflowId}/required-providers`,
    { token }
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

// Workflow performance
export interface WorkflowPerformance {
  workflowId: string;
  workflowName: string;
  displayName: string;
  signatureName: string;
  sectionKey: string;
  runCount: number;
  emailsSent: number;
  emailsReplied: number;
  replyRate: number;
  costPerReplyCents: number | null;
}

export async function getBestWorkflow(
  token?: string
): Promise<{
  workflow: { id: string; name: string; category: string; channel: string; audienceType: string; signatureName: string };
  stats: { totalCostInUsdCents: number; totalOutcomes: number; costPerOutcome: number; completedRuns: number };
}> {
  return apiCall("/workflows/best", { token });
}

// Leaderboard (public performance data)
export interface WorkflowLeaderboardEntry {
  workflowName: string;
  displayName: string;
  signatureName: string | null;
  category: string | null;
  sectionKey: string | null;
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
export async function fetchSectionLeaderboard(sectionKey: string): Promise<WorkflowLeaderboardEntry[]> {
  try {
    const res = await fetch("/api/performance/leaderboard");
    if (!res.ok) return [];
    const data = await res.json();
    const section = data.categorySections?.find(
      (s: { sectionKey: string }) => s.sectionKey === sectionKey
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
  email: {
    transactional: RankedEmailStats;
    broadcast: RankedEmailStats;
  };
}

export interface RankedWorkflowItem {
  workflow: {
    id: string;
    name: string;
    displayName: string | null;
    brandId: string | null;
    category: string;
    channel: string;
    audienceType: string;
    signature: string;
    signatureName: string;
  };
  dag: DAG;
  stats: RankedWorkflowStats;
}

export interface RankedWorkflowResponse {
  results: RankedWorkflowItem[];
}

export async function fetchRankedWorkflows(params: {
  category?: string;
  channel?: string;
  audienceType?: string;
  objective?: string;
  limit?: number;
}, token?: string): Promise<RankedWorkflowItem[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.channel) query.set("channel", params.channel);
  if (params.audienceType) query.set("audienceType", params.audienceType);
  if (params.objective) query.set("objective", params.objective);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  const data = await apiCall<RankedWorkflowResponse>(`/workflows/ranked${qs ? `?${qs}` : ""}`, { token });
  return data.results;
}

// Create campaign
export async function createCampaign(
  params: {
    name: string;
    workflowName: string;
    brandUrl: string;
    targetAudience: string;
    targetOutcome: string;
    valueForTarget: string;
    urgency: string;
    scarcity: string;
    riskReversal: string;
    socialProof: string;
    maxBudgetDailyUsd?: string;
    maxBudgetWeeklyUsd?: string;
    maxBudgetMonthlyUsd?: string;
    maxBudgetTotalUsd?: string;
  },
  token?: string
): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>("/campaigns", {
    token,
    method: "POST",
    body: params as unknown as Record<string, unknown>,
  });
}

