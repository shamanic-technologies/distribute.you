"use client";

import { ReportTable, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface WorkflowRow {
  id: string;
  name: string;
  version: number;
  status: string;
  description: string;
  emailsSent: number;
  positiveReplies: number;
  /** USD cents of total run cost attributed to this workflow */
  totalCostCents: number;
  expectedRevenueUsd: number | null;
  roiMultiple: number | null;
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

function cpa(totalCostCents: number, count: number): string {
  if (count <= 0) return "—";
  return formatUsd(totalCostCents / count);
}

function formatUsdValue(usd: number | null): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatRoi(roi: number | null): string {
  return roi == null ? "—" : `${roi.toFixed(1)}×`;
}

function buildColumns(labels: WorkflowsTableLabels, showRevenueColumns: boolean): ReportTableColumn<WorkflowRow>[] {
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
      sortValue: (r) => String(r.emailsSent).padStart(8, "0"),
      render: (r) => r.emailsSent.toLocaleString("en-US"),
    },
    {
      key: "positiveReplies",
      label: labels.leadsRepliesPositive,
      sortValue: (r) => String(r.positiveReplies).padStart(8, "0"),
      render: (r) => r.positiveReplies.toLocaleString("en-US"),
    },
    {
      key: "cacReply",
      label: "CAC / positive reply",
      sortValue: (r) => String(r.positiveReplies > 0 ? r.totalCostCents / r.positiveReplies : Number.MAX_SAFE_INTEGER).padStart(12, "0"),
      render: (r) => <span className="font-medium text-gray-900">{cpa(r.totalCostCents, r.positiveReplies)}</span>,
    },
  ];

  if (showRevenueColumns) {
    columns.push(
      {
        key: "expectedRevenue",
        label: "Expected revenue",
        sortValue: (r) => String(r.expectedRevenueUsd ?? -1).padStart(14, "0"),
        render: (r) => <span className="font-medium text-green-700">{formatUsdValue(r.expectedRevenueUsd)}</span>,
      },
      {
        key: "roi",
        label: "ROI",
        sortValue: (r) => String(r.roiMultiple ?? -1).padStart(14, "0"),
        render: (r) => <span className="font-medium text-green-700">{formatRoi(r.roiMultiple)}</span>,
      },
    );
  }

  return columns;
}

function buildDrawerEntries(labels: WorkflowsTableLabels, showRevenueColumns: boolean) {
  return (r: WorkflowRow): DrawerEntry[] => [
    { label: "Version", value: `v${r.version}` },
    { label: labels.leadsSent, value: r.emailsSent.toLocaleString("en-US") },
    { label: labels.leadsRepliesPositive, value: r.positiveReplies.toLocaleString("en-US") },
    { label: "Total cost", value: formatUsd(r.totalCostCents) },
    { label: "CAC / positive reply", value: cpa(r.totalCostCents, r.positiveReplies) },
    ...(showRevenueColumns ? [
      { label: "Expected revenue", value: formatUsdValue(r.expectedRevenueUsd) },
      { label: "ROI", value: formatRoi(r.roiMultiple) },
    ] : []),
    { label: "Description", value: r.description, block: true },
  ];
}

export function WorkflowsTable({ rows, labels, showRevenueColumns = false }: { rows: WorkflowRow[]; labels: WorkflowsTableLabels; showRevenueColumns?: boolean }) {
  const columns = buildColumns(labels, showRevenueColumns);
  const drawerEntries = buildDrawerEntries(labels, showRevenueColumns);
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
