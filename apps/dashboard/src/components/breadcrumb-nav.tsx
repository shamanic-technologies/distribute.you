"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useOrganization, useOrganizationList, useAuth } from "@clerk/nextjs";
import { useState, useRef, useEffect, useCallback } from "react";
import { WORKFLOW_DEFINITIONS, SECTION_LABELS } from "@mcpfactory/content";

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
const CACHE_TTL = 60000; // 1 minute

export function BreadcrumbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  // Dropdown states - only one open at a time
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Data states
  const [brands, setBrands] = useState<Brand[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Parse pathname
  const pathParts = pathname.split("/").filter(Boolean);
  const brandId = pathParts[0] === "brands" && pathParts[1] ? pathParts[1] : null;
  const sectionKey = brandId && pathParts[2] === "workflows" && pathParts[3] ? pathParts[3] : null;
  const campaignId = sectionKey && pathParts[4] === "campaigns" && pathParts[5] ? pathParts[5] : null;

  // Get current page type (to preserve when switching)
  const getPageSuffix = useCallback(() => {
    if (pathParts[2] === "brand-info") return "/brand-info";
    if (sectionKey && pathParts[4] === "prompt") return `/workflows/${sectionKey}/prompt`;
    if (sectionKey && campaignId) {
      const subpage = pathParts[6] || "";
      return `/workflows/${sectionKey}/campaigns/${campaignId}${subpage ? "/" + subpage : ""}`;
    }
    if (sectionKey) return `/workflows/${sectionKey}`;
    return "";
  }, [pathParts, sectionKey, campaignId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch brands when dropdown opens
  const fetchBrands = useCallback(async () => {
    if (brandListCache.data && Date.now() - brandListCache.timestamp < CACHE_TTL) {
      setBrands(brandListCache.data);
      return;
    }
    setLoading((l) => ({ ...l, brands: true }));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.distribute.you"}/v1/brands`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
  }, [getToken]);

  // Fetch campaigns for current brand when dropdown opens
  const fetchCampaigns = useCallback(async () => {
    if (!brandId) return;
    const cached = campaignListCache[brandId];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setCampaigns(cached.data);
      return;
    }
    setLoading((l) => ({ ...l, campaigns: true }));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "https://api.distribute.you"}/v1/campaigns?brandId=${brandId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
  }, [brandId, getToken]);

  // Eagerly fetch brand/campaign names for breadcrumb display
  useEffect(() => {
    if (brandId) fetchBrands();
  }, [brandId, fetchBrands]);

  useEffect(() => {
    if (campaignId) fetchCampaigns();
  }, [campaignId, fetchCampaigns]);

  // Handle dropdown toggle
  const toggleDropdown = (key: string) => {
    if (openDropdown === key) {
      setOpenDropdown(null);
    } else {
      setOpenDropdown(key);
      if (key === "brand") fetchBrands();
      if (key === "campaign") fetchCampaigns();
    }
  };

  // Switch handlers
  const handleOrgSwitch = (orgId: string) => {
    if (setActive) setActive({ organization: orgId });
    setOpenDropdown(null);
  };

  const handleBrandSwitch = (newBrandId: string) => {
    setOpenDropdown(null);
    const suffix = getPageSuffix();
    if (suffix.includes("/campaigns/")) {
      router.push(`/brands/${newBrandId}/workflows/${sectionKey}`);
    } else if (suffix) {
      router.push(`/brands/${newBrandId}${suffix}`);
    } else {
      router.push(`/brands/${newBrandId}`);
    }
  };

  const handleWorkflowSwitch = (newSectionKey: string) => {
    setOpenDropdown(null);
    router.push(`/brands/${brandId}/workflows/${newSectionKey}`);
  };

  const handleCampaignSwitch = (newCampaignId: string) => {
    setOpenDropdown(null);
    const subpage = pathParts[6] || "";
    router.push(`/brands/${brandId}/workflows/${sectionKey}/campaigns/${newCampaignId}${subpage ? "/" + subpage : ""}`);
  };

  // Get current names
  const currentBrand = brands.find((b) => b.id === brandId);
  const currentCampaign = campaigns.find((c) => c.id === campaignId);
  const currentWorkflowLabel = sectionKey ? (SECTION_LABELS[sectionKey] ?? sectionKey) : null;

  // Chevron icon
  const Chevron = ({ open }: { open: boolean }) => (
    <svg className={`w-3 h-3 text-gray-400 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  // Separator
  const Sep = () => (
    <svg className="w-4 h-4 text-gray-300 mx-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <nav className="flex items-center text-sm min-w-0" ref={dropdownRef}>
      {/* ORG */}
      <div className="relative flex items-center">
        <Link href="/" className="px-2 py-1 rounded-md hover:bg-gray-100 transition flex items-center gap-1.5">
          <div className="w-5 h-5 bg-primary-100 rounded flex items-center justify-center">
            <span className="text-primary-600 font-semibold text-xs">{organization?.name?.[0] || "O"}</span>
          </div>
          <span className="font-medium text-gray-800 max-w-[120px] truncate">{organization?.name || "Org"}</span>
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
                  organization?.id === m.organization.id ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="w-6 h-6 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-600 font-semibold text-xs">{m.organization.name[0]}</span>
                </div>
                <span className="truncate">{m.organization.name}</span>
                {organization?.id === m.organization.id && (
                  <svg className="w-4 h-4 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BRAND */}
      {brandId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/brands/${brandId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800">
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
                        brandId === b.id ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{b.name || b.domain}</span>
                      {brandId === b.id && (
                        <svg className="w-4 h-4 text-primary-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
      {sectionKey && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/brands/${brandId}/workflows/${sectionKey}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800">
              {currentWorkflowLabel}
            </Link>
            <button onClick={() => toggleDropdown("workflow")} className="p-1 hover:bg-gray-100 rounded transition">
              <Chevron open={openDropdown === "workflow"} />
            </button>
            {openDropdown === "workflow" && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Switch workflow</p>
                </div>
                {WORKFLOW_DEFINITIONS.map((wf) => (
                  <button
                    key={wf.sectionKey}
                    onClick={() => handleWorkflowSwitch(wf.sectionKey)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition ${
                      sectionKey === wf.sectionKey ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="truncate">{wf.label}</span>
                    {sectionKey === wf.sectionKey && (
                      <svg className="w-4 h-4 text-primary-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* CAMPAIGN */}
      {campaignId && (
        <>
          <Sep />
          <div className="relative flex items-center">
            <Link href={`/brands/${brandId}/workflows/${sectionKey}/campaigns/${campaignId}`} className="px-2 py-1 rounded-md hover:bg-gray-100 transition font-medium text-gray-800">
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
                        campaignId === c.id ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {campaignId === c.id && (
                        <svg className="w-4 h-4 text-primary-600 ml-auto flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Subpages (brand-info, prompt) - no dropdown, just label */}
      {pathParts[2] === "brand-info" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Brand Info</span>
        </>
      )}
      {sectionKey && pathParts[4] === "prompt" && (
        <>
          <Sep />
          <span className="px-2 py-1 text-gray-600">Email Prompt</span>
        </>
      )}
    </nav>
  );
}
