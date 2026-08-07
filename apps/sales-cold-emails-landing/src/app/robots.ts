import { MetadataRoute } from "next";

// Constant output, but `output: "export"` needs that stated rather than inferred.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://salescoldemail.distribute.you/sitemap.xml",
  };
}
