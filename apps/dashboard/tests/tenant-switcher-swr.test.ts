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
