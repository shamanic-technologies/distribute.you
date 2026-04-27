// ─── Identity ────────────────────────────────────────────────────────────────

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
  key: string;
  keyPrefix: string;
  name: string | null;
  message: string;
}

// ─── Brands ──────────────────────────────────────────────────────────────────

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

export interface UpsertBrandResult {
  brandId: string;
  domain: string | null;
  name: string | null;
  created: boolean;
}

export interface ExtractFieldDef {
  key: string;
  description: string;
}

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

export interface ExtractFieldBrandInfo {
  brandId: string;
  domain: string;
  name: string;
}

export interface ExtractFieldsResponse {
  brands: ExtractFieldBrandInfo[];
  fields: Record<string, ExtractFieldResult>;
}

export interface CachedField {
  key: string;
  value: unknown;
  sourceUrls: string[] | null;
  extractedAt: string;
  expiresAt: string;
}

// ─── Features ────────────────────────────────────────────────────────────────

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
}

export type UpdateFeatureResult = { feature: Feature };

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

export interface PrefillResponse {
  slug: string;
  brandId: string;
  prefilled: Record<string, string | null>;
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

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

export interface CostByName {
  costName: string;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  totalQuantity: string;
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
  repliesInterested?: number;
  repliesMeetingBooked?: number;
  repliesClosed?: number;
  repliesNeutral?: number;
  repliesNotInterested?: number;
  repliesOutOfOffice?: number;
  repliesUnsubscribe?: number;
}

export interface CreateCampaignParams {
  name: string;
  workflowSlug: string;
  brandUrls: string[];
  featureInputs?: Record<string, string>;
  maxBudgetDailyUsd?: string;
  maxBudgetWeeklyUsd?: string;
  maxBudgetMonthlyUsd?: string;
  maxBudgetTotalUsd?: string;
  [key: string]: unknown;
}

// ─── Leads ───────────────────────────────────────────────────────────────────

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
  status: "contacted" | "served";
  contacted: boolean;
  delivered: boolean;
  bounced: boolean;
  replied: boolean;
  createdAt: string;
}

// ─── Emails ──────────────────────────────────────────────────────────────────

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
}

// ─── Workflows ───────────────────────────────────────────────────────────────

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

// ─── Outlets ─────────────────────────────────────────────────────────────────

export interface OutletCampaign {
  campaignId: string;
  featureSlug: string;
  brandIds: string[];
  relevanceScore: number;
  outreachStatus: string;
  replyClassification?: "positive" | "negative" | "neutral" | null;
  whyRelevant?: string;
  whyNotRelevant?: string;
  overallRelevance?: string | null;
  relevanceRationale?: string | null;
  runId?: string | null;
  updatedAt: string;
}

export interface DeduplicatedOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  createdAt: string;
  outreachStatus: string;
  replyClassification?: "positive" | "negative" | "neutral" | null;
  relevanceScore: number;
  campaigns: OutletCampaign[];
}

export interface CampaignOutlet {
  id: string;
  outletName: string;
  outletUrl: string;
  outletDomain: string;
  relevanceScore: number;
  whyRelevant: string | null;
  outletStatus: string | null;
  replyClassification?: "positive" | "negative" | "neutral" | null;
}

// ─── Journalists ─────────────────────────────────────────────────────────────

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

export interface JournalistCampaignEntry {
  id: string;
  campaignId: string;
  featureSlug: string | null;
  workflowSlug: string | null;
  outreachStatus: string;
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
  outletName: string | null;
  outletDomain: string | null;
  email: string | null;
  apolloPersonId: string | null;
  outreachStatus: string;
  replyClassification?: "positive" | "negative" | "neutral" | null;
  emailStatus: EmailStatus | null;
  campaigns: JournalistCampaignEntry[];
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

// ─── Articles ────────────────────────────────────────────────────────────────

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
    ogTitle: string | null;
    author: string | null;
    articleAuthor: string | null;
    articlePublished: string | null;
    articleChannel: string | null;
    articleSection: string | null;
    newsKeywords: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

// ─── Press Kits ──────────────────────────────────────────────────────────────

export type MediaKitStatus = "drafted" | "generating" | "validated" | "denied" | "failed" | "archived";

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

export interface MediaKit extends MediaKitSummary {
  mdxPageContent: string | null;
}

export interface MediaKitViewStats {
  totalViews: number;
  uniqueVisitors: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
}

// ─── Billing ─────────────────────────────────────────────────────────────────

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

// ─── Costs ───────────────────────────────────────────────────────────────────

export interface CostStatsGroup {
  dimensions: Record<string, string | null>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

export interface BrandDeliveryStats {
  emailsContacted: number;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  repliesInterested: number;
  repliesMeetingBooked: number;
  repliesClosed: number;
  repliesNeutral: number;
  repliesNotInterested: number;
  repliesOutOfOffice: number;
  repliesUnsubscribe: number;
}
