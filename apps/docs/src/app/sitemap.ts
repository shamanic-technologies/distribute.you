import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://docs.distribute.you";

  const routes = [
    "",
    "/quickstart",
    "/authentication",
    "/mcp",
    "/api",
    "/api/campaigns",
    "/api/results",
    "/api/webhooks",
    "/integrations",
    "/integrations/chatgpt",
    "/integrations/claude",
    "/integrations/cursor",
    "/integrations/cursor-skill",
    "/integrations/n8n",
    "/integrations/zapier",
    "/integrations/make",
    "/sales-outreach",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));
}
