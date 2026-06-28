"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import {
  listBrandLeads,
  getLeadConsolidatedStatus,
  getAudienceMembershipStats,
  listAudiences,
  getBrandSalesEconomics,
  type Lead,
  type LeadConsolidatedStatus,
} from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { Skeleton } from "@/components/skeleton";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";

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

type Tab = "positive-replies" | "clicks" | "opens" | "outreach" | "all";

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

// Shared logo.dev token (also used in `BrandLogo`, public
// `components/report/leads-table.tsx`, and the landing's
// `provider-avatar.tsx`). Replaces the old Google S2 favicons surface to
// keep the company-avatar treatment consistent across the whole app.
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

// Per-lead audience (name from human-service membership stats, avatar joined
// from `listAudiences`). Null when the lead's email matches no active audience.
type LeadAudience = { name: string; avatarUrl: string | null };

function AudienceCell({ audience }: { audience: LeadAudience | null }) {
  if (!audience) return <span className="text-xs text-gray-300">-</span>;
  return (
    <div className="flex items-center gap-2">
      {audience.avatarUrl ? (
        <img
          src={audience.avatarUrl}
          alt=""
          className="w-6 h-6 rounded object-cover bg-white border border-gray-200 shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="w-6 h-6 rounded bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0">
          {audience.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-gray-700">{audience.name}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: LeadConsolidatedStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>{leadStatusLabel(status)}</span>;
}

function LeadsLoadingSkeleton() {
  return (
    <>
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-2">
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-full rounded-lg" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_8rem_7rem_5rem] gap-4 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
              <Skeleton className="hidden h-4 w-12 rounded md:block" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LeadsTable({ leads, selectedLead, onSelectLead, statusOf, audienceOf }: {
  leads: Lead[];
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  statusOf: (lead: Lead) => LeadConsolidatedStatus;
  audienceOf: (lead: Lead) => LeadAudience | null;
}) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">No leads in this tab.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3 hidden md:table-cell">Audience</th>
            <th className="px-4 py-3 hidden sm:table-cell">Status</th>
            <th className="px-4 py-3 hidden md:table-cell">Date</th>
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
                className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.id === lead.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo domain={org?.primaryDomain ?? null} name={org?.name ?? null} />
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">{org?.name || "Unknown"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{full?.firstName ?? ""} {full?.lastName ?? ""}</p>
                      {full?.headline && <p className="text-xs text-gray-500 truncate max-w-[180px]">{full.headline}</p>}
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
                <td className="px-4 py-3 hidden md:table-cell"><AudienceCell audience={audienceOf(lead)} /></td>
                <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={statusOf(lead)} /></td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {lead.firstClickedAt ? (
                    <span className="text-xs text-gray-500" title={new Date(lead.firstClickedAt).toLocaleString()}>{timeAgo(lead.firstClickedAt)}</span>
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

export function EngagedLeadsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("positive-replies");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  const { data, isPending, isPlaceholderData } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  const leads = useMemo(() => data?.leads ?? [], [data]);

  // Brand optimization goal drives the default tab: signups → Website visits,
  // sales_meetings (server default when unset) → Positive replies.
  const { data: econData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    {},
  );
  const optimizationGoal = econData?.salesEconomics?.optimizationGoal ?? null;

  // Audience per lead — human-service owns the email → audience membership
  // (name); `listAudiences` supplies the avatar. Joined client-side, fetched
  // on-demand off the engaged leads' emails (no widening of `listBrandLeads`).
  const engagedEmails = useMemo(
    () => Array.from(new Set(
      leads
        .filter((l) => l.clicked || l.replyClassification === "positive")
        .map((l) => l.email)
        .filter((e): e is string => !!e),
    )),
    [leads],
  );
  const { data: audStatsData } = useAuthQuery(
    ["audienceStats", brandId, engagedEmails],
    () => getAudienceMembershipStats({ emails: engagedEmails }),
    { enabled: engagedEmails.length > 0 },
  );
  const { data: audiencesData } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId),
    {},
  );
  const audienceByEmail = useMemo(() => {
    const avatarById = new Map(
      (audiencesData?.audiences ?? []).map((a) => [a.id, a.avatarUrl] as const),
    );
    const map = new Map<string, LeadAudience>();
    for (const m of audStatsData?.matched ?? []) {
      const first = m.audiences[0];
      if (!m.emailNorm || !first) continue;
      map.set(m.emailNorm.toLowerCase(), {
        name: first.name,
        avatarUrl: avatarById.get(first.audienceId) ?? null,
      });
    }
    return map;
  }, [audStatsData, audiencesData]);
  const audienceOf = (lead: Lead): LeadAudience | null =>
    lead.email ? audienceByEmail.get(lead.email.toLowerCase()) ?? null : null;

  // Sort by the Date column shown in the table (`firstClickedAt`), most recent
  // first. Leads with no click date sink to the bottom (null → 0).
  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => {
      const aTime = a.firstClickedAt ? new Date(a.firstClickedAt).getTime() : 0;
      const bTime = b.firstClickedAt ? new Date(b.firstClickedAt).getTime() : 0;
      return bTime - aTime;
    }),
    [leads],
  );

  // Monotonic status latch: each lead's tab is derived from the email-gateway
  // delivery overlay, which can transiently drop on a poll and bounce a lead
  // back to "Processing" — emptying the tab being viewed, then repopulating.
  // Engagement is append-only, so a less-advanced status on a later poll is a
  // stale read: keep the most-advanced status seen this mount (see #1257 latch
  // philosophy). `statusOf` is the single source the table, tabs, and side
  // panel all bucket on.
  const statusEntries = useMemo(
    () => sortedLeads.map((l) => ({ id: l.id, status: getLeadConsolidatedStatus(l) })),
    [sortedLeads],
  );
  const latchedStatus = useMonotonicStatuses(statusEntries, LEAD_STATUS_ORDER, "leads");
  const statusOf = (lead: Lead): LeadConsolidatedStatus =>
    (latchedStatus.get(lead.id) as LeadConsolidatedStatus | undefined) ?? getLeadConsolidatedStatus(lead);

  const groupedByTab = useMemo(() => {
    const groups = new Map<Tab, Lead[]>();
    groups.set("positive-replies", []);
    groups.set("clicks", []);
    groups.set("opens", []);
    groups.set("outreach", []);
    groups.set("all", sortedLeads);
    for (const lead of sortedLeads) {
      if (lead.replyClassification === "positive") groups.get("positive-replies")?.push(lead);
      if (lead.clicked) groups.get("clicks")?.push(lead);
      if (lead.opened) groups.get("opens")?.push(lead);
      if (lead.contacted) groups.get("outreach")?.push(lead);
    }
    return groups;
  }, [sortedLeads]);

  // Open the tab matching what the brand optimizes for (once, after leads + the
  // goal have loaded). User manual tab switches latch the ref and are never
  // overridden by a later poll. Honors the goal tab even when empty.
  useEffect(() => {
    if (hasAutoSelectedTab.current) return;
    if (sortedLeads.length === 0 || optimizationGoal === null) return;
    hasAutoSelectedTab.current = true;
    setActiveTab(optimizationGoal === "signups" ? "clicks" : "positive-replies");
  }, [sortedLeads.length, optimizationGoal]);

  const activeList = groupedByTab.get(activeTab) ?? sortedLeads;

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
    { key: "positive-replies", label: "Positive replies", count: groupedByTab.get("positive-replies")?.length ?? 0 },
    { key: "clicks", label: "Clicks", count: groupedByTab.get("clicks")?.length ?? 0 },
    { key: "opens", label: "Opens", count: groupedByTab.get("opens")?.length ?? 0 },
    { key: "outreach", label: "Outreach", count: groupedByTab.get("outreach")?.length ?? 0 },
    { key: "all", label: "All", count: sortedLeads.length },
  ];

  // Static-shell-first (CLAUDE.md "Page composition: shell+nav+header render
  // instantly; each card owns its skeleton"). The shell (stat cards, h1, tabs,
  // search) paints immediately; only the table region skeletons while the slow
  // `brandLeads` fetch (lead-service is the bottleneck) is still cold. Gating the
  // WHOLE page on this blanked the screen for the entire load.
  const loading = isPending || isPlaceholderData;

  const selectedFull = selectedLead?.lead ?? null;
  const selectedOrg = selectedFull?.organization ?? null;

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <OutreachStatCardsAuto />
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            {loading ? (
              <Skeleton className="ml-2 inline-block h-4 w-56 align-middle" />
            ) : (
              <span className="ml-2 text-sm font-normal text-gray-500">({leads.length.toLocaleString("en-US")} leads)</span>
            )}
          </h1>
        </div>

        {loading ? (
          <LeadsLoadingSkeleton />
        ) : (
          <>
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
                <p className="text-gray-600 text-sm">Leads appear here once outreach starts.</p>
              </div>
            ) : (
              <LeadsTable leads={filteredLeads} selectedLead={selectedLead} onSelectLead={setSelectedLead} statusOf={statusOf} audienceOf={audienceOf} />
            )}
          </>
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
                <div><span className="text-gray-500">Name:</span><p className="font-medium">{selectedFull?.firstName ?? ""} {selectedFull?.lastName ?? ""}</p></div>
                <div><span className="text-gray-500">Email:</span><p className="font-medium">{selectedLead.email}</p>
                  {selectedLead.emailStatus && <span className={`text-xs px-1.5 py-0.5 rounded ${selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" : selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{selectedLead.emailStatus}</span>}
                </div>
                <div><span className="text-gray-500">Title:</span><p className="font-medium">{selectedFull?.headline || "-"}</p></div>
                <div><span className="text-gray-500">Status:</span><p className="font-medium flex items-center gap-1.5 flex-wrap"><StatusBadge status={statusOf(selectedLead)} />{selectedLead.global?.bounced && <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">Global Bounced</span>}{selectedLead.global?.unsubscribed && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Global Unsubscribed</span>}</p></div>
                {selectedFull?.linkedinUrl && <div className="sm:col-span-2"><span className="text-gray-500">LinkedIn:</span><p><a href={selectedFull.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{selectedFull.linkedinUrl}</a></p></div>}
              </div>
            </div>
            {selectedOrg && (selectedOrg.name || selectedOrg.primaryDomain || selectedOrg.industry) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Company:</span><p className="font-medium">{selectedOrg.name || "-"}</p></div>
                  <div><span className="text-gray-500">Domain:</span><p className="font-medium">{selectedOrg.primaryDomain || "-"}</p></div>
                  <div><span className="text-gray-500">Industry:</span><p className="font-medium">{selectedOrg.industry || "-"}</p></div>
                  <div><span className="text-gray-500">Size:</span><p className="font-medium">{selectedOrg.estimatedNumEmployees != null ? `${selectedOrg.estimatedNumEmployees} employees` : "-"}</p></div>
                </div>
              </div>
            )}
            {selectedLead.servedAt && (
              <div className="mt-4 text-xs text-gray-400">Served: {new Date(selectedLead.servedAt).toLocaleString()}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
