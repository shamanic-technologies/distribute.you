"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOutlets, type DiscoveredOutlet } from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

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

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function OutletRow({ outlet, onClick }: { outlet: DiscoveredOutlet; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 p-4 rounded-lg border border-gray-100 hover:border-brand-300 hover:shadow-sm transition bg-white cursor-pointer"
    >
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
        <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-800 truncate">{outlet.outletName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${outletStatusStyle(outlet.status)}`}>
            {outlet.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ${relevanceColor(outlet.relevanceScore)}`}>
        {outlet.relevanceScore}%
      </span>
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function OutletDetailPanel({ outlet, onClose }: { outlet: DiscoveredOutlet; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto border-l border-gray-200 animate-slide-in-right">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 truncate">{outlet.outletName}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* URL & Domain */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Website</h3>
            <a
              href={outlet.outletUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-600 hover:text-brand-700 hover:underline break-all"
            >
              {outlet.outletUrl}
            </a>
            <p className="text-sm text-gray-500">{outlet.outletDomain}</p>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</h3>
            <span className={`inline-block text-xs px-2 py-1 rounded-full border ${outletStatusStyle(outlet.status)}`}>
              {outlet.status}
            </span>
          </div>

          {/* Relevance Score */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relevance Score</h3>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium px-2.5 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
                {outlet.relevanceScore}%
              </span>
            </div>
          </div>

          {/* Why Relevant */}
          {outlet.whyRelevant && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Why Relevant</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.whyRelevant}</p>
            </div>
          )}

          {/* Why Not Relevant */}
          {outlet.whyNotRelevant && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Why Not Relevant</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.whyNotRelevant}</p>
            </div>
          )}

          {/* Overall Relevance */}
          {outlet.overalRelevance && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overall Relevance</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.overalRelevance}</p>
            </div>
          )}

          {/* Relevance Rationale */}
          {outlet.relevanceRationale && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relevance Rationale</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.relevanceRationale}</p>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Discovered: {new Date(outlet.createdAt).toLocaleDateString()} ({timeAgo(outlet.createdAt)})</p>
              <p>Updated: {new Date(outlet.updatedAt).toLocaleDateString()} ({timeAgo(outlet.updatedAt)})</p>
            </div>
          </div>

          {/* ID (debug) */}
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">ID</h3>
            <p className="text-xs text-gray-400 font-mono break-all">{outlet.id}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function OutletsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selectedOutlet, setSelectedOutlet] = useState<DiscoveredOutlet | null>(null);

  const { data, isLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    pollOptions,
  );
  const outlets = data?.outlets ?? [];
  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

  return (
    <div className="p-4 md:p-8 max-w-4xl">
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
              <OutletRow key={outlet.id} outlet={outlet} onClick={() => setSelectedOutlet(outlet)} />
            ))}
          </div>
        </>
      )}

      {/* Detail Panel */}
      {selectedOutlet && (
        <OutletDetailPanel outlet={selectedOutlet} onClose={() => setSelectedOutlet(null)} />
      )}
    </div>
  );
}
