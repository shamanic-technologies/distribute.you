import { MetadataRoute } from "next";
import { PROD_URLS } from "@/lib/env-urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = PROD_URLS.landing;

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
