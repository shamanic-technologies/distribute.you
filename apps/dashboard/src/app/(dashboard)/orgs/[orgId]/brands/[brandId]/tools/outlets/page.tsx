"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  listBrandOutlets,
  type DiscoveredOutlet,
} from "@/lib/api";

const POLL_INTERVAL = 10_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function outletStatusStyle(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-700 border-blue-200";
    case "ended": return "bg-gray-100 text-gray-500 border-gray-200";
    case "denied": return "bg-red-100 text-red-600 border-red-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function OutletRow({ outlet }: { outlet: DiscoveredOutlet }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition bg-white">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <a
            href={outlet.outletUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm text-gray-800 hover:text-brand-600 transition truncate"
          >
            {outlet.outletName}
          </a>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${outletStatusStyle(outlet.status)}`}>
            {outlet.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ${relevanceColor(outlet.relevanceScore)}`}>
        {outlet.relevanceScore}%
      </span>
    </div>
  );
}

export default function OutletsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  const brand = brandData?.brand ?? null;

  const { data, isLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    pollOptions,
  );
  const outlets = data?.outlets ?? [];
  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <Link href={`/orgs/${orgId}/brands/${brandId}`} className="hover:text-brand-600 transition truncate">
          {brand?.name ?? brand?.domain ?? "Brand"}
        </Link>
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900 font-medium">Outlets</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Outlets</h1>
          <p className="text-sm text-gray-500">Discovered media outlets for this brand</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : outlets.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No outlets yet</h3>
          <p className="text-gray-500 text-sm">
            Media outlets will be discovered when you run a journalist pitch campaign.
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-4">{outlets.length} outlet{outlets.length !== 1 ? "s" : ""}</div>
          <div className="space-y-2">
            {sorted.map((outlet) => (
              <OutletRow key={outlet.id} outlet={outlet} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
