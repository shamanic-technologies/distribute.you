"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands, upsertBrand, extractBrandFields, SALES_PROFILE_FIELDS } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

export default function BrandsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showCreate, setShowCreate] = useState(false);
  const [brandUrl, setBrandUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const autoCreateTriggered = useRef(false);

  const { data, isLoading, refetch } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brands = data?.brands ?? [];

  const createBrandAndRedirect = async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return;
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setIsCreating(true);
    setCreateError(null);
    const source = searchParams.get("autoCreate") === rawUrl ? "onboarding" : "manual";
    posthog.capture("brand_create_started", { source });
    try {
      const { brandId: newBrandId } = await upsertBrand(url);
      extractBrandFields([newBrandId], SALES_PROFILE_FIELDS).catch(() => {});
      await refetch();
      posthog.capture("brand_create_completed", {
        brand_id: newBrandId,
        source,
      });
      router.replace(`/orgs/${orgId}/brands/${newBrandId}`);
    } catch (err) {
      posthog.capture("brand_create_failed", { source });
      setCreateError(err instanceof Error ? err.message : "Failed to create brand");
      setShowCreate(true);
      setBrandUrl(rawUrl);
    } finally {
      setIsCreating(false);
    }
  };

  // Auto-create brand from onboarding flow
  const autoCreateUrl = searchParams.get("autoCreate");
  useEffect(() => {
    if (autoCreateUrl && !autoCreateTriggered.current) {
      autoCreateTriggered.current = true;
      createBrandAndRedirect(autoCreateUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreateUrl]);

  const handleCreateBrand = () => createBrandAndRedirect(brandUrl);

  // Show a creating state when auto-creating from onboarding
  if (autoCreateUrl && isCreating) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Setting up your brand...</p>
        <p className="text-sm text-gray-400 mt-1">This may take a few seconds</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Brands</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Brand
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">New Brand</h3>
            <button onClick={() => { setShowCreate(false); setBrandUrl(""); setCreateError(null); }} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          <p className="text-sm text-gray-500 mb-3">Enter a website URL to create a brand. We'll automatically extract the brand profile.</p>
          <div className="flex items-center gap-3">
            <input
              type="url"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateBrand(); }}
              disabled={isCreating}
            />
            <button
              onClick={handleCreateBrand}
              disabled={isCreating || !brandUrl.trim()}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
          {createError && <p className="mt-2 text-sm text-red-600">{createError}</p>}
        </div>
      )}

      {brands.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">No brands yet</p>
          <p className="text-sm text-gray-400">Brands are created automatically when you start a campaign via the API or MCP client.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/orgs/${orgId}/brands/${brand.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                  <BrandLogo domain={brand.domain} size={28} fallbackClassName="h-6 w-6 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 group-hover:text-brand-600 transition truncate">
                    {brand.name || brand.domain}
                  </h3>
                  <p className="text-xs text-gray-400 truncate">{brand.domain}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{brand.createdAt ? `Created ${new Date(brand.createdAt).toLocaleDateString()}` : ""}</span>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-brand-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
