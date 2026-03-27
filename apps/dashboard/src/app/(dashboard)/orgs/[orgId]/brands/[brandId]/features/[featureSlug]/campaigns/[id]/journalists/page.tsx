"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignJournalists, type DiscoveredJournalist } from "@/lib/api";

const POLL_INTERVAL = 5_000;
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

export default function CampaignJournalistsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [selected, setSelected] = useState<DiscoveredJournalist | null>(null);

  const { data, isLoading } = useAuthQuery(
    ["campaignJournalists", campaignId],
    () => listCampaignJournalists(campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const journalists = data?.journalists ?? [];

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
      {/* Journalist List */}
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Journalists
            <span className="ml-2 text-sm font-normal text-gray-500">({journalists.length})</span>
          </h1>
        </div>

        {journalists.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No journalists yet</h3>
            <p className="text-gray-600 text-sm">Journalists will appear here once the discovery campaign runs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {journalists.map((j) => (
              <button
                key={j.id}
                onClick={() => setSelected(j)}
                className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                  selected?.id === j.id ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {j.outletDomain ? (
                    <img
                      src={`https://img.logo.dev/${j.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                      alt={j.outletName ?? j.outletDomain}
                      className="w-8 h-8 rounded-full object-contain bg-gray-50 border border-gray-200 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">
                        {(j.outletName ?? j.journalistName).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{j.journalistName}</p>
                    {j.outletName && (
                      <p className="text-xs text-gray-400 truncate">{j.outletName}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Journalist Detail Panel */}
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
            <h2 className="font-semibold text-gray-800 hidden md:block">Journalist Details</h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <p className="font-medium">{selected.journalistName}</p>
                </div>
                {selected.firstName && (
                  <div>
                    <span className="text-gray-500">First Name:</span>
                    <p className="font-medium">{selected.firstName}</p>
                  </div>
                )}
                {selected.lastName && (
                  <div>
                    <span className="text-gray-500">Last Name:</span>
                    <p className="font-medium">{selected.lastName}</p>
                  </div>
                )}
              </div>
            </div>

            {selected.outletName && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Outlet</h4>
                <div className="flex items-center gap-3">
                  {selected.outletDomain && (
                    <img
                      src={`https://img.logo.dev/${selected.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                      alt={selected.outletName}
                      className="w-6 h-6 rounded object-contain bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{selected.outletName}</p>
                    {selected.outletDomain && (
                      <p className="text-xs text-gray-400">{selected.outletDomain}</p>
                    )}
                  </div>
                </div>
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
