"use client";

import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  workflow: string;
  budget: string;
  leadCount: number;
  createdAt: string;
}

const columns: ReportTableColumn<CampaignRow>[] = [
  {
    key: "name",
    label: "Campaign",
    sortValue: (r) => r.name,
    render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
  },
  { key: "status", label: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  { key: "workflow", label: "Workflow", sortValue: (r) => r.workflow, render: (r) => r.workflow || "—" },
  { key: "budget", label: "Budget", sortValue: (r) => r.budget, render: (r) => r.budget },
  {
    key: "leadCount",
    label: "Leads",
    sortValue: (r) => String(r.leadCount).padStart(8, "0"),
    render: (r) => r.leadCount.toLocaleString("en-US"),
  },
  {
    key: "createdAt",
    label: "Created",
    sortValue: (r) => r.createdAt,
    render: (r) => new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }),
  },
];

function drawerEntries(r: CampaignRow): DrawerEntry[] {
  return [
    { label: "Status", value: <StatusBadge status={r.status} /> },
    { label: "Workflow", value: r.workflow },
    { label: "Budget", value: r.budget },
    { label: "Leads", value: r.leadCount.toLocaleString("en-US") },
    { label: "Created", value: new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) },
  ];
}

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder="Search campaign, workflow…"
      searchValue={(r) => `${r.name} ${r.workflow} ${r.status} ${r.budget}`}
      filter={{ label: "Status", value: (r) => r.status }}
      drawerTitle={(r) => r.name}
      drawerSubtitle={(r) => r.workflow}
      drawerEntries={drawerEntries}
      emptyMessage="No campaigns match."
    />
  );
}
