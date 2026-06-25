"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands } from "@/lib/api";
import { hasExplicitHierarchyIntent, resolveLandingBrand } from "@/lib/last-brand";
import { BrandLogo } from "@/components/brand-logo";
import { DashboardPage } from "@/components/dashboard-page";
import { pollOptions } from "@/lib/query-options";

export default function OrgOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitHierarchy = hasExplicitHierarchyIntent(searchParams);

  const { data: brandsData } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brands = brandsData?.brands ?? [];

  // The org URL should drop the user straight into a brand. The common
  // returning-user path is handled at the edge (proxy.ts redirects on the
  // last-brand cookie before this page paints). This client redirect only runs
  // when there's no cookie yet (first session / cleared cookie): single brand →
  // that brand, multiple brands → the first one (decision B). No "last" exists
  // in that window, so there's no prior content to flash. The Overview below
  // renders only for an empty org (which the onboarding gate normally prevents).
  const landingBrandId = !explicitHierarchy && brandsData
    ? resolveLandingBrand(brandsData.brands, null)
    : null;

  useEffect(() => {
    if (landingBrandId) {
      router.replace(`/orgs/${orgId}/brands/${landingBrandId}`);
    }
  }, [landingBrandId, orgId, router]);

  // Render nothing while brands load, or while the redirect to a resolved brand
  // is in flight — no Overview flash. Overview shows only once brands have
  // loaded AND there's genuinely no brand to land on.
  if (!brandsData || landingBrandId) {
    return null;
  }

  return (
    <DashboardPage width="wide">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>

      {/* Brands Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Brands</h2>
          {brands.length > 0 && (
            <button
              onClick={() => router.push("/onboarding?from=add")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add brand
            </button>
          )}
        </div>
        {brands.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">No brands yet. Set up your first brand to get started.</p>
            <button
              onClick={() => router.push("/onboarding?from=add")}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Set up your first brand
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto">
            {brands.slice(0, 4).map((brand) => (
              <Link
                key={brand.id}
                href={`/orgs/${orgId}/brands/${brand.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-brand-300 transition min-w-0 shrink-0"
              >
                <BrandLogo domain={brand.domain} size={24} fallbackClassName="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 truncate">{brand.name || brand.domain}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardPage>
  );
}
