/**
 * Old (v1) dashboard URLs, mapped to the v2 dashboard.
 *
 * v1 was deleted (it lives in git history). Its URLs still arrive: sent emails,
 * bookmarks, Stripe returns, and links inside the shared business components v2
 * embeds. `proxy.ts` redirects every one of them here, pre-paint, so an old link
 * never 404s.
 *
 * Alias-free on purpose: the edge imports it, and the `@` alias is not resolved
 * under vitest, so keeping it on no imports at all is what lets it carry real unit
 * tests.
 */

/** Drop a leading `/v2` so path parsers written for the old URLs read a v2 URL unchanged. */
export function stripV2Prefix(pathname: string): string {
  if (pathname === "/v2") return "/";
  return pathname.startsWith("/v2/") ? pathname.slice(3) : pathname;
}

export function v2DashboardHref(orgId: string, brandId: string): string {
  return `/v2/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
}

/** Where a signed-in user with no org to name goes: Clerk's org picker. */
export const NO_ORG_HREF = "/session-tasks/choose-organization";

/**
 * Where an old dashboard URL lives in v2, or null when the path is not an old
 * dashboard URL at all (onboarding, sign-in, api, a v2 path).
 *
 * Every old dashboard URL maps somewhere: a page with a v2 twin goes to the twin,
 * anything else goes to the nearest v2 page above it (the brand, else the org).
 *
 * The search string rides along untouched (a Stripe return carries `?success=true`),
 * except that the Leads panel's `leadRowId` becomes the person's own v2 page.
 *
 * Org-level pages (billing, API key, account) have no brand in their URL; v2 files
 * them under a brand, so they need the last brand opened in that org. Without one
 * they land on the org's v2 page (the brand picker).
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
  const orgBase = (orgId: string) => `/v2/orgs/${encodeURIComponent(orgId)}`;
  const orgLevel = (orgId: string, section: string) => {
    const brandId = opts.lastBrand?.(orgId);
    return withQuery(brandId ? `${brandBase(orgId, brandId)}/${section}` : orgBase(orgId));
  };
  const activeOrg = (section: string | null) => {
    const org = opts.activeOrgId;
    if (!org) return NO_ORG_HREF;
    return section ? orgLevel(org, section) : withQuery(orgBase(org));
  };

  // The old root and org list: the active org's v2 landing.
  if (parts.length === 0) return activeOrg(null);
  if (parts[0] === "orgs" && parts.length === 1) return activeOrg(null);
  if (parts[0] === "account" && parts.length === 1) return activeOrg("account");
  if (parts[0] === "api-keys" && parts.length === 1) return activeOrg("api-keys");
  if (parts[0] !== "orgs") return null;
  const orgId = decodeURIComponent(parts[1]);
  if (parts.length === 3 && parts[2] === "billing") return orgLevel(orgId, "billing");
  if (parts.length === 3 && (parts[2] === "api-keys" || parts[2] === "provider-keys")) {
    return orgLevel(orgId, "api-keys");
  }
  // The bare org, and anything else under it: v2's own landing (the last brand, else a picker).
  if (parts[2] !== "brands" || !parts[3]) return withQuery(orgBase(orgId));
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
  if (a !== "offers") return withQuery(base);
  if (rest.length === 1) return withQuery(`${base}/offers`);
  const offer = `${base}/offers/${enc(b)}`;
  if (rest.length === 2) return withQuery(offer);
  if (c === "settings" && rest.length === 3) return withQuery(offer);
  if (c === "audiences" && rest.length === 3) return withQuery(`${offer}/targeting`);
  if (c === "audiences" && d === "leads" && rest.length === 4) return withQuery(`${base}/people`);
  if (c !== "campaigns") return withQuery(base);
  if (rest.length === 3) return withQuery(`${base}/missions`);
  const mission = `${base}/missions/${enc(d)}`;
  if (rest.length === 4) return withQuery(mission);
  if (e === "settings" && rest.length === 5) return withQuery(`${mission}/settings`);
  if (e === "audiences" && rest.length === 5) return withQuery(`${mission}/audiences`);
  if (e === "leads" && rest.length === 5) return withQuery(mission);
  if (e === "workflows" && rest.length === 5) return withQuery(`${mission}/workflows`);
  if (e === "workflows" && rest.length === 6) {
    const next = new URLSearchParams(q);
    next.set("workflow", decodeURIComponent(f));
    return withQuery(`${mission}/workflows`, next);
  }
  return withQuery(base);
}
