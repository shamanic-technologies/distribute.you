"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportTable, StatusBadge, type ReportTableColumn, type TabSpec } from "./report-table";
// `status` is still surfaced in the row drawer; we no longer render it as a
// column because the active tab already conveys the milestone — and a row
// with a more-advanced status (e.g. replied) appearing in a less-advanced
// tab (e.g. opened) made the badge look mismatched.
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
  /** Most-advanced milestone reached. Used by sort + StatusBadge. */
  status: string;
  /** Raw intake status (served / skipped / claimed / buffered). Used by the
   *  tab predicates for the intake-side tabs. The consolidated `status`
   *  above shadows this whenever an email milestone is hit. */
  intakeStatus: "buffered" | "skipped" | "claimed" | "served";
  emailStatus: string;
  workflow: string;
  /** Kept for email-list matching only — never rendered. */
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
    render: (r) => <span className="font-medium text-gray-900 truncate block">{r.firstName} {r.lastName}</span>,
    className: "w-[15%]",
  },
  {
    key: "email",
    label: "Email",
    sortValue: (r) => r.email,
    render: (r) => <span className="font-mono text-xs truncate block" title={r.email}>{r.email}</span>,
    className: "w-[20%]",
  },
  {
    key: "title",
    label: "Title",
    sortValue: (r) => r.title,
    render: (r) => <span className="truncate block" title={r.title || undefined}>{r.title || "—"}</span>,
    className: "w-[15%]",
  },
  {
    key: "company",
    label: "Company",
    sortValue: (r) => r.company,
    render: (r) => (
      <div className="min-w-0">
        <div className="truncate" title={r.company || undefined}>{r.company || "—"}</div>
        {r.companyDomain && <div className="text-xs text-gray-500 truncate" title={r.companyDomain}>{r.companyDomain}</div>}
      </div>
    ),
    className: "w-[15%]",
  },
  {
    key: "industry",
    label: "Industry",
    sortValue: (r) => r.industry,
    render: (r) => <span className="truncate block" title={r.industry || undefined}>{r.industry || "—"}</span>,
    className: "w-[13%]",
  },
  {
    key: "country",
    label: "Country",
    sortValue: (r) => r.country,
    render: (r) => <span className="truncate block" title={r.country || undefined}>{r.country || "—"}</span>,
    className: "w-[10%]",
  },
  {
    key: "workflow",
    label: "Workflow",
    sortValue: (r) => r.workflow,
    render: (r) => <span className="truncate block text-xs text-indigo-700" title={r.workflow || undefined}>{r.workflow || "—"}</span>,
    className: "w-[12%]",
  },
];

// Tab order: most-advanced milestone leftmost, intake statuses last (right of
// the milestone band, before "All"). Each lead row appears in every tab whose
// predicate is true — a replied lead also shows under Clicked / Opened /
// Delivered / Sent. Intake tabs (served / skipped / claimed / buffered) are
// mutually exclusive per lead and orthogonal to the email-milestone tabs.
const TABS: TabSpec<LeadRow>[] = [
  { key: "replied", label: "Replied", match: (r) => r.replied },
  { key: "clicked", label: "Clicked", match: (r) => r.clicked },
  { key: "opened", label: "Opened", match: (r) => r.opened },
  { key: "delivered", label: "Delivered", match: (r) => r.delivered },
  { key: "sent", label: "Sent", match: (r) => r.sent },
  { key: "bounced", label: "Bounced", match: (r) => r.bounced },
  { key: "unsubscribed", label: "Unsubscribed", match: (r) => r.unsubscribed },
  { key: "contacted", label: "Contacted", match: (r) => r.contacted },
  { key: "served", label: "Processing", match: (r) => r.intakeStatus === "served" },
  { key: "skipped", label: "Skipped", match: (r) => r.intakeStatus === "skipped" },
  { key: "claimed", label: "Claimed", match: (r) => r.intakeStatus === "claimed" },
  { key: "buffered", label: "Buffered", match: (r) => r.intakeStatus === "buffered" },
  { key: "all", label: "All", match: () => true },
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
        <p className="text-xs text-gray-400 italic">Loading emails — can take up to 25s for large brands…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
        <div className="font-medium">Emails unavailable.</div>
        <div className="font-mono break-all">{error}</div>
        <div className="text-red-600/80">Upstream /v1/emails likely timed out. Reload to retry.</div>
      </div>
    );
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
    const url = `/api/public/report/${orgId}/${brandId}/emails?featureSlug=${encodeURIComponent(featureSlug)}`;
    const startedAt = Date.now();
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        const elapsed = Date.now() - startedAt;
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} after ${elapsed}ms: ${body.slice(0, 200)}`);
        }
        return res.json() as Promise<{ emails: { campaignId: string; leadFirstName: string; leadLastName: string; subject: string; bodyText: string; sentAt: string; workflow: string }[] }>;
      })
      .then((data) => {
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
        // eslint-disable-next-line no-console
        console.error(`[report-leads] emails fetch failed for brand ${brandId}:`, err);
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
        { label: "Workflow", value: r.workflow || null },
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
      defaultSortKey="name"
      defaultSortDir="asc"
      searchPlaceholder="Search name, email, company…"
      searchValue={(r) => `${r.firstName} ${r.lastName} ${r.email} ${r.title} ${r.company} ${r.industry} ${r.country} ${r.workflow}`}
      tabs={TABS}
      fixedLayout
      drawerTitle={(r) => `${r.firstName} ${r.lastName}`.trim() || r.email}
      drawerSubtitle={(r) => r.email}
      drawerEntries={drawerEntries}
      onRowSelect={setSelected}
      emptyMessage="No leads match."
    />
  );
}
