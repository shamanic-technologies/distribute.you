"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
  useUser,
} from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, listBrands } from "@/lib/api";

export interface TenantBrand {
  id: string;
  name: string | null;
  domain: string | null;
}

export interface TenantOrgOption {
  id: string;
  name: string;
  slug: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

/** The org label persisted alongside every other query (name + Clerk avatar). */
interface TenantOrgIdentity {
  name: string;
  imageUrl?: string;
  hasImage?: boolean;
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
 *  - `breadcrumb-nav.tsx` (the onboarding chrome)
 *  - `tenant-switcher.tsx` (the sidebar-top switcher)
 *
 * LOCAL-FIRST: every identity read here goes through React Query, so the
 * per-query IndexedDB persister paints the last-known org name, brand name and
 * brand domain (→ the logo.dev logo) on the FIRST frame of a cold load and
 * revalidates silently behind it. Before this, the hook was the one dashboard
 * surface bypassing that cache: it fetched `/api/v1/brands` + `/api/v1/brands/:id`
 * with a raw `fetch` behind module-level 60s caches, and held the org label in a
 * `useRef` — none of which survive a page load, so every hard navigation showed
 * the `Dashboard` / `Brand` placeholders and an empty logo slot for as long as the
 * cold gateway → brand-service chain took to answer.
 *
 * Three consequences worth keeping in mind when editing:
 *  - `["brands"]` and `["brand", brandId]` are the SAME keys the org-overview,
 *    billing and brand pages already use, so those reads dedupe instead of
 *    doubling. All three roots (incl. `orgIdentity`) are in
 *    `PERSISTABLE_QUERY_ROOTS` — a new identity read must be added there too or
 *    it silently loses the instant paint.
 *  - `listBrands`/`getBrand` go through the shared api client, which scopes each
 *    request to THIS tab's Clerk session. The raw `fetch` they replace rode the
 *    shared session cookie (last-focused tab wins), so a multi-tab user could
 *    resolve the label under another tab's org.
 *  - The org switch no longer needs a manual cache clear: the QueryProvider
 *    remounts under the org key and the persister is org-prefixed, so neither
 *    memory nor disk can carry org A's labels into org B.
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

  const [allOrgs, setAllOrgs] = useState<TenantOrgOption[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Parse path structure: /orgs/[orgId]/brands/[brandId]/<section>/[id]
  // The product ships ONE feature → no `/features/[featureSlug]` segment.
  const pathParts = pathname.split("/").filter(Boolean);
  const orgId = pathParts[0] === "orgs" && pathParts[1] ? pathParts[1] : null;
  const brandId = orgId && pathParts[2] === "brands" && pathParts[3] ? pathParts[3] : null;
  const section = brandId ? pathParts[4] ?? null : null;

  // ── Org identity ────────────────────────────────────────────────────────────
  // Display the org from the URL (per-tab), NOT `useOrganization()`. Clerk's active
  // org is a SHARED browser-global value that flips when another tab switches org —
  // binding the label to it made the org name visibly oscillate between tabs. The
  // URL org is stable per tab. (#1948)
  //
  // Clerk itself is the only source of an org's name (client-service `orgs.name` is
  // null for everyone), and it hydrates asynchronously — which is why the label read
  // `Dashboard` for the first second of every load. Snapshotting it into a query
  // means the persister writes it to disk, so the NEXT load paints the last-known
  // name before Clerk has loaded at all, then revalidates. `enabled` is the same
  // condition that used to guard the ref write: only snapshot the org the URL is on.
  const orgIdentityQuery = useQuery<TenantOrgIdentity>({
    queryKey: ["orgIdentity", orgId],
    queryFn: async () => ({
      name: organization!.name,
      imageUrl: organization!.imageUrl,
      hasImage: organization!.hasImage,
    }),
    enabled: !!orgId && organization?.id === orgId,
  });

  // Live Clerk value first (freshest, e.g. an org just renamed in another surface),
  // then the persisted snapshot, then the lists we already hold.
  const liveOrg = organization && organization.id === orgId ? organization : null;
  const displayOrg:
    | { name?: string; imageUrl?: string | null; hasImage?: boolean }
    | undefined = orgId
    ? liveOrg ??
      orgIdentityQuery.data ??
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
  const displayOrgImageUrl = displayOrg?.imageUrl ?? undefined;
  const displayOrgHasImage = displayOrg?.hasImage;

  // Staff-only: fetch ALL platform orgs (god-mode switcher). No-op for customers.
  // Search-driven and debounced by the caller, so it stays a plain fetch — there is
  // no stable key to cache it under and nothing to paint from disk.
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

  // ── Brands ──────────────────────────────────────────────────────────────────
  // The dropdown list. Same key as the org-overview + billing pages, so opening the
  // submenu costs nothing once any of them has run.
  const brandsQuery = useAuthQuery(["brands"], () => listBrands(), {
    enabled: !!orgId,
  });
  const brands: TenantBrand[] = brandsQuery.data?.brands ?? [];
  // Reveal on SETTLE: a failed list must fall through to the "No brands" empty
  // state, never sit on "Loading…" forever.
  const brandsLoading = brandsQuery.isPending && !brandsQuery.isError;

  // The authoritative label for the URL brand. The org-scoped LIST can legitimately
  // not contain it (god-mode / a brand created in another tab), which used to leave
  // the label pinned to the "Brand" placeholder; the by-id read always resolves it.
  // Same key the brand overview page uses → warm on arrival.
  const brandQuery = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId!),
    { enabled: !!brandId },
  );

  const handleOrgSwitch = useCallback(async (clerkOrgId: string) => {
    // Update Clerk's client-side active org so useOrganization() reflects the switch
    // immediately (label, QueryProvider remount). Then push the URL so middleware's
    // organizationSyncOptions confirms server-side and /api/v1/* calls run under the
    // new org. Both directions are required: setActive alone left the URL stale
    // (PR #1058 prod incident, polls 404'd); router.push alone left the client UI
    // stale until the session cookie refreshed.
    //
    // No cache clear here: the QueryProvider remounts under the org key (fresh empty
    // in-memory cache) and the per-query persister is org-prefixed, so org A's
    // labels can reach neither org B's memory nor its disk key space.
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
  // read. Both are disk-backed, so whichever answers first paints instantly.
  const byIdBrand = brandQuery.data?.brand;
  const displayBrand: TenantBrand | undefined = brandId
    ? brands.find((b) => b.id === brandId) ??
      (byIdBrand
        ? { id: byIdBrand.id, name: byIdBrand.name, domain: byIdBrand.domain }
        : undefined)
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
    fetchBrands: brandsQuery.refetch,
    displayOrgName,
    displayOrgImageUrl,
    displayOrgHasImage,
    displayBrand,
    handleOrgSwitch,
    handleBrandSwitch,
    router,
  };
}
