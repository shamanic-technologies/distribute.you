import { renderedResponse } from "@/lib/static-html";
import { renderLeadNurturingAutomationPage } from "@/lib/pages/lead-nurturing-automation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet figures the page states record a new day every hour.
export const revalidate = 1800;

/**
 * The lead nurturing automation page (Lead Nurturing, AI Agent buyer,
 * PAGE-LEAD-NURTURING-AUTOMATION-1030). The price list is READ from the public cost catalogue;
 * the fleet figures are resolved by `renderedResponse`. A failed read drops its own figure
 * and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/lead-nurturing-automation");
  return renderedResponse(withActionPrices(renderLeadNurturingAutomationPage(), prices), request, {
    canonicalPath: "/lead-nurturing-automation",
    sMaxAge: prices ? 1800 : 60,
  });
}
