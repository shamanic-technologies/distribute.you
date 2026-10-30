import { renderedResponse } from "@/lib/static-html";
import { renderColdEmailAutomationPage, withColdEmailPrices } from "@/lib/pages/cold-email-automation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet indexes and the client counts the page
// states record a new day every hour.
export const revalidate = 1800;

/**
 * The cold email automation page (Sales Cold Email, AI Agent buyer,
 * PAGE-COLD-EMAIL-AUTOMATION-1030). The price of each workflow step, the send tiers and
 * the price list are READ from the public cost catalogue in one call; the fleet figures
 * and client counts are resolved by `renderedResponse`. A failed read drops its own
 * figures and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/cold-email-automation");
  return renderedResponse(withActionPrices(withColdEmailPrices(renderColdEmailAutomationPage(), prices), prices), request, {
    canonicalPath: "/cold-email-automation",
    sMaxAge: prices ? 1800 : 60,
  });
}
