"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { workflowDisplayName } from "@/lib/workflow-display-name";
import { BrandLogo } from "./brand-logo";
import { OrgAvatar } from "./org-avatar";
import { explicitHierarchyHref } from "@/lib/last-brand";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";

// Org/brand identity and the switch handlers live in `@/lib/use-tenant-switcher`
// — the SINGLE source shared with the sidebar-top `TenantSwitcher`, so the two
// tenant surfaces can never drift.

export function BreadcrumbNav() {
  const {
    pathParts,
    orgId,
    brandId,
    section,
    isStaff,
    memberships,
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
  } = useTenantSwitcher();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);

  const workflowId =
    brandId && section === "workflows" && pathParts[5] && pathParts[5] !== "new"
      ? pathParts[5]
      : null;
  // Campaign LEVEL (v2 staff preview): `.../campaigns/[campaignId]` → resolve the
  // campaign name by-id for the crumb (mirrors the workflow crumb fetch).
  const campaignId =
    brandId && section === "campaigns" && pathParts[5] ? pathParts[5] : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch the all-orgs list when a staff member opens the org dropdown; debounce
  // on search. Never fires for non-staff (the route would 403 anyway).
  useEffect(() => {
    if (!isStaff || openDropdown !== "org") return;
    const t = setTimeout(() => fetchOrgs(orgSearch), 250);
    return () => clearTimeout(t);
  }, [isStaff, openDropdown, orgSearch, fetchOrgs]);

  useEffect(() => {
    if (!workflowId) { setWorkflowName(null); return; }
    fetch(`/api/v1/workflows/${workflowId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setWorkflowName(data ? workflowDisplayName(data) : null))
      .catch(() => setWorkflowName(null));
  }, [workflowId]);

  useEffect(() => {
    if (!campaignId) { setCampaignName(null); return; }
    let cancelled = false;
    fetch(`/api/v1/campaigns/${campaignId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setCampaignName(data?.campaign?.name ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [campaignId]);

  const toggleDropdown = (key: string) => {
    if (openDropdown === key) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(key);
      if (key === "brand") fetchBrands();
    }
  };

  const switchOrg = (clerkOrgId: string) => {
    setOpenDropdown(null);
    handleOrgSwitch(clerkOrgId);
  };

  const switchBrand = (newBrandId: string) => {
    setOpenDropdown(null);
    handleBrandSwitch(newBrandId);
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
    <>
    <nav
      className={`flex items-center text-sm min-w-0 ${
        // Mobile: the breadcrumb row can exceed the viewport — scroll it
        // horizontally so org/brand + their switchers stay reachable.
        // When a dropdown is open switch to overflow-visible, else the
        // absolutely-positioned panel gets clipped by the scroll container.
        openDropdown ? "overflow-visible" : "overflow-x-auto"
      }`}
      ref={dropdownRef}
    >
      {/* ORG — always shown as root */}
      <div className="relative flex items-center">
        <Link href={orgId ? explicitHierarchyHref(`/orgs/${orgId}`) : explicitHierarchyHref("/")} className="px-2 py-1 rounded-md hover:bg-gray-100 transition flex items-center gap-1.5">
          <OrgAvatar name={displayOrgName} imageUrl={displayOrgImageUrl} hasImage={displayOrgHasImage} sizeClass="w-5 h-5" />
          <span className="font-medium text-gray-800 max-w-[140px] truncate">{displayOrgName}</span>
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
                    onClick={() => switchOrg(o.id)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      orgId === o.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <OrgAvatar name={o.name} imageUrl={o.imageUrl} hasImage={o.hasImage} sizeClass="w-6 h-6" />
                    <span className="truncate">{o.name}</span>
                    {orgId === o.id && (
                      <svg className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              memberships.map((m) => (
                <button
                  key={m.organization.id}
                  onClick={() => switchOrg(m.organization.id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                    orgId === m.organization.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <OrgAvatar name={m.organization.name} imageUrl={m.organization.imageUrl} hasImage={m.organization.hasImage} sizeClass="w-6 h-6" />
                  <span className="truncate">{m.organization.name}</span>
                  {orgId === m.organization.id && (
                    <svg className="w-4 h-4 text-brand-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { setOpenDropdown(null); router.push("/onboarding?new=1&from=add"); }}
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

      {/* BRAND */}
      {brandId && orgId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={explicitHierarchyHref(`/orgs/${orgId}/brands/${brandId}`)} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800 flex items-center gap-1.5">
              {displayBrand?.domain && <BrandLogo domain={displayBrand.domain} size={16} className="rounded-sm flex-shrink-0" fallbackClassName="w-4 h-4 text-gray-400 flex-shrink-0" />}
              {displayBrand?.name || displayBrand?.domain || "Brand"}
            </Link>
            <button onClick={() => toggleDropdown("brand")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "brand"} />
            </button>
            {openDropdown === "brand" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch brand</p>
                </div>
                {brandsLoading ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">Loading...</div>
                ) : brands.length === 0 ? (
                  <div className="px-3 py-4 text-center text-gray-400 text-sm">No brands</div>
                ) : (
                  brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => switchBrand(b.id)}
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
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={() => { setOpenDropdown(null); router.push("/onboarding?from=add"); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition"
                  >
                    <div className="w-[18px] h-[18px] border-2 border-dashed border-gray-300 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs font-bold leading-none">+</span>
                    </div>
                    <span>New brand</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* CAMPAIGN (v2 staff preview): Campaigns list crumb + campaign name */}
      {brandId && orgId && section === "campaigns" && (
        <>
          <Sep />
          {campaignId ? (
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/campaigns`}
              className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition"
            >
              Campaigns
            </Link>
          ) : (
            <span className="px-2 py-1 text-gray-600">Campaigns</span>
          )}
          {campaignId && (
            <>
              <Sep />
              <span className="px-2 py-1 font-medium text-gray-800">
                {campaignName || "Campaign"}
              </span>
            </>
          )}
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
    </nav>
    </>
  );
}
