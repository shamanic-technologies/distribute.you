"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listJournalistsEnriched,
  type EnrichedJournalist,
  type JournalistCampaignEntry,
} from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";
import {
  STATUS_PRIORITY,
  STATUS_DESCRIPTIONS,
  statusBadgeColor as statusStyle,
  statusLabel,
  bestDisplayStatus,
  resolveDisplayStatus,
} from "@/lib/outlet-status";

const POLL_INTERVAL = 5_000;
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

type Tab = string | "all";

function getReplyClassification(j: EnrichedJournalist): string | null {
  return j.emailStatus?.broadcast?.campaign?.replyClassification ?? null;
}

function statusDescription(displayStatus: string): string {
  return STATUS_DESCRIPTIONS[displayStatus] ?? displayStatus;
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

/** Returns the most advanced display status across all campaign entries */
function bestStatus(j: EnrichedJournalist): string {
  return bestDisplayStatus(j.campaigns, getReplyClassification(j));
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function CampaignJournalistsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const brandId = params.brandId as string;
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [selected, setSelected] = useState<EnrichedJournalist | null>(null);
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["enrichedJournalists", brandId, campaignId],
    () => listJournalistsEnriched(brandId, { campaignId }),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const journalists = journalistsData?.journalists ?? [];
  const isFirstLoad = journalistsLoading && journalists.length === 0;

  // Derive best display status per journalist for tab grouping
  const journalistStatuses = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of journalists) {
      map.set(j.journalistId, bestStatus(j));
    }
    return map;
  }, [journalists]);

  // Group by best display status
  const groupedByStatus = useMemo(() => {
    const groups = new Map<string, EnrichedJournalist[]>();
    for (const status of STATUS_PRIORITY) {
      groups.set(status, []);
    }
    for (const j of journalists) {
      const s = journalistStatuses.get(j.journalistId) ?? "skipped";
      groups.get(s)?.push(j);
    }
    return groups;
  }, [journalists, journalistStatuses]);

  // Auto-select the first non-empty tab on initial data load
  useEffect(() => {
    if (hasAutoSelectedTab.current || journalists.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = STATUS_PRIORITY.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [journalists.length, groupedByStatus]);

  const activeList = activeTab === "all"
    ? journalists
    : groupedByStatus.get(activeTab) ?? [];

  const filteredList = useMemo(() => {
    if (!search) return activeList;
    const q = search.toLowerCase();
    return activeList.filter((j) => {
      const outletName = j.outletName ?? "";
      return j.journalistName.toLowerCase().includes(q) || outletName.toLowerCase().includes(q);
    });
  }, [activeList, search]);

  // Tabs: status tabs (ordered) + all
  const tabs: { key: Tab; label: string; count: number }[] = [
    ...STATUS_PRIORITY.map((status) => ({
      key: status as Tab,
      label: statusLabel(status),
      count: groupedByStatus.get(status)?.length ?? 0,
    })),
    { key: "all", label: "All", count: journalists.length },
  ];

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
            <span className="ml-2 text-sm font-normal text-gray-500">({journalists.length})</span>
          </h1>
        </div>

        {/* Tabs */}
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

        <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by journalist or outlet name..." resultCount={filteredList.length} totalCount={activeList.length} />

        {filteredList.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
              {activeList.length === 0 ? "No journalists" : "No matching journalists"}
            </h3>
            <p className="text-gray-600 text-sm">
              {activeList.length === 0 ? "No journalists with this status yet." : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredList.map((j) => {
              const cost = j.cost?.totalCostInUsdCents ?? 0;
              const status = journalistStatuses.get(j.journalistId) ?? "skipped";
              return (
                <button
                  key={j.journalistId}
                  onClick={() => setSelected(j)}
                  className={`w-full text-left bg-white rounded-xl border p-4 hover:border-brand-300 hover:shadow-sm transition ${
                    selected?.journalistId === j.journalistId ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {j.outletDomain ? (
                      <img
                        src={`https://img.logo.dev/${j.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                        alt={j.outletName ?? ""}
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusStyle(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </div>
                      {j.outletName && (
                        <p className="text-xs text-gray-400 truncate">{j.outletName}</p>
                      )}
                    </div>
                    {cost > 0 && (
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function DetailPanel({
  journalist: j,
  onClose,
}: {
  journalist: EnrichedJournalist;
  onClose: () => void;
}) {
  const cost = j.cost?.totalCostInUsdCents ?? 0;

  return (
    <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10 flex flex-col">
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

      <div className="p-4 md:p-6 space-y-4 flex-1">
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
            {j.email && (
              <div>
                <span className="text-gray-500">Email</span>
                <p className="font-medium">{j.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Aggregated Status & Cost */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500 block mb-1">Best Status</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${statusStyle(bestStatus(j))}`}>
                {statusLabel(bestStatus(j))}
              </span>
            </div>
            {cost > 0 && (
              <div>
                <span className="text-xs text-gray-500 block mb-1">Cost</span>
                <span className="text-sm font-medium text-gray-800">{formatCost(cost)}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-500 block mb-1">Campaigns</span>
              <span className="text-sm font-medium text-gray-800">{j.campaigns.length}</span>
            </div>
          </div>
        </div>

        {/* Email Delivery Status */}
        {j.emailStatus && <EmailStatusCard emailStatus={j.emailStatus} scope="campaign" />}

        {/* Outlet */}
        {j.outletName && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Outlet</h4>
            <div className="flex items-center gap-3">
              {j.outletDomain && (
                <img
                  src={`https://img.logo.dev/${j.outletDomain}?token=${LOGO_DEV_TOKEN}`}
                  alt={j.outletName}
                  className="w-6 h-6 rounded object-contain bg-gray-50"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">{j.outletName}</p>
                {j.outletDomain && <p className="text-xs text-gray-400">{j.outletDomain}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Per-Campaign Details */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign Entries</h4>
          {j.campaigns.map((c) => (
            <CampaignEntryCard key={c.id} campaign={c} />
          ))}
        </div>
      </div>

      {/* Status Legend */}
      <div className="border-t border-gray-200 bg-white p-4">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Status Legend</h4>
        <div className="space-y-2">
          {STATUS_PRIORITY.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusStyle(status)}`}>
                {statusLabel(status)}
              </span>
              <span className="text-xs text-gray-500">{statusDescription(status)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CampaignEntryCard({ campaign: c }: { campaign: JournalistCampaignEntry }) {
  const score = parseFloat(c.relevanceScore);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusStyle(c.outreachStatus)}`}>
          {statusLabel(c.outreachStatus)}
        </span>
        {!isNaN(score) && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${relevanceColor(score)}`}>
            {score}% relevant
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">
          {new Date(c.createdAt).toLocaleDateString()} ({timeAgo(c.createdAt)})
        </span>
      </div>

      {c.whyRelevant && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Why Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{c.whyRelevant}</p>
        </div>
      )}
      {c.whyNotRelevant && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Why Not Relevant</span>
          <p className="text-sm text-gray-700 mt-0.5">{c.whyNotRelevant}</p>
        </div>
      )}

      {c.articleUrls && c.articleUrls.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Articles</span>
          <ul className="mt-1 space-y-0.5">
            {c.articleUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline truncate block">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EmailStatusCard({ emailStatus, scope }: { emailStatus: NonNullable<EnrichedJournalist["emailStatus"]>; scope: "campaign" | "brand" }) {
  const bc = emailStatus.broadcast[scope];
  const tc = emailStatus.transactional[scope];
  if (!bc && !tc) return null;

  const items: { label: string; value: boolean }[] = [];
  if (bc) {
    items.push({ label: "Contacted", value: bc.contacted });
    items.push({ label: "Delivered", value: bc.delivered });
    items.push({ label: "Opened", value: bc.opened });
    items.push({ label: "Replied", value: bc.replied });
  }
  if (tc) {
    items.push({ label: "Transactional sent", value: tc.contacted });
    items.push({ label: "Transactional delivered", value: tc.delivered });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Email Delivery</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.label}
            className={`text-[10px] px-2 py-1 rounded-full border ${
              item.value
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-400 border-gray-200"
            }`}
          >
            {item.label}
          </span>
        ))}
        {bc?.replyClassification && (
          <span className={`text-[10px] px-2 py-1 rounded-full border ${
            bc.replyClassification === "positive"
              ? "bg-green-50 text-green-700 border-green-200"
              : bc.replyClassification === "negative"
                ? "bg-red-50 text-red-600 border-red-200"
                : "bg-yellow-50 text-yellow-700 border-yellow-200"
          }`}>
            Reply: {bc.replyClassification}
          </span>
        )}
      </div>
    </div>
  );
}
