"use client";

import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

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
  /** Most-advanced milestone reached (replied > clicked > opened > delivered > sent > …). */
  status: string;
  emailStatus: string;
  campaign: string;
  emails: LeadEmailSummary[];
  // Individual milestone booleans — used by the drawer timeline + CSV
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  /** Reply tone, if `replied`. */
  replyClassification: string | null;
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

const columns: ReportTableColumn<LeadRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (r) => `${r.firstName} ${r.lastName}`,
    render: (r) => <span className="font-medium text-gray-900">{r.firstName} {r.lastName}</span>,
  },
  {
    key: "email",
    label: "Email",
    sortValue: (r) => r.email,
    render: (r) => <span className="font-mono text-xs">{r.email}</span>,
  },
  { key: "title", label: "Title", sortValue: (r) => r.title, render: (r) => r.title || "—" },
  {
    key: "company",
    label: "Company",
    sortValue: (r) => r.company,
    render: (r) => (
      <div>
        <div>{r.company || "—"}</div>
        {r.companyDomain && <div className="text-xs text-gray-400">{r.companyDomain}</div>}
      </div>
    ),
  },
  { key: "industry", label: "Industry", sortValue: (r) => r.industry, render: (r) => r.industry || "—" },
  { key: "country", label: "Country", sortValue: (r) => r.country, render: (r) => r.country || "—" },
  { key: "status", label: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  { key: "campaign", label: "Campaign", sortValue: (r) => r.campaign, render: (r) => r.campaign || "—" },
];

function StatusTimeline({ row }: { row: LeadRow }) {
  return (
    <ul className="space-y-1.5">
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
            <span className={hit ? "text-gray-800 font-medium" : "text-gray-400"}>{m.label}</span>
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

function drawerEntries(r: LeadRow): DrawerEntry[] {
  const entries: DrawerEntry[] = [
    { label: "Email", value: r.email, monospace: true },
    { label: "Current status", value: <StatusBadge status={r.status} /> },
    { label: "Title", value: r.title },
    { label: "Company", value: r.company },
    { label: "Company domain", value: r.companyDomain, monospace: true },
    { label: "Industry", value: r.industry },
    { label: "City", value: r.city },
    { label: "Country", value: r.country },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
    { label: "Email delivery state", value: r.emailStatus },
    { label: "Campaign", value: r.campaign },
    { label: "Milestones reached", value: <StatusTimeline row={r} />, block: true },
  ];
  if (r.emails.length > 0) {
    for (let i = 0; i < r.emails.length; i++) {
      const e = r.emails[i];
      const labelPrefix = r.emails.length > 1 ? `Email ${i + 1} of ${r.emails.length}` : "Email sent";
      entries.push({
        label: labelPrefix,
        value: (
          <div className="space-y-1.5">
            <div className="text-xs text-gray-500">
              {new Date(e.sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              {e.workflow && <> · <span className="text-indigo-700">{e.workflow}</span></>}
            </div>
            <div className="font-medium text-gray-800">{e.subject || <em className="text-gray-400">(no subject)</em>}</div>
            {e.bodyText
              ? <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{e.bodyText}</pre>
              : <em className="text-xs text-gray-400">No body text available.</em>}
          </div>
        ),
        block: true,
      });
    }
  } else {
    entries.push({ label: "Email sent", value: <em className="text-gray-400">No email recorded for this lead.</em>, block: true });
  }
  return entries;
}

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
      defaultSortKey="status"
      defaultSortDir="asc"
      searchPlaceholder="Search name, email, company…"
      searchValue={(r) => `${r.firstName} ${r.lastName} ${r.email} ${r.title} ${r.company} ${r.industry} ${r.country} ${r.campaign}`}
      filter={{ label: "Status", value: (r) => r.status }}
      drawerTitle={(r) => `${r.firstName} ${r.lastName}`.trim() || r.email}
      drawerSubtitle={(r) => r.email}
      drawerEntries={drawerEntries}
      emptyMessage="No leads match."
    />
  );
}
