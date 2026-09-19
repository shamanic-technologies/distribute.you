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
  { method: "GET", segments: ["brands", ":brand", "sales-funnels"] },
  { method: "PUT", segments: ["brands", ":brand", "sales-funnels"] },
  { method: "PUT", segments: ["brands", ":brand", "sales-funnels", ":seg"] },
  { method: "DELETE", segments: ["brands", ":brand", "sales-funnels", ":seg"] },
  { method: "PUT", segments: ["brands", ":brand", "click-destination"] },
  { method: "POST", segments: ["brands", ":brand", "icp", "suggest"] },

  // ── The audiences we assemble for it ─────────────────────────────────
  { method: "GET", segments: ["orgs", "audiences"] },
  { method: "POST", segments: ["orgs", "audiences", "suggest"] },

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
    if (brandMismatch) {
      sawWrongBrand = true;
      continue;
    }
    return ALLOWED;
  }

  return deny(sawWrongBrand ? "wrong-brand" : "not-allowlisted");
}
