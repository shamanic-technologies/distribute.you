"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportTable, StatusBadge, type ReportTableColumn } from "./report-table";
import type { DrawerEntry } from "./data-drawer";

export interface LeadEmailSummary {
  subject: string;
  bodyText: string;
  sentAt: string;
  workflow: string;
}

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
  /** Most-advanced milestone reached. */
  status: string;
  emailStatus: string;
  campaign: string;
  campaignId: string;
  contacted: boolean;
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  replied: boolean;
  replyClassification: string | null;
}

interface Milestone {
  key: keyof Pick<LeadRow, "contacted" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced" | "unsubscribed">;
  label: string;
}

const MILESTONES: Milestone[] = [
  { key: "contacted", label: "Contacted" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "replied", label: "Replied" },
  { key: "bounced", label: "Bounced" },
  { key: "unsubscribed", label: "Unsubscribed" },
];

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

function StatusTimeline({ row }: { row: LeadRow }) {
  return (
    <ul className="space-y-1.5">
      {MILESTONES.map((m) => {
        const hit = row[m.key];
        const dim = m.key === "bounced" || m.key === "unsubscribed";
        return (
          <li key={m.key} className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full border ${
              hit
                ? dim
                  ? "bg-red-100 border-red-300 text-red-700"
                  : "bg-green-100 border-green-300 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-300"
            }`}>
              {hit ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </span>
            <span className={hit ? "text-gray-800 font-medium" : "text-gray-400"}>{m.label}</span>
            {m.key === "replied" && hit && row.replyClassification && (
              <span className={`ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                row.replyClassification === "positive"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : row.replyClassification === "negative"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-zinc-200 text-zinc-700 border-zinc-300"
              }`}>
                {row.replyClassification}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EmailSection({ emails, isLoading, error }: { emails: LeadEmailSummary[]; isLoading: boolean; error: string | null }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 w-full bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }
  if (error) {
    return <em className="text-xs text-gray-400">Emails unavailable: {error}</em>;
  }
  if (emails.length === 0) {
    return <em className="text-gray-400">No email recorded for this lead.</em>;
  }
  return (
    <div className="space-y-4">
      {emails.map((e, i) => (
        <div key={i} className="space-y-1.5">
          <div className="text-xs text-gray-500">
            {new Date(e.sentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {e.workflow && <> · <span className="text-indigo-700">{e.workflow}</span></>}
          </div>
          <div className="font-medium text-gray-800">{e.subject || <em className="text-gray-400">(no subject)</em>}</div>
          {e.bodyText
            ? <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded p-3 whitespace-pre-wrap font-sans">{e.bodyText}</pre>
            : <em className="text-xs text-gray-400">No body text available.</em>}
        </div>
      ))}
    </div>
  );
}

interface BrandEmailsState {
  status: "idle" | "loading" | "ready" | "error";
  emails: LeadEmailSummary[];
  byKey: Map<string, LeadEmailSummary[]>;
  error: string | null;
}

function leadKey(campaignId: string, firstName: string, lastName: string): string {
  return `${campaignId}::${firstName.toLowerCase()}::${lastName.toLowerCase()}`;
}

function indexByLead(items: { campaignId: string; leadFirstName: string; leadLastName: string; subject: string; bodyText: string; sentAt: string; workflow: string }[]): Map<string, LeadEmailSummary[]> {
  const map = new Map<string, LeadEmailSummary[]>();
  for (const e of items) {
    const k = leadKey(e.campaignId, e.leadFirstName, e.leadLastName);
    const summary: LeadEmailSummary = { subject: e.subject, bodyText: e.bodyText, sentAt: e.sentAt, workflow: e.workflow };
    const existing = map.get(k);
    if (existing) existing.push(summary);
    else map.set(k, [summary]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
  return map;
}

interface LeadsTableProps {
  rows: LeadRow[];
  orgId: string;
  brandId: string;
  featureSlug: string;
}

export function LeadsTable({ rows, orgId, brandId, featureSlug }: LeadsTableProps) {
  const [selected, setSelected] = useState<LeadRow | null>(null);
  const [emailsState, setEmailsState] = useState<BrandEmailsState>({ status: "idle", emails: [], byKey: new Map(), error: null });

  // Fire ONE brand-scoped fetch the first time a drawer is opened. Cache
  // result for the session; subsequent row clicks just index into the map.
  useEffect(() => {
    if (!selected) return;
    if (emailsState.status !== "idle") return;
    let aborted = false;
    setEmailsState((s) => ({ ...s, status: "loading" }));
    fetch(`/api/public/report/${orgId}/${brandId}/emails?featureSlug=${encodeURIComponent(featureSlug)}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data: { emails: { campaignId: string; leadFirstName: string; leadLastName: string; subject: string; bodyText: string; sentAt: string; workflow: string }[] }) => {
        if (aborted) return;
        const list = data.emails ?? [];
        setEmailsState({
          status: "ready",
          emails: list,
          byKey: indexByLead(list),
          error: null,
        });
      })
      .catch((err) => {
        if (aborted) return;
        setEmailsState({ status: "error", emails: [], byKey: new Map(), error: err instanceof Error ? err.message : String(err) });
      });
    return () => { aborted = true; };
  }, [selected, emailsState.status, orgId, brandId, featureSlug]);

  const drawerEntries = useMemo<(row: LeadRow) => DrawerEntry[]>(() => {
    return (r: LeadRow) => {
      const k = leadKey(r.campaignId, r.firstName, r.lastName);
      const emailsForLead = emailsState.byKey.get(k) ?? [];
      const isLoading = emailsState.status === "idle" || emailsState.status === "loading";
      return [
        { label: "Email", value: r.email, monospace: true },
        { label: "Current status", value: <StatusBadge status={r.status} /> },
        { label: "Title", value: r.title },
        { label: "Company", value: r.company },
        { label: "Company domain", value: r.companyDomain, monospace: true },
        { label: "Industry", value: r.industry },
        { label: "City", value: r.city },
        { label: "Country", value: r.country },
        { label: "LinkedIn", value: r.linkedinUrl ? <a href={r.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{r.linkedinUrl}</a> : null, block: true },
        { label: "Email delivery state", value: r.emailStatus },
        { label: "Campaign", value: r.campaign },
        { label: "Milestones reached", value: <StatusTimeline row={r} />, block: true },
        {
          label: emailsForLead.length > 1 ? `Emails sent (${emailsForLead.length})` : "Email sent",
          value: <EmailSection emails={emailsForLead} isLoading={isLoading} error={emailsState.error} />,
          block: true,
        },
      ];
    };
  }, [emailsState]);

  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.email}
      defaultSortKey="status"
      defaultSortDir="asc"
      searchPlaceholder="Search name, email, company…"
      searchValue={(r) => `${r.firstName} ${r.lastName} ${r.email} ${r.title} ${r.company} ${r.industry} ${r.country} ${r.campaign}`}
      filter={{ label: "Status", value: (r) => r.status }}
      drawerTitle={(r) => `${r.firstName} ${r.lastName}`.trim() || r.email}
      drawerSubtitle={(r) => r.email}
      drawerEntries={drawerEntries}
      onRowSelect={setSelected}
      emptyMessage="No leads match."
    />
  );
}
