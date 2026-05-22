"use client";

import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

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
  status: string;
  emailStatus: string;
  campaign: string;
}

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

function drawerEntries(r: LeadRow): DrawerEntry[] {
  return [
    { label: "Email", value: r.email, monospace: true },
    { label: "Status", value: <StatusBadge status={r.status} /> },
    { label: "Title", value: r.title },
    { label: "Company", value: r.company },
    { label: "Company domain", value: r.companyDomain, monospace: true },
    { label: "Industry", value: r.industry },
    { label: "City", value: r.city },
    { label: "Country", value: r.country },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
    { label: "Email delivery state", value: r.emailStatus },
    { label: "Campaign", value: r.campaign },
  ];
}

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
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
