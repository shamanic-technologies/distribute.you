/**
 * The ONE question the anonymous flow asks brand-service directly.
 *
 * Everything else the signed-out wizard does with a brand goes through the
 * gateway, as an ordinary org-scoped call. This cannot: it is asked BEFORE
 * there is a session, before there is an org, and before anything has been
 * created — which is the entire point. Once a brand exists we have already
 * scraped a website that may belong to a paying customer.
 *
 * The answer is a BOOLEAN and brand-service says, in its own words, not to
 * widen it: the caller is acting for somebody with no account, so nothing
 * identifying the claimant may cross. Do not ask this module for an org id, a
 * name or a count — it is not withholding them, they are not in the response.
 *
 * Reached on the compose network, so nothing here crosses the public edge.
 *
 * The key cannot reach a browser: Next inlines only `NEXT_PUBLIC_*` into a
 * client bundle, so a bare `process.env` read resolves to `undefined` there.
 */

const BRAND_SERVICE_URL = process.env.BRAND_SERVICE_URL;
const BRAND_SERVICE_API_KEY = process.env.BRAND_SERVICE_API_KEY;

/** Long enough for a cold service, short enough not to hold the first screen. */
const TIMEOUT_MS = 8_000;

/**
 * Does anybody already own the brand behind this website?
 *
 * `"unknown"` is a first-class answer and the caller treats it exactly like
 * `"claimed"` — see `anon-session-start.ts` for why failing closed here is the
 * cheap mistake. It is never swallowed into `"unclaimed"`, which is the one
 * reading that would start spending on somebody else's domain.
 */
export async function domainClaim(domain: string): Promise<"claimed" | "unclaimed" | "unknown"> {
  if (!BRAND_SERVICE_URL || !BRAND_SERVICE_API_KEY) {
    console.error("[brand-service] BRAND_SERVICE_URL / BRAND_SERVICE_API_KEY not set");
    return "unknown";
  }

  try {
    const res = await fetch(`${BRAND_SERVICE_URL}/internal/brands/domain-claimed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": BRAND_SERVICE_API_KEY },
      // In the BODY, not the path: brand-service put it there so a stranger's
      // website does not land in access logs and proxy traces.
      body: JSON.stringify({ domain }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      // A 400 is a domain brand-service will not parse, which is not the same
      // as an outage — but it is still not a yes, and the website rule has
      // already had its say, so both read as "we could not check".
      console.error(`[brand-service] domain-claimed: ${res.status}`);
      return "unknown";
    }

    const body = (await res.json()) as { claimed?: unknown };
    if (typeof body.claimed !== "boolean") {
      console.error("[brand-service] domain-claimed: response shape mismatch", body);
      return "unknown";
    }
    return body.claimed ? "claimed" : "unclaimed";
  } catch (err) {
    console.error("[brand-service] domain-claimed errored:", err);
    return "unknown";
  }
}
