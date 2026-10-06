import { URLS } from "@distribute/content";
import { renderedResponse } from "@/lib/static-html";
import { renderCatalogPage, type PlatformPrice } from "@/lib/pages/catalog";

export const revalidate = 3600;

/**
 * The live cost catalogue, through the gateway (the one public surface this landing
 * reads). A failed read renders the page with an explicit "could not be read" block
 * and logs loud: an empty list would read as "nothing is priced".
 */
async function fetchPlatformPrices(): Promise<PlatformPrice[] | null> {
  const base = (process.env.API_SERVICE_URL || URLS.api).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/costs/platform-prices`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body: unknown = await res.json();
    if (!Array.isArray(body)) throw new Error("body is not an array");
    return body as PlatformPrice[];
  } catch (err) {
    console.error("[landing] /catalog: /v1/costs/platform-prices read failed", err);
    return null;
  }
}

export async function GET(request: Request) {
  return renderedResponse(renderCatalogPage(await fetchPlatformPrices()), request);
}
