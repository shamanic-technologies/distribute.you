"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listBrandJournalists,
  listCampaignOutlets,
  discoverJournalists,
  getJournalistStatsCosts,
  type BrandJournalist,
  type DiscoveredOutlet,
} from "@/lib/api";

const POLL_INTERVAL = 5_000;
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

type Tab = "contacted" | "not-contacted";

const CONTACTED_STATUSES = new Set<BrandJournalist["status"]>(["contacted"]);

function statusLabel(status: BrandJournalist["status"]): string {
  switch (status) {
    case "contacted": return "Contacted";
    case "served": return "Processing";
    case "buffered": return "In queue";
    case "claimed": return "Claimed";
    case "skipped": return "Skipped";
    default: return status;
  }
}

function statusStyle(status: BrandJournalist["status"]): string {
  switch (status) {
    case "contacted": return "bg-green-100 text-green-700 border-green-200";
    case "served": return "bg-orange-100 text-orange-700 border-orange-200";
    case "buffered": return "bg-blue-100 text-blue-600 border-blue-200";
    case "claimed": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "skipped": return "bg-gray-100 text-gray-500 border-gray-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
}

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

/* ─── Discover Journalists Button (per outlet) ───────────────────────── */

function DiscoverJournalistsButton({
  brandId,
  campaignId,
  outletId,
  onSuccess,
}: {
  brandId: string;
  campaignId: string;
  outletId: string;
  onSuccess: () => void;
}) {
  const mutation = useMutation({
    mutationFn: () => discoverJournalists(brandId, campaignId, outletId),
    onSuccess,
  });

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); mutation.mutate(); }}
        disabled={mutation.isPending}
        className="text-xs px-3 py-1.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
      >
        {mutation.isPending ? (
          <>
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Discovering...
          </>
        ) : (
          "Discover Journalists"
        )}
      </button>
      {mutation.isSuccess && mutation.data && (
        <span className="text-xs text-green-600">+{mutation.data.discovered}</span>
      )}
      {mutation.isError && (
        <span className="text-xs text-red-600">Failed</span>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function CampaignJournalistsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [selected, setSelected] = useState<BrandJournalist | null>(null);

  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["brandJournalists", brandId, campaignId],
    () => listBrandJournalists(brandId, campaignId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const { data: outletsData } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
  );

  const { data: costsData } = useAuthQuery(
    ["journalistCosts", brandId, campaignId],
    () => getJournalistStatsCosts(brandId, "journalistId", campaignId),
  );

  const campaignJournalists = journalistsData?.campaignJournalists ?? [];
  const isFirstLoad = journalistsLoading && campaignJournalists.length === 0;

  // Outlet lookup
  const outletMap = useMemo(() => {
    const map = new Map<string, DiscoveredOutlet>();
    for (const o of outletsData?.outlets ?? []) {
      map.set(o.id, o);
    }
    return map;
  }, [outletsData]);

  // Cost lookup by journalistId
  const costMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of costsData?.groups ?? []) {
      const jId = g.dimensions.journalistId;
      if (jId) {
        map.set(jId, typeof g.totalCostInUsdCents === "string" ? parseFloat(g.totalCostInUsdCents) : g.totalCostInUsdCents);
      }
    }
    return map;
  }, [costsData]);

  // Split into contacted / not-contacted
  const contacted = useMemo(
    () => campaignJournalists.filter((j) => CONTACTED_STATUSES.has(j.status)),
    [campaignJournalists],
  );
  const notContacted = useMemo(
    () => campaignJournalists.filter((j) => !CONTACTED_STATUSES.has(j.status)),
    [campaignJournalists],
  );

  // Outlets that have no journalists yet (for the discover action)
  const outletsWithoutJournalists = useMemo(() => {
    const outletsWithJournalists = new Set(campaignJournalists.map((j) => j.outletId));
    return (outletsData?.outlets ?? [])
      .filter((o) => o.status !== "skipped" && !outletsWithJournalists.has(o.id));
  }, [outletsData, campaignJournalists]);

  const activeList = activeTab === "contacted" ? contacted : notContacted;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["brandJournalists", brandId, campaignId] });
    queryClient.invalidateQueries({ queryKey: ["journalistCosts", brandId, campaignId] });
  };

  if (isFirstLoad) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-10 w-64 bg-gray-100 rounded" />
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
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Journalists
            <span className="ml-2 text-sm font-normal text-gray-500">({campaignJournalists.length})</span>
          </h1>
        </div>

        {/* Discover journalists for outlets without any */}
        {outletsWithoutJournalists.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Discover journalists for outlets</h3>
            <div className="space-y-2">
              {outletsWithoutJournalists.map((outlet) => (
                <div key={outlet.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {outlet.outletDomain && (
                      <img
                        src={`https://img.logo.dev/${outlet.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                        alt={outlet.outletName}
                        className="w-5 h-5 rounded object-contain bg-gray-50 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <span className="text-sm text-gray-700 truncate">{outlet.outletName}</span>
                  </div>
                  <DiscoverJournalistsButton
                    brandId={brandId}
                    campaignId={campaignId}
                    outletId={outlet.id}
                    onSuccess={invalidate}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => { setActiveTab("contacted"); setSelected(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "contacted"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Contacted
            <span className="ml-1.5 text-xs font-normal text-gray-400">({contacted.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab("not-contacted"); setSelected(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "not-contacted"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Not Contacted
            <span className="ml-1.5 text-xs font-normal text-gray-400">({notContacted.length})</span>
          </button>
        </div>

        {activeList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
              {activeTab === "contacted" ? "No contacted journalists yet" : "No journalists in queue"}
            </h3>
            <p className="text-gray-600 text-sm">
              {activeTab === "contacted"
                ? "Journalists will appear here once outreach has been sent."
                : "All discovered journalists have been contacted or will appear here when discovered."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeList.map((j) => {
              const outlet = outletMap.get(j.outletId);
              const cost = costMap.get(j.journalistId);
              return (
                <button
                  key={j.id}
                  onClick={() => setSelected(j)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                    selected?.id === j.id ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {outlet?.outletDomain ? (
                      <img
                        src={`https://img.logo.dev/${outlet.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                        alt={outlet.outletName}
                        className="w-8 h-8 rounded-full object-contain bg-gray-50 border border-gray-200 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                        <span className="text-gray-400 text-xs font-medium">
                          {j.journalistName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate">{j.journalistName}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusStyle(j.status)}`}>
                          {statusLabel(j.status)}
                        </span>
                      </div>
                      {outlet?.outletName && (
                        <p className="text-xs text-gray-400 truncate">{outlet.outletName}</p>
                      )}
                    </div>
                    {cost != null && cost > 0 && (
                      <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                        {formatCost(cost)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Journalist Detail Panel */}
      {selected && (
        <DetailPanel
          journalist={selected}
          outlet={outletMap.get(selected.outletId)}
          costMap={costMap}
          brandId={brandId}
          campaignId={campaignId}
          onClose={() => setSelected(null)}
          onDiscover={invalidate}
        />
      )}
    </div>
  );
}

function DetailPanel({
  journalist: j,
  outlet,
  costMap,
  brandId,
  campaignId,
  onClose,
  onDiscover,
}: {
  journalist: BrandJournalist;
  outlet: DiscoveredOutlet | undefined;
  costMap: Map<string, number>;
  brandId: string;
  campaignId: string;
  onClose: () => void;
  onDiscover: () => void;
}) {
  const cost = costMap.get(j.journalistId);
  const score = parseFloat(j.relevanceScore);

  return (
    <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onClose} className="md:hidden flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 className="font-semibold text-gray-800 hidden md:block">Journalist Details</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hidden md:block">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Identity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Name</span>
              <p className="font-medium">{j.journalistName}</p>
            </div>
            {j.firstName && (
              <div>
                <span className="text-gray-500">First Name</span>
                <p className="font-medium">{j.firstName}</p>
              </div>
            )}
            {j.lastName && (
              <div>
                <span className="text-gray-500">Last Name</span>
                <p className="font-medium">{j.lastName}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Type</span>
              <p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
                  j.entityType === "individual"
                    ? "bg-blue-50 text-blue-600 border-blue-200"
                    : "bg-purple-50 text-purple-600 border-purple-200"
                }`}>
                  {j.entityType}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Status & Cost */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500 block mb-1">Status</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${statusStyle(j.status)}`}>
                {statusLabel(j.status)}
              </span>
            </div>
            {cost != null && cost > 0 && (
              <div>
                <span className="text-xs text-gray-500 block mb-1">Discovery Cost</span>
                <span className="text-sm font-medium text-gray-800">{formatCost(cost)}</span>
              </div>
            )}
            {!isNaN(score) && (
              <div>
                <span className="text-xs text-gray-500 block mb-1">Relevance</span>
                <span className={`text-xs px-2 py-1 rounded-full border ${relevanceColor(score)}`}>
                  {score}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Outlet */}
        {outlet && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Outlet</h4>
              <DiscoverJournalistsButton
                brandId={brandId}
                campaignId={campaignId}
                outletId={outlet.id}
                onSuccess={onDiscover}
              />
            </div>
            <div className="flex items-center gap-3">
              {outlet.outletDomain && (
                <img
                  src={`https://img.logo.dev/${outlet.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                  alt={outlet.outletName}
                  className="w-6 h-6 rounded object-contain bg-gray-50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">{outlet.outletName}</p>
                {outlet.outletDomain && <p className="text-xs text-gray-400">{outlet.outletDomain}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Relevance Reasoning */}
        {j.whyRelevant && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Relevant</h4>
            <p className="text-sm text-gray-700">{j.whyRelevant}</p>
          </div>
        )}
        {j.whyNotRelevant && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Not Relevant</h4>
            <p className="text-sm text-gray-700">{j.whyNotRelevant}</p>
          </div>
        )}

        {/* Articles */}
        {j.articleUrls && j.articleUrls.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Articles</h4>
            <ul className="space-y-1">
              {j.articleUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline truncate block">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-gray-400">
          Discovered: {new Date(j.createdAt).toLocaleDateString()} ({timeAgo(j.createdAt)})
        </div>
      </div>
    </div>
  );
}
