"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listBrandJournalists,
  listBrandOutlets,
  type BrandJournalist,
  type DiscoveredOutlet,
} from "@/lib/api";
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

interface OutletWithJournalists {
  outlet: DiscoveredOutlet;
  journalists: BrandJournalist[];
}

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

function JournalistDetailTable({ journalist: j }: { journalist: BrandJournalist }) {
  const score = parseFloat(j.relevanceScore);
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

function DetailPanel({
  item,
  onClose,
}: {
  item: OutletWithJournalists;
  onClose: () => void;
}) {
  const { outlet, journalists } = item;
  const [outletOpen, setOutletOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto border-l border-gray-200 animate-slide-in-right">
        {/* Header */}
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
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Journalists ({journalists.length})
            </h3>
            {journalists.length === 0 ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500">No journalists associated with this outlet yet.</p>
                <p className="text-xs text-gray-400 mt-1">Journalists will appear here once they are discovered by a campaign.</p>
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
                    <JournalistDetailTable journalist={j} />
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

export default function JournalistsToolPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selected, setSelected] = useState<OutletWithJournalists | null>(null);

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

  const isLoading = outletsLoading || journalistsLoading;

  const outletItems = useMemo(() => {
    const outlets = (outletsData?.outlets ?? []).filter((o) => o.status !== "skipped");
    const journalists = journalistsData?.campaignJournalists ?? [];

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
  }, [outletsData, journalistsData]);

  const totalJournalists = outletItems.reduce((sum, item) => sum + item.journalists.length, 0);

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
          <p className="text-sm text-gray-500">Discovered journalists grouped by media outlet</p>
        </div>
      </div>

      {/* Content */}
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
        <>
          <div className="text-sm text-gray-500 mb-4">
            {outletItems.length} outlet{outletItems.length !== 1 ? "s" : ""} &middot; {totalJournalists} journalist{totalJournalists !== 1 ? "s" : ""}
          </div>
          <div className="space-y-2">
            {outletItems.map((item) => (
              <OutletRow key={item.outlet.id} item={item} onClick={() => setSelected(item)} />
            ))}
          </div>
        </>
      )}

      {/* Detail Panel */}
      {selected && (
        <DetailPanel item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
