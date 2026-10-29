import { renderedResponse } from "@/lib/static-html";
import { renderCatalogPage } from "@/lib/pages/catalog";
import { fetchPlatformPrices } from "@/lib/platform-prices";

export const revalidate = 3600;

/**
 * The live cost catalogue, through the gateway (`lib/platform-prices.ts`). A failed
 * read renders the page with an explicit "could not be read" block and logs loud: an
 * empty list would read as "nothing is priced".
 */
export async function GET(request: Request) {
  return renderedResponse(renderCatalogPage(await fetchPlatformPrices("/catalog")), request);
}
