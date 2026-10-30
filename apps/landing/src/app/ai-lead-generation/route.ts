import { renderedResponse } from "@/lib/static-html";
import { renderAiLeadGenerationPage, withLeadReceipt } from "@/lib/pages/ai-lead-generation";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet indexes and the client counts the page
// states record a new day every hour.
export const revalidate = 1800;

/**
 * The AI lead generation page (Lead Generation, AI Agent buyer, PAGE-AI-LEAD-GEN-1029).
 * The hero receipt and the price list are READ from the public cost catalogue; the fleet
 * figures and client counts are resolved by `renderedResponse`. A failed read drops its
 * own figure and points at the catalog.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/ai-lead-generation");
  return renderedResponse(withActionPrices(withLeadReceipt(renderAiLeadGenerationPage(), prices), prices), request, {
    canonicalPath: "/ai-lead-generation",
    sMaxAge: prices ? 1800 : 60,
  });
}
