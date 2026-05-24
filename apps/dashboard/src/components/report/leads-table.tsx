"use client";

import { ReportTable, StatusBadge, type ReportTableColumn, type TabSpec } from "./report-table";
// `status` is still surfaced in the row drawer; we no longer render it as a
// column because the active tab already conveys the milestone — and a row
// with a more-advanced status (e.g. replied) appearing in a less-advanced
// tab (e.g. opened) made the badge look mismatched.
import type { DrawerEntry } from "./data-drawer";
import { WorkflowTag } from "./workflow-tag";

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

const columns: ReportTableColumn<LeadRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (r) => `${r.firstName} ${r.lastName}`,
    render: (r) => <span className="font-medium text-gray-900 truncate block">{r.firstName} {r.lastName}</span>,
    className: "w-[16%]",
  },
  {
    key: "email",
    label: "Email",
    sortValue: (r) => r.email,
    render: (r) => <span className="font-mono text-xs truncate block" title={r.email}>{r.email}</span>,
    className: "w-[22%]",
  },
  {
    key: "title",
    label: "Title",
    sortValue: (r) => r.title,
    render: (r) => <span className="truncate block" title={r.title || undefined}>{r.title || "—"}</span>,
    className: "w-[17%]",
  },
  {
    key: "company",
    label: "Company",
    sortValue: (r) => r.company,
    render: (r) => (
      <div className="min-w-0">
        <div className="truncate" title={r.company || undefined}>{r.company || "—"}</div>
        {r.companyDomain && <div className="text-xs text-gray-500 truncate" title={r.companyDomain}>{r.companyDomain}</div>}
      </div>
    ),
    className: "w-[18%]",
  },
  {
    key: "industry",
    label: "Industry",
    sortValue: (r) => r.industry,
    render: (r) => <span className="truncate block" title={r.industry || undefined}>{r.industry || "—"}</span>,
    className: "w-[15%]",
  },
  {
    key: "country",
    label: "Country",
    sortValue: (r) => r.country,
    render: (r) => <span className="truncate block" title={r.country || undefined}>{r.country || "—"}</span>,
    className: "w-[12%]",
  },
];

// Tab order: most-advanced milestone leftmost, intake statuses last (right of
// the milestone band, before "All"). Each lead row appears in every tab whose
// predicate is true — a replied lead also shows under Clicked / Opened /
// Delivered / Sent. Intake tabs (served / skipped / claimed / buffered) are
// mutually exclusive per lead and orthogonal to the email-milestone tabs.
const TABS: TabSpec<LeadRow>[] = [
  { key: "replied", label: "Replied", match: (r) => r.replied },
  { key: "clicked", label: "Clicked", match: (r) => r.clicked },
  { key: "opened", label: "Opened", match: (r) => r.opened },
  { key: "delivered", label: "Delivered", match: (r) => r.delivered },
  { key: "sent", label: "Sent", match: (r) => r.sent },
  { key: "bounced", label: "Bounced", match: (r) => r.bounced },
  { key: "unsubscribed", label: "Unsubscribed", match: (r) => r.unsubscribed },
  { key: "contacted", label: "Contacted", match: (r) => r.contacted },
  { key: "served", label: "Served", match: (r) => r.intakeStatus === "served" },
  { key: "skipped", label: "Skipped", match: (r) => r.intakeStatus === "skipped" },
  { key: "claimed", label: "Claimed", match: (r) => r.intakeStatus === "claimed" },
  { key: "buffered", label: "Buffered", match: (r) => r.intakeStatus === "buffered" },
  { key: "all", label: "All", match: () => true },
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
  if (emails.length === 0) {
    return <em className="text-gray-500">No email recorded for this lead.</em>;
  }
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
  return [
    { label: "Email", value: r.email, monospace: true },
    { label: "Current status", value: <StatusBadge status={r.status} /> },
    { label: "Workflow", value: <WorkflowTag name={r.workflow} /> },
    { label: "Title", value: r.title },
    { label: "Company", value: r.company },
    { label: "Company domain", value: r.companyDomain, monospace: true },
    { label: "Industry", value: r.industry },
    { label: "City", value: r.city },
    { label: "Country", value: r.country },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
    { label: "Email delivery state", value: r.emailStatus },
    { label: "Statuses", value: <StatusTimeline row={r} />, block: true },
    {
      label: r.emails.length > 1 ? `Emails sent (${r.emails.length})` : "Email sent",
      value: <EmailSection emails={r.emails} />,
      block: true,
    },
  ];
}

interface LeadsTableProps {
  rows: LeadRow[];
}

export function LeadsTable({ rows }: LeadsTableProps) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
      defaultSortKey="name"
      defaultSortDir="asc"
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
