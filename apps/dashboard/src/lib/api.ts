const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.mcpfactory.org";

interface ApiOptions {
  token: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
}

async function apiCall<T>(endpoint: string, options: ApiOptions): Promise<T> {
  const { token, method = "GET", body } = options;

  const response = await fetch(`${API_URL}/v1${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
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
    clerkUserId: string;
    createdAt: string;
  } | null;
  org: {
    id: string;
    clerkOrgId: string;
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
export async function getMe(token: string): Promise<UserInfo> {
  return apiCall<UserInfo>("/me", { token });
}

// API Keys
export async function listApiKeys(token: string): Promise<{ keys: ApiKey[] }> {
  return apiCall<{ keys: ApiKey[] }>("/api-keys", { token });
}

export async function createApiKey(token: string, name?: string): Promise<NewApiKey> {
  return apiCall<NewApiKey>("/api-keys", { token, method: "POST", body: { name } });
}

export async function deleteApiKey(token: string, id: string): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/api-keys/${id}`, { token, method: "DELETE" });
}

// BYOK Keys
export async function listByokKeys(token: string): Promise<{ keys: ByokKey[] }> {
  return apiCall<{ keys: ByokKey[] }>("/keys", { token });
}

export async function setByokKey(
  token: string,
  provider: string,
  apiKey: string
): Promise<{ provider: string; maskedKey: string }> {
  return apiCall<{ provider: string; maskedKey: string }>("/keys", {
    token,
    method: "POST",
    body: { provider, apiKey },
  });
}

export async function deleteByokKey(
  token: string,
  provider: string
): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/keys/${provider}`, {
    token,
    method: "DELETE",
  });
}

// Session API Key (Foxy chat)
export interface SessionApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  name: string;
}

export async function getOrCreateSessionKey(token: string): Promise<SessionApiKey> {
  return apiCall<SessionApiKey>("/api-keys/session", { token, method: "POST" });
}

// Activity tracking
export async function trackActivity(token: string): Promise<{ ok: boolean }> {
  return apiCall<{ ok: boolean }>("/activity", { token, method: "POST" });
}

// Campaigns
export interface Campaign {
  id: string;
  name: string;
  status: string;
  targetAudience: string | null;
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

export interface CampaignStats {
  campaignId: string;
  totalCostInUsdCents?: string | null;
  leadsServed: number;
  leadsBuffered: number;
  leadsSkipped: number;
  apollo?: ApolloStats;
  emailsGenerated: number;
  emailsSent: number;
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

export async function listCampaigns(token: string): Promise<{ campaigns: Campaign[] }> {
  return apiCall<{ campaigns: Campaign[] }>("/campaigns", { token });
}

export async function getCampaignStats(token: string, campaignId: string): Promise<CampaignStats> {
  return apiCall<CampaignStats>(`/campaigns/${campaignId}/stats`, { token });
}

export async function getCampaignBatchStats(
  token: string,
  campaignIds: string[]
): Promise<Record<string, CampaignStats>> {
  const result = await apiCall<{ stats: Record<string, CampaignStats> }>("/campaigns/batch-stats", {
    token,
    method: "POST",
    body: { campaignIds },
  });
  return result.stats;
}

export async function stopCampaign(token: string, campaignId: string): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>(`/campaigns/${campaignId}/stop`, { token, method: "POST" });
}

export async function resumeCampaign(token: string, campaignId: string): Promise<{ campaign: Campaign }> {
  return apiCall<{ campaign: Campaign }>(`/campaigns/${campaignId}/resume`, { token, method: "POST" });
}

// Brands
export interface Brand {
  id: string;
  domain: string;
  name: string | null;
  brandUrl: string;
  createdAt: string;
}

export async function listBrands(token: string): Promise<{ brands: Brand[] }> {
  return apiCall<{ brands: Brand[] }>("/brands", { token });
}

export async function getBrand(token: string, brandId: string): Promise<{ brand: Brand }> {
  return apiCall<{ brand: Brand }>(`/brands/${brandId}`, { token });
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
  extractedAt: string;
}

export async function getBrandSalesProfile(
  token: string,
  brandId: string
): Promise<{ profile: SalesProfile | null }> {
  try {
    return await apiCall<{ profile: SalesProfile }>(`/brands/${brandId}/sales-profile`, { token });
  } catch (err: unknown) {
    // 404 means no profile yet — not an error
    if (err instanceof Error && err.message.includes("not found")) {
      return { profile: null };
    }
    throw err;
  }
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

export async function listBrandRuns(token: string, brandId: string): Promise<{ runs: BrandRun[] }> {
  return apiCall<{ runs: BrandRun[] }>(`/brands/${brandId}/runs`, { token });
}

// Campaign by brand
export async function listCampaignsByBrand(token: string, brandId: string): Promise<{ campaigns: Campaign[] }> {
  return apiCall<{ campaigns: Campaign[] }>(`/campaigns?brandId=${brandId}&status=all`, { token });
}

// Single campaign
export async function getCampaign(token: string, campaignId: string): Promise<{ campaign: Campaign }> {
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

export async function listCampaignLeads(token: string, campaignId: string): Promise<{ leads: Lead[] }> {
  return apiCall<{ leads: Lead[] }>(`/campaigns/${campaignId}/leads`, { token });
}

export interface Email {
  id: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
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

export async function listCampaignEmails(token: string, campaignId: string): Promise<{ emails: Email[] }> {
  return apiCall<{ emails: Email[] }>(`/campaigns/${campaignId}/emails`, { token });
}

export interface Reply {
  id: string;
  emailId: string;
  leadName: string | null;
  leadEmail: string;
  classification: string | null;
  snippet: string | null;
  receivedAt: string;
}

export async function listCampaignReplies(token: string, campaignId: string): Promise<{ replies: Reply[] }> {
  return apiCall<{ replies: Reply[] }>(`/campaigns/${campaignId}/replies`, { token });
}

