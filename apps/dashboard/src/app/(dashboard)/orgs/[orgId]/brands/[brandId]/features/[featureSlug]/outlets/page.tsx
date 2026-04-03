"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandOutlets,
  getOutletStatsCosts,
  type DiscoveredOutlet,
  type CostStatsGroup,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function formatCost(cents: string | number | null | undefined): string | null {
  if (cents == null) return null;
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(n) || n === 0) return null;
  return `$${(n / 100).toFixed(2)}`;
}

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

function OutletRow({ outlet, costCents, isSelected, onClick }: { outlet: DiscoveredOutlet; costCents: string | null; isSelected: boolean; onClick: () => void }) {
  const cost = formatCost(costCents);
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
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusBadge(outlet.status)}`}>
            {outlet.status}
          </span>
        </div>
        <p className="text-xs text-gray-400 truncate">{outlet.outletDomain}</p>
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

/* ─── Detail Panel ───────────────────────────────────────────────────── */

function OutletDetailPanel({ outlet, costCents, onClose }: { outlet: DiscoveredOutlet; costCents: string | null; onClose: () => void }) {
  const cost = formatCost(costCents);
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-800">{outlet.outletName}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
              {outlet.relevanceScore}% relevance
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Domain:</span>
              <p className="font-medium">{outlet.outletDomain}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p>
                <span className={`text-xs px-2 py-1 rounded-full border ${statusBadge(outlet.status)}`}>
                  {outlet.status}
                </span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">URL:</span>
              <p>
                <a href={outlet.outletUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline text-sm break-all">
                  {outlet.outletUrl}
                </a>
              </p>
            </div>
          </div>
        </div>

        {cost && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Discovery Cost</h4>
            <span className="text-sm font-medium text-gray-700">{cost}</span>
          </div>
        )}

        {outlet.whyRelevant && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Relevant</h4>
            <p className="text-sm text-gray-700">{outlet.whyRelevant}</p>
          </div>
        )}

        {outlet.whyNotRelevant && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Why Not Relevant</h4>
            <p className="text-sm text-gray-700">{outlet.whyNotRelevant}</p>
          </div>
        )}

        {(outlet.overalRelevance || outlet.relevanceRationale) && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Relevance Assessment</h4>
            {outlet.overalRelevance && (
              <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Overall:</span> {outlet.overalRelevance}</p>
            )}
            {outlet.relevanceRationale && (
              <p className="text-sm text-gray-700">{outlet.relevanceRationale}</p>
            )}
          </div>
        )}

        <div className="text-xs text-gray-400 space-y-1">
          <p>Discovered: {new Date(outlet.createdAt).toLocaleDateString()} ({timeAgo(outlet.createdAt)})</p>
          <p>Updated: {new Date(outlet.updatedAt).toLocaleDateString()} ({timeAgo(outlet.updatedAt)})</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Runs Tab ───────────────────────────────────────────────────────── */

function RunsTab({ groups }: { groups: CostStatsGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No runs yet</h3>
        <p className="text-gray-500 text-sm">Discovery runs and their costs will appear here.</p>
      </div>
    );
  }

  const sorted = [...groups].sort((a, b) => {
    const costA = parseFloat(a.totalCostInUsdCents);
    const costB = parseFloat(b.totalCostInUsdCents);
    return costB - costA;
  });

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Run ID</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Runs</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Total Cost</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Actual</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Provisioned</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((g, i) => {
            const runId = g.dimensions.runId ?? "unknown";
            return (
              <tr key={runId + i} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{runId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-right text-gray-700">{g.runCount}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCost(g.totalCostInUsdCents) ?? "$0.00"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCost(g.actualCostInUsdCents) ?? "$0.00"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCost(g.provisionedCostInUsdCents) ?? "$0.00"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function FeatureOutletsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selected, setSelected] = useState<DiscoveredOutlet | null>(null);
  const [activeTab, setActiveTab] = useState<"outlets" | "runs">("outlets");

  const { data, isLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    pollOptions,
  );

  const { data: costsByOutlet } = useAuthQuery(
    ["outletStatsCosts", brandId, "outletId"],
    () => getOutletStatsCosts(brandId, "outletId"),
  );

  const { data: costsByRun } = useAuthQuery(
    ["outletStatsCosts", brandId, "runId"],
    () => getOutletStatsCosts(brandId, "runId"),
  );

  const outlets = (data?.outlets ?? []).filter((o) => o.status !== "skipped");
  const sorted = [...outlets].sort((a, b) => b.relevanceScore - a.relevanceScore);

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
            <p className="text-sm text-gray-500">
              {outlets.length} outlet{outlets.length !== 1 ? "s" : ""} across all campaigns
              {totalCost > 0 && ` · Total cost: $${(totalCost / 100).toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("outlets")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "outlets"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Outlets
          </button>
          <button
            onClick={() => setActiveTab("runs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "runs"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Runs
          </button>
        </div>

        {/* Outlets Tab */}
        {activeTab === "outlets" && (
          <>
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
                  Outlets will appear here once discovered by campaigns.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((outlet) => (
                  <OutletRow
                    key={outlet.id}
                    outlet={outlet}
                    costCents={costMap.get(outlet.id) ?? null}
                    isSelected={selected?.id === outlet.id}
                    onClick={() => setSelected(outlet)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Runs Tab */}
        {activeTab === "runs" && (
          <RunsTab groups={costsByRun?.groups ?? []} />
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
