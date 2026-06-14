"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getLeadConsolidatedStatus, type Lead, type LeadConsolidatedStatus } from "@/lib/api";
import { useCampaign } from "@/lib/campaign-context";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import { EntitySearchBar } from "@/components/entity-search-bar";

const LEAD_STATUS_ORDER: LeadConsolidatedStatus[] = [
  "replied",
  "clicked",
  "opened",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

type Tab = LeadConsolidatedStatus | "all";

function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Clicked";
    case "opened": return "Opened";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    case "contacted": return "Contacted";
    case "served": return "Processing";
    case "skipped": return "Skipped";
    case "claimed": return "Claimed";
    case "buffered": return "Buffered";
  }
}

function leadStatusStyle(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "clicked": return "bg-violet-100 text-violet-700 border-violet-200";
    case "opened": return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "delivered": return "bg-green-100 text-green-700 border-green-200";
    case "sent": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "bounced": return "bg-red-100 text-red-600 border-red-200";
    case "unsubscribed": return "bg-amber-100 text-amber-700 border-amber-200";
    case "contacted": return "bg-teal-100 text-teal-700 border-teal-200";
    case "served": return "bg-orange-100 text-orange-700 border-orange-200";
    case "skipped": return "bg-gray-100 text-gray-500 border-gray-200";
    case "claimed": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "buffered": return "bg-blue-100 text-blue-600 border-blue-200";
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

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

function CompanyLogo({ domain, name }: { domain: string | null; name: string | null }) {
  if (domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=32`}
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


function LeadsTable({
  leads,
  selectedLead,
  onSelectLead,
  statusOf,
}: {
  leads: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  statusOf: (lead: Lead) => LeadConsolidatedStatus;
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const full = lead.lead;
            const org = full?.organization ?? null;
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`cursor-pointer hover:bg-gray-50 transition ${
                  selectedLead?.id === lead.id ? 'bg-brand-50' : ''
                }`}
              >
                {/* Company */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo domain={org?.primaryDomain ?? null} name={org?.name ?? null} />
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">
                      {org?.name || "Unknown"}
                    </span>
                  </div>
                </td>

                {/* Contact */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {full?.firstName ?? ""} {full?.lastName ?? ""}
                      </p>
                      {full?.headline && (
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{full.headline}</p>
                      )}
                    </div>
                    {full?.linkedinUrl && (
                      <span className="text-blue-400 shrink-0">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3 hidden sm:table-cell">
                  <StatusBadge status={statusOf(lead)} />
                </td>

                {/* Found date */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {lead.servedAt ? (
                    <span
                      className="text-xs text-gray-500"
                      title={new Date(lead.servedAt).toLocaleString()}
                    >
                      {timeAgo(lead.servedAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CampaignLeadsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);
  const { leads, leadsLoading: isLoading } = useCampaign();

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => {
      const aTime = a.servedAt ? new Date(a.servedAt).getTime() : 0;
      const bTime = b.servedAt ? new Date(b.servedAt).getTime() : 0;
      return bTime - aTime;
    }),
    [leads]
  );

  // Monotonic status latch — see the feature-level leads page / use-monotonic-status.ts.
  // The campaign leads share the same email-gateway delivery overlay, so a transient
  // poll dropout would otherwise empty the viewed tab. Keep the most-advanced status
  // seen this mount; `statusOf` is the single source the table, tabs, and panel bucket on.
  const statusEntries = useMemo(
    () => sortedLeads.map((l) => ({ id: l.id, status: getLeadConsolidatedStatus(l) })),
    [sortedLeads],
  );
  const latchedStatus = useMonotonicStatuses(statusEntries, LEAD_STATUS_ORDER, "campaign-leads");
  const statusOf = (lead: Lead): LeadConsolidatedStatus =>
    (latchedStatus.get(lead.id) as LeadConsolidatedStatus | undefined) ?? getLeadConsolidatedStatus(lead);

  const groupedByStatus = useMemo(() => {
    const groups = new Map<LeadConsolidatedStatus, Lead[]>();
    for (const status of LEAD_STATUS_ORDER) groups.set(status, []);
    for (const lead of sortedLeads) {
      const s = statusOf(lead);
      groups.get(s)?.push(lead);
    }
    return groups;
  }, [sortedLeads, latchedStatus]);

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
      const full = l.lead;
      const name = `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.toLowerCase();
      return name.includes(q)
        || (full?.organization?.name?.toLowerCase().includes(q) ?? false)
        || (full?.headline?.toLowerCase().includes(q) ?? false)
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

  if (isLoading && leads.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-32 bg-gray-200 rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const selectedFull = selectedLead?.lead ?? null;
  const selectedOrg = selectedFull?.organization ?? null;

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      {/* Lead Table */}
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            <span className="ml-2 text-sm font-normal text-gray-500">({leads.length.toLocaleString("en-US")})</span>
          </h1>
        </div>

        {/* Tabs */}
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
            <div className="text-4xl mb-4">&#128101;</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
            <p className="text-gray-600 text-sm">Leads will appear here once the campaign runs.</p>
          </div>
        ) : (
          <LeadsTable
            leads={filteredLeads}
            selectedLead={selectedLead}
            onSelectLead={setSelectedLead}
            statusOf={statusOf}
          />
        )}
      </div>

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedLead(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Lead Details</h2>
            <button
              onClick={() => setSelectedLead(null)}
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-4 md:p-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Name:</span>
                  <p className="font-medium">{selectedFull?.firstName ?? ""} {selectedFull?.lastName ?? ""}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p className="font-medium">{selectedLead.email}</p>
                  {selectedLead.emailStatus && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" :
                      selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {selectedLead.emailStatus}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-500">Title:</span>
                  <p className="font-medium">{selectedFull?.headline || "-"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p className="font-medium flex items-center gap-1.5 flex-wrap">
                    <StatusBadge status={statusOf(selectedLead)} />
                    {selectedLead.global?.bounced && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">Global Bounced</span>
                    )}
                    {selectedLead.global?.unsubscribed && (
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Global Unsubscribed</span>
                    )}
                  </p>
                </div>
                {selectedFull?.linkedinUrl && (
                  <div className="sm:col-span-2">
                    <span className="text-gray-500">LinkedIn:</span>
                    <p>
                      <a
                        href={selectedFull.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm"
                      >
                        {selectedFull.linkedinUrl}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Organization Info */}
            {selectedOrg && (selectedOrg.name || selectedOrg.primaryDomain || selectedOrg.industry) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Company:</span>
                    <p className="font-medium">{selectedOrg.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Domain:</span>
                    <p className="font-medium">{selectedOrg.primaryDomain || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Industry:</span>
                    <p className="font-medium">{selectedOrg.industry || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <p className="font-medium">{selectedOrg.estimatedNumEmployees != null ? `${selectedOrg.estimatedNumEmployees} employees` : "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            {selectedLead.servedAt && (
              <div className="mt-4 text-xs text-gray-400">
                Served: {new Date(selectedLead.servedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
