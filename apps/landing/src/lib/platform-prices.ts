import { URLS } from "@distribute/content";
import { parsePlatformPrices, type PlatformPrice } from "./pages/catalog";

/**
 * The live public cost catalogue, through the gateway: what `/catalog` lists and what
 * the homepage prices each action at. A failed read returns null and logs loud: an
 * empty list would read as "nothing is priced".
 */
export async function fetchPlatformPrices(caller: string): Promise<PlatformPrice[] | null> {
  const base = (process.env.API_SERVICE_URL || URLS.api).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/v1/costs/platform-prices`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    } as RequestInit);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return parsePlatformPrices(await res.json());
  } catch (err) {
    console.error(`[landing] ${caller}: /v1/costs/platform-prices read failed`, err);
    return null;
  }
}
