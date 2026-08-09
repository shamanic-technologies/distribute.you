import { MetadataRoute } from "next";

// The route list below is a hardcoded literal, so this is already a constant —
// but under `output: "export"` Next refuses to guess that and needs it said.
// Without this the whole build fails rather than emitting a stale sitemap, which
// is the right way round: a sitemap that silently froze would be worse.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docs.distribute.you";

  const routes = [
    "",
    "/quickstart",
    "/authentication",
    "/mcp",
    "/mcp/installation",
    "/mcp/tools",
    "/api",
    "/api/brands",
    "/api/features",
    "/api/campaigns",
    "/api/workflows",
    "/api/leads",
    "/api/emails",
    "/api/outlets",
    "/api/journalists",
    "/api/articles",
    "/api/press-kits",
    "/api/billing",
    "/api/costs",
    "/api/webhooks",
    "/integrations",
    "/integrations/claude",
    "/integrations/claude-desktop",
    "/integrations/cursor",
    "/integrations/chatgpt",
    "/integrations/n8n",
    "/integrations/zapier",
    "/integrations/make",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));
}
