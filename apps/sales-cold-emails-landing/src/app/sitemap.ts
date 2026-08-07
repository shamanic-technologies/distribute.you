import { MetadataRoute } from "next";

// Constant output, but `output: "export"` needs that stated rather than inferred.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://salescoldemail.distribute.you";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
