"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignOutlets, type CampaignOutlet } from "@/lib/api";

const POLL_INTERVAL = 5_000;

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function statusStyle(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-700 border-blue-200";
    case "ended": return "bg-gray-100 text-gray-500 border-gray-200";
    case "denied": return "bg-red-100 text-red-600 border-red-200";
    case "served": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

interface DiscoveredOutletsProps {
  campaignId: string;
}

export function DiscoveredOutlets({ campaignId }: DiscoveredOutletsProps) {
  const { data, isLoading } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  const outlets = (data?.outlets ?? []).filter((o) => (o.outletStatus ?? "open") !== "skipped");

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 min-h-[120px]">
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (outlets.length === 0) {
    return null;
  }

  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 min-h-[120px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-gray-800">
          Discovered Outlets
        </h3>
        <span className="text-xs text-gray-400">{outlets.length} found</span>
      </div>
      <div className="space-y-2">
        {sorted.map((outlet) => (
          <OutletRow key={outlet.id} outlet={outlet} />
        ))}
      </div>
    </div>
  );
}

function OutletRow({ outlet }: { outlet: CampaignOutlet }) {
  const status = outlet.outletStatus ?? "open";
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <a
            href={outlet.outletUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm text-gray-800 hover:text-brand-600 transition truncate"
          >
            {outlet.outletName}
          </a>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusStyle(status)}`}>
            {status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
        {outlet.whyRelevant && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{outlet.whyRelevant}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
          {outlet.relevanceScore}%
        </span>
      </div>
    </div>
  );
}
