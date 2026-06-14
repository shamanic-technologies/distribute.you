"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrganization, useOrganizationList, useUser } from "@clerk/nextjs";
import { useState, useRef, useEffect, useCallback } from "react";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { useFeatures } from "@/lib/features-context";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { FEATURE_GATES, GA_BRAND_FEATURES } from "@/lib/feature-gates";
import { workflowDisplayName } from "@/lib/workflow-display-name";
import { BrandLogo } from "./brand-logo";
import { explicitHierarchyHref } from "@/lib/last-brand";

interface Brand {
  id: string;
  name: string;
  domain: string;
}

interface OrgOption {
  id: string;
  name: string;
  slug: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}

interface Campaign {
  id: string;
  name: string;
}

// Caches
const brandListCache: { data: Brand[] | null; timestamp: number } = { data: null, timestamp: 0 };
const campaignListCache: Record<string, { data: Campaign[]; timestamp: number }> = {};
const CACHE_TTL = 60000;

/** Clear module-level breadcrumb caches (called on org switch) */
export function clearBreadcrumbCaches() {
  brandListCache.data = null;
  brandListCache.timestamp = 0;
  for (const key of Object.keys(campaignListCache)) {
    delete campaignListCache[key];
  }
}

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The org's domain when its name is domain-shaped. Onboarding creates the org
 *  with `name: <brand domain>`, so self-serve orgs carry a usable domain here;
 *  a renamed / non-domain org name returns null and falls back to the initial. */
function orgDomainFromName(name?: string | null): string | null {
  if (!name) return null;
  const candidate = name.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[^\s]+\.[^\s]+$/.test(candidate) ? candidate : null;
}

/** Organization avatar. Resolution order:
 *  1. A real *uploaded* Clerk logo (`hasImage` — Clerk's `imageUrl` is ALWAYS
 *     populated, defaulting to a generated gradient-initials avatar we don't want).
 *  2. logo.dev keyed on the org's domain-shaped name.
 *  3. The org's initial.
 *  Plain `<img>` — no Next/Image domain config needed, mirrors lead photos. */
function OrgAvatar({
  name,
  imageUrl,
  hasImage,
  sizeClass,
}: {
  name: string;
  imageUrl?: string | null;
  hasImage?: boolean;
  sizeClass: string;
}) {
  const [broken, setBroken] = useState(false);
  const domain = orgDomainFromName(name);
  const src = hasImage && imageUrl
    ? imageUrl
    : domain
      ? `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}`
      : null;
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        onError={() => setBroken(true)}
        className={`${sizeClass} rounded object-cover bg-brand-100 flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClass} bg-brand-100 rounded flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand-600 font-semibold text-xs">{name?.[0]?.toUpperCase() || "O"}</span>
    </div>
  );
}

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  // Staff get a "god-mode" org switcher (ALL platform orgs); regular customers
  // see only their own memberships (unchanged). isStaff gates the UI only — the
  // real security boundary is the `isAdminEmail` 403 on the /api/admin/* routes.
  const { user } = useUser();
  const isStaff = isAdminEmail(user?.primaryEmailAddress?.emailAddress);
  const { features, getFeature } = useFeatures();
  // Gate the feature switcher exactly like the sidebar + brand overview: a
  // non-staff viewer sees only GA features, staff (flag on) sees all. Without
  // this the breadcrumb dropdown leaked every alpha feature to non-staff.
  const featuresAlphaOk = useFeatureFlag(FEATURE_GATES["brand-features"].flag);
  const visibleFeatures = features.filter(
    (f) => GA_BRAND_FEATURES.has(f.slug) || featuresAlphaOk,
  );
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [allOrgs, setAllOrgs] = useState<OrgOption[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);

  // Parse path structure: /orgs/[orgId]/brands/[brandId]/<section>/[id]
  // The product ships ONE feature → no `/features/[featureSlug]` segment.
  // Also handles app-level: /features/[featureId] and /features/[featureId]/new
  const pathParts = pathname.split("/").filter(Boolean);
  const orgId = pathParts[0] === "orgs" && pathParts[1] ? pathParts[1] : null;
  const brandId = orgId && pathParts[2] === "brands" && pathParts[3] ? pathParts[3] : null;
  const section = brandId ? pathParts[4] ?? null : null;
  const campaignId =
    brandId && section === "campaigns" && pathParts[5] && pathParts[5] !== "new"
      ? pathParts[5]
      : null;
  const workflowId =
    brandId && section === "workflows" && pathParts[5] && pathParts[5] !== "new"
      ? pathParts[5]
      : null;
  // App-level feature path: /features/[featureId] or /features/[featureId]/new
  const appFeatureId = !orgId && pathParts[0] === "features" && pathParts[1] ? pathParts[1] : null;
  const appFeatureSubpage = appFeatureId && pathParts[2] ? pathParts[2] : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Fetch the all-orgs list when a staff member opens the org dropdown; debounce
  // on search. Never fires for non-staff (the route would 403 anyway).
  useEffect(() => {
    if (!isStaff || openDropdown !== "org") return;
    const t = setTimeout(() => fetchOrgs(orgSearch), 250);
    return () => clearTimeout(t);
  }, [isStaff, openDropdown, orgSearch, fetchOrgs]);

  const fetchBrands = useCallback(async () => {
    if (brandListCache.data && Date.now() - brandListCache.timestamp < CACHE_TTL) {
      setBrands(brandListCache.data);
      return;
    }
    setLoading((l) => ({ ...l, brands: true }));
    try {
      const res = await fetch("/api/v1/brands");
      if (res.ok) {
        const data = await res.json();
        const list = data.brands || [];
        brandListCache.data = list;
        brandListCache.timestamp = Date.now();
        setBrands(list);
      }
    } catch (err) {
      console.error("Failed to fetch brands:", err);
    } finally {
      setLoading((l) => ({ ...l, brands: false }));
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    if (!brandId) return;
    const cached = campaignListCache[brandId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setCampaigns(cached.data);
      return;
    }
    setLoading((l) => ({ ...l, campaigns: true }));
    try {
      const res = await fetch(`/api/v1/campaigns?brandId=${brandId}`);
      if (res.ok) {
        const data = await res.json();
        const list = data.campaigns || [];
        campaignListCache[brandId] = { data: list, timestamp: Date.now() };
        setCampaigns(list);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading((l) => ({ ...l, campaigns: false }));
    }
  }, [brandId]);

  useEffect(() => {
    if (brandId) fetchBrands();
  }, [brandId, fetchBrands]);

  useEffect(() => {
    if (campaignId) fetchCampaigns();
  }, [campaignId, fetchCampaigns]);

  useEffect(() => {
    if (!workflowId) { setWorkflowName(null); return; }
    fetch(`/api/v1/workflows/${workflowId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setWorkflowName(data ? workflowDisplayName(data) : null))
      .catch(() => setWorkflowName(null));
  }, [workflowId]);

  const toggleDropdown = (key: string) => {
    if (openDropdown === key) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(key);
      if (key === "brand") fetchBrands();
      if (key === "campaign") fetchCampaigns();
    }
  };

  const handleOrgSwitch = async (clerkOrgId: string) => {
    setOpenDropdown(null);
    clearBreadcrumbCaches();
    // Update Clerk's client-side active org so useOrganization() reflects the switch
    // immediately (breadcrumb name, OrgCacheInvalidator firing, QueryProvider remount).
    // Then push the URL so middleware's organizationSyncOptions confirms server-side
    // and /api/v1/* calls run under the new org. Both directions are required:
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
    router.push(`/orgs/${clerkOrgId}`);
  };

  const handleBrandSwitch = (newBrandId: string) => {
    setOpenDropdown(null);
    if (orgId) {
      router.push(`/orgs/${orgId}/brands/${newBrandId}`);
    }
  };

  const handleCampaignSwitch = (newCampaignId: string) => {
    setOpenDropdown(null);
    if (orgId && brandId) {
      const subpage = pathParts[6] || "";
      router.push(`/orgs/${orgId}/brands/${brandId}/campaigns/${newCampaignId}${subpage ? "/" + subpage : ""}`);
    }
  };

  const currentBrand = brands.find((b) => b.id === brandId);
  const currentCampaign = campaigns.find((c) => c.id === campaignId);
  const appFeatureDef = appFeatureId ? getFeature(appFeatureId) : null;
  const appFeatureLabel = appFeatureDef ? (appFeatureDef.name) : appFeatureId;

  const handleAppFeatureSwitch = (newFeatureId: string) => {
    setOpenDropdown(null);
    router.push(`/features/${newFeatureId}`);
  };

  const Chevron = ({ open }: { open: boolean }) => (
    <svg className={`w-3 h-3 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  const Sep = () => (
    <svg className="w-4 h-4 text-gray-300 mx-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <nav className="flex items-center text-sm min-w-0" ref={dropdownRef}>
      {/* ORG — always shown as root */}
      <div className="relative flex items-center">
        <Link href={organization ? explicitHierarchyHref(`/orgs/${organization.id}`) : explicitHierarchyHref("/")} className="px-2 py-1 rounded-md hover:bg-gray-100 transition flex items-center gap-1.5">
          <OrgAvatar name={organization?.name || "Dashboard"} imageUrl={organization?.imageUrl} hasImage={organization?.hasImage} sizeClass="w-5 h-5" />
          <span className="font-medium text-gray-800 max-w-[140px] truncate">{organization?.name || "Dashboard"}</span>
        </Link>
        <button onClick={() => toggleDropdown("org")} className="p-1 hover:bg-gray-100 rounded transition">
          <Chevron open={openDropdown === "org"} />
        </button>
        {openDropdown === "org" && (
          <div className={`absolute left-0 top-full mt-1 ${isStaff ? "w-72" : "w-56"} bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50`}>
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1.5">Switch organization</p>
              {isStaff && (
                <input
                  autoFocus
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Search all organizations…"
                  className="w-full text-sm px-2 py-1 border border-gray-200 rounded focus:ring-2 focus:ring-brand-300 focus:outline-none"
                />
              )}
            </div>
            {isStaff ? (
              <div className="max-h-80 overflow-y-auto">
                {orgsLoading && (
                  <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
                )}
                {!orgsLoading && allOrgs.length === 0 && (
                  <p className="px-3 py-2 text-xs text-gray-400">No organizations found</p>
                )}
                {allOrgs.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleOrgSwitch(o.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      organization?.id === o.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} sizeClass="w-6 h-6" />
                    <span className="truncate">{o.name}</span>
                    {organization?.id === o.id && (
                      <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              userMemberships?.data?.map((m) => (
                <button
                  key={m.organization.id}
                  onClick={() => handleOrgSwitch(m.organization.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                    organization?.id === m.organization.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <OrgAvatar name={m.organization.name} imageUrl={m.organization.imageUrl} hasImage={m.organization.hasImage} sizeClass="w-6 h-6" />
                  <span className="truncate">{m.organization.name}</span>
                  {organization?.id === m.organization.id && (
                    <svg className="w-4 h-4 text-brand-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { setOpenDropdown(null); router.push("/onboarding?new=1"); }}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition"
              >
                <div className="w-6 h-6 border-2 border-dashed border-gray-300 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-400 text-xs font-bold">+</span>
                </div>
                <span>New organization</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* APP-LEVEL FEATURE */}
      {appFeatureId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/features/${appFeatureId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800 truncate max-w-[200px]">
              {appFeatureLabel}
            </Link>
            <button onClick={() => toggleDropdown("appFeature")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "appFeature"} />
            </button>
            {openDropdown === "appFeature" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch feature</p>
                </div>
                {visibleFeatures.map((f) => {
                  return (
                  <button
                    key={f.slug}
                    onClick={() => handleAppFeatureSwitch(f.slug)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      appFeatureId === f.slug ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{f.name}</span>
                    {appFeatureId === f.slug && (
                      <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Subpage label (e.g. "New" for create campaign) */}
          {appFeatureSubpage === "new" && (
            <>
              <Sep />
              <span className="px-2 py-1 text-gray-600">Create Campaign</span>
            </>
          )}
        </>
      )}

      {/* BRAND */}
      {brandId && orgId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={explicitHierarchyHref(`/orgs/${orgId}/brands/${brandId}`)} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800 flex items-center gap-1.5">
              {currentBrand?.domain && <BrandLogo domain={currentBrand.domain} size={16} className="rounded-sm flex-shrink-0" fallbackClassName="w-4 h-4 text-gray-400 flex-shrink-0" />}
              {currentBrand?.name || currentBrand?.domain || "Brand"}
            </Link>
            <button onClick={() => toggleDropdown("brand")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "brand"} />
            </button>
            {openDropdown === "brand" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch brand</p>
                </div>
                {loading.brands ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">Loading...</div>
                ) : brands.length === 0 ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">No brands</div>
                ) : (
                  brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => handleBrandSwitch(b.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                        brandId === b.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <BrandLogo domain={b.domain} size={18} className="rounded-sm flex-shrink-0" fallbackClassName="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
                      <span className="truncate">{b.name || b.domain}</span>
                      {brandId === b.id && (
                        <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* CAMPAIGN */}
      {campaignId && orgId && brandId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/orgs/${orgId}/brands/${brandId}/campaigns/${campaignId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800">
              {currentCampaign?.name || "Campaign"}
            </Link>
            <button onClick={() => toggleDropdown("campaign")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "campaign"} />
            </button>
            {openDropdown === "campaign" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50 max-h-64 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch campaign</p>
                </div>
                {loading.campaigns ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">Loading...</div>
                ) : campaigns.length === 0 ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">No campaigns</div>
                ) : (
                  campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleCampaignSwitch(c.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                        campaignId === c.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {campaignId === c.id && (
                        <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* WORKFLOW */}
      {workflowId && orgId && brandId && (
        <>
          <Sep />
          <span className="px-2 py-1 font-medium text-gray-800">
            {workflowName || "Workflow"}
          </span>
        </>
      )}

      {/* Static subpage labels */}
      {brandId && orgId && section === "brand-info" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Brand Info</span>
        </>
      )}
      {brandId && orgId && section === "campaigns" && !pathParts[5] && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Campaigns</span>
        </>
      )}
      {brandId && orgId && section === "campaigns" && pathParts[5] === "new" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Create Campaign</span>
        </>
      )}
      {brandId && orgId && section === "workflows" && !pathParts[5] && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Workflows</span>
        </>
      )}
      {brandId && orgId && section === "tools" && pathParts[5] && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">
            {pathParts[5] === "outlets" ? "Outlets" : pathParts[5] === "press-kits" ? "Press Kits" : pathParts[5] === "journalists" ? "Journalists" : pathParts[5]}
          </span>
        </>
      )}
      {brandId && orgId && section === "campaigns" && pathParts[6] === "prompt" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Email Prompt</span>
        </>
      )}
    </nav>
  );
}
