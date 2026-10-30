import { renderedResponse } from "@/lib/static-html";
import { fetchIndexList } from "@/lib/fleet-indexes";
import { renderAiAdManagementPage } from "@/lib/pages/ai-ad-management";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the indexes and fleet figures record a new day every hour.
export const revalidate = 1800;

/**
 * The AI ad management page (Paid Acquisition, AI Agent buyer, PAGE-TRAFFIC-1030). The website
 * visit indexes and the price list are READ live; the fleet figures are resolved by
 * `renderedResponse`. A failed read drops its own block and points at the catalog.
 */
export async function GET(request: Request) {
  const [list, prices] = await Promise.all([fetchIndexList(), fetchPlatformPrices("/ai-ad-management")]);
  return renderedResponse(withActionPrices(renderAiAdManagementPage(list), prices), request, {
    canonicalPath: "/ai-ad-management",
    sMaxAge: list && prices ? 1800 : 60,
  });
}
