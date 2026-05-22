"use client";

import { ReportTable, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";
import type { CompanyRow } from "@/lib/report-api";

const columns: ReportTableColumn<CompanyRow>[] = [
  {
    key: "name",
    label: "Company",
    sortValue: (r) => r.name,
    render: (r) => (
      <div>
        <div className="font-medium text-gray-900">{r.name || "—"}</div>
        {r.domain && <div className="text-xs text-gray-400">{r.domain}</div>}
      </div>
    ),
  },
  { key: "industry", label: "Industry", sortValue: (r) => r.industry ?? "", render: (r) => r.industry ?? "—" },
  {
    key: "employees",
    label: "Employees",
    sortValue: (r) => String(r.employees ?? 0).padStart(10, "0"),
    render: (r) => r.employees?.toLocaleString("en-US") ?? "—",
  },
  {
    key: "location",
    label: "Location",
    sortValue: (r) => `${r.country ?? ""} ${r.city ?? ""}`,
    render: (r) => [r.city, r.country].filter(Boolean).join(", ") || "—",
  },
  {
    key: "leadCount",
    label: "Leads",
    sortValue: (r) => String(r.leadCount).padStart(8, "0"),
    render: (r) => <span className="font-medium text-brand-700">{r.leadCount}</span>,
  },
];

function drawerEntries(r: CompanyRow): DrawerEntry[] {
  return [
    { label: "Domain", value: r.domain, monospace: true },
    { label: "Industry", value: r.industry },
    { label: "Employees", value: r.employees?.toLocaleString("en-US") },
    { label: "City", value: r.city },
    { label: "Country", value: r.country },
    { label: "Leads targeted", value: r.leadCount.toLocaleString("en-US") },
    { label: "Website", value: r.websiteUrl ? <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.websiteUrl}</a> : null, block: true },
    { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
  ];
}

export function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => `${r.name}-${r.domain ?? ""}`}
      searchPlaceholder="Search company, domain, industry…"
      searchValue={(r) => `${r.name} ${r.domain ?? ""} ${r.industry ?? ""} ${r.country ?? ""}`}
      filter={{ label: "Industry", value: (r) => r.industry ?? "" }}
      drawerTitle={(r) => r.name || "Unknown company"}
      drawerSubtitle={(r) => r.domain ?? ""}
      drawerEntries={drawerEntries}
      emptyMessage="No companies match."
    />
  );
}
