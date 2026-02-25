/**
 * Internal service client for calling other mcpfactory services
 * No auth needed for internal services (Railway private networking)
 */

// Internal services (no auth - private network)
export const services = {
  client: process.env.CLIENT_SERVICE_URL || "http://localhost:3002",
};

// External services (need API key)
export const externalServices = {
  emailgen: {
    url: process.env.CONTENT_GENERATION_SERVICE_URL || "https://content-generation.mcpfactory.org",
    apiKey: process.env.CONTENT_GENERATION_SERVICE_API_KEY || "",
  },
  lead: {
    url: process.env.LEAD_SERVICE_URL || "http://localhost:3006",
    apiKey: process.env.LEAD_SERVICE_API_KEY || "",
  },
  campaign: {
    url: process.env.CAMPAIGN_SERVICE_URL || "http://localhost:3004",
    apiKey: process.env.CAMPAIGN_SERVICE_API_KEY || "",
  },
  key: {
    url: process.env.KEY_SERVICE_URL || "http://localhost:3001",
    apiKey: process.env.KEY_SERVICE_API_KEY || "",
  },
  replyQualification: {
    url: process.env.REPLY_QUALIFICATION_SERVICE_URL || "http://localhost:3006",
    apiKey: process.env.REPLY_QUALIFICATION_SERVICE_API_KEY || "",
  },
  scraping: {
    url: process.env.SCRAPING_SERVICE_URL || "http://localhost:3010",
    apiKey: process.env.SCRAPING_SERVICE_API_KEY || "",
  },
  emailSending: {
    url: process.env.EMAIL_GATEWAY_SERVICE_URL || "http://localhost:3009",
    apiKey: process.env.EMAIL_GATEWAY_SERVICE_API_KEY || "",
  },
  lifecycle: {
    url: process.env.LIFECYCLE_EMAILS_SERVICE_URL || "http://localhost:3008",
    apiKey: process.env.LIFECYCLE_EMAILS_SERVICE_API_KEY || "",
  },
  brand: {
    url: process.env.BRAND_SERVICE_URL || "https://brand.mcpfactory.org",
    apiKey: process.env.BRAND_SERVICE_API_KEY || "",
  },
  runs: {
    url: process.env.RUNS_SERVICE_URL || "https://runs.mcpfactory.org",
    apiKey: process.env.RUNS_SERVICE_API_KEY || "",
  },
  windmill: {
    url: process.env.WINDMILL_SERVICE_URL || "https://windmill.mcpfactory.org",
    apiKey: process.env.WINDMILL_SERVICE_API_KEY || "",
  },
};

interface ServiceCallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

// Call internal service (no auth)
export async function callService<T>(
  serviceUrl: string,
  path: string,
  options: ServiceCallOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const url = `${serviceUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Service call failed: ${response.status}`);
  }

  return response.json();
}

// Call external service (with API key)
export async function callExternalService<T>(
  service: { url: string; apiKey: string },
  path: string,
  options: ServiceCallOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const url = `${service.url}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": service.apiKey,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `Service call failed: ${response.status}`);
      } catch {
        throw new Error(`Service call failed: ${response.status} - ${errorText}`);
      }
    }

    return response.json();
  } catch (error: any) {
    console.error(`[callExternalService] Fetch error for ${path}:`, error.message);
    throw error;
  }
}
