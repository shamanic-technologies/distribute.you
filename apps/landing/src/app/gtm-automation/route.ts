import { renderedResponse } from "@/lib/static-html";
import { renderGtmAutomationPage, withGtmPrices } from "@/lib/pages/gtm-automation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet indexes and the client counts the page
// states record a new day every hour.
export const revalidate = 1800;

/**
 * The GTM automation page (GTM, AI Agent buyer, PAGE-GTM-AUTOMATION-1030). The price of
 * each step the agent runs and the price list are READ from the public cost catalogue in
 * one call; the fleet figures and client counts are resolved by `renderedResponse`. A
 * failed read drops its own figures and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/gtm-automation");
  return renderedResponse(withActionPrices(withGtmPrices(renderGtmAutomationPage(), prices), prices), request, {
    canonicalPath: "/gtm-automation",
    sMaxAge: prices ? 1800 : 60,
  });
}
