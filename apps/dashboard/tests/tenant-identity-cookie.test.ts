import { describe, it, expect } from "vitest";
import {
  EMPTY_TENANT_IDENTITY,
  MAX_REMEMBERED_BRANDS,
  MAX_REMEMBERED_ORGS,
  TENANT_IDENTITY_COOKIE,
  TENANT_IDENTITY_VERSION,
  mergeTenantIdentity,
  parseTenantIdentityCookie,
  readTenantIdentityFromDocumentCookie,
  serializeTenantIdentityCookie,
  tenantIdentityCookieAssignment,
} from "../src/lib/tenant-identity-cookie";

/**
 * Real unit tests, not source-substring guards: `tenant-identity-cookie.ts` carries
 * no `@` import (the alias vitest does not resolve in this repo), so it is runtime-
 * importable. Keep it alias-free.
 */
describe("tenant identity cookie", () => {
  const org = { n: "Acme" };
  const brand = { n: "Acme Sales", d: "acme.com" };

  it("returns null for an absent cookie — we do not know the tenant", () => {
    // The whole point: "unknown" must be representable, so the UI can render a
    // skeleton instead of fabricating a `Brand` label.
    expect(parseTenantIdentityCookie(undefined)).toBeNull();
    expect(parseTenantIdentityCookie("")).toBeNull();
  });

  it("returns null for a malformed blob instead of throwing", () => {
    // Not httpOnly → user-writable → a garbage value is an expected input, and a
    // throw here would take down the server render of every authed page.
    expect(parseTenantIdentityCookie("not-json")).toBeNull();
    expect(parseTenantIdentityCookie(encodeURIComponent('"a string"'))).toBeNull();
    expect(parseTenantIdentityCookie(encodeURIComponent("[1,2,3]"))).toBeNull();
  });

  it("drops a stale-version blob rather than migrating it", () => {
    const stale = encodeURIComponent(
      JSON.stringify({ v: TENANT_IDENTITY_VERSION + 1, orgs: { o1: org }, brands: {} }),
    );
    expect(parseTenantIdentityCookie(stale)).toBeNull();
  });

  it("round-trips an org and a brand", () => {
    const snapshot = mergeTenantIdentity(null, {
      orgId: "o1",
      org,
      brandId: "b1",
      brand,
    });
    const parsed = parseTenantIdentityCookie(serializeTenantIdentityCookie(snapshot));
    expect(parsed?.orgs.o1).toEqual(org);
    expect(parsed?.brands.b1).toEqual(brand);
  });

  it("keeps a brand that has only a domain — the domain drives the logo", () => {
    const snapshot = mergeTenantIdentity(null, {
      brandId: "b1",
      brand: { n: null, d: "acme.com" },
    });
    const parsed = parseTenantIdentityCookie(serializeTenantIdentityCookie(snapshot));
    expect(parsed?.brands.b1).toEqual({ n: null, d: "acme.com" });
  });

  it("discards a brand row with neither half — it would re-serve the placeholder", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        v: TENANT_IDENTITY_VERSION,
        orgs: {},
        brands: { b1: { n: null, d: null } },
      }),
    );
    expect(parseTenantIdentityCookie(raw)?.brands).toEqual({});
  });

  it("returns the SAME reference when nothing changed, so no cookie re-write", () => {
    const first = mergeTenantIdentity(null, { orgId: "o1", org, brandId: "b1", brand });
    const again = mergeTenantIdentity(first, { orgId: "o1", org, brandId: "b1", brand });
    expect(again).toBe(first);
  });

  it("updates a remembered name when it actually changes", () => {
    const first = mergeTenantIdentity(null, { orgId: "o1", org });
    const renamed = mergeTenantIdentity(first, { orgId: "o1", org: { n: "Acme Inc" } });
    expect(renamed).not.toBe(first);
    expect(renamed.orgs.o1).toEqual({ n: "Acme Inc" });
  });

  it("ignores a null identity — an unresolved tenant must not overwrite a known one", () => {
    const known = mergeTenantIdentity(null, { orgId: "o1", org, brandId: "b1", brand });
    const after = mergeTenantIdentity(known, { orgId: "o1", org: null, brandId: "b1", brand: null });
    expect(after).toBe(known);
    expect(after.brands.b1).toEqual(brand);
  });

  it("caps orgs and brands, evicting the LEAST recently touched", () => {
    let snapshot = EMPTY_TENANT_IDENTITY;
    for (let i = 0; i < MAX_REMEMBERED_ORGS + 2; i++) {
      snapshot = mergeTenantIdentity(snapshot, { orgId: `o${i}`, org: { n: `Org ${i}` } });
    }
    for (let i = 0; i < MAX_REMEMBERED_BRANDS + 2; i++) {
      snapshot = mergeTenantIdentity(snapshot, {
        brandId: `b${i}`,
        brand: { n: `Brand ${i}`, d: `b${i}.com` },
      });
    }
    expect(Object.keys(snapshot.orgs)).toHaveLength(MAX_REMEMBERED_ORGS);
    expect(Object.keys(snapshot.brands)).toHaveLength(MAX_REMEMBERED_BRANDS);
    expect(snapshot.orgs.o0).toBeUndefined();
    expect(snapshot.orgs[`o${MAX_REMEMBERED_ORGS + 1}`]).toBeDefined();
    expect(snapshot.brands.b0).toBeUndefined();
    expect(snapshot.brands[`b${MAX_REMEMBERED_BRANDS + 1}`]).toBeDefined();
  });

  it("re-touching an existing org keeps it from being evicted", () => {
    let snapshot = mergeTenantIdentity(null, { orgId: "keep", org: { n: "Keep" } });
    for (let i = 0; i < MAX_REMEMBERED_ORGS - 1; i++) {
      snapshot = mergeTenantIdentity(snapshot, { orgId: `o${i}`, org: { n: `Org ${i}` } });
    }
    // A rename re-inserts it last → it survives the next round of evictions.
    snapshot = mergeTenantIdentity(snapshot, { orgId: "keep", org: { n: "Keep v2" } });
    for (let i = 0; i < MAX_REMEMBERED_ORGS; i++) {
      snapshot = mergeTenantIdentity(snapshot, { orgId: `x${i}`, org: { n: `X ${i}` } });
    }
    expect(Object.keys(snapshot.orgs)).toHaveLength(MAX_REMEMBERED_ORGS);
  });

  it("reads its own assignment back out of a document.cookie string", () => {
    const snapshot = mergeTenantIdentity(null, { orgId: "o1", org, brandId: "b1", brand });
    const assignment = tenantIdentityCookieAssignment(snapshot);
    const value = assignment.split("; ")[0].slice(TENANT_IDENTITY_COOKIE.length + 1);
    const documentCookie = `theme=dark; ${TENANT_IDENTITY_COOKIE}=${value}; other=1`;
    expect(readTenantIdentityFromDocumentCookie(documentCookie)?.brands.b1).toEqual(brand);
  });

  it("is readable by the server: no httpOnly, path=/ , lax", () => {
    // The client writes it and the SERVER reads it — that asymmetry is the entire
    // mechanism, so the attributes are load-bearing, not incidental.
    const assignment = tenantIdentityCookieAssignment(
      mergeTenantIdentity(null, { orgId: "o1", org }),
    );
    expect(assignment).toContain("path=/");
    expect(assignment).toContain("samesite=lax");
    expect(assignment.toLowerCase()).not.toContain("httponly");
  });

  it("stays small enough to ride every request", () => {
    let snapshot = EMPTY_TENANT_IDENTITY;
    for (let i = 0; i < MAX_REMEMBERED_ORGS; i++) {
      snapshot = mergeTenantIdentity(snapshot, {
        orgId: `00000000-0000-4000-8000-00000000000${i}`,
        org: { n: "A fairly long organisation name here", i: "https://img.clerk.com/some/long/path.png" },
      });
    }
    for (let i = 0; i < MAX_REMEMBERED_BRANDS; i++) {
      snapshot = mergeTenantIdentity(snapshot, {
        brandId: `10000000-0000-4000-8000-00000000000${i}`,
        brand: { n: "A fairly long brand name goes here", d: "averylongbranddomainname.com" },
      });
    }
    // Browsers cap a cookie at ~4KB and this one is sent with every /api/v1 call.
    expect(tenantIdentityCookieAssignment(snapshot).length).toBeLessThan(4096);
  });
});
