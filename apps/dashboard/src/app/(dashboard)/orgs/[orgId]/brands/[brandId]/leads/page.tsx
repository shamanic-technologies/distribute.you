"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandLeads, getLeadConsolidatedStatus, type Lead, type LeadConsolidatedStatus, type RunCost, type DescendantRun } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

const POLL_INTERVAL = 5_000;

const LEAD_STATUS_ORDER: LeadConsolidatedStatus[] = [
  "replied",
  "delivered",
  "bounced",
  "contacted",
  "served",
];

type Tab = LeadConsolidatedStatus | "all";

function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "delivered": return "Delivered";
    case "bounced": return "Bounced";
    case "contacted": return "Contacted";
    case "served": return "Processing";
  }
}

function leadStatusStyle(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "delivered": return "bg-green-100 text-green-700 border-green-200";
    case "bounced": return "bg-red-100 text-red-600 border-red-200";
    case "contacted": return "bg-teal-100 text-teal-700 border-teal-200";
    case "served": return "bg-orange-100 text-orange-700 border-orange-200";
  }
}

function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatCostRounded(run: Lead["enrichmentRun"]): string | null {
  if (!run) return null;
  const cents = parseFloat(run.totalCostInUsdCents);
  if (isNaN(cents) || cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCostDetailed(cents: string): string {
  const val = parseFloat(cents) / 100;
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

function formatDuration(startedAt: string, completedAt: string | null): string | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd < 0.01 && usd > 0) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CostGroup {
  serviceName: string;
  taskName: string;
  subtotal: string;
  costs: RunCost[];
}

function buildCostGroups(
  ownCosts: RunCost[],
  serviceName: string,
  taskName: string,
  descendantRuns: DescendantRun[]
): CostGroup[] {
  const groups: CostGroup[] = [];
  if (ownCosts.length > 0) {
    const subtotal = ownCosts.reduce((sum, c) => sum + parseFloat(c.totalCostInUsdCents), 0);
    groups.push({ serviceName, taskName, subtotal: String(subtotal), costs: ownCosts });
  }
  for (const dr of descendantRuns) {
    if (dr.costs.length > 0) {
      groups.push({ serviceName: dr.serviceName, taskName: dr.taskName, subtotal: dr.ownCostInUsdCents, costs: dr.costs });
    }
  }
  return groups;
}

function CostGroupList({ costs, serviceName, taskName, descendantRuns }: {
  costs: RunCost[];
  serviceName: string;
  taskName: string;
  descendantRuns: DescendantRun[];
}) {
  const groups = buildCostGroups(costs, serviceName, taskName, descendantRuns);
  if (groups.length === 0) return null;
  if (groups.length === 1 && descendantRuns.length === 0) {
    return (
      <div className="space-y-1">
        {costs.map((cost) => (
          <div key={cost.costName} className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-mono">{cost.costName}</span>
            <span>{formatCostDetailed(cost.totalCostInUsdCents)}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={`${group.serviceName}-${group.taskName}`}>
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-1">
            <span>{group.serviceName} / {group.taskName}</span>
            <span>{formatCostDetailed(group.subtotal)}</span>
          </div>
          <div className="space-y-0.5 pl-3 border-l-2 border-gray-100">
            {group.costs.map((cost) => (
              <div key={cost.costName} className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-mono">{cost.costName}</span>
                <span>{formatCostDetailed(cost.totalCostInUsdCents)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanyLogo({ domain, name }: { domain: string | null; name: string | null }) {
  if (domain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
        alt=""
        className="w-6 h-6 rounded"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

function StatusBadge({ status }: { status: LeadConsolidatedStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>{leadStatusLabel(status)}</span>;
}


function LeadsTable({ leads, selectedLead, onSelectLead }: {
  leads: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">No leads in this tab.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3 hidden sm:table-cell">Status</th>
            <th className="px-4 py-3 hidden md:table-cell">Found</th>
            <th className="px-4 py-3 text-right">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const cost = formatCostRounded(lead.enrichmentRun);
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.id === lead.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo domain={lead.organizationDomain} name={lead.organizationName} />
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">{lead.organizationName || "Unknown"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{lead.firstName} {lead.lastName}</p>
                      {lead.title && <p className="text-xs text-gray-500 truncate max-w-[180px]">{lead.title}</p>}
                    </div>
                    {lead.linkedinUrl && (
                      <span className="text-blue-400 shrink-0">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={getLeadConsolidatedStatus(lead)} /></td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-gray-500" title={new Date(lead.createdAt).toLocaleString()}>{timeAgo(lead.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {cost ? <span className="text-xs font-medium text-gray-600">{cost}</span> : <span className="text-xs text-gray-300">-</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function BrandLeadsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  const { data, isLoading } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const leads = data?.leads ?? [];

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [leads],
  );

  // Group leads by consolidated status
  const groupedByStatus = useMemo(() => {
    const groups = new Map<LeadConsolidatedStatus, Lead[]>();
    for (const status of LEAD_STATUS_ORDER) groups.set(status, []);
    for (const lead of sortedLeads) {
      const s = getLeadConsolidatedStatus(lead);
      groups.get(s)?.push(lead);
    }
    return groups;
  }, [sortedLeads]);

  // Auto-select first non-empty tab
  useEffect(() => {
    if (hasAutoSelectedTab.current || sortedLeads.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = LEAD_STATUS_ORDER.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [sortedLeads.length, groupedByStatus]);

  const activeList = activeTab === "all"
    ? sortedLeads
    : groupedByStatus.get(activeTab) ?? [];

  const filteredLeads = useMemo(() => {
    if (!search) return activeList;
    const q = search.toLowerCase();
    return activeList.filter((l) => {
      const name = `${l.firstName} ${l.lastName}`.toLowerCase();
      return name.includes(q)
        || (l.organizationName?.toLowerCase().includes(q) ?? false)
        || (l.title?.toLowerCase().includes(q) ?? false)
        || (l.email?.toLowerCase().includes(q) ?? false);
    });
  }, [activeList, search]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    ...LEAD_STATUS_ORDER.map((status) => ({
      key: status as Tab,
      label: leadStatusLabel(status),
      count: groupedByStatus.get(status)?.length ?? 0,
    })),
    { key: "all", label: "All", count: sortedLeads.length },
  ];

  const { totalCostCents, avgCostPerContactedCents } = useMemo(() => {
    let total = 0;
    let contactedWithCost = 0;
    let contactedCost = 0;
    for (const lead of leads) {
      if (lead.enrichmentRun) {
        const cents = parseFloat(lead.enrichmentRun.totalCostInUsdCents);
        if (!isNaN(cents)) {
          total += cents;
          if (lead.contacted) { contactedCost += cents; contactedWithCost++; }
        }
      }
    }
    return { totalCostCents: total, avgCostPerContactedCents: contactedWithCost > 0 ? contactedCost / contactedWithCost : 0 };
  }, [leads]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            <span className="ml-2 text-sm font-normal text-gray-500">({leads.length.toLocaleString("en-US")} across all campaigns)</span>
          </h1>
          {totalCostCents > 0 && (
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-800">{formatUsd(totalCostCents)}</p>
              {avgCostPerContactedCents > 0 && (
                <p className="text-xs text-gray-500">{formatUsd(avgCostPerContactedCents)} avg/contacted</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedLead(null); }}
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

        <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by name, company, title, or email..." resultCount={filteredLeads.length} totalCount={activeList.length} />

        {leads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
            <p className="text-gray-600 text-sm">Leads will appear here once campaigns run.</p>
          </div>
        ) : (
          <LeadsTable leads={filteredLeads} selectedLead={selectedLead} onSelectLead={setSelectedLead} />
        )}
      </div>

      {selectedLead && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button onClick={() => setSelectedLead(null)} className="md:hidden flex items-center gap-2 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Lead Details</h2>
            <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600 hidden md:block">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 md:p-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Name:</span><p className="font-medium">{selectedLead.firstName} {selectedLead.lastName}</p></div>
                <div><span className="text-gray-500">Email:</span><p className="font-medium">{selectedLead.email}</p>
                  {selectedLead.emailStatus && <span className={`text-xs px-1.5 py-0.5 rounded ${selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" : selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{selectedLead.emailStatus}</span>}
                </div>
                <div><span className="text-gray-500">Title:</span><p className="font-medium">{selectedLead.title || "-"}</p></div>
                <div><span className="text-gray-500">Status:</span><p className="font-medium"><StatusBadge status={getLeadConsolidatedStatus(selectedLead)} /></p></div>
                {selectedLead.linkedinUrl && <div className="sm:col-span-2"><span className="text-gray-500">LinkedIn:</span><p><a href={selectedLead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{selectedLead.linkedinUrl}</a></p></div>}
              </div>
            </div>
            {(selectedLead.organizationName || selectedLead.organizationDomain || selectedLead.organizationIndustry) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Company:</span><p className="font-medium">{selectedLead.organizationName || "-"}</p></div>
                  <div><span className="text-gray-500">Domain:</span><p className="font-medium">{selectedLead.organizationDomain || "-"}</p></div>
                  <div><span className="text-gray-500">Industry:</span><p className="font-medium">{selectedLead.organizationIndustry || "-"}</p></div>
                  <div><span className="text-gray-500">Size:</span><p className="font-medium">{selectedLead.organizationSize ? `${selectedLead.organizationSize} employees` : "-"}</p></div>
                </div>
              </div>
            )}
            {selectedLead.enrichmentRun && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enrichment Cost</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${selectedLead.enrichmentRun.status === "completed" ? "bg-green-400" : selectedLead.enrichmentRun.status === "failed" ? "bg-red-400" : "bg-yellow-400"}`} />
                  <span>{selectedLead.enrichmentRun.status}</span>
                  {formatDuration(selectedLead.enrichmentRun.startedAt, selectedLead.enrichmentRun.completedAt) && <span>{"\u2022"} {formatDuration(selectedLead.enrichmentRun.startedAt, selectedLead.enrichmentRun.completedAt)}</span>}
                  <span className="ml-auto font-medium text-gray-700">{formatCostDetailed(selectedLead.enrichmentRun.totalCostInUsdCents)}</span>
                </div>
                <CostGroupList costs={selectedLead.enrichmentRun.costs} serviceName={selectedLead.enrichmentRun.serviceName} taskName={selectedLead.enrichmentRun.taskName} descendantRuns={selectedLead.enrichmentRun.descendantRuns} />
                {selectedLead.enrichmentRun.status === "failed" && selectedLead.enrichmentRun.errorSummary && (
                  <div className="mt-3 bg-red-50 border border-red-100 rounded-md p-3">
                    <p className="text-sm text-red-700">{selectedLead.enrichmentRun.errorSummary.rootCause}</p>
                    <p className="text-xs text-red-500 mt-1">Step: <span className="font-mono">{selectedLead.enrichmentRun.errorSummary.failedStep}</span></p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 text-xs text-gray-400">Found: {new Date(selectedLead.createdAt).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
