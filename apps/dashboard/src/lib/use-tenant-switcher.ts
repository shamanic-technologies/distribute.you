"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
  useUser,
} from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, listBrands, listBrandOffers, getBrandOffer, type Offer } from "@/lib/api";
import { useTenantIdentity } from "@/components/tenant-identity-provider";

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
 * The single source of truth for org → brand → offer identity + switching.
 *
 * Three tiers, because the OFFER is a real level of the product: a brand is an
 * IDENTITY (name, domain, logo, tracking snippet) and an offer is a PROPOSITION,
 * and campaigns, audiences and leads all belong to the offer. The offer reads
 * mirror the brand ones exactly — a LIST for the dropdown plus an authoritative
 * by-id read for the label, because the list can legitimately not contain the one
 * the URL is on.
 *
 * Consumed by BOTH tenant surfaces so they can never drift:
 *  - `breadcrumb-nav.tsx` (the onboarding chrome)
 *  - `tenant-switcher.tsx` (the sidebar-top switcher)
 *
 * FIRST FRAME: the identity comes from a SERVER-READ cookie (`useTenantIdentity`),
 * so the real org name, brand name and brand domain (→ the logo.dev mark) are in
 * the SSR HTML — on screen before any JS runs. The React Query + IndexedDB path
 * below owns freshness, but it CANNOT own the first frame: its restore is
 * asynchronous (a `useEffect` in query-provider), so it is structurally incapable
 * of beating the initial paint, which is why `Brand` + the globe kept flashing on
 * every hard refresh even after the identity reads were moved onto the persister.
 * The cookie is the only store the server can read. Keep the two layers: drop the
 * cookie and the flash returns; drop the queries and the labels go stale.
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
  // The server-read cookie snapshot. Available synchronously, on the very first
  // render, on the server AND the client — the only source with that property.
  const { seed: identitySeed, remember: rememberIdentity } = useTenantIdentity();

  const [allOrgs, setAllOrgs] = useState<TenantOrgOption[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);
  // The org the user just clicked, held from the click until the navigation is
  // under way. A switch costs two or three Clerk round-trips before anything can
  // paint, and the sidebar label is keyed on the URL org — which has not moved
  // yet — so without this the whole window is indistinguishable from a dead
  // button. Carries the NAME as well as the id: the target is frequently absent
  // from every list we hold (staff god-mode), so there is nothing to look it up
  // in once the menu starts closing.
  const [switchingOrg, setSwitchingOrg] = useState<{ id: string; name: string } | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Parse path structure:
  // /orgs/[orgId]/brands/[brandId]/offers/[offerId]/<section>/[id]
  // The product ships ONE feature → no `/features/[featureSlug]` segment.
  const pathParts = pathname.split("/").filter(Boolean);
  const orgId = pathParts[0] === "orgs" && pathParts[1] ? pathParts[1] : null;
  const brandId = orgId && pathParts[2] === "brands" && pathParts[3] ? pathParts[3] : null;
  const offerId =
    brandId && pathParts[4] === "offers" && pathParts[5] ? pathParts[5] : null;
  const section = offerId ? pathParts[6] ?? null : brandId ? pathParts[4] ?? null : null;

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
  // then the persisted snapshot, then the lists we already hold, and LAST the
  // server-read cookie seed. Ordering matters in both directions: a fresher source
  // must always win, and the seed must always be reachable — it is the only entry
  // that exists during SSR and the first client frame.
  const seededOrg = orgId ? identitySeed?.orgs[orgId] : undefined;
  const liveOrg = organization && organization.id === orgId ? organization : null;
  const displayOrg:
    | { name?: string; imageUrl?: string | null; hasImage?: boolean }
    | undefined = orgId
    ? liveOrg ??
      orgIdentityQuery.data ??
      allOrgs.find((o) => o.id === orgId) ??
      userMemberships?.data?.find((m) => m.organization.id === orgId)?.organization ??
      (seededOrg
        ? { name: seededOrg.n, imageUrl: seededOrg.i, hasImage: !!seededOrg.i }
        : undefined)
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
  // "Do we actually know this tenant?" — distinct from the label being non-empty,
  // because the label falls back to a generic word. A surface that shows identity
  // renders a skeleton while this is false rather than asserting a name we do not
  // have; `Dashboard` / `Brand` beside a globe is a fabricated identity, and the
  // user reads it as the product having lost their brand.
  const orgKnown = !!displayOrg?.name;

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

  // ── Offers ──────────────────────────────────────────────────────────────────
  // The third tier. An offer is a PROPOSITION under the brand identity, and it is
  // where campaigns, audiences and leads live, so switching offer is as ordinary a
  // move as switching brand. Same discipline as the brand tier: a LIST for the
  // dropdown, plus an authoritative BY-ID read for the label, because the list can
  // legitimately not contain the offer the URL is on (created in another tab).
  const offersQuery = useAuthQuery(
    ["brandOffers", brandId],
    () => listBrandOffers(brandId!),
    { enabled: !!brandId },
  );
  const offers: Offer[] = offersQuery.data?.offers ?? [];
  // Reveal on SETTLE: a failed list falls through to the empty state, never sits
  // on "Loading…" forever.
  const offersLoading = offersQuery.isPending && !offersQuery.isError;

  const offerQuery = useAuthQuery(
    ["brandOffer", brandId, offerId],
    () => getBrandOffer(brandId!, offerId!),
    { enabled: !!brandId && !!offerId },
  );
  const displayOffer: Offer | undefined = offerId
    ? offers.find((o) => o.offerId === offerId) ?? offerQuery.data?.offer
    : undefined;
  // Same rule as `orgKnown` / `brandKnown`: a surface renders a skeleton while this
  // is false rather than asserting a name we do not have.
  const offerKnown = !!displayOffer;

  const handleOfferSwitch = useCallback((newOfferId: string) => {
    if (orgId && brandId) router.push(`/orgs/${orgId}/brands/${brandId}/offers/${newOfferId}`);
  }, [orgId, brandId, router]);

  const handleOrgSwitch = useCallback(async (clerkOrgId: string, orgName?: string) => {
    // Mark the switch pending SYNCHRONOUSLY, before the first await. Everything
    // below is network, and until `router.push` lands there is nothing on screen
    // that reflects the click — the switcher label reads the URL org, which is
    // still the old one. Reported as "je change d'org et il ne se passe rien,
    // des fois j'attends 30s".
    setSwitchError(null);
    setSwitchingOrg({ id: clerkOrgId, name: orgName ?? "" });

    try {
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
      //
      // Skip it entirely when Clerk's own membership list — already loaded on the
      // client, so free to read — says the membership exists. That check is
      // authoritative-POSITIVE only: the list is paginated, so an ABSENT membership
      // proves nothing and still goes through the (idempotent) route. Staff switch
      // mostly into orgs they joined long ago, and this was a full Clerk Backend API
      // round-trip on every one of those clicks.
      const alreadyMember = (userMemberships?.data ?? []).some(
        (m) => m.organization.id === clerkOrgId,
      );
      if (isStaff && !alreadyMember) {
        const res = await fetch(`/api/admin/orgs/${clerkOrgId}/join`, { method: "POST" });
        // Fail loud. Continuing past a failed join reaches `setActive` on an org the
        // user does not belong to, which REJECTS — and that rejection was unhandled
        // inside a click handler, so `router.push` never ran and nothing was shown.
        // That is the "sometimes it never does anything at all" half of the report.
        if (!res.ok) {
          throw new Error(`Could not open that organization (join failed: ${res.status}).`);
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
      // No `.catch` here: a failed re-mint IS that revert, so it belongs in the
      // handler's catch where the user is told, not swallowed.
      await session?.getToken({ skipCache: true });
      router.push(`/orgs/${clerkOrgId}`);
    } catch (err) {
      console.error("[dashboard] org switch failed:", err);
      setSwitchingOrg(null);
      setSwitchError(
        err instanceof Error ? err.message : "Could not switch organization.",
      );
    }
  }, [isStaff, userMemberships?.data, setActive, session, router]);

  // Drop the pending state once the URL has actually moved to the target. The
  // navigation is what ends the switch, not the promise resolving — `router.push`
  // returns before the destination renders, so clearing it there would blank the
  // label again for the rest of the wait.
  useEffect(() => {
    if (switchingOrg && orgId === switchingOrg.id) setSwitchingOrg(null);
  }, [switchingOrg, orgId]);

  const handleBrandSwitch = useCallback((newBrandId: string) => {
    if (orgId) router.push(`/orgs/${orgId}/brands/${newBrandId}`);
  }, [orgId, router]);

  // Resolve the brand from the dropdown list first, then the authoritative by-id
  // read, and LAST the server-read cookie seed. The first two are disk-backed, so
  // whichever answers first paints instantly once JS is running; the seed is what
  // covers the window before that — SSR and the pre-hydration frames.
  const byIdBrand = brandQuery.data?.brand;
  const seededBrand = brandId ? identitySeed?.brands[brandId] : undefined;
  const displayBrand: TenantBrand | undefined = brandId
    ? brands.find((b) => b.id === brandId) ??
      (byIdBrand
        ? { id: byIdBrand.id, name: byIdBrand.name, domain: byIdBrand.domain }
        : seededBrand
          ? { id: brandId, name: seededBrand.n, domain: seededBrand.d }
          : undefined)
    : undefined;
  const brandKnown = !!displayBrand;

  // Write every freshly-resolved identity back to the cookie so the NEXT load
  // paints it server-side. Deliberately keyed on the resolved VALUES, not on the
  // queries: it must fire for whichever source answered (Clerk, the list, the
  // by-id read), and `remember` no-ops when nothing changed, so a poll re-resolving
  // the same name does not re-write the cookie on every tick.
  // Depend on PRIMITIVES, never on `displayBrand` itself: that object is rebuilt on
  // every render, so keeping it in the dep list would re-run this (and re-parse the
  // cookie) on each one. Harmless but pointless — the values are what changed or not.
  const rememberedOrgName = orgKnown ? displayOrg?.name : undefined;
  const rememberedOrgImage = displayOrgHasImage ? displayOrgImageUrl : undefined;
  // Only remember a brand we have a real half of — a `{name: null, domain: null}`
  // row would just re-serve the placeholder from the cookie on the next load.
  const rememberedBrandName = displayBrand?.name ?? null;
  const rememberedBrandDomain = displayBrand?.domain ?? null;
  useEffect(() => {
    if (!orgId && !brandId) return;
    rememberIdentity({
      orgId,
      org: rememberedOrgName
        ? rememberedOrgImage
          ? { n: rememberedOrgName, i: rememberedOrgImage }
          : { n: rememberedOrgName }
        : null,
      brandId,
      brand:
        rememberedBrandName || rememberedBrandDomain
          ? { n: rememberedBrandName, d: rememberedBrandDomain }
          : null,
    });
  }, [
    orgId,
    brandId,
    rememberedOrgName,
    rememberedOrgImage,
    rememberedBrandName,
    rememberedBrandDomain,
    rememberIdentity,
  ]);

  return {
    pathname,
    pathParts,
    orgId,
    brandId,
    offerId,
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
    offers,
    offersLoading,
    fetchOffers: offersQuery.refetch,
    displayOffer,
    orgKnown,
    brandKnown,
    offerKnown,
    handleOrgSwitch,
    handleBrandSwitch,
    handleOfferSwitch,
    // The click is answered here, not by the destination: `switchingOrgId` spins
    // the clicked row and re-labels the switcher with the target, `switchError`
    // states a refusal instead of leaving a dead button behind.
    switchingOrgId: switchingOrg?.id ?? null,
    switchingOrgName: switchingOrg?.name || null,
    switchError,
    router,
  };
}
