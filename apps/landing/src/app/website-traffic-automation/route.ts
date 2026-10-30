import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { renderWebsiteTrafficAutomationPage } from "@/lib/pages/website-traffic-automation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the indexes and fleet figures record a new day every hour.
export const revalidate = 1800;

/**
 * The website traffic automation page (Website Visits, AI Agent buyer, PAGE-TRAFFIC-1030). The
 * website visit indexes and the price list are READ live; the fleet figures are resolved by
 * `renderedResponse`. A failed read drops its own block and points at the catalog.
 */
export async function GET(request: Request) {
  const [list, prices] = await Promise.all([fetchIndexList(), fetchPlatformPrices("/website-traffic-automation")]);
  return renderedResponse(withActionPrices(renderWebsiteTrafficAutomationPage(list), prices), request, {
    canonicalPath: "/website-traffic-automation",
    sMaxAge: list && prices ? 1800 : 60,
  });
}
