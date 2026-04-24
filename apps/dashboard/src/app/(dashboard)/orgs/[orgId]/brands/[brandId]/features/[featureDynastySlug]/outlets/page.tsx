"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandOutlets,
  getOutletStatsCosts,
  type DeduplicatedOutlet,
  type OutletCampaign,
  type OutletStatusCounts,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/skeleton";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { STATUS_PRIORITY, statusBadgeColor, statusLabel, deriveDisplayStatusFromCounts } from "@/lib/outlet-status";

type Tab = string | "all";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function formatCost(cents: string | number | null | undefined): string | null {
  if (cents == null) return null;
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(n) || n === 0) return null;
  const usd = n / 100;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relevanceColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-red-100 text-red-600 border-red-200";
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

/* ─── Outlet Row ─────────────────────────────────────────────────────── */

function OutletRow({ outlet, costCents, isSelected, onClick }: { outlet: DeduplicatedOutlet; costCents: string | null; isSelected: boolean; onClick: () => void }) {
  const cost = formatCost(costCents);
  const displayStatus = deriveDisplayStatusFromCounts(outlet.status?.brand);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border hover:border-brand-300 hover:shadow-sm transition bg-white cursor-pointer ${
        isSelected ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
      }`}
    >
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
        <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-gray-800 truncate">{outlet.outletName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadgeColor(displayStatus)}`}>
            {statusLabel(displayStatus)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
          <span className="text-xs text-gray-300">&middot;</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{outlet.campaigns.length} campaign{outlet.campaigns.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cost && (
          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
            {cost}
          </span>
        )}
        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
          {outlet.relevanceScore}%
        </span>
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

/* ─── Campaign Detail Card ──────────────────────────────────────────── */

function CampaignDetailCard({ campaign, counts }: { campaign: OutletCampaign; counts: OutletStatusCounts | null | undefined }) {
  const displayStatus = deriveDisplayStatusFromCounts(counts);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{campaign.featureSlug}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusBadgeColor(displayStatus)}`}>
            {statusLabel(displayStatus)}
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(campaign.relevanceScore)}`}>
          {campaign.relevanceScore}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
        <div>
          <span className="text-gray-500 text-xs">Campaign ID</span>
          <p className="text-xs font-mono text-gray-700 truncate">{campaign.campaignId}</p>
        </div>
        <div>
          <span className="text-gray-500 text-xs">Updated</span>
          <p className="text-xs text-gray-700">{timeAgo(campaign.updatedAt)}</p>
        </div>
      </div>

      {campaign.whyRelevant && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Why Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{campaign.whyRelevant}</p>
        </div>
      )}
      {campaign.whyNotRelevant && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Why Not Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{campaign.whyNotRelevant}</p>
        </div>
      )}
      {(campaign.overallRelevance || campaign.relevanceRationale) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-500">Relevance Assessment</span>
          {campaign.overallRelevance && (
            <p className="text-sm text-gray-700 mt-0.5"><span className="font-medium">Overall:</span> {campaign.overallRelevance}</p>
          )}
          {campaign.relevanceRationale && (
            <p className="text-sm text-gray-700 mt-0.5">{campaign.relevanceRationale}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Detail Panel ───────────────────────────────────────────────────── */

function OutletDetailPanel({ outlet, costCents, onClose }: { outlet: DeduplicatedOutlet; costCents: string | null; onClose: () => void }) {
  const cost = formatCost(costCents);
  const displayStatus = deriveDisplayStatusFromCounts(outlet.status?.brand);
  return (
    <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onClose} className="md:hidden flex items-center gap-2 text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="hidden md:flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 truncate">{outlet.outletName}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hidden md:block">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* High-level outlet info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">{outlet.outletName}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
              {outlet.relevanceScore}% relevance
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Domain</span>
              <p className="font-medium">{outlet.outletDomain}</p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadgeColor(displayStatus)}`}>
                  {statusLabel(displayStatus)}
                </span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">URL</span>
              <p>
                <a href={outlet.outletUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-sm break-all">
                  {outlet.outletUrl}
                </a>
              </p>
            </div>
            <div>
              <span className="text-gray-500">Discovered</span>
              <p className="text-gray-700">{new Date(outlet.createdAt).toLocaleDateString()} ({timeAgo(outlet.createdAt)})</p>
            </div>
            {cost && (
              <div>
                <span className="text-gray-500">Total Cost</span>
                <p className="font-medium text-gray-700">{cost}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Campaigns</span>
              <p className="font-medium text-gray-700">{outlet.campaigns.length}</p>
            </div>
          </div>
        </div>

        {/* Per-campaign detail */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Campaign Details ({outlet.campaigns.length})</h4>
          <div className="space-y-3">
            {outlet.campaigns.map((c) => (
              <CampaignDetailCard key={c.campaignId} campaign={c} counts={outlet.status?.byCampaign?.[c.campaignId]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function FeatureOutletsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureDynastySlug = params.featureDynastySlug as string;
  const [selected, setSelected] = useState<DeduplicatedOutlet | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  const { data, isLoading } = useAuthQuery(
    ["brandOutlets", brandId, featureDynastySlug],
    () => listBrandOutlets(brandId, featureDynastySlug),
    pollOptions,
  );

  const { data: costsByOutlet } = useAuthQuery(
    ["outletStatsCosts", brandId, featureDynastySlug, "outletId"],
    () => getOutletStatsCosts(brandId, "outletId", featureDynastySlug),
  );

  const outlets = data?.outlets ?? [];

  const costMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of costsByOutlet?.groups ?? []) {
      const id = g.dimensions.outletId;
      if (id) map.set(id, g.totalCostInUsdCents);
    }
    return map;
  }, [costsByOutlet]);

  const totalCost = useMemo(() => {
    let total = 0;
    for (const g of costsByOutlet?.groups ?? []) {
      total += parseFloat(g.totalCostInUsdCents) || 0;
    }
    return total;
  }, [costsByOutlet]);

  const avgCostPerOutlet = outlets.length > 0 ? totalCost / outlets.length : 0;

  // Group outlets by display status derived from structured counts
  const groupedByStatus = useMemo(() => {
    const groups = new Map<string, DeduplicatedOutlet[]>();
    for (const status of STATUS_PRIORITY) {
      groups.set(status, []);
    }
    for (const o of outlets) {
      const ds = deriveDisplayStatusFromCounts(o.status?.brand);
      groups.get(ds)?.push(o);
    }
    return groups;
  }, [outlets]);

  // Auto-select the first non-empty tab on initial data load
  useEffect(() => {
    if (hasAutoSelectedTab.current || outlets.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = STATUS_PRIORITY.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [outlets.length, groupedByStatus]);

  // Tab counts: use backend byOutreachStatus when available, fall back to client-side.
  // "replied" from backend is split into replied-positive/negative/neutral from the array.
  const backendCounts = data?.byOutreachStatus;
  const tabCount = (status: string): number => {
    if (status.startsWith("replied-")) return groupedByStatus.get(status)?.length ?? 0;
    if (backendCounts && status in backendCounts) return backendCounts[status];
    return groupedByStatus.get(status)?.length ?? 0;
  };

  // Static tabs: all statuses in priority order + "all"
  const tabs: { key: Tab; label: string; count: number }[] = [
    ...STATUS_PRIORITY.map((status) => ({
      key: status as Tab,
      label: statusLabel(status),
      count: tabCount(status),
    })),
    { key: "all", label: "All", count: data?.total ?? outlets.length },
  ];

  const displayedOutlets = useMemo(() => {
    const list = activeTab === "all"
      ? outlets
      : groupedByStatus.get(activeTab) ?? [];
    return [...list].sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [activeTab, outlets, groupedByStatus]);

  const filteredOutlets = useMemo(() => {
    if (!search) return displayedOutlets;
    const q = search.toLowerCase();
    return displayedOutlets.filter((o) =>
      o.outletName.toLowerCase().includes(q) || o.outletDomain.toLowerCase().includes(q)
    );
  }, [displayedOutlets, search]);

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selected ? "hidden md:block md:w-1/2" : "w-full"} p-4 md:p-8 overflow-y-auto transition-all`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Outlets</h1>
            {isLoading && !data ? (
              <Skeleton className="h-4 w-48 mt-1" />
            ) : (
              <p className="text-sm text-gray-500">
                {data?.total ?? outlets.length} outlet{(data?.total ?? outlets.length) !== 1 ? "s" : ""} across all campaigns
                {totalCost > 0 && ` \u00b7 Total: $${(totalCost / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                {avgCostPerOutlet > 0 && ` \u00b7 Avg: $${(avgCostPerOutlet / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/outlet`}
              </p>
            )}
          </div>
        </div>

        {/* Status tabs */}
        {!(isLoading && !data) && outlets.length > 0 && (
          <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelected(null); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs font-normal text-gray-400">({tab.count})</span>
              </button>
            ))}
          </div>
        )}

        {/* Outlet list */}
        {isLoading && !data ? (
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
              Outlets will appear here once discovered by campaigns.
            </p>
          </div>
        ) : (
          <>
          <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by outlet name or domain..." resultCount={filteredOutlets.length} totalCount={displayedOutlets.length} />
          <div className="space-y-2">
            {filteredOutlets.map((outlet) => (
              <OutletRow
                key={outlet.id}
                outlet={outlet}
                costCents={costMap.get(outlet.id) ?? null}
                isSelected={selected?.id === outlet.id}
                onClick={() => setSelected(outlet)}
              />
            ))}
          </div>
          </>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <OutletDetailPanel
          outlet={selected}
          costCents={costMap.get(selected.id) ?? null}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
