"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { OrgUsageSection } from "@/components/org-usage";
import { pollOptions } from "@/lib/query-options";

export default function OrgOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const { data: brandsData } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brands = brandsData?.brands ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Overview</h1>

      {/* Brands Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Brands</h2>
          <div className="flex items-center gap-3">
            {brands.length > 4 && (
              <Link
                href={`/orgs/${orgId}/brands`}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                View all →
              </Link>
            )}
            <Link
              href={`/orgs/${orgId}/brands`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Brand
            </Link>
          </div>
        </div>
        {brands.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">No brands yet. Set up your first brand to get started.</p>
            <Link
              href={`/features/sales-email-cold-outreach/new`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Launch your first campaign
            </Link>
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

      {/* Usage */}
      <div>
        <OrgUsageSection brands={brands} />
      </div>
    </div>
  );
}
