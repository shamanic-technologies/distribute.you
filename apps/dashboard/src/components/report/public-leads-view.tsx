"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { EmailSignature } from "@/components/email-signature";
import { WorkflowTag } from "./workflow-tag";
import type { LeadRow, LeadEmailSummary } from "./leads-table";
import {
  bucketRowsByStatus,
  type PublicReportStatus,
} from "@/lib/public-report-bucketing";
import { usePaginated, TablePager } from "@/components/table-pagination";

/**
 * Public-report leads view — bespoke client component that mirrors the
 * operator-side leads page layout: flex container with a left list and an
 * in-container right side panel (NOT a modal drawer).
 *
 * Tabs are CUMULATIVE / multi-status: every lead appears in every funnel
 * bucket whose boolean flag is true (a clicked lead lives in Clicked AND
 * Opened AND Delivered AND Sent). This matches the backend's `leads*`
 * stats (also cumulative) so per-tab counts equal the funnel counts shown
 * on the overview page. Intake buckets (Served / Buffered / Skipped /
 * Claimed) key on `intakeStatus` so a lead stays in its intake tab even
 * after progressing through the funnel.
 *
 * Note: this diverges from the operator-side `getLeadConsolidatedStatus`
 * max-milestone bucketing on purpose; operator UI expects each lead in
 * one tab, public report optimizes for "funnel and tab counts match".
 *
 * Data is pre-fetched server-side and embedded into each `LeadRow`. No
 * client-side polling — public report is ISR-cached for 4h.
 */

// Tab order: most-engaged first. Boolean funnel tabs precede intake tabs
// because a sent / opened / replied lead is more interesting to a viewer
// than a buffered one.
const LEAD_STATUS_ORDER: ReadonlyArray<PublicReportStatus> = [
  "positive-reply",
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

type Tab = PublicReportStatus | "all";

// Capitalized labels for each status. Public-side override: `served` shows
// "Served" (operator labels it "Processing"); see PR #1165 history.
// `positive-reply` matches the funnel's "Leads Positive" stage — every
// lead bucketed here also appears in Sent / Delivered / Opened / Clicked,
// so we never need a separate "Replied" tab.
function leadStatusLabel(status: string): string {
  switch (status) {
    case "positive-reply": return "Positive reply";
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
    case "replied": return "Replied";
    default: return status;
  }
}

// Per-status badge palette mirrored from the operator-side
// `leadStatusStyle()`. Sites that touch this map: the internal leads page,
// this view, and `report-table.tsx` (StatusBadge — used by other report
// tables). Keep the three in sync.
function leadStatusStyle(status: string): string {
  switch (status) {
    case "positive-reply": return "bg-emerald-100 text-emerald-700 border-emerald-200";
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
  /** Base URL of the lazy email-fetch Route Handler, e.g.
   *  `/api/report/${orgId}/${brandId}/${featureSlug}/lead-emails`. The
   *  drawer's emails section hits this on first open of each lead and
   *  caches the response in-process so reopening is instant. */
  emailsApiUrl: string;
}

export function PublicLeadsView({ rows, emailsApiUrl }: PublicLeadsViewProps) {
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("contacted");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  // Defer the heavy work (re-bucketing the active list + re-running the
  // search filter + re-rendering up to 5,000 rows) so the tab pill /
  // search input updates feel instant. React keeps showing the previous
  // table while computing the next one; `isStale` flips true during the
  // pending commit so we can swap in a skeleton instead.
  const deferredTab = useDeferredValue(activeTab);
  const deferredSearch = useDeferredValue(search);
  const isStale = deferredTab !== activeTab || deferredSearch !== search;

  // Pre-sort by servedAt desc (most-recently intaken first).
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => {
      const aTime = a.servedAt ? new Date(a.servedAt).getTime() : 0;
      const bTime = b.servedAt ? new Date(b.servedAt).getTime() : 0;
      return bTime - aTime;
    }),
    [rows],
  );

  // Bucket cumulatively: a lead with sent=true appears in the Sent tab
  // regardless of whether it later got clicked / replied. Tab counts
  // therefore equal the funnel's lead* stats (which are also cumulative).
  const groupedByStatus = useMemo(
    () => bucketRowsByStatus(sortedRows, LEAD_STATUS_ORDER),
    [sortedRows],
  );

  // Auto-pick the leftmost non-empty tab on first paint. Once the user
  // picks any tab, leave it alone even if its count later drops to 0 —
  // honest signal beats auto-jumping.
  useEffect(() => {
    if (hasAutoSelectedTab.current || sortedRows.length === 0) return;
    hasAutoSelectedTab.current = true;
    const first = LEAD_STATUS_ORDER.find((s) => (groupedByStatus.get(s)?.length ?? 0) > 0);
    if (first) setActiveTab(first);
  }, [sortedRows.length, groupedByStatus]);

  // activeList + filteredLeads are derived from the DEFERRED state so the
  // pending heavy re-render is decoupled from the urgent UI update. The
  // table briefly shows the previous tab's data (we mask it with a
  // skeleton when `isStale` is true) while React commits the new one.
  const activeList = deferredTab === "all"
    ? sortedRows
    : groupedByStatus.get(deferredTab) ?? [];

  const filteredLeads = useMemo(() => {
    if (!deferredSearch) return activeList;
    const q = deferredSearch.toLowerCase();
    return activeList.filter((r) => {
      const name = `${r.firstName} ${r.lastName}`.toLowerCase();
      return name.includes(q)
        || r.company.toLowerCase().includes(q)
        || r.title.toLowerCase().includes(q)
        || r.email.toLowerCase().includes(q)
        || r.workflow.toLowerCase().includes(q);
    });
  }, [activeList, deferredSearch]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    ...LEAD_STATUS_ORDER.map((status) => ({
      key: status as Tab,
      label: leadStatusLabel(status),
      count: groupedByStatus.get(status)?.length ?? 0,
    })),
    { key: "all", label: "All", count: sortedRows.length },
  ];

  // Paginate the filtered list (20/page). Reset to page 1 whenever the tab or
  // search changes so the viewer never lands mid-list of a different bucket.
  const { pageItems, page, setPage, pageCount, total, from, to } = usePaginated(filteredLeads);
  useEffect(() => {
    setPage(0);
  }, [deferredTab, deferredSearch, setPage]);

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
        ) : isStale ? (
          <LeadsTableSkeleton />
        ) : (
          <>
            <PublicLeadsTable leads={pageItems} selectedLead={selected} onSelectLead={setSelected} />
            {pageCount > 1 && (
              <div className="mt-3 bg-white rounded-xl border border-gray-200">
                <TablePager
                  page={page}
                  pageCount={pageCount}
                  from={from}
                  to={to}
                  total={total}
                  onPage={setPage}
                />
              </div>
            )}
          </>
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
          <SidePanel row={selected} emailsApiUrl={emailsApiUrl} />
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
    // overflow-x-auto on the card lets the user swipe horizontally on
    // narrow viewports instead of having columns either disappear or
    // collapse into unreadable cells.
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 whitespace-nowrap">Company</th>
            <th className="px-4 py-3 whitespace-nowrap">Contact</th>
            <th className="px-4 py-3 whitespace-nowrap">Status</th>
            <th className="px-4 py-3 whitespace-nowrap">Found</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((row) => (
            <tr
              key={row.email}
              onClick={() => onSelectLead(row)}
              className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.email === row.email ? 'bg-brand-50' : ''}`}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2.5">
                  <CompanyLogo domain={row.companyDomain} name={row.company} />
                  <span className="font-medium text-gray-800 truncate max-w-[200px]">{row.company || "Unknown"}</span>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{row.firstName} {row.lastName}</p>
                    {row.title && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{row.title}</p>
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
              <td className="px-4 py-3 whitespace-nowrap">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
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

// Skeleton swapped in while `useDeferredValue` is still computing the
// next tab/search bucket. 10 rows, 4 columns, matching the live table's
// row geometry so the swap doesn't shift surrounding layout. Bars use
// `bg-gray-200` (not `bg-gray-100`) because `animate-pulse` cycles
// opacity 1 → 0.5 → 1; against the white card, gray-100 at half opacity
// is effectively invisible, producing the "no skeleton, just blank
// lines" report. gray-200 stays visible across the full pulse cycle.
function LeadsTableSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 whitespace-nowrap">Company</th>
            <th className="px-4 py-3 whitespace-nowrap">Contact</th>
            <th className="px-4 py-3 whitespace-nowrap">Status</th>
            <th className="px-4 py-3 whitespace-nowrap">Found</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {Array.from({ length: 10 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded bg-gray-200 animate-pulse flex-shrink-0" />
                  <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-2.5 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
              </td>
              <td className="px-4 py-3">
                <div className="h-3.5 w-14 bg-gray-200 rounded animate-pulse" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Right side panel content — Lead summary card + Organization card +
// lazy-loaded Emails-sent block + Served timestamp footer. Mirrors the
// internal page's right panel 1:1.
function SidePanel({ row, emailsApiUrl }: { row: LeadRow; emailsApiUrl: string }) {
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

      <LeadEmailsCard
        apiUrl={emailsApiUrl}
        campaignId={row.campaignId}
        firstName={row.firstName}
        lastName={row.lastName}
      />


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

// Module-level cache so reopening the same lead's drawer is instant.
// Key: `${campaignId}::${firstName.lower}::${lastName.lower}`. We also
// store the in-flight Promise so two near-simultaneous opens of the
// same lead don't trigger two fetches.
type EmailsState =
  | { status: "loading"; promise: Promise<LeadEmailSummary[]> }
  | { status: "ready"; emails: LeadEmailSummary[] }
  | { status: "error"; error: string };

const emailsCache = new Map<string, EmailsState>();

function leadCacheKey(campaignId: string, firstName: string, lastName: string): string {
  return `${campaignId}::${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
}

function LeadEmailsCard({
  apiUrl,
  campaignId,
  firstName,
  lastName,
}: {
  apiUrl: string;
  campaignId: string;
  firstName: string;
  lastName: string;
}) {
  const cacheKey = leadCacheKey(campaignId, firstName, lastName);
  const cached = emailsCache.get(cacheKey);
  const initial: EmailsState =
    cached && cached.status === "ready"
      ? cached
      : { status: "loading", promise: Promise.resolve([]) };
  const [state, setState] = useState<EmailsState>(initial);

  useEffect(() => {
    const existing = emailsCache.get(cacheKey);
    if (existing && existing.status === "ready") {
      setState(existing);
      return;
    }
    if (existing && existing.status === "loading") {
      existing.promise
        .then((emails) => setState({ status: "ready", emails }))
        .catch((err) => setState({ status: "error", error: String(err) }));
      return;
    }

    const params = new URLSearchParams({
      campaignId,
      firstName,
      lastName,
    });
    const promise = fetch(`${apiUrl}?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { emails: LeadEmailSummary[] };
        return data.emails ?? [];
      });

    emailsCache.set(cacheKey, { status: "loading", promise });
    setState({ status: "loading", promise });

    promise
      .then((emails) => {
        emailsCache.set(cacheKey, { status: "ready", emails });
        setState({ status: "ready", emails });
      })
      .catch((err) => {
        emailsCache.set(cacheKey, { status: "error", error: String(err) });
        setState({ status: "error", error: String(err) });
      });
  }, [apiUrl, cacheKey, campaignId, firstName, lastName]);

  if (state.status === "loading") {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Emails</h3>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-3.5 w-56 bg-gray-200 rounded animate-pulse" />
              <div className="h-16 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Emails</h3>
        <p className="text-xs text-gray-500">Failed to load emails.</p>
      </div>
    );
  }

  if (state.emails.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
        {state.emails.length > 1 ? `Emails sent (${state.emails.length})` : "Email sent"}
      </h3>
      <EmailsList emails={state.emails} />
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
              <EmailSignature className="text-xs text-gray-500" />
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
