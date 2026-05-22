"use client";

import { ReportTable, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface EmailRow {
  id: string;
  subject: string;
  recipient: string;
  recipientCompany: string;
  recipientTitle: string;
  workflow: string;
  campaign: string;
  createdAt: string;
  bodyText: string;
}

const columns: ReportTableColumn<EmailRow>[] = [
  { key: "subject", label: "Subject", sortValue: (r) => r.subject, render: (r) => <span className="font-medium text-gray-900 truncate">{r.subject}</span> },
  { key: "recipient", label: "To", sortValue: (r) => r.recipient, render: (r) => r.recipient || "—" },
  { key: "company", label: "Company", sortValue: (r) => r.recipientCompany, render: (r) => r.recipientCompany || "—" },
  { key: "workflow", label: "Workflow", sortValue: (r) => r.workflow, render: (r) => r.workflow || "—" },
  { key: "campaign", label: "Campaign", sortValue: (r) => r.campaign, render: (r) => r.campaign || "—" },
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
    { label: "Workflow", value: r.workflow },
    { label: "Campaign", value: r.campaign },
    { label: "Sent at", value: new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) },
    { label: "Subject", value: r.subject, block: true },
    {
      label: "Body",
      value: r.bodyText ? <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{r.bodyText}</pre> : null,
      block: true,
    },
  ];
}

export function EmailsTable({ rows }: { rows: EmailRow[] }) {
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchPlaceholder="Search subject, recipient, company…"
      searchValue={(r) => `${r.subject} ${r.recipient} ${r.recipientCompany} ${r.recipientTitle} ${r.workflow} ${r.campaign}`}
      filter={{ label: "Campaign", value: (r) => r.campaign }}
      drawerTitle={(r) => r.subject}
      drawerSubtitle={(r) => `to ${r.recipient}${r.recipientCompany ? ` · ${r.recipientCompany}` : ""}`}
      drawerEntries={drawerEntries}
      emptyMessage="No emails match."
    />
  );
}
