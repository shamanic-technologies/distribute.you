import "server-only";

/**
 * Server-side reader for the public brand view at `/share/<token>`.
 *
 * The page has no Clerk session by construction, so this goes to api-service
 * directly with the platform key, exactly as `apps/admin`'s `report-api.ts` does
 * for its own public report. Nothing here is reachable from the browser.
 *
 * The credential travels in the request BODY, matching brand-service: a share
 * credential in a URL lands in access logs and proxy traces, and this one is
 * exactly the secret that must not leak.
 *
 * WHAT COMES BACK is brand-service's own public-safe brand payload — the same
 * shape `GET /public/brands/{id}` already serves — PLUS the org that brand
 * belongs to. The org is what makes the full share view possible: every outreach
 * figure the shared pages render is served per-organisation, so the credential
 * alone opens nothing. It comes from the producer because the producer is the one
 * that knows; this file must never derive or look it up some other way.
 *
 * The org id is NOT a second credential and is never treated as one. It only ever
 * reaches the share proxy, which pairs it with the brand this same call named and
 * refuses every read that is not about that brand.
 */

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

export interface SharedBrand {
  id: string;
  name: string;
  domain: string | null;
  url: string | null;
  logoUrl: string | null;
  /** The organisation that owns this brand, per brand-service's own resolve. */
  orgId: string;
}

/**
 * The brand a credential opens, or null when it opens nothing.
 *
 * Unknown, revoked and rotated-away credentials are one outcome by design: the
 * caller learns that the link opens nothing, never which of the three it is.
 * Any other failure throws, so a real outage never reads as "link not found".
 */
export async function resolveShareToken(shareToken: string): Promise<SharedBrand | null> {
  if (!API_KEY) {
    // Fail loud: a missing platform key is a deploy fault, not an empty page.
    throw new Error("[dashboard] ADMIN_DISTRIBUTE_API_KEY is not set");
  }
  if (!shareToken || shareToken.trim() === "") return null;

  const res = await fetch(`${API_URL}/v1/share-tokens/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // `X-API-Key`, NOT `Authorization: Bearer`. api-service has two auth
      // paths and they are not interchangeable: the platform key travels in
      // `X-API-Key`, while `Bearer` is reserved for a `distrib.usr_*` user key
      // validated through key-service. Sending the platform key as a Bearer is
      // rejected, and because this route has no session to fall back on, the
      // rejection surfaces as a 500 on the public page. The dashboard's own
      // `/api/v1` proxy and `apps/admin`'s public report both use this header.
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ shareToken }),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`[dashboard] POST /v1/share-tokens/resolve → ${res.status}`);
  }

  const body = (await res.json()) as {
    brandId?: string;
    orgId?: string;
    brand?: {
      id?: string;
      name?: string;
      domain?: string | null;
      url?: string | null;
      logoUrl?: string | null;
    };
  };

  const brand = body.brand;
  if (!brand?.id || !brand.name) {
    // The credential resolved but the payload is not a brand. Fail loud rather
    // than rendering a page with a blank identity.
    console.error("[dashboard] resolveShareToken: unexpected payload", body);
    throw new Error("[dashboard] resolveShareToken: invalid response shape");
  }
  if (!body.orgId) {
    // No org means no figures: every shared page reads per-organisation. Fail
    // loud rather than degrading to the identity-only card, which would look
    // like a deliberate product decision instead of a broken chain.
    console.error("[dashboard] resolveShareToken: response carries no org", body);
    throw new Error("[dashboard] resolveShareToken: response carries no org");
  }

  return {
    id: brand.id,
    name: brand.name,
    domain: brand.domain ?? null,
    url: brand.url ?? null,
    logoUrl: brand.logoUrl ?? null,
    orgId: body.orgId,
  };
}
