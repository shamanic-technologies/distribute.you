"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
  useUser,
} from "@clerk/nextjs";
import { useState, useRef, useEffect, useCallback } from "react";
import { isAdminEmail } from "@/lib/admin-allowlist";

export interface TenantBrand {
  id: string;
  name: string;
  domain: string;
}

export interface TenantOrgOption {
  id: string;
  name: string;
  slug: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

// Caches — the brand LIST is keyed by org id. `/api/v1/brands` is org-scoped, so a
// single global cache bled one org's brands into another org's dropdown on a
// god-mode / cross-tab / direct-URL nav (any path that skips handleOrgSwitch, the
// only place the cache cleared) → the current brand missing from the list.
const brandListCache: Record<string, { data: TenantBrand[]; timestamp: number }> = {};
// The by-id brand label, keyed by brand id. The beta chrome mounts this hook up
// to three times at once (desktop sidebar + the mobile drawer's sidebar + the
// mobile header chip), and each instance would otherwise re-fetch the same brand
// on every navigation. Same 60s TTL as the list.
const brandByIdCache: Record<string, { data: TenantBrand; timestamp: number }> = {};
const CACHE_TTL = 60000;

/** Clear module-level tenant caches (called on org switch). Named
 *  `clearBreadcrumbCaches` for continuity with its original home + the
 *  `OrgCacheInvalidator` import site. */
export function clearBreadcrumbCaches() {
  for (const key of Object.keys(brandListCache)) delete brandListCache[key];
  for (const key of Object.keys(brandByIdCache)) delete brandByIdCache[key];
}

/** The org's domain when its name is domain-shaped. Onboarding creates the org
 *  with `name: <brand domain>`, so self-serve orgs carry a usable domain here;
 *  a renamed / non-domain org name returns null and falls back to the initial. */
export function orgDomainFromName(name?: string | null): string | null {
  if (!name) return null;
  const candidate = name.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[^\s]+\.[^\s]+$/.test(candidate) ? candidate : null;
}

/**
 * The single source of truth for org → brand identity + switching.
 *
 * Consumed by BOTH tenant surfaces so they can never drift:
 *  - `<TenantSwitcher>` (the sidebar-top block, dashboard)
 *  - `<TenantChip>` (the inline chip: the dashboard header below `md`, and the
 *    onboarding escape chrome, which has no sidebar)
 *
 * Extracted from the old top-bar breadcrumb (now deleted); the source guards
 * that used to read that file read this one.
 */
export function useTenantSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // `?new=1` = the "create a NEW org" onboarding flow → there is no target org
  // yet and the Clerk active org is a DIFFERENT org, so it must NOT stand in as
  // the label. `?from=add` (new BRAND) reuses the existing active org → its name
  // IS the right label. Only the new-brand flow gets the active-org fallback.
  const isNewOrgFlow = searchParams.get("new") === "1";
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { session } = useSession();
  // Staff get a "god-mode" org switcher (ALL platform orgs); regular customers
  // see only their own memberships (unchanged). isStaff gates the UI only — the
  // real security boundary is the `isAdminEmail` 403 on the /api/admin/* routes.
  const { user } = useUser();
  const isStaff = isAdminEmail(user?.primaryEmailAddress?.emailAddress);

  // Per-URL-org display label cache (name/avatar) — keeps the label from flipping
  // when Clerk's shared active org momentarily points at another tab's org.
  const orgDisplayCacheRef = useRef<
    Record<string, { name?: string; imageUrl?: string; hasImage?: boolean }>
  >({});
  // Per-URL-brand display cache (keep-last-good) — the twin of orgDisplayCacheRef.
  // The brand label reads `brands.find(...)`, which returns undefined when a
  // transient/degenerate `/api/v1/brands` response (cold Neon 200 with an empty
  // or partial list, or a stale 60s cache missing the current brand) drops the
  // current brand from state. Cache each brand's label the moment it resolves so
  // the name survives the transient.
  const brandDisplayCacheRef = useRef<
    Record<string, { name?: string; domain?: string | null }>
  >({});

  const [brands, setBrands] = useState<TenantBrand[]>([]);
  // Authoritative per-URL-brand label — fetched by id, exactly like the overview
  // page (`getBrand(brandId)`). The dropdown `brands` LIST is org-scoped + cached
  // and can legitimately not contain the URL brand (god-mode / cross-tab / a stale
  // 60s cache), which left the label stuck on the "Brand" placeholder forever
  // (the keep-last-good cache never got a first value to keep).
  const [byIdBrand, setByIdBrand] = useState<TenantBrand | null>(null);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [allOrgs, setAllOrgs] = useState<TenantOrgOption[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Parse path structure: /orgs/[orgId]/brands/[brandId]/<section>/[id]
  // The product ships ONE feature → no `/features/[featureSlug]` segment.
  const pathParts = pathname.split("/").filter(Boolean);
  const orgId = pathParts[0] === "orgs" && pathParts[1] ? pathParts[1] : null;
  const brandId = orgId && pathParts[2] === "brands" && pathParts[3] ? pathParts[3] : null;
  const section = brandId ? pathParts[4] ?? null : null;

  // Display the org from the URL (per-tab), NOT `useOrganization()`. Clerk's active
  // org is a SHARED browser-global value that flips when another tab switches org —
  // binding the label to it made the org name visibly oscillate between tabs.
  // The URL org is stable per tab. We cache each org's label the moment the active
  // org matches the URL (the normal focused case). (#1948)
  if (organization && organization.id === orgId) {
    orgDisplayCacheRef.current[orgId] = {
      name: organization.name,
      imageUrl: organization.imageUrl,
      hasImage: organization.hasImage,
    };
  }
  const displayOrg = orgId
    ? orgDisplayCacheRef.current[orgId] ??
      allOrgs.find((o) => o.id === orgId) ??
      userMemberships?.data?.find((m) => m.organization.id === orgId)?.organization
    : // Off the /orgs/ tree (the onboarding create flow: `/onboarding?from=add`),
      // there is no URL org to key on, so fall back to Clerk's active org — the
      // add-BRAND flow reuses the existing active org, so its name is the right
      // label. The add-ORG flow (`?new=1`) is EXCLUDED: it targets a brand-new
      // org that isn't the active one, so the active-org name would mislead.
      // Sanctioned by CLAUDE.md: `useOrganization()` may feed off-/orgs/ fallbacks.
      isNewOrgFlow
      ? undefined
      : organization ?? undefined;
  const displayOrgName = displayOrg?.name || "Dashboard";
  const displayOrgImageUrl = displayOrg?.imageUrl;
  const displayOrgHasImage =
    (displayOrg as { hasImage?: boolean } | undefined)?.hasImage;

  // Staff-only: fetch ALL platform orgs (god-mode switcher). No-op for customers.
  const fetchOrgs = useCallback(async (q: string) => {
    setOrgsLoading(true);
    try {
      const res = await fetch(`/api/admin/orgs?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setAllOrgs(data.organizations || []);
      }
    } catch (err) {
      console.error("Failed to fetch orgs:", err);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    if (!orgId) return;
    const cached = brandListCache[orgId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setBrands(cached.data);
      return;
    }
    setBrandsLoading(true);
    try {
      const res = await fetch("/api/v1/brands");
      if (res.ok) {
        const data = await res.json();
        const list = data.brands || [];
        brandListCache[orgId] = { data: list, timestamp: Date.now() };
        setBrands(list);
      }
    } catch (err) {
      console.error("Failed to fetch brands:", err);
    } finally {
      setBrandsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (brandId) fetchBrands();
  }, [brandId, fetchBrands]);

  useEffect(() => {
    if (!brandId) { setByIdBrand(null); return; }
    const cached = brandByIdCache[brandId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setByIdBrand(cached.data);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/brands/${brandId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.brand) return;
        const resolved = { id: brandId, name: data.brand.name, domain: data.brand.domain };
        brandByIdCache[brandId] = { data: resolved, timestamp: Date.now() };
        setByIdBrand(resolved);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [brandId]);

  const handleOrgSwitch = useCallback(async (clerkOrgId: string) => {
    clearBreadcrumbCaches();
    // Update Clerk's client-side active org so useOrganization() reflects the switch
    // immediately (label, OrgCacheInvalidator firing, QueryProvider remount). Then
    // push the URL so middleware's organizationSyncOptions confirms server-side and
    // /api/v1/* calls run under the new org. Both directions are required:
    // setActive alone left the URL stale (PR #1058 prod incident, polls 404'd);
    // router.push alone left the client UI stale until the session cookie refreshed.
    //
    // AWAIT setActive before navigating: it resolves once the Clerk session (and its
    // org claim) has rotated to the new org. Navigating / firing an API call before
    // that resolves carries the OLD org in the lag window → write commits under the
    // wrong org, later read 404s (DIS-143 stale write). The proxy's fail-closed guard
    // is the backstop; awaiting closes the race at the source.
    //
    // STAFF god-mode: the target may be a customer org the staff member is NOT a
    // member of. Clerk `setActive` rejects a non-member org, so first make them a
    // real member (role org:admin) server-side. Idempotent. Only staff hit this
    // (the route 403s otherwise); customers always switch to an org they own.
    if (isStaff) {
      try {
        await fetch(`/api/admin/orgs/${clerkOrgId}/join`, { method: "POST" });
      } catch (err) {
        console.error("Failed to join org:", err);
      }
    }
    if (setActive) {
      await setActive({ organization: clerkOrgId });
    }
    // Re-mint the session token so the new active org (and, for staff god-mode, the
    // freshly-added membership) are in the cookie BEFORE the navigation hits the
    // middleware. `setActive` resolves on the client before its Set-Cookie has
    // propagated, so without this the next request reaches `proxy.ts`
    // `organizationSyncOptions` carrying the STALE token (active = previous org /
    // not-a-member of the target) → Clerk bounces the URL back → OrgActivator
    // re-syncs the client to the previous org → the switch reverts on its own.
    await session?.getToken({ skipCache: true }).catch(() => {});
    router.push(`/orgs/${clerkOrgId}`);
  }, [isStaff, setActive, session, router]);

  const handleBrandSwitch = useCallback((newBrandId: string) => {
    if (orgId) router.push(`/orgs/${orgId}/brands/${newBrandId}`);
  }, [orgId, router]);

  // Resolve the brand from the dropdown list first, then the authoritative by-id
  // fetch (which resolves even when the list doesn't contain the URL brand).
  const currentBrand =
    brands.find((b) => b.id === brandId) ??
    (byIdBrand && byIdBrand.id === brandId ? byIdBrand : undefined);
  // Keep-last-good: cache the label when the brand resolves, read from cache when a
  // transient fetch drops it, so the label never flips to the "Brand" placeholder.
  if (brandId && currentBrand) {
    brandDisplayCacheRef.current[brandId] = {
      name: currentBrand.name,
      domain: currentBrand.domain,
    };
  }
  const displayBrand = brandId
    ? currentBrand ?? brandDisplayCacheRef.current[brandId]
    : undefined;

  return {
    pathname,
    pathParts,
    orgId,
    brandId,
    section,
    isStaff,
    memberships: userMemberships?.data ?? [],
    allOrgs,
    orgsLoading,
    orgSearch,
    setOrgSearch,
    fetchOrgs,
    brands,
    brandsLoading,
    fetchBrands,
    displayOrgName,
    displayOrgImageUrl,
    displayOrgHasImage,
    displayBrand,
    handleOrgSwitch,
    handleBrandSwitch,
    router,
  };
}
