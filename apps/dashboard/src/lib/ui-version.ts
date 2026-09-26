/**
 * Which version of the dashboard a beta user is on: v1 (the current one) or v2
 * (the Keel-style shell being built beside it, under `/v2`).
 *
 * The choice is a COOKIE rather than a client store because it is a routing
 * decision, and routing decisions belong at the edge (`proxy.ts`): a beta user who
 * picked v2 must land on v2 from the very first frame after a reload or a new
 * sign-in, and only a cookie can be read before paint. It is NOT httpOnly because
 * the switch control that writes it is a client component.
 *
 * The cookie is a PREFERENCE, never an authorisation: the edge honours it only for
 * a beta email, and the v2 layout gates its body on the same allowlist. A non-beta
 * user carrying `v2` (someone removed from the list) is simply never redirected.
 *
 * Alias-free on purpose: the edge imports it, and the `@` alias is not resolved
 * under vitest, so keeping it on no imports at all is what lets it carry real unit
 * tests.
 */

export const UI_VERSION_COOKIE = "distribute-ui";
export type UiVersion = "v1" | "v2";

/** One year: the choice should outlive every session it is made in. */
const UI_VERSION_MAX_AGE_S = 60 * 60 * 24 * 365;

/** Anything but an exact `v2` reads as v1, which is the dashboard everyone else sees. */
export function parseUiVersion(raw: string | null | undefined): UiVersion {
  return raw === "v2" ? "v2" : "v1";
}

/** The `document.cookie` assignment for a choice. Pure, so the string is testable. */
export function uiVersionCookieAssignment(version: UiVersion, secure: boolean): string {
  return `${UI_VERSION_COOKIE}=${version}; Path=/; Max-Age=${UI_VERSION_MAX_AGE_S}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}

/** Drop a leading `/v2` so the v1 path parsers can read a v2 URL unchanged. */
export function stripV2Prefix(pathname: string): string {
  if (pathname === "/v2") return "/";
  return pathname.startsWith("/v2/") ? pathname.slice(3) : pathname;
}

export function isV2Path(pathname: string): boolean {
  return pathname === "/v2" || pathname.startsWith("/v2/");
}

export function v2DashboardHref(orgId: string, brandId: string): string {
  return `/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
}

export function v1BrandHref(orgId: string, brandId: string): string {
  return `/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
}

const V1_BRAND_ROOT_RE = /^\/orgs\/([^/]+)\/brands\/([^/]+)\/?$/;

/**
 * The v1 brand ROOT (the brand Overview), exactly — the one v1 page a v2 user is
 * sent past at the edge, because v2's Dashboard answers the same question. Deeper
 * v1 pages (Leads, Settings, a campaign) stay reachable: v2 links to them for every
 * section it has not rebuilt yet, and bouncing those would make them unreachable.
 */
export function matchV1BrandRoot(pathname: string): { orgId: string; brandId: string } | null {
  const m = V1_BRAND_ROOT_RE.exec(pathname);
  return m ? { orgId: m[1], brandId: m[2] } : null;
}

/**
 * Where a v1 dashboard URL lives in v2, for a user who chose v2.
 *
 * Every v1 brand page now has a v2 twin, so a v2 user is never sent back to v1 by a
 * link, a `router.push` or a typed URL: `proxy.ts` rewrites the v1 path here, pre-paint,
 * which covers the v1 business components v2 embeds (their links still name v1 paths)
 * without touching them. The only way into v1 is the explicit "Back to v1" switch,
 * which flips the cookie first.
 *
 * The search string rides along untouched (a Stripe return carries `?success=true`),
 * except that the Leads panel's `leadRowId` becomes the person's own v2 page.
 *
 * Org-level pages (billing, API key, account) have no brand in their URL; v2 files
 * them under a brand, so they need the last brand opened in that org. Without one
 * there is no v2 page to send them to, and the v1 page is served (null).
 */
export function v2PathForV1(
  pathname: string,
  search: string,
  opts: { lastBrand?: (orgId: string) => string | undefined; activeOrgId?: string | null } = {},
): string | null {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const withQuery = (path: string, params: URLSearchParams = q) => {
    const s = params.toString();
    return s ? `${path}?${s}` : path;
  };
  const brandBase = (orgId: string, brandId: string) => v2DashboardHref(orgId, brandId);
  const orgLevel = (orgId: string, section: string) => {
    const brandId = opts.lastBrand?.(orgId);
    return brandId ? withQuery(`${brandBase(orgId, brandId)}/${section}`) : null;
  };

  if (parts[0] === "account" && parts.length === 1) {
    const org = opts.activeOrgId;
    return org ? orgLevel(org, "account") : null;
  }
  if (parts[0] !== "orgs" || !parts[1]) return null;
  const orgId = decodeURIComponent(parts[1]);
  if (parts.length === 3 && parts[2] === "billing") return orgLevel(orgId, "billing");
  if (parts.length === 3 && (parts[2] === "api-keys" || parts[2] === "provider-keys")) {
    return orgLevel(orgId, "api-keys");
  }
  // The bare org: v2's own landing (the last brand, else a picker).
  if (parts.length === 2) return withQuery(`/v2/orgs/${encodeURIComponent(orgId)}`);
  if (parts[2] !== "brands" || !parts[3]) return null;
  const brandId = decodeURIComponent(parts[3]);
  const base = brandBase(orgId, brandId);
  const rest = parts.slice(4);
  const enc = encodeURIComponent;

  if (rest.length === 0) return withQuery(base);
  const [a, b, c, d, e, f] = rest;
  if (a === "leads" && rest.length === 1) {
    const row = q.get("leadRowId");
    if (row) {
      const next = new URLSearchParams(q);
      next.delete("leadRowId");
      return withQuery(`${base}/people/${enc(row)}`, next);
    }
    return withQuery(`${base}/people`);
  }
  if (a === "settings" && rest.length === 1) return withQuery(`${base}/settings`);
  if (a === "crm" && rest.length === 1) return withQuery(`${base}/integrations`);
  if (a === "crm" && b === "merged" && rest.length === 2) return withQuery(`${base}/integrations/merged`);
  if (a !== "offers") return null;
  if (rest.length === 1) return withQuery(`${base}/offers`);
  const offer = `${base}/offers/${enc(b)}`;
  if (rest.length === 2) return withQuery(offer);
  if (c === "settings" && rest.length === 3) return withQuery(offer);
  if (c === "audiences" && rest.length === 3) return withQuery(`${offer}/targeting`);
  if (c === "audiences" && d === "leads" && rest.length === 4) return withQuery(`${base}/people`);
  if (c !== "campaigns") return null;
  if (rest.length === 3) return withQuery(`${base}/missions`);
  const mission = `${base}/missions/${enc(d)}`;
  if (rest.length === 4) return withQuery(mission);
  if (e === "settings" && rest.length === 5) return withQuery(`${mission}/settings`);
  if (e === "audiences" && rest.length === 5) return withQuery(`${offer}/targeting`);
  if (e === "leads" && rest.length === 5) return withQuery(mission);
  if (e === "workflows" && rest.length === 5) return withQuery(`${mission}/workflows`);
  if (e === "workflows" && rest.length === 6) {
    const next = new URLSearchParams(q);
    next.set("workflow", decodeURIComponent(f));
    return withQuery(`${mission}/workflows`, next);
  }
  return null;
}
