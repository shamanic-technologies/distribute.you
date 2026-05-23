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
  emailsSent: number;
  positiveReplies: number;
  /** USD cents of total run cost attributed to this workflow */
  totalCostCents: number;
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function cpa(totalCostCents: number, count: number): string {
  if (count <= 0) return "—";
  return formatUsd(totalCostCents / count);
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
    key: "emailsSent",
    label: "Emails sent",
    sortValue: (r) => String(r.emailsSent).padStart(8, "0"),
    render: (r) => r.emailsSent.toLocaleString("en-US"),
  },
  {
    key: "positiveReplies",
    label: "Positive replies",
    sortValue: (r) => String(r.positiveReplies).padStart(8, "0"),
    render: (r) => r.positiveReplies.toLocaleString("en-US"),
  },
  {
    key: "cacReply",
    label: "CAC / reply",
    sortValue: (r) => String(r.positiveReplies > 0 ? r.totalCostCents / r.positiveReplies : Number.MAX_SAFE_INTEGER).padStart(12, "0"),
    render: (r) => <span className="font-medium text-gray-900">{cpa(r.totalCostCents, r.positiveReplies)}</span>,
  },
];

function drawerEntries(r: WorkflowRow): DrawerEntry[] {
  const entries: DrawerEntry[] = [
    { label: "Version", value: `v${r.version}` },
    { label: "Status", value: <StatusBadge status={r.status || "active"} /> },
    { label: "Emails sent", value: r.emailsSent.toLocaleString("en-US") },
    { label: "Positive replies", value: r.positiveReplies.toLocaleString("en-US") },
    { label: "Total cost", value: formatUsd(r.totalCostCents) },
    { label: "CAC per reply", value: cpa(r.totalCostCents, r.positiveReplies) },
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
      emptyMessage="No workflows in use yet for this brand."
    />
  );
}
