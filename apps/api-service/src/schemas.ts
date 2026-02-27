import { z } from "zod";
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);
export const registry = new OpenAPIRegistry();

// ---------------------------------------------------------------------------
// Security schemes
// ---------------------------------------------------------------------------
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "App key (mcpf_app_*) or user key (mcpf_*) via Authorization: Bearer header",
});

const authed: Record<string, string[]>[] = [{ bearerAuth: [] }];

// ---------------------------------------------------------------------------
// Common schemas
// ---------------------------------------------------------------------------
export const ErrorResponseSchema = z
  .object({ error: z.string().describe("Error message") })
  .openapi("ErrorResponse");

const errorContent = {
  "application/json": { schema: ErrorResponseSchema },
};

const CampaignIdParam = z.object({
  id: z.string().describe("Campaign ID"),
});

const BrandIdParam = z.object({
  id: z.string().describe("Brand ID"),
});

// ===================================================================
// HEALTH
// ===================================================================

registry.registerPath({
  method: "get",
  path: "/",
  tags: ["Health"],
  summary: "API info",
  description: "Returns API name, version, and docs URL",
  responses: {
    200: {
      description: "API information",
      content: {
        "application/json": {
          schema: z
            .object({
              name: z.string(),
              version: z.string(),
              docs: z.string(),
            })
            .openapi("ApiInfoResponse"),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Health check",
  description: "Returns service health status",
  responses: {
    200: {
      description: "Service is healthy",
      content: {
        "application/json": {
          schema: z
            .object({
              status: z.string(),
              service: z.string(),
              version: z.string(),
            })
            .openapi("HealthResponse"),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/debug/config",
  tags: ["Health"],
  summary: "Debug configuration",
  description: "Returns debug info about external service configuration",
  responses: {
    200: { description: "Debug configuration data" },
  },
});

registry.registerPath({
  method: "get",
  path: "/openapi.json",
  tags: ["Health"],
  summary: "OpenAPI specification",
  description: "Returns the OpenAPI 3.0 JSON spec for this service",
  responses: {
    200: { description: "OpenAPI 3.0 specification" },
    404: { description: "Spec not generated yet", content: errorContent },
  },
});

// ===================================================================
// APPS
// ===================================================================

export const RegisterAppRequestSchema = z
  .object({
    name: z.string().min(1).describe("Unique app name (lowercase, alphanumeric with hyphens)"),
  })
  .openapi("RegisterAppRequest");

export const RegisterAppResponseSchema = z
  .object({
    appId: z.string().describe("The registered app ID"),
    apiKey: z.string().optional().describe("API key (only returned on first creation — save it)"),
    message: z.string().optional().describe("Status message"),
  })
  .openapi("RegisterAppResponse");

registry.registerPath({
  method: "post",
  path: "/v1/apps/register",
  tags: ["Apps"],
  summary: "Register an app",
  description:
    "Register a new app and receive an API key. Idempotent: returns existing appId if already registered. The API key is only shown on first creation.",
  request: {
    body: {
      content: { "application/json": { schema: RegisterAppRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "App registered (or already exists)",
      content: { "application/json": { schema: RegisterAppResponseSchema } },
    },
    400: { description: "Invalid request", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// PERFORMANCE
// ===================================================================

registry.registerPath({
  method: "get",
  path: "/performance/leaderboard",
  tags: ["Performance"],
  summary: "Get performance leaderboard",
  description:
    "Returns public performance leaderboard data. No authentication required.",
  responses: {
    200: { description: "Leaderboard data with brands, models, and hero stats" },
    502: { description: "Upstream service error", content: errorContent },
  },
});

// ===================================================================
// USER
// ===================================================================

registry.registerPath({
  method: "get",
  path: "/v1/me",
  tags: ["User"],
  summary: "Get current user info",
  description: "Returns the authenticated user and organization details",
  security: authed,
  responses: {
    200: {
      description: "Current user and org info",
      content: {
        "application/json": {
          schema: z
            .object({
              userId: z.string().optional(),
              orgId: z.string().optional(),
              authType: z.enum(["app_key", "user_key"]).optional(),
            })
            .openapi("MeResponse"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// CAMPAIGNS
// ===================================================================

// -- Request schemas --

export const CreateCampaignRequestSchema = z
  .object({
    name: z.string().describe("Campaign name"),
    workflowName: z.string().min(1).describe("Workflow name (e.g. 'sales-email-cold-outreach-sienna'). Determines which execution pipeline to use."),
    brandUrl: z.string().min(1).describe("Brand website URL"),
    targetAudience: z.string().min(1).describe("Plain text description of who to target (e.g. 'CTOs at SaaS startups with 10-50 employees in the US')"),
    targetOutcome: z.string().min(1).describe("What you want to achieve (e.g. 'Book sales demos', 'Recruit community ambassadors')"),
    valueForTarget: z.string().min(1).describe("What the target audience gains from responding"),
    urgency: z.string().min(1).describe("Time-based constraint that motivates action now (e.g. 'Recruitment closes in 30 days', 'Price doubles after March 1st')"),
    scarcity: z.string().min(1).describe("Supply-based constraint on availability (e.g. 'Only 10 spots available worldwide', 'Limited to 50 participants')"),
    riskReversal: z.string().min(1).describe("Guarantee or safety net that removes risk for the prospect (e.g. 'Free trial for 2 weeks, no commitment', 'Phone screening call before any obligation')"),
    socialProof: z.string().min(1).describe("Evidence of credibility and traction (e.g. 'Backed by 60 sponsors including X, Y, Z', '500+ companies already onboarded')"),
    maxBudgetDailyUsd: z.union([z.string(), z.number()]).optional().describe("Max daily budget in USD"),
    maxBudgetWeeklyUsd: z.union([z.string(), z.number()]).optional().describe("Max weekly budget in USD"),
    maxBudgetMonthlyUsd: z.union([z.string(), z.number()]).optional().describe("Max monthly budget in USD"),
    maxBudgetTotalUsd: z.union([z.string(), z.number()]).optional().describe("Max total budget in USD"),
    maxLeads: z.number().int().optional().describe("Maximum number of leads to contact"),
    endDate: z.string().optional().describe("Campaign end date"),
  })
  .openapi("CreateCampaignRequest");

export const BatchStatsRequestSchema = z
  .object({
    campaignIds: z
      .array(z.string())
      .min(1)
      .describe("Array of campaign IDs to fetch stats for"),
  })
  .openapi("BatchStatsRequest");

// -- Paths --

registry.registerPath({
  method: "get",
  path: "/v1/campaigns",
  tags: ["Campaigns"],
  summary: "List campaigns",
  description:
    "List all campaigns for the organization, optionally filtered by brand ID",
  security: authed,
  request: {
    query: z.object({
      brandId: z.string().optional().describe("Filter by brand ID"),
    }),
  },
  responses: {
    200: { description: "List of campaigns" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/campaigns",
  tags: ["Campaigns"],
  summary: "Create a campaign",
  description:
    "Create a new outreach campaign. The `workflowName` field determines which execution pipeline campaign-service uses.",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: CreateCampaignRequestSchema } },
    },
  },
  responses: {
    200: { description: "Created campaign" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}",
  tags: ["Campaigns"],
  summary: "Get a campaign",
  description: "Get a specific campaign by ID",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/campaigns/{id}",
  tags: ["Campaigns"],
  summary: "Update a campaign",
  description: "Update campaign fields (name, settings, etc.)",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Updated campaign" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/campaigns/{id}/stop",
  tags: ["Campaigns"],
  summary: "Stop a campaign",
  description: "Stop a running campaign",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Stopped campaign" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/campaigns/{id}/resume",
  tags: ["Campaigns"],
  summary: "Resume a campaign",
  description: "Resume a stopped campaign",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Resumed campaign" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}/runs",
  tags: ["Campaigns"],
  summary: "Get campaign runs",
  description: "Get execution history/runs for a campaign",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign runs list" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}/stats",
  tags: ["Campaigns"],
  summary: "Get campaign stats",
  description:
    "Get campaign statistics (leads served/buffered/skipped, apollo metrics, emails sent/opened/clicked/replied, etc.)",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: {
      description: "Aggregated campaign statistics",
      content: {
        "application/json": {
          schema: z
            .object({
              campaignId: z.string(),
              leadsServed: z.number(),
              leadsBuffered: z.number(),
              leadsSkipped: z.number(),
              apollo: z.object({
                enrichedLeadsCount: z.number(),
                searchCount: z.number(),
                fetchedPeopleCount: z.number(),
                totalMatchingPeople: z.number(),
              }).optional(),
              emailsGenerated: z.number(),
              totalCostUsd: z.number().optional(),
              emailsSent: z.number(),
              emailsOpened: z.number(),
              emailsClicked: z.number(),
              emailsReplied: z.number(),
              emailsBounced: z.number(),
              repliesWillingToMeet: z.number().optional(),
              repliesInterested: z.number().optional(),
              repliesNotInterested: z.number().optional(),
              repliesOutOfOffice: z.number().optional(),
              repliesUnsubscribe: z.number().optional(),
            })
            .openapi("CampaignStatsResponse"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/campaigns/batch-stats",
  tags: ["Campaigns"],
  summary: "Batch get campaign stats",
  description: "Get stats for multiple campaigns in a single request",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: BatchStatsRequestSchema } },
    },
  },
  responses: {
    200: { description: "Stats keyed by campaign ID" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}/leads",
  tags: ["Campaigns"],
  summary: "Get campaign leads",
  description:
    "Get all leads for a campaign with enrichment cost data",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign leads with enrichment run data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}/emails",
  tags: ["Campaigns"],
  summary: "Get campaign emails",
  description:
    "Get all generated emails for a campaign across all runs, with generation cost data",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign emails with generation run data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// BYOK KEYS
// ===================================================================

export const AddByokKeyRequestSchema = z
  .object({
    provider: z
      .string()
      .describe("Provider name (e.g. openai, anthropic, apollo)"),
    apiKey: z.string().describe("The API key value"),
    scope: z
      .enum(["app"])
      .optional()
      .describe("Key scope: 'app' for app-level key (no org/user needed). Omit for org-level BYOK."),
  })
  .openapi("AddByokKeyRequest");

registry.registerPath({
  method: "get",
  path: "/v1/keys",
  tags: ["Keys"],
  summary: "List BYOK keys",
  description:
    "List all BYOK (Bring Your Own Key) API keys for the organization",
  security: authed,
  responses: {
    200: { description: "List of BYOK keys" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/keys",
  tags: ["Keys"],
  summary: "Add a provider key",
  description:
    "Store a provider API key. Use scope:'app' for app-level keys (no org/user needed). Omit scope for org-level BYOK keys.",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: AddByokKeyRequestSchema } },
    },
  },
  responses: {
    200: { description: "Key stored" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/keys/{provider}",
  tags: ["Keys"],
  summary: "Delete a BYOK key",
  description: "Remove a BYOK API key for a specific provider",
  security: authed,
  request: {
    params: z.object({
      provider: z.string().describe("Provider name"),
    }),
  },
  responses: {
    200: { description: "Key deleted" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/internal/keys/{provider}/decrypt",
  tags: ["Keys"],
  summary: "Decrypt a BYOK key (internal)",
  description:
    "Get decrypted BYOK key value. Internal service-to-service endpoint.",
  request: {
    params: z.object({
      provider: z.string().describe("Provider name"),
    }),
    query: z.object({
      orgId: z.string().describe("Organization ID"),
    }),
  },
  responses: {
    200: { description: "Decrypted key" },
    400: { description: "Missing orgId query parameter", content: errorContent },
    404: { description: "Key not found", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// API KEYS
// ===================================================================

export const CreateApiKeyRequestSchema = z
  .object({
    name: z
      .string()
      .optional()
      .describe("Human-readable name for the API key"),
  })
  .openapi("CreateApiKeyRequest");

registry.registerPath({
  method: "get",
  path: "/v1/api-keys",
  tags: ["API Keys"],
  summary: "List API keys",
  description: "List all API keys for the organization",
  security: authed,
  responses: {
    200: { description: "List of API keys" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/api-keys",
  tags: ["API Keys"],
  summary: "Create an API key",
  description: "Generate a new permanent API key for the organization",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: CreateApiKeyRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Created API key" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "delete",
  path: "/v1/api-keys/{id}",
  tags: ["API Keys"],
  summary: "Revoke an API key",
  description: "Delete/revoke an API key by ID",
  security: authed,
  request: {
    params: z.object({ id: z.string().describe("API key ID") }),
  },
  responses: {
    200: { description: "API key revoked" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/api-keys/session",
  tags: ["API Keys"],
  summary: "Get or create session API key",
  description:
    "Get or create a short-lived session API key for Foxy chat integration",
  security: authed,
  responses: {
    200: { description: "Session API key" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// LEADS
// ===================================================================

export const LeadSearchRequestSchema = z
  .object({
    person_titles: z
      .array(z.string())
      .min(1)
      .describe("Job titles to search for"),
    organization_locations: z
      .array(z.string())
      .optional()
      .describe("Company locations filter"),
    organization_industries: z
      .array(z.string())
      .optional()
      .describe("Industry tag IDs filter"),
    organization_num_employees_ranges: z
      .array(z.string())
      .optional()
      .describe("Employee count ranges"),
    per_page: z
      .number()
      .int()
      .max(100)
      .optional()
      .default(10)
      .describe("Results per page (max 100)"),
  })
  .openapi("LeadSearchRequest");

registry.registerPath({
  method: "post",
  path: "/v1/leads/search",
  tags: ["Leads"],
  summary: "Search for leads",
  description:
    "Search for leads using Apollo-compatible filters (titles, locations, industries, company size)",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: LeadSearchRequestSchema } },
    },
  },
  responses: {
    200: { description: "Lead search results" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// QUALIFY
// ===================================================================

export const QualifyRequestSchema = z
  .object({
    sourceService: z
      .string()
      .optional()
      .default("api")
      .describe("Source service identifier"),
    sourceOrgId: z
      .string()
      .optional()
      .describe("Organization ID (defaults to auth org)"),
    sourceRefId: z
      .string()
      .optional()
      .describe("Reference ID in the source system"),
    fromEmail: z.string().min(1).describe("Sender email address"),
    toEmail: z.string().min(1).describe("Recipient email address"),
    subject: z.string().optional().describe("Email subject line"),
    bodyText: z.string().optional().describe("Plain text email body"),
    bodyHtml: z.string().optional().describe("HTML email body"),
    byokApiKey: z
      .string()
      .optional()
      .describe("BYOK API key for AI provider"),
  })
  .refine((data) => data.bodyText || data.bodyHtml, {
    message: "bodyText or bodyHtml is required",
    path: ["bodyText"],
  })
  .openapi("QualifyRequest");

registry.registerPath({
  method: "post",
  path: "/v1/qualify",
  tags: ["Qualify"],
  summary: "Qualify an email reply",
  description:
    "Uses AI to qualify/classify an inbound email reply (interested, not interested, out-of-office, etc.)",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: QualifyRequestSchema } },
    },
  },
  responses: {
    200: { description: "Qualification result" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// BRAND
// ===================================================================

export const BrandScrapeRequestSchema = z
  .object({
    url: z.string().min(1).describe("Brand website URL to scrape"),
    skipCache: z
      .boolean()
      .optional()
      .describe("Skip cached results and force re-scrape"),
  })
  .openapi("BrandScrapeRequest");

export const IcpSuggestionRequestSchema = z
  .object({
    brandUrl: z.string().min(1).describe("Brand website URL"),
  })
  .openapi("IcpSuggestionRequest");

registry.registerPath({
  method: "post",
  path: "/v1/brand/scrape",
  tags: ["Brand"],
  summary: "Scrape brand info",
  description:
    "Scrape brand information from a URL using the scraping service",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: BrandScrapeRequestSchema } },
    },
  },
  responses: {
    200: { description: "Scraped brand information" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brand/by-url",
  tags: ["Brand"],
  summary: "Get brand by URL",
  description: "Get cached brand info by website URL",
  security: authed,
  request: {
    query: z.object({
      url: z.string().describe("Brand website URL"),
    }),
  },
  responses: {
    200: { description: "Cached brand information" },
    400: { description: "Missing url param", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brands",
  tags: ["Brand"],
  summary: "List brands",
  description: "Get all brands for the organization",
  security: authed,
  responses: {
    200: { description: "List of brands" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brands/{id}",
  tags: ["Brand"],
  summary: "Get a brand",
  description: "Get a single brand by ID",
  security: authed,
  request: { params: BrandIdParam },
  responses: {
    200: { description: "Brand data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brands/{id}/sales-profile",
  tags: ["Brand"],
  summary: "Get brand sales profile",
  description: "Get the sales profile for a specific brand",
  security: authed,
  request: { params: BrandIdParam },
  responses: {
    200: { description: "Brand sales profile" },
    401: { description: "Unauthorized", content: errorContent },
    404: { description: "Sales profile not found", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brand/sales-profiles",
  tags: ["Brand"],
  summary: "List sales profiles",
  description: "Get all sales profiles (brands) for the organization",
  security: authed,
  responses: {
    200: { description: "List of sales profiles" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/brand/icp-suggestion",
  tags: ["Brand"],
  summary: "Get ICP suggestion",
  description:
    "Get AI-generated Ideal Customer Profile suggestion (Apollo-compatible search params) for a brand URL",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: IcpSuggestionRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "ICP suggestion (Apollo-compatible search params)" },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brands/{id}/cost-breakdown",
  tags: ["Brand"],
  summary: "Get brand cost breakdown",
  description:
    "Get cost breakdown by cost name for all runs associated with a brand, from runs-service",
  security: authed,
  request: { params: BrandIdParam },
  responses: {
    200: { description: "Cost breakdown by cost name" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brands/{id}/runs",
  tags: ["Brand"],
  summary: "Get brand runs",
  description:
    "Get extraction runs for a brand (sales-profile, icp-extraction) enriched with cost data",
  security: authed,
  request: { params: BrandIdParam },
  responses: {
    200: { description: "Brand extraction runs with cost data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/brand/{id}",
  tags: ["Brand"],
  summary: "Get brand scrape result",
  description: "Get brand scrape result by scrape ID",
  security: authed,
  request: {
    params: z.object({ id: z.string().describe("Scrape ID") }),
  },
  responses: {
    200: { description: "Brand scrape result" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// WORKFLOWS
// ===================================================================

registry.registerPath({
  method: "get",
  path: "/v1/workflows",
  tags: ["Workflows"],
  summary: "List workflows",
  description:
    "List available workflows from the workflow-service, optionally filtered by category, channel, or audience type",
  security: authed,
  request: {
    query: z.object({
      appId: z.string().optional().describe("Application ID (defaults to 'mcpfactory')"),
      category: z.string().optional().describe("Filter by category (e.g. 'sales', 'pr')"),
      channel: z.string().optional().describe("Filter by channel (e.g. 'email')"),
      audienceType: z.string().optional().describe("Filter by audience type (e.g. 'cold-outreach')"),
    }),
  },
  responses: {
    200: { description: "List of workflows" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/workflows/{id}",
  tags: ["Workflows"],
  summary: "Get a workflow",
  description: "Get a single workflow with full DAG definition",
  security: authed,
  request: {
    params: z.object({ id: z.string().describe("Workflow ID") }),
  },
  responses: {
    200: { description: "Workflow with DAG" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/workflows/best",
  tags: ["Workflows"],
  summary: "Get best-performing workflow",
  description:
    "Returns the workflow with the lowest cost per outcome, filtered by category, channel, audience type, and objective",
  security: authed,
  request: {
    query: z.object({
      appId: z.string().optional().describe("Application ID (defaults to 'mcpfactory')"),
      category: z.string().optional().describe("Filter by category (e.g. 'sales')"),
      channel: z.string().optional().describe("Filter by channel (e.g. 'email')"),
      audienceType: z.string().optional().describe("Filter by audience type (e.g. 'cold-outreach')"),
      objective: z.string().optional().describe("Optimization objective ('replies' or 'clicks')"),
    }),
  },
  responses: {
    200: {
      description: "Best-performing workflow with DAG and stats",
      content: {
        "application/json": {
          schema: z
            .object({
              workflow: z.object({
                id: z.string(),
                name: z.string(),
                category: z.string(),
                channel: z.string(),
                audienceType: z.string(),
                signature: z.string(),
                signatureName: z.string(),
              }),
              dag: z.object({
                nodes: z.array(z.any()),
                edges: z.array(z.any()),
              }),
              stats: z.object({
                totalCostInUsdCents: z.number(),
                totalOutcomes: z.number(),
                costPerOutcome: z.number(),
                completedRuns: z.number(),
              }),
            })
            .openapi("BestWorkflowResponse"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

export const GenerateWorkflowRequestSchema = z
  .object({
    description: z
      .string()
      .min(10)
      .describe(
        "Natural language description of the desired workflow. Be specific about steps, services, and data flow."
      ),
    hints: z
      .object({
        services: z.array(z.string()).optional().describe("Scope generation to these services"),
        nodeTypes: z.array(z.string()).optional().describe("Suggest specific node types"),
        expectedInputs: z
          .array(z.string())
          .optional()
          .describe("Expected flow_input field names (e.g. campaignId, email)"),
      })
      .optional()
      .describe("Optional hints to guide DAG generation"),
  })
  .openapi("GenerateWorkflowRequest");

registry.registerPath({
  method: "post",
  path: "/v1/workflows/generate",
  tags: ["Workflows"],
  summary: "Generate a workflow DAG",
  description:
    "Uses AI to generate a workflow DAG from a natural language description. The generated workflow is validated and deployed automatically.",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: GenerateWorkflowRequestSchema },
      },
    },
  },
  responses: {
    200: {
      description: "Generated and deployed workflow",
      content: {
        "application/json": {
          schema: z
            .object({
              workflow: z.object({
                id: z.string().describe("Workflow ID"),
                name: z.string().describe("Auto-generated workflow name"),
                category: z.string().describe("Workflow category"),
                channel: z.string().describe("Communication channel"),
                audienceType: z.string().describe("Audience type"),
                signature: z.string().describe("SHA-256 hash of the canonical DAG"),
                signatureName: z.string().describe("Human-readable name for this DAG variant"),
                action: z.enum(["created", "updated"]).describe("Whether the workflow was created or updated"),
              }),
              dag: z.object({
                nodes: z.array(z.any()).describe("DAG nodes"),
                edges: z.array(z.any()).describe("DAG edges"),
              }),
              generatedDescription: z.string().describe("AI-generated description of the workflow"),
            })
            .openapi("GenerateWorkflowResponse"),
        },
      },
    },
    400: { description: "Invalid request", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    422: {
      description: "Could not generate a valid DAG",
      content: errorContent,
    },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// CAMPAIGNS SSE STREAM
// ===================================================================

registry.registerPath({
  method: "get",
  path: "/v1/campaigns/{id}/stream",
  tags: ["Campaigns"],
  summary: "Stream campaign updates (SSE)",
  description:
    "Server-Sent Events endpoint that pushes real-time campaign updates (new leads, emails, status changes). Connect with EventSource.",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: {
      description: "SSE stream of campaign events",
      content: {
        "text/event-stream": {
          schema: z.string().describe("Server-Sent Events stream"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// ACTIVITY
// ===================================================================

registry.registerPath({
  method: "post",
  path: "/v1/activity",
  tags: ["Activity"],
  summary: "Track user activity",
  description:
    "Records user activity event. Fires a lifecycle email deduped per user per day.",
  security: authed,
  responses: {
    200: {
      description: "Activity tracked",
      content: {
        "application/json": {
          schema: z
            .object({ ok: z.boolean() })
            .openapi("ActivityResponse"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// CHAT
// ===================================================================

export const ChatConfigRequestSchema = z
  .object({
    systemPrompt: z.string().min(1).describe("System prompt for the AI assistant"),
    mcpServerUrl: z.string().url().optional().describe("MCP server URL for tool calling"),
    mcpKeyName: z.string().min(1).optional().describe("MCP key name for auth resolution"),
  })
  .openapi("ChatConfigRequest");

export const ChatMessageRequestSchema = z
  .object({
    message: z.string().min(1).describe("User message text"),
    sessionId: z.string().uuid().optional().describe("Session ID for conversation continuity"),
    context: z.record(z.unknown()).optional().describe("Additional context for the AI"),
  })
  .openapi("ChatMessageRequest");

registry.registerPath({
  method: "put",
  path: "/v1/chat/config",
  tags: ["Chat"],
  summary: "Register chat app config",
  description:
    "Register or update app configuration for chat (system prompt, MCP server). Requires app key authentication.",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: ChatConfigRequestSchema } },
    },
  },
  responses: {
    200: { description: "Config registered" },
    401: { description: "Unauthorized", content: errorContent },
    403: { description: "App key required", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/chat",
  tags: ["Chat"],
  summary: "Stream chat response (SSE)",
  description:
    "Send a message and receive a streamed AI response via Server-Sent Events.",
  security: authed,
  request: {
    body: {
      content: { "application/json": { schema: ChatMessageRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "SSE stream of chat events (tokens, tool calls, buttons)",
      content: {
        "text/event-stream": {
          schema: z.string().describe("Server-Sent Events stream"),
        },
      },
    },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

// ===================================================================
// BILLING
// ===================================================================

export const SwitchBillingModeRequestSchema = z
  .object({
    mode: z.enum(["byok", "payg"]).describe("Billing mode to switch to"),
    reload_amount_cents: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Auto-reload amount in cents (for payg mode)"),
  })
  .openapi("SwitchBillingModeRequest");

export const DeductCreditsRequestSchema = z
  .object({
    amount_cents: z.number().int().positive().describe("Amount to deduct in cents"),
    description: z.string().min(1).describe("Reason for the deduction"),
    app_id: z.string().min(1).describe("App ID"),
    user_id: z.string().uuid().optional().describe("User ID"),
  })
  .openapi("DeductCreditsRequest");

export const CreateCheckoutSessionRequestSchema = z
  .object({
    success_url: z.string().url().describe("URL to redirect after successful payment"),
    cancel_url: z.string().url().describe("URL to redirect on cancellation"),
    reload_amount_cents: z
      .number()
      .int()
      .positive()
      .describe("Amount to reload in cents"),
  })
  .openapi("CreateCheckoutSessionRequest");

registry.registerPath({
  method: "get",
  path: "/v1/billing/accounts",
  tags: ["Billing"],
  summary: "Get billing account",
  description: "Get or create the billing account for the organization",
  security: authed,
  responses: {
    200: { description: "Billing account data" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/billing/accounts/balance",
  tags: ["Billing"],
  summary: "Get account balance",
  description:
    "Quick check of current balance, billing mode, and depletion status",
  security: authed,
  responses: {
    200: { description: "Balance info" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/billing/accounts/transactions",
  tags: ["Billing"],
  summary: "Get transaction history",
  description: "List billing transactions for the organization",
  security: authed,
  responses: {
    200: { description: "Transaction list" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "patch",
  path: "/v1/billing/accounts/mode",
  tags: ["Billing"],
  summary: "Switch billing mode",
  description: "Switch between billing modes (byok, payg)",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: SwitchBillingModeRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Mode switched" },
    400: { description: "Invalid transition", content: errorContent },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/billing/credits/deduct",
  tags: ["Billing"],
  summary: "Deduct credits",
  description: "Deduct credits from the organization's billing account",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: DeductCreditsRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Credits deducted" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/billing/checkout-sessions",
  tags: ["Billing"],
  summary: "Create Stripe checkout session",
  description: "Create a Stripe checkout session for purchasing credits",
  security: authed,
  request: {
    body: {
      content: {
        "application/json": { schema: CreateCheckoutSessionRequestSchema },
      },
    },
  },
  responses: {
    200: { description: "Checkout session created with URL" },
    401: { description: "Unauthorized", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/billing/webhooks/stripe/{appId}",
  tags: ["Billing"],
  summary: "Stripe webhook",
  description:
    "Stripe webhook endpoint. No authentication — Stripe validates via signature header.",
  request: {
    params: z.object({
      appId: z.string().describe("App ID"),
    }),
  },
  responses: {
    200: { description: "Webhook processed" },
    400: { description: "Invalid signature", content: errorContent },
    500: { description: "Internal error", content: errorContent },
  },
});

