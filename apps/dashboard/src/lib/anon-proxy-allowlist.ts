/**
 * What a SIGNED-OUT browser is allowed to ask the gateway for.
 *
 * The anonymous half of onboarding calls the same api helpers the authed half
 * does, so the proxy behind it is a write surface with no Clerk session in
 * front of it. This module is the boundary. It is a CLOSED ALLOWLIST of
 * (method, path) pairs — not a denylist, not a prefix rule — because the
 * failure direction of a denylist is that a route nobody thought about is
 * reachable, and some of the routes nobody thought about spend money on
 * somebody's behalf.
 *
 * Two things are absent BY CONSTRUCTION rather than by a check, which is what
 * makes the no-outreach promise structural: nothing that sends (instantly,
 * campaigns, email-gateway, leads) and nothing that charges (billing, stripe,
 * credits) has an entry here. A future contributor adding outreach to the
 * signed-out flow has to add a line to this file, which is a line a reviewer
 * can see.
 *
 * The BRAND BINDING is the other half. Brand identity and extracted fields are
 * keyed on the brand alone with no org column, so a session that could name any
 * brand id could read any customer's scraped site and extracted offer. Every
 * brand-scoped rule therefore matches the session's OWN brand and nothing else.
 *
 * Alias-free so it carries real unit tests. Keep it that way.
 */

/** The methods a rule may permit. */
export type AnonMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Rule {
  method: AnonMethod;
  /** Segments. `:brand` must equal the session's brand; `:seg` is any single
   *  non-empty segment; anything else matches literally. */
  segments: string[];
  /** A query parameter that must be present and equal the session's brand, for a
   *  route that names the brand in its query rather than its path. */
  queryBrand?: string;
}

/**
 * The closed set.
 *
 * Every entry is a call the wizard makes before the account exists, and each
 * one is org-scoped at the producer — so it writes onto the anonymous org and
 * can touch nobody else's rows. The two `/orgs/audiences` entries are the only
 * non-brand-scoped writes, and they are org-keyed at human-service, which is
 * what bounds them.
 */
const RULES: Rule[] = [
  // ── The brand this session is building ───────────────────────────────
  { method: "POST", segments: ["brands"] },
  { method: "GET", segments: ["brands", ":brand"] },
  { method: "POST", segments: ["brands", "extract-fields"] },
  { method: "GET", segments: ["brands", ":brand", "user-fields"] },
  { method: "PUT", segments: ["brands", ":brand", "user-fields"] },
  { method: "GET", segments: ["brands", ":brand", "offers"] },
  { method: "GET", segments: ["brands", ":brand", "sales-economics-effective"] },
  { method: "PUT", segments: ["brands", ":brand", "click-destination"] },
  // The no-website path's only source: there is no site to scrape, so the
  // pasted business context IS what the extraction reads. Without this the
  // whole no-website walk 403s one call after the brand is created.
  { method: "PUT", segments: ["brands", ":brand", "business-context"] },
  { method: "POST", segments: ["brands", ":brand", "icp", "suggest"] },
  // Step 3 of /get-started: the brand's distinct offers, proposed from what the site
  // says it sells, then the ONE the visitor picks confirmed on the brand. Both are
  // path-bound to this session's brand.
  { method: "POST", segments: ["brands", ":brand", "offers", "proposals"] },
  { method: "POST", segments: ["brands", ":brand", "offers", "confirm"] },
  // Steps 6 to 8 of /get-started: what a client is worth and the offer's six points +
  // give lists, saved on the offer picked at step 3, before any first message is
  // drafted (it is drafted from them). Path-bound to this session's brand; brand-service
  // refuses an offer that is not the brand's.
  { method: "PUT", segments: ["brands", ":brand", "offers", ":seg", "economics"] },
  { method: "PUT", segments: ["brands", ":brand", "offers", ":seg", "user-fields"] },
  // The sales path steps of /get-started: the steps and legs ticked for the offer
  // (brand-service), the brand's conversion rate per leg, read and overwritten from the
  // paths' detail (brand-service), and the paths those legs make, ranked by expected ROI
  // (features-service). The ranking names the brand in its QUERY, bound below.
  { method: "GET", segments: ["brands", ":brand", "offers", ":seg", "sales-path"] },
  { method: "PUT", segments: ["brands", ":brand", "offers", ":seg", "sales-path"] },
  { method: "GET", segments: ["brands", ":brand", "leg-rates"] },
  { method: "PUT", segments: ["brands", ":brand", "leg-rates"] },
  { method: "GET", segments: ["offers", ":seg", "sales-paths"], queryBrand: "brandId" },

  // ── The audiences we assemble for it ─────────────────────────────────
  { method: "GET", segments: ["orgs", "audiences"] },
  { method: "POST", segments: ["orgs", "audiences", "suggest"] },
  // Step 4: who the brand sells to, split into at most 6 audiences in words (no search,
  // no count), then the ONE picked created under the picked offer. Both bodies name the
  // brand, which `anonBodyRefusal` binds to the session.
  { method: "POST", segments: ["orgs", "audiences", "split"] },
  { method: "POST", segments: ["orgs", "audiences", "split", "confirm"] },
  // Step 5: up to 100 companies of the picked audience with one person each (names and
  // titles, last names masked, never an address), built page by page; and one row's
  // person found and verified live (the first 10 rows, billed to this anonymous org,
  // sends nothing). Same bound as the sample: human-service checks the audience
  // against the org. No body.
  { method: "GET", segments: ["orgs", "audiences", ":seg", "preview", "companies"] },
  { method: "POST", segments: ["orgs", "audiences", ":seg", "preview", "companies", ":seg", "email-check"] },

  // ── One written preview for one sampled person, billed to this anonymous org ──
  // It WRITES and never sends: nothing it creates can go out. Its body names the
  // brand, which `anonBodyRefusal` binds to the session.
  { method: "POST", segments: ["content", "preview-email"] },

  // ── What the projection screen reads. All reads. ─────────────────────
  { method: "GET", segments: ["features", ":seg"] },
  { method: "GET", segments: ["features", ":seg", "workflow-projection"] },
];

export interface AllowInput {
  method: string;
  /** The endpoint as the api client spells it: a leading slash, no `/v1`, query
   *  string still attached (it is ignored here and forwarded verbatim). */
  endpoint: string;
  /**
   * The brand this session owns. Every `:brand` segment must equal it.
   *
   * EMPTY until the wizard has created one, which is a real state rather than a
   * broken one: a session's first act is `POST /brands`, and that call names no
   * brand. So an empty id refuses every rule that mentions `:brand` — matching
   * nothing is the correct answer for a session that owns nothing — while the
   * brand-less rules stay reachable. Refusing the whole allowlist on an empty
   * id would mean a session could never create the brand that fills it.
   */
  brandId: string;
}

/** Why a call was refused. A log line; the caller answers 403 either way. */
export type AnonRefusal = "not-allowlisted" | "wrong-brand";

export interface AllowResult {
  allowed: boolean;
  refusal: AnonRefusal | null;
}

const ALLOWED = { allowed: true, refusal: null } as const;

/**
 * Is this call one the signed-out flow may make?
 *
 * Refuses before it matches when the path escapes its own namespace: a segment
 * of `..` or an absolute URL in the endpoint would be a way to address a route
 * no rule mentions.
 */
export function anonCallAllowed({ method, endpoint, brandId }: AllowInput): AllowResult {
  const deny = (refusal: AnonRefusal): AllowResult => ({ allowed: false, refusal });

  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) return deny("not-allowlisted");
  const ownedBrand = typeof brandId === "string" ? brandId : "";

  const path = endpoint.split("?")[0];
  const given = path.split("/").filter((s) => s.length > 0);
  if (given.length === 0) return deny("not-allowlisted");
  if (given.some((s) => s === "." || s === ".." || s.includes("\\"))) {
    return deny("not-allowlisted");
  }

  const upper = typeof method === "string" ? method.toUpperCase() : "";

  let sawWrongBrand = false;
  for (const rule of RULES) {
    if (rule.method !== upper) continue;
    if (rule.segments.length !== given.length) continue;

    let matched = true;
    let brandMismatch = false;
    for (let i = 0; i < rule.segments.length; i += 1) {
      const want = rule.segments[i];
      const got = given[i];
      if (want === ":brand") {
        // A shape match with the WRONG brand is reported as such rather than as
        // "no such route": it is the one refusal that means somebody reached for
        // a brand that is not theirs, and that deserves its own log line. A
        // session with no brand yet matches no brand, which lands here too.
        if (ownedBrand.length === 0 || decodeURIComponent(got) !== ownedBrand) {
          brandMismatch = true;
        }
        continue;
      }
      if (want === ":seg") continue;
      if (want !== got) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    if (rule.queryBrand) {
      const q = new URLSearchParams(endpoint.includes("?") ? endpoint.slice(endpoint.indexOf("?") + 1) : "");
      if (ownedBrand.length === 0 || q.get(rule.queryBrand) !== ownedBrand) brandMismatch = true;
    }
    if (brandMismatch) {
      sawWrongBrand = true;
      continue;
    }
    return ALLOWED;
  }

  return deny(sawWrongBrand ? "wrong-brand" : "not-allowlisted");
}

/**
 * The BODY half of the brand binding.
 *
 * Two allowlisted routes name the brand in their body rather than their path:
 * the field extraction (`brandIds`) and the audience suggestion (`brandId`).
 * The path rule above cannot see a body, so without this a session could read
 * any customer's extracted fields by naming their brand id there. Every brand
 * a body names must be the session's own.
 *
 * Returns `null` when the call is fine (including every route that names no
 * brand in its body), otherwise the refusal. The caller answers 403 either way.
 */
export function anonBodyRefusal({
  method,
  endpoint,
  body,
  brandId,
}: {
  method: string;
  endpoint: string;
  body: string | undefined;
  brandId: string;
}): AnonRefusal | null {
  const upper = typeof method === "string" ? method.toUpperCase() : "";
  const path = typeof endpoint === "string" ? endpoint.split("?")[0].replace(/\/+$/, "") : "";
  const bound =
    upper === "POST" &&
    (path === "/brands/extract-fields" ||
      path === "/orgs/audiences/suggest" ||
      path === "/orgs/audiences/split" ||
      path === "/orgs/audiences/split/confirm" ||
      path === "/content/preview-email");
  if (!bound) return null;

  const owned = typeof brandId === "string" ? brandId : "";
  if (owned.length === 0) return "wrong-brand";

  let parsed: unknown;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    return "not-allowlisted";
  }
  if (!parsed || typeof parsed !== "object") return "not-allowlisted";
  const rec = parsed as Record<string, unknown>;

  if (path === "/brands/extract-fields") {
    const ids = rec.brandIds;
    if (!Array.isArray(ids) || ids.length === 0) return "not-allowlisted";
    return ids.every((id) => id === owned) ? null : "wrong-brand";
  }
  return rec.brandId === owned ? null : "wrong-brand";
}
