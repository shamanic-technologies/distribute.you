// What a share credential may READ — pure, no `@` imports, so this file is
// runtime-importable by vitest and carries real unit tests rather than
// source-substring guards. Keep it that way.
//
// This is the SECURITY BOUNDARY of the public share view, and it is deliberately
// an allowlist rather than a denylist. The share proxy forwards under the OWNING
// ORG's identity, so a "forward any GET" rule would hand a link recipient the
// org's billing, its API keys, its other brands and its provider credentials. A
// denylist is a list of the leaks somebody happened to think of; an allowlist is
// a list of what the four shared pages actually need, and everything else — every
// route that exists today and every route added tomorrow — is refused by default.
//
// Two independent locks, both required:
//   1. GET only. Nothing else is exported by the route handler either, so a share
//      visitor cannot write even to a route on this list.
//   2. Every rule pins the BRAND. A read is allowed only when the brand it names
//      (in the path or in `?brandId=`) is the brand the credential opens, so the
//      recipient cannot walk sideways to a sibling brand in the same org.
//
// Deliberately ABSENT, and they must stay absent:
//   - `/brands/:id/conversion-token`  — a website tracking credential, not a stat.
//   - `/brands/:id/share-token`       — the share credential itself; a recipient
//                                       must never be able to read or re-derive it.
//   - anything under billing, api-keys, provider-keys, runs, or `/me`.

/** How a rule proves the request is about the brand the credential opens. */
type BrandBinding =
  /** A capture group in the path holds the brand id. */
  | "path"
  /** The `brandId` query parameter holds it. Absent → denied. */
  | "query"
  /** Platform catalogue: the same answer for every org, carries no org data. */
  | "catalogue";

interface ShareReadRule {
  pattern: RegExp;
  binding: BrandBinding;
}

/**
 * Every read the three shared pages (Overview, Leads, Audiences) make.
 *
 * Adding a page means adding its reads here. A missing entry surfaces as one
 * broken card plus a named 403 in the logs — never as a silent widening.
 */
const SHARE_READ_RULES: ShareReadRule[] = [
  // Brand identity + the per-brand config the pages render.
  { pattern: /^\/brands\/([^/]+)$/, binding: "path" },
  {
    pattern:
      /^\/brands\/([^/]+)\/(sales-economics|sales-economics-effective|daily-budget|pause|user-fields|click-destination)$/,
    binding: "path",
  },
  // The conversion tracker's LIVENESS, which several columns are gated on. The
  // payload carries the brand's tracking key, and that is fine here specifically
  // because that key is publishable by design — it lives in a JS snippet on the
  // brand's own public website, can only POST events for its one brand, and can
  // never read. Withholding it would withhold nothing a reader cannot already
  // take from the site, while making a live tracker read as "not set up".
  { pattern: /^\/brands\/([^/]+)\/conversion-token$/, binding: "path" },

  // Outreach evidence. Every one of these is already brand-scoped upstream; the
  // `brandId` parameter is what we pin.
  {
    pattern:
      /^\/features\/[^/]+\/(stats|audience-stats|revenue|pipeline-activity|workflow-projection)$/,
    binding: "query",
  },
  { pattern: /^\/orgs\/audiences$/, binding: "query" },
  { pattern: /^\/leads$/, binding: "query" },
  { pattern: /^\/emails\/by-lead\/[^/]+$/, binding: "query" },
  { pattern: /^\/workflow-examples$/, binding: "query" },
  { pattern: /^\/campaigns$/, binding: "query" },

  // The feature catalogue + its stats registry. Platform-level: the same rows for
  // every org, no org id in, no org data out. The shell needs them to know which
  // feature the brand runs.
  { pattern: /^\/features$/, binding: "catalogue" },
  { pattern: /^\/features\/stats\/registry$/, binding: "catalogue" },
  { pattern: /^\/features\/[^/]+$/, binding: "catalogue" },
];

export type ShareApiDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * May a share credential for `brandId` make this request?
 *
 * `path` is the api-service path WITHOUT the `/v1` prefix and without a query
 * string (e.g. `/features/sales-cold-email-outreach/revenue`), matching the shape
 * `apiCall` composes. `search` is the parsed query string.
 *
 * Fails closed, and the reason names the path so a gap is diagnosable from the
 * logs rather than looking like a broken endpoint.
 */
export function shareApiAccess(
  method: string,
  path: string,
  search: URLSearchParams,
  brandId: string,
): ShareApiDecision {
  if (method.toUpperCase() !== "GET") {
    return { allowed: false, reason: `share links are read-only (${method} ${path})` };
  }

  const rule = SHARE_READ_RULES.find((r) => r.pattern.test(path));
  if (!rule) {
    return { allowed: false, reason: `not readable through a share link (${path})` };
  }

  if (rule.binding === "catalogue") return { allowed: true };

  if (rule.binding === "path") {
    const match = rule.pattern.exec(path);
    // A rule bound to the path declares its brand capture group; a rule that
    // matched without one is a rule authored wrong, so refuse rather than guess.
    const pathBrand = match?.[1];
    if (!pathBrand) {
      return { allowed: false, reason: `rule for ${path} names no brand` };
    }
    return pathBrand === brandId
      ? { allowed: true }
      : { allowed: false, reason: `${path} is not this share link's brand` };
  }

  const queryBrand = search.get("brandId");
  if (!queryBrand) {
    // Without a brand this would read the whole org. "Unscoped" is a denial, not
    // a default.
    return { allowed: false, reason: `${path} needs an explicit brandId` };
  }
  return queryBrand === brandId
    ? { allowed: true }
    : { allowed: false, reason: `${path} is not this share link's brand` };
}
