import { MetadataRoute } from "next";
import { ENV_URLS } from "@/lib/env-urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = ENV_URLS.landing;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
