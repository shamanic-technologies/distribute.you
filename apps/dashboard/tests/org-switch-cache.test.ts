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

  it("QueryProvider remounts under a key derived from the PER-TAB URL org (not the shared active org)", () => {
    // Clerk's active org is browser-global and flips when another tab switches —
    // keying the remount on it caused the cross-tab oscillation. Key on the URL org
    // (per-tab, stable); fall back to the active org only off the /orgs/ tree.
    const content = read(queryProviderPath);
    expect(content).toContain("usePathname");
    expect(content).toContain("/orgs/");
    expect(content).toContain("urlOrgId ?? organization?.id");
    expect(content).toContain("key={orgKey}");
  });

  it("persister no-ops while orgId is null (never persists under a shared anon bucket)", () => {
    // While orgId is null the disk cache must NOT be written: a shared `cache:anon`
    // key space would restore org A's data under org B (DIS-143 / OWASP shared-key).
    // The per-query persister storage is undefined unless a resolved org is present.
    const content = read(queryProviderPath);
    expect(content).toContain(
      'typeof window !== "undefined" && !!orgId',
    );
    expect(content).toContain("persistEnabled ? idbStorage : undefined");
  });

  it("OrgCacheInvalidator no longer clears the React Query cache (remount supersedes)", () => {
    const content = read(invalidatorPath);
    expect(content).not.toContain("queryClient.clear()");
    expect(content).not.toContain("useQueryClient");
  });

  it("OrgCacheInvalidator clears breadcrumb caches on org change", () => {
    const content = read(invalidatorPath);
    expect(content).toContain("useOrganization");
    expect(content).toContain("prevOrgId");
    expect(content).toContain("clearBreadcrumbCaches");
  });

  it("OrgCacheInvalidator NEVER navigates on a (possibly cross-tab) active-org change", () => {
    // The URL is the per-tab source of truth; the Clerk active-org signal is the
    // shared/global one and flips when ANOTHER tab switches. Navigating this tab on
    // that signal yanked tab A onto tab B's org (the cross-tab "switches by itself"
    // bug). In-tab switches navigate via handleOrgSwitch; URL→active via OrgActivator.
    const content = read(invalidatorPath);
    expect(content).not.toContain("router.push");
    expect(content).not.toContain("useRouter");
    expect(content).not.toContain("usePathname");
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

  it("api.ts attaches this tab's Clerk token as an Authorization Bearer (per-tab org scoping)", () => {
    // Multi-tab: the session COOKIE is a global singleton (last-focused tab wins), so
    // the proxy must scope off a PER-TAB token, not the cookie. window.Clerk is per-tab;
    // its getToken() rides in the Authorization header, which Clerk's auth() honors over
    // the cookie → the proxy sees the org THIS tab is viewing.
    const content = read(apiPath);
    expect(content).toContain("getTabSessionToken");
    expect(content).toContain("window");
    expect(content).toContain(".Clerk");
    expect(content).toContain("session?.getToken()");
    expect(content).toContain("`Bearer ${tabToken}`");
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
    // The gate compares URL-org to the active org. A genuinely-null active org
    // (first load, never resolved) still fails the gate (no `effectiveActiveOrgId`
    // to fall back to) → no request under an unknown org → no cross-org bleed
    // (DIS-143 / TanStack #3743). The latch below only fills a TRANSIENT null once a
    // resolved org exists; it never lets a null-from-cold fire a read.
    const content = read(useAuthQueryPath);
    expect(content).toContain("const orgConsistent = !urlOrgId || urlOrgId === effectiveActiveOrgId;");
  });

  it("useAuthQuery latches the last resolved active org so a null blink can't re-disable a consistent query", () => {
    // Clerk blinks `organization: null` on JWT rotation / tab focus. Without a latch
    // the gate flips false → disabled query → `isPending` → infinite skeleton when
    // the IndexedDB cache was evicted. The latch fills ONLY a null (never overrides a
    // different non-null org → cross-org isolation intact).
    const content = read(useAuthQueryPath);
    expect(content).toContain("lastResolvedActiveOrgId");
    expect(content).toContain("const effectiveActiveOrgId = activeOrgId ?? lastResolvedActiveOrgId.current;");
    // Latch only fills a null — a different non-null active org still closes the gate.
    expect(content).toContain("if (activeOrgId) lastResolvedActiveOrgId.current = activeOrgId;");
  });

  // --- Source: close the race ----------------------------------------------

  it("handleOrgSwitch awaits setActive before navigating", () => {
    const content = read(breadcrumbPath);
    expect(content).toContain("await setActive({ organization: clerkOrgId })");
  });

  it("handleOrgSwitch re-mints the session token AFTER setActive, BEFORE navigating", () => {
    // Without a fresh mint, setActive's Set-Cookie hasn't propagated when router.push
    // fires → the middleware's organizationSyncOptions reads the STALE token (active =
    // previous org / not-a-member of the target) and bounces the URL back → the
    // god-mode switch reverts on its own. The fresh mint closes that race.
    const content = read(breadcrumbPath);
    expect(content).toContain('await session?.getToken({ skipCache: true })');
    const match = content.match(
      /handleOrgSwitch[\s\S]*?setActive\([\s\S]*?getToken\(\{ skipCache: true \}\)[\s\S]*?router\.push/,
    );
    expect(match, "getToken must sit between setActive and router.push").not.toBeNull();
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
