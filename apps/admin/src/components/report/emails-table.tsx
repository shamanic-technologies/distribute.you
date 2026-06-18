"use client";

import { ReportTable, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";
import { WorkflowTag } from "./workflow-tag";
import { EmailSignature } from "../email-signature";

export interface EmailRow {
  id: string;
  subject: string;
  recipient: string;
  recipientCompany: string;
  recipientTitle: string;
  workflow: string;
  createdAt: string;
  bodyText: string;
}

const baseColumns: ReportTableColumn<EmailRow>[] = [
  { key: "subject", label: "Subject", sortValue: (r) => r.subject, render: (r) => <span className="font-medium text-gray-900">{r.subject}</span> },
  { key: "recipient", label: "To", sortValue: (r) => r.recipient, render: (r) => r.recipient || "—" },
  { key: "company", label: "Company", sortValue: (r) => r.recipientCompany, render: (r) => r.recipientCompany || "—" },
  { key: "workflow", label: "Workflow", sortValue: (r) => r.workflow, render: (r) => <WorkflowTag name={r.workflow} /> },
  {
    key: "createdAt",
    label: "Sent",
    sortValue: (r) => r.createdAt,
    render: (r) => new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }),
  },
];

function drawerEntries(r: EmailRow): DrawerEntry[] {
  return [
    { label: "To", value: r.recipient },
    { label: "Title", value: r.recipientTitle },
    { label: "Company", value: r.recipientCompany },
    { label: "Workflow", value: r.workflow ? <WorkflowTag name={r.workflow} /> : null },
    { label: "Sent at", value: new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) },
    { label: "Subject", value: r.subject, block: true },
    {
      label: "Body",
      value: r.bodyText
        ? <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{r.bodyText}<EmailSignature className="text-xs text-gray-500" /></pre>
        : <em className="text-gray-400">No body text available.</em>,
      block: true,
    },
  ];
}

export function EmailsTable({ rows }: { rows: EmailRow[] }) {
  // Hide workflow column entirely when no row carries the info, to avoid a
  // column full of "—". Filter is only shown when there's something to filter.
  const hasWorkflow = rows.some((r) => !!r.workflow);
  const columns = hasWorkflow ? baseColumns : baseColumns.filter((c) => c.key !== "workflow");

  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSortKey="createdAt"
      defaultSortDir="desc"
      searchPlaceholder="Search subject, recipient, company, workflow…"
      searchValue={(r) => `${r.subject} ${r.recipient} ${r.recipientCompany} ${r.recipientTitle} ${r.workflow}`}
      filter={hasWorkflow ? { label: "Workflow", value: (r) => r.workflow } : undefined}
      drawerTitle={(r) => r.subject}
      drawerSubtitle={(r) => `to ${r.recipient}${r.recipientCompany ? ` · ${r.recipientCompany}` : ""}`}
      drawerEntries={drawerEntries}
      emptyMessage="No emails match."
    />
  );
}
