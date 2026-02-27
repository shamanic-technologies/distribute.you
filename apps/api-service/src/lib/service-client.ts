/**
 * Service client for calling other mcpfactory services
 * All services require API key authentication via X-API-Key header
 */

export const externalServices = {
  client: {
    url: process.env.CLIENT_SERVICE_URL || "http://localhost:3002",
    apiKey: process.env.CLIENT_SERVICE_API_KEY || "",
  },
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
  workflow: {
    url: process.env.WORKFLOW_SERVICE_URL || "https://workflow.mcpfactory.org",
    apiKey: process.env.WORKFLOW_SERVICE_API_KEY || "",
  },
  billing: {
    url: process.env.BILLING_SERVICE_URL || "http://localhost:3020",
    apiKey: process.env.BILLING_SERVICE_API_KEY || "",
  },
  chat: {
    url: process.env.CHAT_SERVICE_URL || "http://localhost:3021",
    apiKey: process.env.CHAT_SERVICE_API_KEY || "",
  },
};

interface ServiceCallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
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

/**
 * Stream an external service SSE response directly to the Express response.
 * Does NOT buffer or parse — pipes chunks through for real-time streaming.
 */
export async function streamExternalService(
  service: { url: string; apiKey: string },
  path: string,
  options: ServiceCallOptions & { expressRes: import("express").Response }
): Promise<void> {
  const { method = "POST", body, headers = {}, expressRes } = options;
  const url = `${service.url}${path}`;

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
    expressRes.status(response.status).json({ error: errorText || `Upstream error: ${response.status}` });
    return;
  }

  expressRes.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  expressRes.flushHeaders();

  const reader = response.body?.getReader();
  if (!reader) {
    expressRes.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
    expressRes.end();
    return;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      expressRes.write(value);
    }
  } catch (err) {
    console.error("[streamExternalService] Stream error:", (err as Error).message);
  } finally {
    expressRes.end();
  }
}
