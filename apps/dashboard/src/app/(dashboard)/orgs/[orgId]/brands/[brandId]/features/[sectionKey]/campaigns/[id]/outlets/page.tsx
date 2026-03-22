"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignOutlets, type DiscoveredOutlet } from "@/lib/api";

const POLL_INTERVAL = 10_000;

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function statusBadge(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-700 border-blue-200";
    case "ended": return "bg-gray-100 text-gray-500 border-gray-200";
    case "denied": return "bg-red-100 text-red-600 border-red-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

export default function CampaignOutletsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [selected, setSelected] = useState<DiscoveredOutlet | null>(null);

  const { data, isLoading } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const outlets = data?.outlets ?? [];
  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      {/* Outlet List */}
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Outlets
            <span className="ml-2 text-sm font-normal text-gray-500">({outlets.length})</span>
          </h1>
        </div>

        {outlets.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No outlets yet</h3>
            <p className="text-gray-600 text-sm">Outlets will appear here once the discovery campaign runs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((outlet) => (
              <button
                key={outlet.id}
                onClick={() => setSelected(outlet)}
                className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                  selected?.id === outlet.id ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{outlet.outletName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadge(outlet.status)}`}>
                      {outlet.status}
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full border flex-shrink-0 ml-2 ${relevanceColor(outlet.relevanceScore)}`}>
                    {outlet.relevanceScore}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Outlet Detail Panel */}
      {selected && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Outlet Details</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-800">{selected.outletName}</h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(selected.relevanceScore)}`}>
                  {selected.relevanceScore}% relevance
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Domain:</span>
                  <p className="font-medium">{selected.outletDomain}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p>
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(selected.status)}`}>
                      {selected.status}
                    </span>
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">URL:</span>
                  <p>
                    <a href={selected.outletUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-sm break-all">
                      {selected.outletUrl}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {selected.whyRelevant && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Relevant</h4>
                <p className="text-sm text-gray-700">{selected.whyRelevant}</p>
              </div>
            )}

            {selected.whyNotRelevant && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Not Relevant</h4>
                <p className="text-sm text-gray-700">{selected.whyNotRelevant}</p>
              </div>
            )}

            {(selected.overalRelevance || selected.relevanceRationale) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Relevance Assessment</h4>
                {selected.overalRelevance && (
                  <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Overall:</span> {selected.overalRelevance}</p>
                )}
                {selected.relevanceRationale && (
                  <p className="text-sm text-gray-700">{selected.relevanceRationale}</p>
                )}
              </div>
            )}

            <div className="text-xs text-gray-400">
              Discovered: {new Date(selected.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
