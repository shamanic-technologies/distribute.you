"use client";

import { useState } from "react";
import { ReportTable, type ReportTableColumn, type TabSpec } from "./report-table";
// `status` is still surfaced in the row drawer; we no longer render it as a
// column because the active tab already conveys the milestone — and a row
// with a more-advanced status (e.g. replied) appearing in a less-advanced
// tab (e.g. opened) made the badge look mismatched.
import type { DrawerEntry } from "./data-drawer";
import { WorkflowTag } from "./workflow-tag";

// Shared logo.dev token used across the dashboard (matches `BrandLogo` and
// `apps/landing/src/components/provider-avatar.tsx`). `logo.dev` returns a
// branded favicon (or an initialised placeholder) for any domain — same
// service the operator-side `(authed)/(dashboard)/.../leads/page.tsx` uses.
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  const [error, setError] = useState(false);
  if (!error && domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=32`}
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 rounded shrink-0"
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="w-5 h-5 rounded bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

// Inline "X time ago" formatter, ported from the operator-side leads page
// so the public report and the internal page share the same human-readable
// time signal. No new dep (`date-fns` is not in dashboard's package.json).
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

export interface LeadEmailSummary {
  subject: string;
  bodyText: string;
  sentAt: string;
  workflow: string;
}

export interface LeadRow {
  email: string;
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  companyDomain: string;
  industry: string;
  country: string;
  city: string;
  linkedinUrl: string | null;
  /** Most-advanced milestone reached. Used by sort + StatusBadge. */
  status: string;
  /** Raw intake status (served / skipped / claimed / buffered). Used by the
   *  tab predicates for the intake-side tabs. The consolidated `status`
   *  above shadows this whenever an email milestone is hit. */
  intakeStatus: "buffered" | "skipped" | "claimed" | "served";
  emailStatus: string;
  workflow: string;
  campaignId: string;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: string | null;
  /** Intake date. The only true per-milestone timestamp lead-service
   *  currently exposes — used to default-sort the Intake tabs (Buffered /
   *  Claimed / Skipped / Served) by most-recently-intaken. */
  servedAt: string | null;
  /** Last delivery / status event from the lead-service.
   *  Used as default sort proxy ("most-recent activity first") because
   *  the lead-service does not expose per-milestone timestamps
   *  (`openedAt`, `clickedAt`, `repliedAt`, …) — only this aggregate.
   *  When backend ships per-status timestamps (DIS-28) we can sort each
   *  tab by its own status date desc. Until then, every milestone tab
   *  falls back to lastDeliveredAt as the closest proxy available. */
  lastDeliveredAt: string | null;
  /** Emails sent to this lead, indexed at page-render time on the server.
   *  Embedded here so the drawer can show them with zero client-side fetch
   *  — the public report is cached for 4h via `unstable_cache`, so the full
   *  HTML (with every lead's emails) reaches the recipient pre-baked. */
  emails: LeadEmailSummary[];
}

interface Milestone {
  key: keyof Pick<LeadRow, "contacted" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "unsubscribed">;
  label: string;
}

const MILESTONES: Milestone[] = [
  { key: "contacted", label: "Contacted" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "replied", label: "Replied" },
  { key: "bounced", label: "Bounced" },
  { key: "unsubscribed", label: "Unsubscribed" },
];

const INTAKE_STATUSES: { key: LeadRow["intakeStatus"]; label: string }[] = [
  { key: "buffered", label: "Buffered" },
  { key: "claimed", label: "Claimed" },
  { key: "skipped", label: "Skipped" },
  { key: "served", label: "Served" },
];

// Industry + Country dropped from the table per UX feedback — both are
// available in the drawer / CSV but rarely scanned at a glance. Last
// activity replaces them so the user immediately sees "how recently did
// this lead move" without opening the drawer.
const columns: ReportTableColumn<LeadRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (r) => `${r.firstName} ${r.lastName}`,
    render: (r) => <span className="font-medium text-gray-900 truncate block">{r.firstName} {r.lastName}</span>,
    className: "w-[18%]",
  },
  {
    key: "email",
    label: "Email",
    sortValue: (r) => r.email,
    render: (r) => <span className="font-mono text-xs truncate block" title={r.email}>{r.email}</span>,
    className: "w-[24%]",
  },
  {
    key: "title",
    label: "Title",
    sortValue: (r) => r.title,
    render: (r) => <span className="truncate block" title={r.title || undefined}>{r.title || "—"}</span>,
    className: "w-[20%]",
  },
  {
    key: "company",
    label: "Company",
    sortValue: (r) => r.company,
    render: (r) => (
      <div className="flex items-center gap-2 min-w-0">
        <CompanyLogo domain={r.companyDomain} name={r.company} />
        <div className="min-w-0">
          <div className="truncate" title={r.company || undefined}>{r.company || "—"}</div>
          {r.companyDomain && <div className="text-xs text-gray-500 truncate" title={r.companyDomain}>{r.companyDomain}</div>}
        </div>
      </div>
    ),
    className: "w-[24%]",
  },
  {
    key: "lastActivity",
    label: "Last activity",
    // Sort by raw timestamp so empty / null lands first when sorted asc
    // and last when sorted desc — same proxy used by the per-tab sort.
    sortValue: (r) => r.lastDeliveredAt ?? "",
    render: (r) => (
      <span
        className="text-xs text-gray-500 whitespace-nowrap"
        title={r.lastDeliveredAt ? new Date(r.lastDeliveredAt).toLocaleString() : undefined}
      >
        {timeAgo(r.lastDeliveredAt)}
      </span>
    ),
    className: "w-[14%]",
  },
];

// Tab order: most-advanced milestone leftmost, intake statuses last (right of
// the milestone band, before "All"). Each lead row appears in every tab whose
// predicate is true — a replied lead also shows under Clicked / Opened /
// Delivered / Sent. Intake tabs (served / skipped / claimed / buffered) are
// mutually exclusive per lead and orthogonal to the email-milestone tabs.
//
// Each tab declares a `sortValue` to default-sort by the best per-tab date
// proxy available client-side:
//   - Replied → most-recent embedded email `sentAt`. Each row's `emails[]`
//     is pre-sorted desc on the server, so `emails[0].sentAt` is the
//     closest proxy for "newest reply". Falls back to `lastDeliveredAt`.
//   - Clicked / Opened / Delivered / Sent / Bounced / Unsubscribed /
//     Contacted → `lastDeliveredAt` (the only delivery-event timestamp
//     lead-service exposes today; DIS-28 tracks adding real per-milestone
//     timestamps).
//   - Intake (Served / Skipped / Claimed / Buffered) → `servedAt`, the
//     true intake date. Falls back to `lastDeliveredAt`.
//   - All → `lastDeliveredAt`.
const lastDeliveredSort = (r: LeadRow) => r.lastDeliveredAt ?? "";
const intakeSort = (r: LeadRow) => r.servedAt ?? r.lastDeliveredAt ?? "";
const repliedSort = (r: LeadRow) => r.emails[0]?.sentAt ?? r.lastDeliveredAt ?? "";

const TABS: TabSpec<LeadRow>[] = [
  { key: "replied", label: "Replied", match: (r) => r.replied, sortValue: repliedSort },
  { key: "clicked", label: "Clicked", match: (r) => r.clicked, sortValue: lastDeliveredSort },
  { key: "opened", label: "Opened", match: (r) => r.opened, sortValue: lastDeliveredSort },
  { key: "delivered", label: "Delivered", match: (r) => r.delivered, sortValue: lastDeliveredSort },
  { key: "sent", label: "Sent", match: (r) => r.sent, sortValue: lastDeliveredSort },
  { key: "bounced", label: "Bounced", match: (r) => r.bounced, sortValue: lastDeliveredSort },
  { key: "unsubscribed", label: "Unsubscribed", match: (r) => r.unsubscribed, sortValue: lastDeliveredSort },
  { key: "contacted", label: "Contacted", match: (r) => r.contacted, sortValue: lastDeliveredSort },
  { key: "served", label: "Served", match: (r) => r.intakeStatus === "served", sortValue: intakeSort },
  { key: "skipped", label: "Skipped", match: (r) => r.intakeStatus === "skipped", sortValue: intakeSort },
  { key: "claimed", label: "Claimed", match: (r) => r.intakeStatus === "claimed", sortValue: intakeSort },
  { key: "buffered", label: "Buffered", match: (r) => r.intakeStatus === "buffered", sortValue: intakeSort },
  { key: "all", label: "All", match: () => true, sortValue: lastDeliveredSort },
];

function StatusTimeline({ row }: { row: LeadRow }) {
  return (
    <ul className="space-y-1.5">
      <li className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold pt-1">Intake</li>
      {INTAKE_STATUSES.map((s) => {
        const hit = row.intakeStatus === s.key;
        return (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border ${
              hit
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-300"
            }`}>
              {hit ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </span>
            <span className={hit ? "text-gray-800 font-medium" : "text-gray-500"}>{s.label}</span>
          </li>
        );
      })}
      <li className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold pt-2">Milestones</li>
      {MILESTONES.map((m) => {
        const hit = row[m.key];
        const dim = m.key === "bounced" || m.key === "unsubscribed";
        return (
          <li key={m.key} className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border ${
              hit
                ? dim
                  ? "bg-red-100 border-red-300 text-red-700"
                  : "bg-green-100 border-green-300 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-300"
            }`}>
              {hit ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </span>
            <span className={hit ? "text-gray-800 font-medium" : "text-gray-500"}>{m.label}</span>
            {m.key === "replied" && hit && row.replyClassification && (
              <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                row.replyClassification === "positive"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : row.replyClassification === "negative"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-zinc-200 text-zinc-700 border-zinc-300"
              }`}>
                {row.replyClassification}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EmailSection({ emails }: { emails: LeadEmailSummary[] }) {
  return (
    <div className="space-y-4">
      {emails.map((e, i) => (
        <div key={i} className="space-y-1.5">
          <div className="text-xs text-gray-500">
            {new Date(e.sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {e.workflow && <> · <WorkflowTag name={e.workflow} /></>}
          </div>
          <div className="font-medium text-gray-800">{e.subject || <em className="text-gray-500">(no subject)</em>}</div>
          {e.bodyText
            ? <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{e.bodyText}</pre>
            : <em className="text-xs text-gray-500">No body text available.</em>}
        </div>
      ))}
    </div>
  );
}

function drawerEntries(r: LeadRow): DrawerEntry[] {
  const entries: DrawerEntry[] = [
    { label: "Email", value: r.email, monospace: true },
    { label: "Workflow", value: <WorkflowTag name={r.workflow} /> },
    { label: "Title", value: r.title },
    { label: "Company", value: r.company },
    { label: "City", value: r.city },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
    { label: "Statuses", value: <StatusTimeline row={r} />, block: true },
  ];
  // Email-sent section is shown ONLY when there's at least one email — no
  // empty placeholder, per UX feedback.
  if (r.emails.length > 0) {
    entries.push({
      label: r.emails.length > 1 ? `Emails sent (${r.emails.length})` : "Email sent",
      value: <EmailSection emails={r.emails} />,
      block: true,
    });
  }
  return entries;
}

interface LeadsTableProps {
  rows: LeadRow[];
}

export function LeadsTable({ rows }: LeadsTableProps) {
  // No outer pre-sort — each TabSpec declares its own `sortValue` and
  // ReportTable applies it per active tab. User-click on a column header
  // (e.g. Name / Email / Last activity) still wins via `sortKey`.
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
      defaultSortKey=""
      defaultSortDir="desc"
      searchPlaceholder="Search name, email, company…"
      searchValue={(r) => `${r.firstName} ${r.lastName} ${r.email} ${r.title} ${r.company} ${r.industry} ${r.country} ${r.workflow}`}
      tabs={TABS}
      fixedLayout
      drawerTitle={(r) => `${r.firstName} ${r.lastName}`.trim() || r.email}
      drawerSubtitle={(r) => r.email}
      drawerEntries={drawerEntries}
      emptyMessage="No leads match."
    />
  );
}
