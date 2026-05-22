"use client";

import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface WorkflowRow {
  id: string;
  name: string;
  version: number;
  status: string;
  description: string;
  prompts: { step: string; field: string; value: string }[];
}

const columns: ReportTableColumn<WorkflowRow>[] = [
  {
    key: "name",
    label: "Workflow",
    sortValue: (r) => r.name,
    render: (r) => (
      <div>
        <div className="font-medium text-gray-900">{r.name}</div>
        {r.description && <div className="text-xs text-gray-400 line-clamp-1">{r.description}</div>}
      </div>
    ),
  },
  {
    key: "version",
    label: "Version",
    sortValue: (r) => String(r.version).padStart(4, "0"),
    render: (r) => <span className="text-xs text-gray-500">v{r.version}</span>,
  },
  { key: "status", label: "Status", sortValue: (r) => r.status, render: (r) => <StatusBadge status={r.status || "active"} /> },
  {
    key: "prompts",
    label: "Prompts",
    sortValue: (r) => String(r.prompts.length).padStart(4, "0"),
    render: (r) => <span className="text-xs text-gray-500">{r.prompts.length} step{r.prompts.length === 1 ? "" : "s"}</span>,
  },
];

function drawerEntries(r: WorkflowRow): DrawerEntry[] {
  const entries: DrawerEntry[] = [
    { label: "Version", value: `v${r.version}` },
    { label: "Status", value: <StatusBadge status={r.status || "active"} /> },
    { label: "Description", value: r.description, block: true },
  ];
  for (const p of r.prompts) {
    entries.push({
      label: `${p.step} · ${p.field}`,
      value: <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{p.value}</pre>,
      block: true,
    });
  }
  if (r.prompts.length === 0) {
    entries.push({ label: "Prompts", value: <em className="text-gray-400">No prompts exposed.</em>, block: true });
  }
  return entries;
}

export function WorkflowsTable({ rows }: { rows: WorkflowRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder="Search workflow name, description…"
      searchValue={(r) => `${r.name} ${r.description} v${r.version} ${r.status}`}
      drawerTitle={(r) => r.name}
      drawerSubtitle={(r) => `v${r.version}`}
      drawerEntries={drawerEntries}
      emptyMessage="No workflows match."
    />
  );
}
