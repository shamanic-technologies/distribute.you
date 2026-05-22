"use client";

import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";
import type { IndividualRow } from "@/lib/report-api";

const columns: ReportTableColumn<IndividualRow>[] = [
  {
    key: "name",
    label: "Name",
    sortValue: (r) => `${r.firstName} ${r.lastName}`,
    render: (r) => (
      <div>
        <div className="font-medium text-gray-900">{r.firstName} {r.lastName}</div>
        {r.headline && <div className="text-xs text-gray-400">{r.headline}</div>}
      </div>
    ),
  },
  { key: "email", label: "Email", sortValue: (r) => r.email, render: (r) => <span className="font-mono text-xs">{r.email}</span> },
  { key: "title", label: "Title", sortValue: (r) => r.title ?? "", render: (r) => r.title ?? "—" },
  { key: "seniority", label: "Seniority", sortValue: (r) => r.seniority ?? "", render: (r) => r.seniority ?? "—" },
  { key: "department", label: "Department", sortValue: (r) => r.department ?? "", render: (r) => r.department ?? "—" },
  { key: "company", label: "Company", sortValue: (r) => r.company ?? "", render: (r) => r.company ?? "—" },
  {
    key: "location",
    label: "Location",
    sortValue: (r) => `${r.country ?? ""} ${r.state ?? ""} ${r.city ?? ""}`,
    render: (r) => [r.city, r.state, r.country].filter(Boolean).join(", ") || "—",
  },
  { key: "status", label: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
];

function drawerEntries(r: IndividualRow): DrawerEntry[] {
  return [
    { label: "Email", value: r.email, monospace: true },
    { label: "Status", value: <StatusBadge status={r.status} /> },
    { label: "Headline", value: r.headline },
    { label: "Title", value: r.title },
    { label: "Seniority", value: r.seniority },
    { label: "Department", value: r.department },
    { label: "Company", value: r.company },
    { label: "City", value: r.city },
    { label: "State", value: r.state },
    { label: "Country", value: r.country },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
    { label: "Twitter", value: r.twitterUrl ? <a href={r.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.twitterUrl}</a> : null, block: true },
    { label: "Email delivery state", value: r.emailStatus },
  ];
}

export function IndividualsTable({ rows }: { rows: IndividualRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
      searchPlaceholder="Search name, email, title, company…"
      searchValue={(r) => `${r.firstName} ${r.lastName} ${r.email} ${r.title ?? ""} ${r.company ?? ""} ${r.headline ?? ""} ${r.country ?? ""}`}
      filter={{ label: "Status", value: (r) => r.status }}
      drawerTitle={(r) => `${r.firstName} ${r.lastName}`.trim() || r.email}
      drawerSubtitle={(r) => [r.title, r.company].filter(Boolean).join(" · ")}
      drawerEntries={drawerEntries}
      emptyMessage="No individuals match."
    />
  );
}
