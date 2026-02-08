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
  type: "apiKey",
  in: "header",
  name: "Authorization",
  description: "Bearer JWT from Clerk (dashboard)",
});

registry.registerComponent("securitySchemes", "apiKey", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
  description: "API key for MCP clients and service-to-service communication",
});

const authed: Record<string, string[]>[] = [{ bearerAuth: [] }, { apiKey: [] }];

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
// WEBHOOKS
// ===================================================================

registry.registerPath({
  method: "post",
  path: "/webhooks/clerk",
  tags: ["Webhooks"],
  summary: "Clerk webhook receiver",
  description:
    "Receives Clerk lifecycle events (user.created, session.created). Verified via svix signature headers.",
  responses: {
    200: {
      description: "Webhook received",
      content: {
        "application/json": {
          schema: z
            .object({ received: z.boolean() })
            .openapi("WebhookResponse"),
        },
      },
    },
    400: { description: "Invalid signature or missing headers", content: errorContent },
    500: { description: "Webhook not configured", content: errorContent },
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
              authType: z.enum(["jwt", "api_key"]).optional(),
              user: z.any().describe("User object from client-service"),
              org: z.any().describe("Organization object from client-service"),
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
    brandUrl: z.string().optional().describe("Brand website URL to scrape"),
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
    "Create a new outreach campaign. Optionally scrapes brand URL first.",
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
  path: "/v1/campaigns/{id}/debug",
  tags: ["Campaigns"],
  summary: "Get campaign debug info",
  description: "Get detailed debug information for a campaign",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign debug data" },
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
  path: "/v1/campaigns/{id}/companies",
  tags: ["Campaigns"],
  summary: "Get campaign companies",
  description:
    "Get all companies for a campaign with aggregated enrichment costs",
  security: authed,
  request: { params: CampaignIdParam },
  responses: {
    200: { description: "Campaign companies with aggregated costs" },
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
  summary: "Add a BYOK key",
  description:
    "Store a new BYOK API key for a provider (e.g. openai, anthropic, apollo)",
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
      clerkOrgId: z.string().describe("Clerk organization ID"),
    }),
  },
  responses: {
    200: { description: "Decrypted key" },
    400: { description: "Missing clerkOrgId", content: errorContent },
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
