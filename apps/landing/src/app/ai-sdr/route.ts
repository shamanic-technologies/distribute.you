import { renderedResponse } from "@/lib/static-html";
import { renderAiSdrPage } from "@/lib/pages/ai-sdr";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";

// Literal (Next reads it statically): the fleet indexes and the client counts the page
// states record a new day every hour.
export const revalidate = 1800;

/**
 * The AI SDR page (Meetings Booked, AI Agent buyer, PAGE-AI-SDR-1029). Its price list is
 * READ from the public cost catalogue, like the homepage's; the fleet figures and client
 * counts are resolved by `renderedResponse`. A failed read drops its own figure.
 */
export async function GET(request: Request) {
  const prices = await fetchPlatformPrices("/ai-sdr");
  return renderedResponse(withActionPrices(renderAiSdrPage(), prices), request, {
    canonicalPath: "/ai-sdr",
    sMaxAge: prices ? 1800 : 60,
  });
}
