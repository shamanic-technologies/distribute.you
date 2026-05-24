"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { WorkflowTag } from "./workflow-tag";
import type { LeadRow, LeadEmailSummary } from "./leads-table";

/**
 * Public-report leads view — bespoke client component that mirrors the
 * operator-side `(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/leads/page.tsx`
 * layout: flex container with a left list and an in-container right side
 * panel (NOT a modal drawer). Mutually-exclusive tabs by max-milestone via
 * the pre-computed `LeadRow.status` field (the consolidated status — same
 * function the internal page uses).
 *
 * Replaces the previous `<LeadsTable>` (ReportTable wrapper + DataDrawer
 * modal), which suffered from a tab-change bug: TABS used boolean
 * predicates (`r.replied`, `r.clicked`, …), so a replied lead matched
 * every milestone tab simultaneously. Switching tabs visually showed
 * mostly the same rows in the same order. Internal page's `groupedByStatus`
 * pattern keys each lead by its single max milestone — each lead lives in
 * exactly one milestone tab.
 *
 * Data is pre-fetched server-side and embedded into each `LeadRow`
 * (including `emails[]`, `globalBounced`, `globalUnsubscribed`,
 * `companyEmployees`). No client-side polling — public report is ISR-
 * cached for 4h; the recipient sees a snapshot, not a live feed.
 */

// Tab order: replied first (most-engaged), buffered last (not yet served).
// Matches the internal page's LEAD_STATUS_ORDER 1:1 — recipient and
// operator see the same milestone columns in the same order.
const LEAD_STATUS_ORDER: ReadonlyArray<LeadRow["status"]> = [
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

type Tab = LeadRow["status"] | "all";

// Capitalized labels for each status. Public-side override: `served` shows
// "Served" (operator labels it "Processing"); see PR #1165 history.
function leadStatusLabel(status: string): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Clicked";
    case "opened": return "Opened";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    case "contacted": return "Contacted";
    case "served": return "Served";
    case "skipped": return "Skipped";
    case "claimed": return "Claimed";
    case "buffered": return "Buffered";
    default: return status;
  }
}

// Per-status badge palette mirrored from the operator-side
// `leadStatusStyle()`. Sites that touch this map: the internal leads page,
// this view, and `report-table.tsx` (StatusBadge — used by other report
// tables). Keep the three in sync.
function leadStatusStyle(status: string): string {
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
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

// "X time ago" — inline so we don't pull in date-fns (not a dashboard dep).
// Shared by the table cell and the side panel's Served timestamp.
function timeAgo(date: string | null): string {
  if (!date) return "—";
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return "—";
  const seconds = Math.floor((Date.now() - then) / 1000);
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

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  const [error, setError] = useState(false);
  if (!error && domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=32`}
        alt=""
        width={24}
        height={24}
        className="w-6 h-6 rounded"
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>
      {leadStatusLabel(status)}
    </span>
  );
}

interface PublicLeadsViewProps {
  rows: LeadRow[];
}

export function PublicLeadsView({ rows }: PublicLeadsViewProps) {
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  // Pre-sort by servedAt desc (most-recently intaken first). Internal page
  // uses the same global sort; per-tab sortValue overrides shipped in PR
  // #1172 are dropped here because the new tabs are mutually exclusive —
  // every row in a milestone tab has the same milestone, so the sort key
  // reduces to one global order.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const aTime = a.servedAt ? new Date(a.servedAt).getTime() : 0;
      const bTime = b.servedAt ? new Date(b.servedAt).getTime() : 0;
      return bTime - aTime;
    }),
    [rows],
  );

  // Bucket each row by its single consolidated max-milestone status.
  // Replied → Replied tab only (NOT also Clicked / Opened / Delivered / Sent).
  // Internal page uses exactly this pattern (`getLeadConsolidatedStatus`).
  const groupedByStatus = useMemo(() => {
    const groups = new Map<string, LeadRow[]>();
    for (const status of LEAD_STATUS_ORDER) groups.set(status, []);
    for (const row of sortedRows) {
      const list = groups.get(row.status);
      if (list) list.push(row);
    }
    return groups;
  }, [sortedRows]);

  // Auto-pick the leftmost non-empty tab on first paint. Once the user
  // picks any tab, leave it alone even if its count later drops to 0 —
  // honest signal beats auto-jumping.
  useEffect(() => {
    if (hasAutoSelectedTab.current || sortedRows.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = LEAD_STATUS_ORDER.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [sortedRows.length, groupedByStatus]);

  const activeList = activeTab === "all"
    ? sortedRows
    : groupedByStatus.get(activeTab) ?? [];

  const filteredLeads = useMemo(() => {
    if (!search) return activeList;
    const q = search.toLowerCase();
    return activeList.filter((r) => {
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      return name.includes(q)
        || r.company.toLowerCase().includes(q)
        || r.title.toLowerCase().includes(q)
        || r.email.toLowerCase().includes(q)
        || r.workflow.toLowerCase().includes(q);
    });
  }, [activeList, search]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    ...LEAD_STATUS_ORDER.map((status) => ({
      key: status as Tab,
      label: leadStatusLabel(status),
      count: groupedByStatus.get(status)?.length ?? 0,
    })),
    { key: "all", label: "All", count: sortedRows.length },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[60vh] relative">
      {/* Left column — tabs + search + table. Collapses on desktop when a
          row is selected (right panel takes the other 50%); on mobile, the
          right panel covers the list entirely. */}
      <div className={`${selected ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-6 overflow-y-auto transition-all`}>
        <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
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

        <EntitySearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, company, title, email, or workflow…"
          resultCount={filteredLeads.length}
          totalCount={activeList.length}
        />

        {sortedRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
            <p className="text-gray-600 text-sm">Leads will appear here once campaigns run.</p>
          </div>
        ) : (
          <PublicLeadsTable leads={filteredLeads} selectedLead={selected} onSelectLead={setSelected} />
        )}
      </div>

      {selected && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-2 text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Lead Details</h2>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="text-gray-400 hover:text-gray-600 hidden md:block"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidePanel row={selected} />
        </div>
      )}
    </div>
  );
}

function PublicLeadsTable({
  leads,
  selectedLead,
  onSelectLead,
}: {
  leads: LeadRow[];
  selectedLead: LeadRow | null;
  onSelectLead: (lead: LeadRow) => void;
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
          {leads.map((row) => (
            <tr
              key={row.email}
              onClick={() => onSelectLead(row)}
              className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.email === row.email ? 'bg-brand-50' : ''}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <CompanyLogo domain={row.companyDomain} name={row.company} />
                  <span className="font-medium text-gray-800 truncate max-w-[160px]">{row.company || "Unknown"}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{row.firstName} {row.lastName}</p>
                    {row.title && (
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">{row.title}</p>
                    )}
                  </div>
                  {row.linkedinUrl && (
                    <span className="text-blue-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                      </svg>
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {row.servedAt ? (
                  <span
                    className="text-xs text-gray-500"
                    title={new Date(row.servedAt).toLocaleString()}
                  >
                    {timeAgo(row.servedAt)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-300">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Right side panel content — Lead summary card + Organization card +
// optional Emails-sent block (server-embedded in row.emails[]) + Served
// timestamp footer. Mirrors the internal page's right panel 1:1.
function SidePanel({ row }: { row: LeadRow }) {
  const hasOrg = row.company || row.companyDomain || row.industry;
  return (
    <div className="p-4 md:p-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Name" value={`${row.firstName} ${row.lastName}`.trim() || "—"} />
          <div>
            <span className="text-gray-500">Email:</span>
            <p className="font-medium break-all">{row.email}</p>
            {row.emailStatus && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  row.emailStatus === "verified"
                    ? "bg-green-100 text-green-700"
                    : row.emailStatus === "guessed"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {row.emailStatus}
              </span>
            )}
          </div>
          <Field label="Title" value={row.title || "—"} />
          <div>
            <span className="text-gray-500">Status:</span>
            <p className="font-medium flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={row.status} />
              {row.globalBounced && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                  Global Bounced
                </span>
              )}
              {row.globalUnsubscribed && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  Global Unsubscribed
                </span>
              )}
            </p>
          </div>
          {row.workflow && (
            <div className="sm:col-span-2">
              <span className="text-gray-500">Workflow:</span>
              <p className="mt-1"><WorkflowTag name={row.workflow} /></p>
            </div>
          )}
          {row.linkedinUrl && (
            <div className="sm:col-span-2">
              <span className="text-gray-500">LinkedIn:</span>
              <p>
                <a
                  href={row.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm break-all"
                >
                  {row.linkedinUrl}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {hasOrg && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Field label="Company" value={row.company || "—"} />
            <Field label="Domain" value={row.companyDomain || "—"} />
            <Field label="Industry" value={row.industry || "—"} />
            <Field
              label="Size"
              value={row.companyEmployees != null ? `${row.companyEmployees.toLocaleString("en-US")} employees` : "—"}
            />
          </div>
        </div>
      )}

      {row.emails.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            {row.emails.length > 1 ? `Emails sent (${row.emails.length})` : "Email sent"}
          </h3>
          <EmailsList emails={row.emails} />
        </div>
      )}

      {row.servedAt && (
        <div className="mt-4 text-xs text-gray-400">
          Served: {new Date(row.servedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function EmailsList({ emails }: { emails: LeadEmailSummary[] }) {
  return (
    <div className="space-y-4">
      {emails.map((e, i) => (
        <div key={i} className="space-y-1.5">
          <div className="text-xs text-gray-500">
            {new Date(e.sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {e.workflow && <> · <WorkflowTag name={e.workflow} /></>}
          </div>
          <div className="font-medium text-gray-800">
            {e.subject || <em className="text-gray-500">(no subject)</em>}
          </div>
          {e.bodyText && (
            <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">
              {e.bodyText}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
