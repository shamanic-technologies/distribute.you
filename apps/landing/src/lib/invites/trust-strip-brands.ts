/**
 * Server-side brand fetch for the /get-started trust strip.
 *
 * Tries the public brand-service stats endpoint via api-service. Returns at
 * most N brand domains for the trust-strip logos. ISR-friendly via
 * `unstable_cache` so the rebuild after invalidation is instant.
 */

import { unstable_cache } from "next/cache";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

const TRUST_STRIP_TAG = "trust-strip-brands";

export interface TrustStripBrand {
  domain: string;
  name: string;
}

export const fetchTrustStripBrands = unstable_cache(
  async (limit = 12): Promise<TrustStripBrand[]> => {
    try {
      const res = await fetch(`${API_URL}/v1/public/brands/recent?limit=${limit}`, {
        next: { tags: [TRUST_STRIP_TAG] },
      });
      if (!res.ok) {
        console.error(`[landing] trust-strip brands fetch HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { brands?: Array<{ domain?: string; name?: string }> };
      const out: TrustStripBrand[] = [];
      for (const b of data.brands || []) {
        if (b.domain && b.name) {
          out.push({ domain: b.domain, name: b.name });
        }
      }
      return out;
    } catch (err) {
      console.error("[landing] trust-strip brands fetch failed", err);
      return [];
    }
  },
  ["trust-strip-brands"],
  { revalidate: 300, tags: [TRUST_STRIP_TAG] },
);
