"use client";

import Link from "next/link";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

export function BrandsList() {
  const { data, isLoading } = useAuthQuery(["brands"], () =>
    listBrands()
  );
  const brands = data?.brands ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32 mb-3"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg text-gray-800">Your Brands</h2>
        <Link href="/brands" className="text-sm text-brand-500 hover:text-brand-600">
          View all →
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <GlobeAltIcon className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">
            No brands yet. Brands are created automatically when you start a campaign via MCP.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {brands.slice(0, 6).map((brand) => (
            <Link
              key={brand.id}
              href={`/brands/${brand.id}`}
              className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                  <BrandLogo domain={brand.domain} size={28} fallbackClassName="h-5 w-5 text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {brand.name || brand.domain}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{brand.domain}</p>
                </div>
              </div>
              <span className="text-brand-500 hover:text-brand-600 font-medium text-sm">
                View campaigns →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
