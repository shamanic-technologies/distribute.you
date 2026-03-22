"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignJournalists, type DiscoveredJournalist } from "@/lib/api";

const POLL_INTERVAL = 10_000;

interface DiscoveredJournalistsProps {
  campaignId: string;
}

export function DiscoveredJournalists({ campaignId }: DiscoveredJournalistsProps) {
  const { data, isLoading } = useAuthQuery(
    ["campaignJournalists", campaignId],
    () => listCampaignJournalists(campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const journalists = data?.journalists ?? [];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (journalists.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <p className="text-gray-500 text-sm">No journalists discovered yet. The campaign workflow will find relevant journalists automatically.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-gray-800">
          Discovered Journalists
        </h3>
        <span className="text-xs text-gray-400">{journalists.length} found</span>
      </div>
      <div className="space-y-2">
        {journalists.map((j) => (
          <JournalistRow key={j.id} journalist={j} />
        ))}
      </div>
    </div>
  );
}

function JournalistRow({ journalist }: { journalist: DiscoveredJournalist }) {
  const typeStyle = journalist.entityType === "individual"
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-purple-100 text-purple-700 border-purple-200";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 flex-shrink-0">
        {journalist.entityType === "individual" ? (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 truncate">
            {journalist.journalistName}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${typeStyle}`}>
            {journalist.entityType}
          </span>
        </div>
        {journalist.outletName && (
          <p className="text-xs text-gray-400 truncate">{journalist.outletName}{journalist.outletDomain ? ` (${journalist.outletDomain})` : ""}</p>
        )}
      </div>
    </div>
  );
}
