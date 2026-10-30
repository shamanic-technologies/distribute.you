import { renderedResponse } from "@/lib/static-html";
import { renderAiCustomerSuccessPage } from "@/lib/pages/ai-customer-success";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet figures the page states record a new day every hour.
export const revalidate = 1800;

/**
 * The AI customer success page (Customer Success, AI Agent buyer, PAGE-AI-CUSTOMER-SUCCESS-1030).
 * The price list is READ from the public cost catalogue; the fleet figures are resolved by
 * `renderedResponse`. A failed read drops its own figure and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/ai-customer-success");
  return renderedResponse(withActionPrices(renderAiCustomerSuccessPage(), prices), request, {
    canonicalPath: "/ai-customer-success",
    sMaxAge: prices ? 1800 : 60,
  });
}
