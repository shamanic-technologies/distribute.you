"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useState, useRef, useEffect, useCallback } from "react";
import { useFeatures } from "@/lib/features-context";
import { workflowDisplayName } from "@/lib/workflow-display-name";
import { BrandLogo } from "./brand-logo";

interface Brand {
  id: string;
  name: string;
  domain: string;
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

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { features, getFeature } = useFeatures();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [workflowName, setWorkflowName] = useState<string | null>(null);

  // Parse path structure: /orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]
  // Also handles app-level: /features/[featureId] and /features/[featureId]/new
  const pathParts = pathname.split("/").filter(Boolean);
  const orgId = pathParts[0] === "orgs" && pathParts[1] ? pathParts[1] : null;
  const brandId = orgId && pathParts[2] === "brands" && pathParts[3] ? pathParts[3] : null;
  const featureSlug = brandId && pathParts[4] === "features" && pathParts[5] ? pathParts[5] : null;
  const campaignId = featureSlug && pathParts[6] === "campaigns" && pathParts[7] ? pathParts[7] : null;
  const workflowId = featureSlug && pathParts[6] === "workflows" && pathParts[7] ? pathParts[7] : null;
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

  const handleOrgSwitch = (clerkOrgId: string) => {
    if (setActive) {
      clearBreadcrumbCaches();
      setActive({ organization: clerkOrgId });
      // OrgCacheInvalidator handles React Query clearing and navigation
    }
    setOpenDropdown(null);
  };

  const handleBrandSwitch = (newBrandId: string) => {
    setOpenDropdown(null);
    if (orgId) {
      router.push(`/orgs/${orgId}/brands/${newBrandId}`);
    }
  };

  const handleFeatureSwitch = (newSectionKey: string) => {
    setOpenDropdown(null);
    if (orgId && brandId) {
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${newSectionKey}`);
    }
  };

  const handleCampaignSwitch = (newCampaignId: string) => {
    setOpenDropdown(null);
    if (orgId && brandId && featureSlug) {
      const subpage = pathParts[8] || "";
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${newCampaignId}${subpage ? "/" + subpage : ""}`);
    }
  };

  const currentBrand = brands.find((b) => b.id === brandId);
  const currentCampaign = campaigns.find((c) => c.id === campaignId);
  const currentFeatureDef = featureSlug ? getFeature(featureSlug) : null;
  const currentFeatureLabel = currentFeatureDef ? (currentFeatureDef.dynastyName ?? currentFeatureDef.name) : featureSlug;
  const appFeatureDef = appFeatureId ? getFeature(appFeatureId) : null;
  const appFeatureLabel = appFeatureDef ? (appFeatureDef.dynastyName ?? appFeatureDef.name) : appFeatureId;

  const handleAppFeatureSwitch = (newFeatureId: string) => {
    setOpenDropdown(null);
    router.push(`/features/${newFeatureId}`);
  };

  const FeatureIcon = ({ featureSlug: sk }: { featureSlug: string }) => {
    if (sk.startsWith("sales") || sk.startsWith("welcome")) {
      return (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-gray-500 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
    if (sk.startsWith("journalists")) {
      return (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-gray-500 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      );
    }
    if (sk.startsWith("webinar")) {
      return (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-gray-500 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4 text-gray-500 flex-shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
      </svg>
    );
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
        <Link href={organization ? `/orgs/${organization.id}` : "/"} className="px-2 py-1 rounded-md hover:bg-gray-100 transition flex items-center gap-1.5">
          <div className="w-5 h-5 bg-brand-100 rounded flex items-center justify-center">
            <span className="text-brand-600 font-semibold text-xs">{organization?.name?.[0] || "O"}</span>
          </div>
          <span className="font-medium text-gray-800 max-w-[140px] truncate">{organization?.name || "Dashboard"}</span>
        </Link>
        <button onClick={() => toggleDropdown("org")} className="p-1 hover:bg-gray-100 rounded transition">
          <Chevron open={openDropdown === "org"} />
        </button>
        {openDropdown === "org" && (
          <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 font-medium">Switch organization</p>
            </div>
            {userMemberships?.data?.map((m) => (
              <button
                key={m.organization.id}
                onClick={() => handleOrgSwitch(m.organization.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                  organization?.id === m.organization.id ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="w-6 h-6 bg-brand-100 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-600 font-semibold text-xs">{m.organization.name[0]}</span>
                </div>
                <span className="truncate">{m.organization.name}</span>
                {organization?.id === m.organization.id && (
                  <svg className="w-4 h-4 text-brand-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => { setOpenDropdown(null); router.push("/onboarding"); }}
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
                {features.filter((f): f is typeof f & { dynastySlug: string } => !!f.dynastySlug).map((f) => {
                  const dSlug = f.dynastySlug;
                  return (
                  <button
                    key={dSlug}
                    onClick={() => handleAppFeatureSwitch(dSlug)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      appFeatureId === dSlug ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{f.dynastyName ?? f.name}</span>
                    {appFeatureId === dSlug && (
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
            <Link href={`/orgs/${orgId}/brands/${brandId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800 flex items-center gap-1.5">
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

      {/* FEATURE */}
      {featureSlug && orgId && brandId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800 flex items-center gap-1.5">
              <FeatureIcon featureSlug={featureSlug} />
              {currentFeatureLabel}
            </Link>
            <button onClick={() => toggleDropdown("feature")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "feature"} />
            </button>
            {openDropdown === "feature" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch feature</p>
                </div>
                {features.filter((f): f is typeof f & { dynastySlug: string } => !!f.dynastySlug).map((f) => {
                  const dSlug = f.dynastySlug;
                  return (
                  <button
                    key={dSlug}
                    onClick={() => handleFeatureSwitch(dSlug)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      featureSlug === dSlug ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <FeatureIcon featureSlug={dSlug} />
                    <span className="truncate">{f.dynastyName ?? f.name}</span>
                    {featureSlug === dSlug && (
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
        </>
      )}

      {/* CAMPAIGN */}
      {campaignId && orgId && brandId && featureSlug && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaignId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800">
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
      {workflowId && orgId && brandId && featureSlug && (
        <>
          <Sep />
          <span className="px-2 py-1 font-medium text-gray-800">
            {workflowName || "Workflow"}
          </span>
        </>
      )}

      {/* Static subpage labels */}
      {brandId && orgId && pathParts[4] === "brand-info" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Brand Info</span>
        </>
      )}
      {brandId && orgId && !featureSlug && pathParts[4] === "campaigns" && !pathParts[5] && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Campaigns</span>
        </>
      )}
      {brandId && orgId && !featureSlug && pathParts[4] === "campaigns" && pathParts[5] === "new" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Create Campaign</span>
        </>
      )}
      {brandId && orgId && !featureSlug && pathParts[4] === "workflows" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Workflows</span>
        </>
      )}
      {brandId && orgId && pathParts[4] === "tools" && pathParts[5] && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">
            {pathParts[5] === "outlets" ? "Outlets" : pathParts[5] === "press-kits" ? "Press Kits" : pathParts[5] === "journalists" ? "Journalists" : pathParts[5]}
          </span>
        </>
      )}
      {featureSlug && pathParts[8] === "prompt" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Email Prompt</span>
        </>
      )}
    </nav>
  );
}
