import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { renderWebsiteTrafficAgencyPage } from "@/lib/pages/website-traffic-agency";

// Literal (Next reads it statically): the indexes record a new day every hour.
export const revalidate = 1800;

/**
 * The Website Traffic Agency page (Website Visits, Agency buyer, PAGE-TRAFFIC-1030). Its live
 * read drops its own block on failure; the page itself always renders.
 */
export async function GET(request: Request) {
  const list = await fetchIndexList();
  return renderedResponse(renderWebsiteTrafficAgencyPage(list), request, {
    canonicalPath: "/website-traffic-agency",
    sMaxAge: list ? 1800 : 60,
  });
}
