import { MetadataRoute } from "next";

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
