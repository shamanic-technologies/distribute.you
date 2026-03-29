"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  listBrandJournalists,
  listBrandOutlets,
  listCampaignsByBrand,
  discoverJournalists,
  getJournalistStatsCosts,
  type BrandJournalist,
  type DiscoveredOutlet,
  type Campaign,
  type CostStatsGroup,
} from "@/lib/api";
import { BrandLogo } from "@/components/brand-logo";

const POLL_INTERVAL = 10_000;
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

/* ─── Types ──────────────────────────────────────────────────────────── */

interface OutletWithJournalists {
  outlet: DiscoveredOutlet;
  journalists: BrandJournalist[];
}

/* ─── Discover Button (per outlet) ───────────────────────────────────── */

function DiscoverJournalistsButton({
  brandId,
  outletId,
  campaigns,
  onSuccess,
}: {
  brandId: string;
  outletId: string;
  campaigns: Campaign[];
  onSuccess: () => void;
}) {
  const [selectedCampaignId] = useState(campaigns[0]?.id ?? "");

  const mutation = useMutation({
    mutationFn: () => discoverJournalists(brandId, selectedCampaignId, outletId),
    onSuccess,
  });

  if (campaigns.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); mutation.mutate(); }}
        disabled={mutation.isPending || !selectedCampaignId}
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

/* ─── Outlet Row ─────────────────────────────────────────────────────── */

function OutletRow({
  item,
  onClick,
}: {
  item: OutletWithJournalists;
  onClick: () => void;
}) {
  const { outlet, journalists } = item;
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
      <div className="flex items-center gap-3 flex-shrink-0">
        {journalists.length > 0 ? (
          <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
            {journalists.length} journalist{journalists.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">No journalists yet</span>
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

/* ─── Journalist Detail Table ────────────────────────────────────────── */

function JournalistDetailTable({ journalist: j, costCents }: { journalist: BrandJournalist; costCents: string | null }) {
  const score = parseFloat(j.relevanceScore);
  const cost = formatCost(costCents);
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Name", value: j.journalistName },
    { label: "First Name", value: j.firstName ?? "—" },
    { label: "Last Name", value: j.lastName ?? "—" },
    { label: "Type", value: <span className={`text-xs px-1.5 py-0.5 rounded-full border ${j.entityType === "individual" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-purple-50 text-purple-600 border-purple-200"}`}>{j.entityType}</span> },
    { label: "Status", value: <span className={`text-xs px-1.5 py-0.5 rounded-full border ${j.status === "served" ? "bg-green-50 text-green-600 border-green-200" : j.status === "skipped" ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>{j.status}</span> },
  ];
  if (!isNaN(score)) {
    rows.push({ label: "Relevance", value: <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${relevanceColor(score)}`}>{score}%</span> });
  }
  if (cost) {
    rows.push({ label: "Discovery Cost", value: <span className="text-xs font-medium text-gray-700">{cost}</span> });
  }
  if (j.whyRelevant) {
    rows.push({ label: "Why Relevant", value: j.whyRelevant });
  }
  if (j.whyNotRelevant) {
    rows.push({ label: "Why Not Relevant", value: j.whyNotRelevant });
  }
  if (j.articleUrls && j.articleUrls.length > 0) {
    rows.push({
      label: "Articles",
      value: (
        <div className="space-y-1">
          {j.articleUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-brand-600 hover:text-brand-700 hover:underline break-all text-xs">
              {url}
            </a>
          ))}
        </div>
      ),
    });
  }
  rows.push({ label: "Discovered", value: new Date(j.createdAt).toLocaleDateString() + ` (${timeAgo(j.createdAt)})` });

  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-gray-50 last:border-0">
            <td className="py-2 pr-3 text-xs font-medium text-gray-500 whitespace-nowrap align-top w-32">{row.label}</td>
            <td className="py-2 text-gray-700">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ─── Detail Panel ───────────────────────────────────────────────────── */

function DetailPanel({
  item,
  campaigns,
  brandId,
  costMap,
  onClose,
  onDiscover,
}: {
  item: OutletWithJournalists;
  campaigns: Campaign[];
  brandId: string;
  costMap: Map<string, string>;
  onClose: () => void;
  onDiscover: () => void;
}) {
  const { outlet, journalists } = item;
  const [outletOpen, setOutletOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto border-l border-gray-200 animate-slide-in-right">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              <BrandLogo domain={outlet.outletDomain} size={24} className="rounded" fallbackClassName="w-5 h-5 text-gray-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{outlet.outletName}</h2>
              <p className="text-xs text-gray-400">{outlet.outletDomain}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Journalists section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Journalists ({journalists.length})
              </h3>
              <DiscoverJournalistsButton
                brandId={brandId}
                outletId={outlet.id}
                campaigns={campaigns}
                onSuccess={onDiscover}
              />
            </div>
            {journalists.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500">No journalists associated with this outlet yet.</p>
                <p className="text-xs text-gray-400 mt-1">Use the button above to discover journalists for this outlet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journalists.map((j) => (
                  <div key={j.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-brand-600 text-[10px] font-medium">
                          {j.journalistName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-sm text-gray-800">{j.journalistName}</span>
                    </div>
                    <JournalistDetailTable journalist={j} costCents={costMap.get(j.journalistId) ?? null} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outlet details — collapsible */}
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setOutletOpen(!outletOpen)}
              className="flex items-center gap-2 w-full text-left"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${outletOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outlet Details</h3>
            </button>
            {outletOpen && (
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Website</h4>
                  <a
                    href={outlet.outletUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-600 hover:text-brand-700 hover:underline break-all"
                  >
                    {outlet.outletUrl}
                  </a>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</h4>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full border ${outletStatusStyle(outlet.status)}`}>
                    {outlet.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relevance Score</h4>
                  <span className={`text-sm font-medium px-2.5 py-1 rounded-full border ${relevanceColor(outlet.relevanceScore)}`}>
                    {outlet.relevanceScore}%
                  </span>
                </div>

                {outlet.whyRelevant && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Why Relevant</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.whyRelevant}</p>
                  </div>
                )}

                {outlet.whyNotRelevant && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Why Not Relevant</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.whyNotRelevant}</p>
                  </div>
                )}

                {outlet.overalRelevance && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overall Relevance</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.overalRelevance}</p>
                  </div>
                )}

                {outlet.relevanceRationale && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Relevance Rationale</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{outlet.relevanceRationale}</p>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dates</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Discovered: {new Date(outlet.createdAt).toLocaleDateString()} ({timeAgo(outlet.createdAt)})</p>
                    <p>Updated: {new Date(outlet.updatedAt).toLocaleDateString()} ({timeAgo(outlet.updatedAt)})</p>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">ID</h4>
                  <p className="text-xs text-gray-400 font-mono break-all">{outlet.id}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Runs Tab ───────────────────────────────────────────────────────── */

function RunsTab({ journalists }: { journalists: BrandJournalist[] }) {
  const runGroups = useMemo(() => {
    const map = new Map<string, BrandJournalist[]>();
    for (const j of journalists) {
      const runId = (j as BrandJournalist & { runId?: string }).runId;
      if (!runId) continue;
      const list = map.get(runId) ?? [];
      list.push(j);
      map.set(runId, list);
    }
    return Array.from(map.entries()).map(([runId, items]) => ({
      runId,
      count: items.length,
      earliestDate: items.reduce((min, j) => j.createdAt < min ? j.createdAt : min, items[0].createdAt),
    })).sort((a, b) => b.earliestDate.localeCompare(a.earliestDate));
  }, [journalists]);

  if (runGroups.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No runs yet</h3>
        <p className="text-gray-500 text-sm">Discovery runs and their costs will appear here once journalists have a runId field.</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Run ID</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Journalists</th>
            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
          </tr>
        </thead>
        <tbody>
          {runGroups.map((g) => (
            <tr key={g.runId} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{g.runId.slice(0, 8)}...</td>
              <td className="px-4 py-3 text-right text-gray-700">{g.count}</td>
              <td className="px-4 py-3 text-gray-600">{new Date(g.earliestDate).toLocaleDateString()} ({timeAgo(g.earliestDate)})</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function JournalistsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<OutletWithJournalists | null>(null);
  const [activeTab, setActiveTab] = useState<"journalists" | "runs">("journalists");

  const { data: outletsData, isLoading: outletsLoading } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    pollOptions,
  );
  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["brandJournalists", brandId],
    () => listBrandJournalists(brandId),
    pollOptions,
  );
  const { data: campaignsData } = useAuthQuery(
    ["brandCampaigns", brandId],
    () => listCampaignsByBrand(brandId),
  );
  const { data: costsByJournalist } = useAuthQuery(
    ["journalistStatsCosts", brandId, "journalistId"],
    () => getJournalistStatsCosts(brandId, "journalistId"),
  );

  const isLoading = outletsLoading || journalistsLoading;
  const campaigns = campaignsData?.campaigns ?? [];
  const journalists = journalistsData?.campaignJournalists ?? [];

  const costMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of costsByJournalist?.groups ?? []) {
      const id = g.dimensions.journalistId;
      if (id) map.set(id, g.totalCostInUsdCents);
    }
    return map;
  }, [costsByJournalist]);

  const outletItems = useMemo(() => {
    const outlets = (outletsData?.outlets ?? []).filter((o) => o.status !== "skipped");

    const journalistsByOutlet = new Map<string, BrandJournalist[]>();
    for (const j of journalists) {
      const list = journalistsByOutlet.get(j.outletId) ?? [];
      list.push(j);
      journalistsByOutlet.set(j.outletId, list);
    }

    return outlets
      .map((outlet) => ({
        outlet,
        journalists: (journalistsByOutlet.get(outlet.id) ?? []).sort(
          (a, b) => parseFloat(b.relevanceScore) - parseFloat(a.relevanceScore),
        ),
      }))
      .sort((a, b) => b.outlet.relevanceScore - a.outlet.relevanceScore);
  }, [outletsData, journalists]);

  const totalJournalists = outletItems.reduce((sum, item) => sum + item.journalists.length, 0);

  const totalCost = useMemo(() => {
    let total = 0;
    for (const g of costsByJournalist?.groups ?? []) {
      total += parseFloat(g.totalCostInUsdCents) || 0;
    }
    return total;
  }, [costsByJournalist]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["brandJournalists", brandId] });
    queryClient.invalidateQueries({ queryKey: ["journalistStatsCosts", brandId] });
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Journalists</h1>
          <p className="text-sm text-gray-500">
            {outletItems.length} outlet{outletItems.length !== 1 ? "s" : ""} &middot; {totalJournalists} journalist{totalJournalists !== 1 ? "s" : ""}
            {totalCost > 0 && ` · Total cost: $${(totalCost / 100).toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("journalists")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === "journalists"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Journalists
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

      {/* Journalists Tab */}
      {activeTab === "journalists" && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : outletItems.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No outlets yet</h3>
              <p className="text-gray-500 text-sm">
                Outlets and their journalists will be discovered when you run a journalist pitch campaign.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {outletItems.map((item) => (
                <OutletRow key={item.outlet.id} item={item} onClick={() => setSelected(item)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Runs Tab */}
      {activeTab === "runs" && (
        <RunsTab journalists={journalists} />
      )}

      {/* Detail Panel */}
      {selected && (
        <DetailPanel
          item={selected}
          campaigns={campaigns}
          brandId={brandId}
          costMap={costMap}
          onClose={() => setSelected(null)}
          onDiscover={invalidate}
        />
      )}
    </div>
  );
}
