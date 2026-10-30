import { renderedResponse } from "@/lib/static-html";
import { renderSignupAutomationPage } from "@/lib/pages/signup-automation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet figures the page states record a new day every hour.
export const revalidate = 1800;

/**
 * The Signup Automation page (Signups, AI Agent buyer, PAGE-SIGNUP-AUTOMATION-1030). The price
 * list is READ from the public cost catalogue; the fleet figures are resolved by
 * `renderedResponse`. A failed read drops its own figures and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/signup-automation");
  return renderedResponse(withActionPrices(renderSignupAutomationPage(), prices), request, {
    canonicalPath: "/signup-automation",
    sMaxAge: prices ? 1800 : 60,
  });
}
