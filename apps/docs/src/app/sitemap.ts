import { MetadataRoute } from "next";
import { DOCS_ROUTES, docsUrl } from "@/lib/docs-routes";

// The route list is a hardcoded literal, so this is already a constant, but
// under `output: "export"` Next refuses to guess that and needs it said.
// Without this the whole build fails rather than emitting a stale sitemap,
// which is the right way round: a sitemap that silently froze would be worse.
export const dynamic = "force-static";

// Routes come from `DOCS_ROUTES`, the same list the pages read their titles,
// descriptions and canonicals from. A sitemap kept as a second hand-written
// list drifts the moment a page is added, and a page absent from the sitemap
// is a page a crawler has to stumble onto.
export default function sitemap(): MetadataRoute.Sitemap {
  return DOCS_ROUTES.map((route) => ({
    url: docsUrl(route.path),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route.path === "/" ? 1 : 0.8,
  }));
}
