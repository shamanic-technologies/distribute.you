"use client";

import { ReportTable, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface WorkflowRow {
  id: string;
  name: string;
  version: number;
  status: string;
  description: string;
  /** Null = not a ledger count (LEDGER-ONLY-1107-P2): reads "—", never 0. */
  emailsSent: number | null;
  positiveReplies: number | null;
  /** USD cents of total run cost attributed to this workflow */
  totalCostCents: number;
  /** ISO timestamp from the Workflow row; used by the page's default composite sort. */
  createdAt: string;
}

export interface WorkflowsTableLabels {
  /** Registry label for the `leadsSent` stat — drives both the column header
   *  and the drawer label. Server resolves it from the stats registry; we
   *  thread it down so this client component stays registry-context-free. */
  leadsSent: string;
  /** Registry label for `leadsRepliesPositive`. */
  leadsRepliesPositive: string;
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const countText = (n: number | null): string => (n == null ? "\u2014" : n.toLocaleString("en-US"));

function cpa(totalCostCents: number, count: number | null): string {
  if (count == null || count <= 0) return "—";
  return formatUsd(totalCostCents / count);
}

// No per-workflow return: a workflow is below a Target, so it shows cost per outcome
// only (owner 2026-11-03, ROI-CONSISTENCY-1103).
function buildColumns(labels: WorkflowsTableLabels): ReportTableColumn<WorkflowRow>[] {
  const columns: ReportTableColumn<WorkflowRow>[] = [
    {
      key: "name",
      label: "Workflow",
      sortValue: (r) => r.name,
      className: "!whitespace-normal max-w-[280px]",
      render: (r) => (
        <div className="max-w-[280px]">
          <div className="font-medium text-gray-900 break-words">{r.name}</div>
          {r.description && <div className="text-xs text-gray-500 line-clamp-1">{r.description}</div>}
        </div>
      ),
    },
    {
      key: "version",
      label: "Version",
      sortValue: (r) => String(r.version).padStart(4, "0"),
      render: (r) => <span className="text-xs text-gray-500">v{r.version}</span>,
    },
    {
      key: "emailsSent",
      label: labels.leadsSent,
      sortValue: (r) => String(r.emailsSent ?? 0).padStart(8, "0"),
      render: (r) => countText(r.emailsSent),
    },
    {
      key: "positiveReplies",
      label: labels.leadsRepliesPositive,
      sortValue: (r) => String(r.positiveReplies ?? 0).padStart(8, "0"),
      render: (r) => countText(r.positiveReplies),
    },
    {
      key: "cacReply",
      label: "CAC / positive reply",
      sortValue: (r) => String(r.positiveReplies != null && r.positiveReplies > 0 ? r.totalCostCents / r.positiveReplies : Number.MAX_SAFE_INTEGER).padStart(12, "0"),
      render: (r) => <span className="font-medium text-gray-900">{cpa(r.totalCostCents, r.positiveReplies)}</span>,
    },
  ];

  return columns;
}

function buildDrawerEntries(labels: WorkflowsTableLabels) {
  return (r: WorkflowRow): DrawerEntry[] => [
    { label: "Version", value: `v${r.version}` },
    { label: labels.leadsSent, value: countText(r.emailsSent) },
    { label: labels.leadsRepliesPositive, value: countText(r.positiveReplies) },
    { label: "Total cost", value: formatUsd(r.totalCostCents) },
    { label: "CAC / positive reply", value: cpa(r.totalCostCents, r.positiveReplies) },
    { label: "Description", value: r.description, block: true },
  ];
}

export function WorkflowsTable({ rows, labels }: { rows: WorkflowRow[]; labels: WorkflowsTableLabels }) {
  const columns = buildColumns(labels);
  const drawerEntries = buildDrawerEntries(labels);
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder="Search workflow name, description…"
      searchValue={(r) => `${r.name} ${r.description} v${r.version} ${r.status}`}
      defaultSortKey=""
      drawerTitle={(r) => r.name}
      drawerSubtitle={(r) => `v${r.version}`}
      drawerEntries={drawerEntries}
      emptyMessage="No workflows in use yet for this brand."
    />
  );
}
