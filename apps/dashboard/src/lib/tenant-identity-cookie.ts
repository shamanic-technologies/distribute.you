/**
 * The last-known org + brand identity, in a SERVER-READABLE cookie.
 *
 * WHY A COOKIE AND NOT THE QUERY CACHE. The tenant labels already live in the
 * per-query IndexedDB persister (`["orgIdentity", orgId]`, `["brand", brandId]`),
 * which makes them survive a reload — but IndexedDB is ASYNCHRONOUS, so the
 * browser cannot read it while producing the first frame. The restore runs in a
 * `useEffect` (`persister.restoreQueries` / `reseedColdQueriesFromDisk`), which is
 * strictly after paint, so every hard refresh was architecturally guaranteed to
 * show `Brand` + the globe placeholder first and swap the real identity in a
 * moment later. Nothing about "caching harder" can fix that ordering.
 *
 * A cookie is the only store the SERVER can read, so the identity is rendered
 * into the HTML itself — it is on screen before a single line of JS has run, and
 * the client hydrates against the same value (no mismatch). This is the same
 * doctrine CLAUDE.md already states for the `last-brand-{orgId}` redirect cookie:
 * remembered state goes in a server-readable cookie, NOT localStorage, because
 * client-only storage costs a round-trip and shows a flash.
 *
 * Deliberately NOT httpOnly: the client is what learns the identity (Clerk for the
 * org name, brand-service for the brand) and therefore what writes it back. The
 * contents are display labels the user is already looking at — an org name, a
 * brand name, a brand domain. No token, no id the URL doesn't already carry.
 *
 * This module is import-alias-free on purpose so vitest can run it directly (the
 * `@` alias is not resolved in this repo — see CLAUDE.md).
 */

/** Bumped only on an incompatible shape change; an older blob is dropped, not migrated. */
export const TENANT_IDENTITY_VERSION = 1;
export const TENANT_IDENTITY_COOKIE = "distribute-tenant";

/** A year. The blob is a display convenience; there is nothing to expire. */
export const TENANT_IDENTITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Caps. The cookie rides EVERY request to this origin, including each `/api/v1/*`
 * proxy call, so it stays small: the point is to cover the handful of tenants a
 * user actually moves between, not to mirror the whole account.
 */
export const MAX_REMEMBERED_ORGS = 4;
export const MAX_REMEMBERED_BRANDS = 8;

/** Keys are single letters for the same reason — this is a hot-path cookie. */
export interface RememberedOrg {
  /** name */
  n: string;
  /** imageUrl — only set when the org has a real uploaded logo (`hasImage`). */
  i?: string;
}

export interface RememberedBrand {
  /** name */
  n: string | null;
  /** domain — drives the logo.dev mark, so it is the load-bearing half. */
  d: string | null;
}

export interface TenantIdentitySnapshot {
  v: number;
  orgs: Record<string, RememberedOrg>;
  brands: Record<string, RememberedBrand>;
}

export const EMPTY_TENANT_IDENTITY: TenantIdentitySnapshot = {
  v: TENANT_IDENTITY_VERSION,
  orgs: {},
  brands: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOrgs(raw: unknown): Record<string, RememberedOrg> {
  if (!isRecord(raw)) return {};
  const out: Record<string, RememberedOrg> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.n !== "string") continue;
    out[id] = typeof value.i === "string" ? { n: value.n, i: value.i } : { n: value.n };
  }
  return out;
}

function readBrands(raw: unknown): Record<string, RememberedBrand> {
  if (!isRecord(raw)) return {};
  const out: Record<string, RememberedBrand> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    const name = typeof value.n === "string" ? value.n : null;
    const domain = typeof value.d === "string" ? value.d : null;
    // A row with neither half is not an identity — it would only re-introduce the
    // placeholder one layer down.
    if (name === null && domain === null) continue;
    out[id] = { n: name, d: domain };
  }
  return out;
}

/**
 * Parse the cookie value. Returns null for absent / unparseable / stale-version —
 * i.e. "we do not know this tenant", which the UI renders as a skeleton rather
 * than a fabricated `Brand` label. The blob is user-writable (not httpOnly), so a
 * malformed one is an expected input, not an internal error to fail loud on; every
 * field is validated rather than trusted.
 */
export function parseTenantIdentityCookie(
  raw: string | undefined | null,
): TenantIdentitySnapshot | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== TENANT_IDENTITY_VERSION) return null;
  return {
    v: TENANT_IDENTITY_VERSION,
    orgs: readOrgs(parsed.orgs),
    brands: readBrands(parsed.brands),
  };
}

export function serializeTenantIdentityCookie(snapshot: TenantIdentitySnapshot): string {
  return encodeURIComponent(JSON.stringify(snapshot));
}

/**
 * Keep the most recently touched entries and drop the rest. `Object.entries`
 * preserves insertion order for string keys, and `mergeTenantIdentity` re-inserts
 * the touched id last, so "keep the tail" IS "keep the most recently used".
 */
function capTail<T>(entries: Record<string, T>, max: number): Record<string, T> {
  const all = Object.entries(entries);
  if (all.length <= max) return entries;
  return Object.fromEntries(all.slice(all.length - max));
}

export interface TenantIdentityUpdate {
  orgId?: string | null;
  org?: RememberedOrg | null;
  brandId?: string | null;
  brand?: RememberedBrand | null;
}

/**
 * Merge a freshly-resolved identity into the snapshot. Pure: returns a NEW object,
 * or the SAME reference when nothing changed — the caller writes the cookie only on
 * a real change, so a poll that keeps re-resolving the same name does not re-write
 * the cookie on every tick.
 */
export function mergeTenantIdentity(
  previous: TenantIdentitySnapshot | null,
  update: TenantIdentityUpdate,
): TenantIdentitySnapshot {
  const base = previous ?? EMPTY_TENANT_IDENTITY;
  const { orgId, org, brandId, brand } = update;

  const orgChanged =
    !!orgId && !!org && (base.orgs[orgId]?.n !== org.n || base.orgs[orgId]?.i !== org.i);
  const brandChanged =
    !!brandId &&
    !!brand &&
    (base.brands[brandId]?.n !== brand.n || base.brands[brandId]?.d !== brand.d);

  if (!orgChanged && !brandChanged) return base;

  // Re-insert the touched id LAST so the cap above evicts the least recently used.
  const orgs = { ...base.orgs };
  if (orgChanged && orgId && org) {
    delete orgs[orgId];
    orgs[orgId] = org;
  }
  const brands = { ...base.brands };
  if (brandChanged && brandId && brand) {
    delete brands[brandId];
    brands[brandId] = brand;
  }

  return {
    v: TENANT_IDENTITY_VERSION,
    orgs: capTail(orgs, MAX_REMEMBERED_ORGS),
    brands: capTail(brands, MAX_REMEMBERED_BRANDS),
  };
}

/** Read the blob out of a raw `document.cookie` string. */
export function readTenantIdentityFromDocumentCookie(
  documentCookie: string,
): TenantIdentitySnapshot | null {
  const match = documentCookie
    .split("; ")
    .find((part) => part.startsWith(`${TENANT_IDENTITY_COOKIE}=`));
  return parseTenantIdentityCookie(match?.slice(TENANT_IDENTITY_COOKIE.length + 1));
}

/** The `document.cookie` assignment string for a snapshot. */
export function tenantIdentityCookieAssignment(snapshot: TenantIdentitySnapshot): string {
  return [
    `${TENANT_IDENTITY_COOKIE}=${serializeTenantIdentityCookie(snapshot)}`,
    "path=/",
    `max-age=${TENANT_IDENTITY_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ].join("; ");
}
