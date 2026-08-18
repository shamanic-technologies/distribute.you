import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The tenant switcher paints its identity from disk (local-first SWR).
 *
 * The switcher was the ONE dashboard surface bypassing the per-query IndexedDB
 * persister: it read `/api/v1/brands` and `/api/v1/brands/:id` with a raw `fetch`
 * behind module-level 60s caches, and held the org label in a `useRef`. None of
 * those survive a page load, so every hard navigation showed `Dashboard` / `Brand`
 * and an empty logo slot until the cold gateway → brand-service chain answered.
 *
 * Routing all three identity reads through React Query puts them under the same
 * persister every other page already uses. Source-substring guards (the dashboard
 * convention — this module imports through the `@` alias, which vitest does not
 * resolve in this repo).
 */
describe("Tenant switcher SWR identity", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const hook = read("src/lib/use-tenant-switcher.ts");
  const persistCache = read("src/lib/persist-cache.ts");

  it("reads the brand dropdown list through React Query, not a raw fetch", () => {
    expect(hook).toContain('useAuthQuery(["brands"], () => listBrands()');
    expect(hook).not.toContain('fetch("/api/v1/brands")');
  });

  it("reads the URL brand by id through React Query, not a raw fetch", () => {
    // Same key the brand overview page uses → warm on arrival, and the label
    // resolves even when the org-scoped LIST does not contain the brand.
    expect(hook).toContain('["brand", brandId]');
    expect(hook).toContain("getBrand(brandId!)");
    expect(hook).not.toContain("`/api/v1/brands/${brandId}`");
  });

  it("keeps no module-level TTL cache (they die on every page load)", () => {
    for (const dead of ["brandListCache", "brandByIdCache", "CACHE_TTL"]) {
      expect(hook, `${dead} must be gone`).not.toContain(dead);
    }
    // The keep-last-good refs went with them: the disk snapshot IS the last-good
    // value, and it survives a reload where a ref cannot.
    expect(hook).not.toContain("orgDisplayCacheRef");
    expect(hook).not.toContain("brandDisplayCacheRef");
  });

  it("snapshots the org label into a persisted query, gated on the URL org", () => {
    expect(hook).toContain('queryKey: ["orgIdentity", orgId]');
    // Only ever snapshot the org the URL is on — Clerk's active org is a shared
    // browser-global that flips when another tab switches (#1948).
    expect(hook).toContain("enabled: !!orgId && organization?.id === orgId");
  });

  it("allowlists every identity root for persistence", () => {
    // An unlisted root is default-OFF, which silently loses the instant paint.
    for (const root of ['"orgIdentity"', '"brand"', '"brands"']) {
      expect(persistCache, `${root} must persist`).toContain(root);
    }
  });

  it("lets a failed brand list settle into the empty state, never an eternal spinner", () => {
    expect(hook).toContain(
      "const brandsLoading = brandsQuery.isPending && !brandsQuery.isError;",
    );
  });

  it("still closes the org-switch race (setActive → fresh token → navigate)", () => {
    const match = hook.match(
      /handleOrgSwitch[\s\S]*?await setActive\([\s\S]*?getToken\(\{ skipCache: true \}\)[\s\S]*?router\.push/,
    );
    expect(match, "getToken must sit between setActive and router.push").not.toBeNull();
  });
});

/**
 * The FIRST frame, which the SWR cache above structurally cannot reach.
 *
 * The IndexedDB restore runs in a `useEffect` (`persister.restoreQueries` /
 * `reseedColdQueriesFromDisk`), i.e. strictly after paint — so moving the identity
 * reads onto the persister fixed staleness but left every hard refresh painting
 * `Brand` + the globe first and swapping the real values in a moment later. Only a
 * cookie can be read by the SERVER, which is what puts the identity in the HTML.
 */
describe("Tenant switcher first-frame identity", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const hook = read("src/lib/use-tenant-switcher.ts");
  const switcher = read("src/components/tenant-switcher.tsx");
  const authedLayout = read("src/app/(authed)/layout.tsx");
  const provider = read("src/components/tenant-identity-provider.tsx");

  const sliceFrom = (src: string, marker: string, length: number) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  it("reads the identity cookie on the SERVER and seeds the client tree", () => {
    // Client-only storage (localStorage / IndexedDB) cannot beat the initial paint,
    // because the HTML is produced before any of it is reachable.
    expect(authedLayout).toContain("parseTenantIdentityCookie");
    expect(authedLayout).toContain("TENANT_IDENTITY_COOKIE");
    expect(authedLayout).toContain("<TenantIdentityProvider seed={tenantSeed}>");
    expect(authedLayout).toContain("export default async function AuthedLayout");
  });

  it("keeps the cookie server-readable and client-written", () => {
    // httpOnly would make the client unable to write it; the client is what learns
    // the identity (Clerk for the org, brand-service for the brand).
    expect(provider).toContain("document.cookie = tenantIdentityCookieAssignment(next)");
    expect(provider).toContain("readTenantIdentityFromDocumentCookie(document.cookie)");
  });

  it("falls back to the seed for BOTH the org and the brand", () => {
    expect(hook).toContain("identitySeed?.orgs[orgId]");
    expect(hook).toContain("identitySeed?.brands[brandId]");
  });

  it("ranks the seed LAST, so a fresher source always wins", () => {
    // The seed is a memory of the previous visit; Clerk / the query cache are the
    // live values. Ordering it first would pin a renamed brand to its old name.
    const orgChain = sliceFrom(hook, "const displayOrg:", 700);
    expect(orgChain.indexOf("liveOrg")).toBeLessThan(orgChain.indexOf("seededOrg"));
    expect(orgChain.indexOf("orgIdentityQuery.data")).toBeLessThan(orgChain.indexOf("seededOrg"));

    const brandChain = sliceFrom(hook, "const displayBrand: TenantBrand", 500);
    expect(brandChain.indexOf("brands.find")).toBeLessThan(brandChain.indexOf("seededBrand"));
    expect(brandChain.indexOf("byIdBrand")).toBeLessThan(brandChain.indexOf("seededBrand"));
  });

  it("writes a resolved identity back so the NEXT load paints it server-side", () => {
    expect(hook).toContain("rememberIdentity({");
  });

  it("renders a skeleton for an unknown tenant, never a fabricated label", () => {
    // `Brand` beside a globe asserts an identity we do not have; the user reads it
    // as the product having lost their brand.
    expect(switcher).toContain("function IdentitySkeleton");
    expect(hook).toContain("const orgKnown = !!displayOrg?.name;");
    expect(hook).toContain("const brandKnown = !!displayBrand;");

    // Both switcher surfaces gate on the tenant the URL is on — a brand page must
    // not fall back to the org's name.
    // The in-flight org switch takes the FIRST branch (it names the target the
    // user just clicked, which is a truthful identity we do hold), so the unknown
    // check reads `: !identityKnown ? (` rather than `{!identityKnown ? (`.
    // Measured offsets to the assertion: 1972 desktop / 1044 mobile.
    const desktop = sliceFrom(switcher, "export function TenantSwitcher()", 2600);
    expect(desktop).toContain("const identityKnown = t.brandId ? t.brandKnown : t.orgKnown;");
    expect(desktop).toContain("!identityKnown ? (");

    const mobile = sliceFrom(switcher, "export function MobileTenantChip()", 1800);
    expect(mobile).toContain("const identityKnown = t.brandId ? t.brandKnown : t.orgKnown;");
    expect(mobile).toContain("!identityKnown ? (");
  });
});
