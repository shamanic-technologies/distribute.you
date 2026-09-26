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
