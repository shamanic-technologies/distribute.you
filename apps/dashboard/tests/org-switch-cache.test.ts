import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Org-switch cross-org isolation framework (DIS-143).
 *
 * Defense-in-depth, dashboard-wide, two single choke points + source-race close:
 *  - Server choke point: every /api/v1 proxy route fails CLOSED on org desync
 *    (`checkProxyOrg`) — the JWT is the org authority, x-active-org-id only detects.
 *  - Client cache choke point: QueryProvider remounts under key={org.id} → atomic
 *    cache reset on switch (replaces the racy queryClient.clear()).
 *  - Source: handleOrgSwitch awaits setActive before navigating.
 *  - Read gate: useAuthQuery suspends org-owned reads while URL org != active org.
 *
 * These are source-substring guards (the dashboard test convention) — they assert
 * the framework wiring stays in place. Behavioral logic of the guard is unit-tested
 * in proxy-org.test.ts.
 */
describe("Org switch cross-org isolation framework", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

  const invalidatorPath = "src/components/org-cache-invalidator.tsx";
  const layoutPath = "src/app/(authed)/(dashboard)/layout.tsx";
  const orgActivatorPath = "src/components/org-activator.tsx";
  const breadcrumbPath = "src/components/breadcrumb-nav.tsx";
  const queryProviderPath = "src/lib/query-provider.tsx";
  const useAuthQueryPath = "src/lib/use-auth-query.ts";
  const apiPath = "src/lib/api.ts";
  const proxyCatchAllPath = "src/app/(authed)/api/v1/[...path]/route.ts";
  const proxyChatPath = "src/app/(authed)/api/v1/chat/route.ts";
  const proxyProvidersPath =
    "src/app/(authed)/api/v1/workflows/[id]/required-providers/route.ts";

  // --- Client cache choke point: keyed remount -----------------------------

  it("QueryProvider remounts under a key derived from the active org id", () => {
    const content = read(queryProviderPath);
    expect(content).toContain("useOrganization");
    expect(content).toContain("organization?.id");
    expect(content).toContain("key={orgKey}");
  });

  it("persister no-ops while orgId is null (never persists under a shared anon bucket)", () => {
    // While orgId is null the disk cache must NOT be written: a shared `cache:anon`
    // bucket would restore org A's data under org B (DIS-143 / OWASP shared-key).
    const content = read(queryProviderPath);
    expect(content).toContain(
      'typeof window !== "undefined" && orgId ? window.localStorage : undefined',
    );
  });

  it("OrgCacheInvalidator no longer clears the React Query cache (remount supersedes)", () => {
    const content = read(invalidatorPath);
    expect(content).not.toContain("queryClient.clear()");
    expect(content).not.toContain("useQueryClient");
  });

  it("OrgCacheInvalidator still navigates + clears breadcrumb on org change", () => {
    const content = read(invalidatorPath);
    expect(content).toContain("useOrganization");
    expect(content).toContain("prevOrgId");
    expect(content).toContain("router.push");
    expect(content).toContain("/orgs/");
    expect(content).toContain("clearBreadcrumbCaches");
  });

  it("OrgCacheInvalidator does NOT act on initial mount", () => {
    expect(read(invalidatorPath)).toContain("prevOrgId.current !== null");
  });

  it("OrgCacheInvalidator is mounted ABOVE QueryProvider so navigation survives the remount", () => {
    const content = read(layoutPath);
    const navIdx = content.indexOf("<OrgCacheInvalidator />");
    const providerIdx = content.indexOf("<QueryProvider>");
    expect(navIdx).toBeGreaterThanOrEqual(0);
    expect(providerIdx).toBeGreaterThanOrEqual(0);
    expect(navIdx).toBeLessThan(providerIdx);
  });

  it("OrgActivator activates the URL org on direct org deep links", () => {
    const content = read(orgActivatorPath);
    expect(content).toContain("usePathname");
    expect(content).toContain("const targetOrgId = urlOrgId");
    expect(content).toContain("m.organization.id === targetOrgId");
    expect(content).toContain("setActive({ organization: targetOrgId })");
  });

  it("OrgActivator lets staff direct-link into customer orgs through the secured join route", () => {
    const content = read(orgActivatorPath);
    expect(content).toContain("isAdminEmail");
    expect(content).toContain("!isMember && !isStaff");
    expect(content).toContain("`/api/admin/orgs/${targetOrgId}/join`");
  });

  // --- Server choke point: fail-closed proxy guard -------------------------

  it("every /api/v1 proxy route imports and calls checkProxyOrg", () => {
    for (const p of [proxyCatchAllPath, proxyChatPath, proxyProvidersPath]) {
      const content = read(p);
      expect(content, `${p} should import checkProxyOrg`).toContain(
        'from "@/lib/proxy-org"',
      );
      expect(content, `${p} should call checkProxyOrg`).toContain(
        'checkProxyOrg(clerkOrgId, req.headers.get("x-active-org-id")',
      );
    }
  });

  // --- Client request annotation + self-heal -------------------------------

  it("api.ts attaches x-active-org-id from the URL and retries once on org_desync", () => {
    const content = read(apiPath);
    expect(content).toContain("x-active-org-id");
    expect(content).toContain("activeOrgIdFromPath");
    expect(content).toContain("ORG_DESYNC_STATUS");
    expect(content).toContain("ORG_DESYNC_ERROR");
  });

  // --- Read gate -----------------------------------------------------------

  it("useAuthQuery gates org-owned reads on URL-org === active-org", () => {
    const content = read(useAuthQueryPath);
    expect(content).toContain("useOrganization");
    expect(content).toContain("usePathname");
    expect(content).toContain("orgConsistent");
    expect(content).toContain("enabled:");
  });

  it("useAuthQuery does NOT fire org reads while the active org is unresolved (null-tenant window)", () => {
    // The gate must be the strict `urlOrg === activeOrg`. The earlier permissive
    // form fired requests when the active org was still null (Clerk loading),
    // running them under an unknown org → cross-org bleed (DIS-143 / TanStack #3743).
    const content = read(useAuthQueryPath);
    expect(content).toContain("const orgConsistent = !urlOrgId || urlOrgId === activeOrgId;");
  });

  // --- Source: close the race ----------------------------------------------

  it("handleOrgSwitch awaits setActive before navigating", () => {
    const content = read(breadcrumbPath);
    expect(content).toContain("await setActive({ organization: clerkOrgId })");
  });

  it("handleOrgSwitch clears breadcrumb caches before setActive", () => {
    const content = read(breadcrumbPath);
    const match = content.match(
      /handleOrgSwitch[\s\S]*?clearBreadcrumbCaches[\s\S]*?setActive/,
    );
    expect(match).not.toBeNull();
  });

  it("breadcrumb-nav exports clearBreadcrumbCaches", () => {
    expect(read(breadcrumbPath)).toContain("export function clearBreadcrumbCaches");
  });
});
