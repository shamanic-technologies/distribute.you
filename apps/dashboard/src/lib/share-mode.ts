// The public share view — pure path helpers, no `@` imports, so this file is
// runtime-importable by vitest and carries real unit tests rather than
// source-substring guards. Keep it that way.
//
// A share link runs the REAL dashboard pages. Those pages read `orgId` /
// `brandId` off the route with `useParams()` in ~25 places, so the share tree
// MIRRORS the authed route shape underneath the credential:
//
//     /share/<token>/orgs/<orgId>/brands/<brandId>/audiences
//
// rather than inventing a second, flatter URL that every page would then have to
// be taught about. The two ids in that URL are not a second credential and grant
// nothing on their own: the token is the whole authority, and the share layout
// re-resolves it on every request and refuses to render when it does not name
// exactly that org and brand. Editing the brandId to peek at a sibling brand
// therefore opens nothing.

/** Path segment the public share view is served under. */
export const SHARE_PATH_PREFIX = "/share";

export interface ShareContext {
  token: string;
  orgId: string;
  brandId: string;
}

/** `/share/<token>/…` → the token, or null when the path is not a share path. */
export function shareTokenFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = /^\/share\/([^/]+)(?:\/|$)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

/** True when this pathname is served by the public share tree. */
export function isSharePathname(pathname: string | null | undefined): boolean {
  return shareTokenFromPathname(pathname) !== null;
}

/**
 * The full `{token, orgId, brandId}` a share page is rendering, or null.
 *
 * Returns null on `/share/<token>` alone — that route only resolves the
 * credential and redirects, it renders no brand data.
 */
export function shareContextFromPathname(
  pathname: string | null | undefined,
): ShareContext | null {
  if (!pathname) return null;
  const m = /^\/share\/([^/]+)\/orgs\/([^/]+)\/brands\/([^/]+)(?:\/.*)?$/.exec(pathname);
  if (!m) return null;
  return {
    token: decodeURIComponent(m[1]),
    orgId: decodeURIComponent(m[2]),
    brandId: decodeURIComponent(m[3]),
  };
}

/** The mirrored brand root a share link lands on. */
export function shareBrandBasePath(token: string, orgId: string, brandId: string): string {
  return `${SHARE_PATH_PREFIX}/${encodeURIComponent(token)}/orgs/${encodeURIComponent(
    orgId,
  )}/brands/${encodeURIComponent(brandId)}`;
}

/**
 * Where a share page's browser reads go.
 *
 * The authed dashboard talks to `/api/v1/*`, which is Clerk-authenticated and
 * org-scoped from the session. A share visitor has no session, so its reads go to
 * the share tree's OWN proxy, which derives the org from the credential in the URL
 * and is read-only. Composed here, once, so the client and the route handler
 * cannot disagree about where that proxy lives.
 */
export function shareApiBasePath(token: string): string {
  return `${SHARE_PATH_PREFIX}/${encodeURIComponent(token)}/api/v1`;
}
