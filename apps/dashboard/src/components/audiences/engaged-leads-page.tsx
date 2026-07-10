"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import {
  listBrandLeads,
  getLeadConsolidatedStatus,
  leadSequenceLabel,
  getBrandSalesEconomics,
  getFeatureRevenue,
  keepLastGoodFeatureRevenue,
  getLeadEmail,
  listAudiences,
  type Lead,
  type LeadConsolidatedStatus,
  type LeadEmailGeneration,
  type AudienceWire,
} from "@/lib/api";
import {
  goalLeadTabs,
  goalOutcomeTab,
  type AnyLeadTab,
  type OutcomeTab,
} from "@/lib/goal-steps";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import type { ConversionLead, RevenueOverview } from "@/lib/revenue-view";
import { buildLeadsCsv } from "@/lib/leads-csv";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { EmailSignature } from "@/components/email-signature";
import { Skeleton } from "@/components/skeleton";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";

// Labels for the goal-driven Leads tabs (goal-steps returns the ordered keys).
const LEAD_TAB_LABEL: Record<AnyLeadTab, string> = {
  "positive-replies": "Positive replies",
  clicks: "Website Visits",
  outreach: "Outreach",
  signups: "Signups",
  meetings: "Meetings",
  "form-submissions": "Form submissions",
  purchases: "Purchases",
};

const OUTCOME_TABS: ReadonlySet<string> = new Set<OutcomeTab>([
  "signups",
  "meetings",
  "form-submissions",
  "purchases",
]);
const isOutcomeTab = (tab: string): tab is OutcomeTab => OUTCOME_TABS.has(tab);

const LEAD_STATUS_ORDER: LeadConsolidatedStatus[] = [
  "replied",
  "clicked",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

// "all" is NOT a rendered tab — it's an internal sort-mode (base "most-recent
// activity" ordering for `sortedLeads` + `leadDateForTab`). The All UI tab was
// removed; the funnel tabs are the four below.
type Tab = "positive-replies" | "clicks" | "outreach" | "all" | OutcomeTab;

// The Date column + sort key are PER-TAB: each tab shows the first-occurrence
// timestamp of the engagement that tab is about (Clicks → first click,
// Outreach → first contacted, Positive replies → first reply). The
// "all" tab has no single engagement, so it uses the most-recent activity across
// every first-occurrence timestamp.
function leadDateForTab(lead: Lead, tab: Tab): string | null {
  switch (tab) {
    case "positive-replies": return lead.firstRepliedAt ?? null;
    case "clicks": return lead.firstClickedAt ?? null;
    case "outreach": return lead.firstContactedAt ?? null;
    case "all": {
      const ats = [
        lead.firstRepliedAt,
        lead.firstClickedAt,
        lead.firstDeliveredAt,
        lead.firstSentAt,
        lead.firstContactedAt,
      ].filter((a): a is string => !!a);
      if (ats.length === 0) return null;
      return ats.reduce((latest, a) => (new Date(a).getTime() > new Date(latest).getTime() ? a : latest));
    }
    // Outcome tabs (signups/meetings/form-submissions/purchases): the date is the
    // realized-outcome timestamp on the /revenue join, not on the lead-service row —
    // resolved separately via `outcomeDates` in the table + grouping.
    default: return null;
  }
}

function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Clicked";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    case "contacted": return "Contacted";
    case "served": return "Processing";
    case "skipped": return "Skipped";
    case "claimed": return "Claimed";
    case "buffered": return "Buffered";
  }
}

function leadStatusStyle(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "clicked": return "bg-violet-100 text-violet-700 border-violet-200";
    case "delivered": return "bg-green-100 text-green-700 border-green-200";
    case "sent": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "bounced": return "bg-red-100 text-red-600 border-red-200";
    case "unsubscribed": return "bg-amber-100 text-amber-700 border-amber-200";
    case "contacted": return "bg-teal-100 text-teal-700 border-teal-200";
    case "served": return "bg-orange-100 text-orange-700 border-orange-200";
    case "skipped": return "bg-gray-100 text-gray-500 border-gray-200";
    case "claimed": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "buffered": return "bg-blue-100 text-blue-600 border-blue-200";
  }
}

function timeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  // Future events (e.g. scheduled follow-up steps) read as negative — render
  // them as "in N…" instead of collapsing to "just now".
  const future = diffSeconds < 0;
  const seconds = Math.abs(diffSeconds);
  const minutes = Math.floor(seconds / 60);
  const fmt = (value: string) => (future ? `in ${value}` : `${value} ago`);
  if (minutes < 1) return future ? "soon" : "just now";
  if (minutes < 60) return fmt(`${minutes}m`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return fmt(`${hours}h`);
  const days = Math.floor(hours / 24);
  if (days < 30) return fmt(`${days}d`);
  const months = Math.floor(days / 30);
  if (months < 12) return fmt(`${months}mo`);
  const years = Math.floor(months / 12);
  return fmt(`${years}y`);
}

// Gap between two consecutive timeline entries, shown in the left gutter so the
// spacing between steps is visible at a glance instead of buried in the row text.
function gapLabel(prevAt: string, at: string): string {
  const diff = new Date(at).getTime() - new Date(prevAt).getTime();
  const minutes = Math.round(Math.abs(diff) / 60000);
  if (minutes < 1) return "·";
  if (minutes < 60) return `+${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `+${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `+${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `+${months}mo`;
  return `+${Math.round(months / 12)}y`;
}

// Firmographic display helpers (reassurance fields). The values come from the
// `view=basic` org projection (widened lead-service-side); render "-" until
// present so the page ships ahead of the producer.
function formatEmployees(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `${n}`;
}

function formatRevenue(v: string | number | null | undefined): string {
  if (v == null || v === "") return "-";
  const n = typeof v === "number" ? v : Number(v);
  // annualRevenue can arrive as a numeric string (e.g. "12000000") or an
  // already-formatted band (e.g. "$1M-$10M"); only reformat the numeric case.
  if (!Number.isFinite(n) || (typeof v === "string" && !/^\d+(\.\d+)?$/.test(v.trim()))) return String(v);
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// Plain-text preview of an email body (strip tags) when only bodyHtml exists.
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Shared logo.dev token (also used in `BrandLogo`, public
// `components/report/leads-table.tsx`, and the landing's
// `provider-avatar.tsx`). Replaces the old Google S2 favicons surface to
// keep the company-avatar treatment consistent across the whole app.
const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

function CompanyLogo({ domain, name }: { domain: string | null; name: string | null }) {
  if (domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=32`}
        alt=""
        className="w-6 h-6 rounded"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}

// Per-lead audience — served ready-made on the lead row by lead-service
// (`lead.audience` = {id,name,avatarUrl} from the leads_campaigns attribution).
// Null when the lead was never attributed to an audience.
type LeadAudience = { name: string; avatarUrl: string | null };

function AudienceCell({ audience }: { audience: LeadAudience | null }) {
  if (!audience) return <span className="text-xs text-gray-300">-</span>;
  return (
    <div className="flex items-center gap-2">
      {audience.avatarUrl ? (
        <img
          src={audience.avatarUrl}
          alt=""
          className="w-6 h-6 rounded object-cover bg-white border border-gray-200 shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="w-6 h-6 rounded bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center shrink-0">
          {audience.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-gray-700">{audience.name}</span>
    </div>
  );
}

// Right-panel "Audience" card — which saved audience this lead was attributed to.
// `inline` = the {id,name,avatarUrl} served on the lead row (always present when
// attributed); `full` = the matching human-service audience row looked up by id
// (description / Size / Remaining), null until listAudiences resolves or when the
// audience was archived away. Renders nothing when the lead has no audience.
function AudienceSection({
  inline,
  full,
}: {
  inline: { id: string; name: string; avatarUrl: string | null };
  full: AudienceWire | null;
}) {
  const avatarUrl = inline.avatarUrl ?? full?.avatarUrl ?? null;
  const description = full?.description ?? null;
  const size = full?.sizeCount;
  const remainingPct = full?.availableToContactPct;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Audience</h3>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-9 h-9 rounded object-cover bg-white border border-gray-200 shrink-0"
            loading="lazy"
          />
        ) : (
          <span className="w-9 h-9 rounded bg-brand-100 text-brand-700 text-sm font-semibold flex items-center justify-center shrink-0">
            {inline.name.charAt(0).toUpperCase()}
          </span>
        )}
        <p className="font-medium text-gray-800 text-sm">{inline.name}</p>
      </div>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      {(size != null || remainingPct != null) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {size != null && (
            <div><span className="text-gray-500">Size:</span><p className="font-medium">{size.toLocaleString("en-US")}</p></div>
          )}
          {remainingPct != null && (
            <div><span className="text-gray-500">Remaining:</span><p className="font-medium">{remainingPct}%</p></div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LeadConsolidatedStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>{leadStatusLabel(status)}</span>;
}

// Outreach-tab Status cell: which email of the sequence actually went out
// (Initial / Follow-up N) from the backend `sentCount`. Falls back to the
// generic "Contacted" badge while the producers haven't shipped the field.
function OutreachSequenceBadge({ lead }: { lead: Lead }) {
  const label = leadSequenceLabel(lead.sentCount);
  if (label === null) return <StatusBadge status="contacted" />;
  return <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">{label}</span>;
}

// A single merged timeline entry: a delivery EVENT (dot + label + date) or the
// actual EMAIL we sent (subject + body, expandable), interleaved chronologically.
type TimelineEntry =
  | { kind: "event"; at: string; label: string; dot: string }
  | { kind: "email"; at: string; label: string; subject: string | null; body: string };

function emailBodyText(html: string | null | undefined, text: string | null | undefined): string {
  if (text && text.trim()) return text.trim();
  if (html && html.trim()) return htmlToText(html);
  return "";
}

// Per-lead activity timeline: delivery events (from the email-gateway
// first-occurrence timestamps forwarded by lead-service) interleaved with the
// actual emails we sent — initial + each follow-up step — most-recent first.
// The email content is fetched on-demand by leadId (content-generation). Renders
// nothing until at least one event timestamp OR an email is present.
function LeadTimeline({ lead, email }: { lead: Lead; email: LeadEmailGeneration | null }) {
  const replyColor =
    lead.replyClassification === "positive" ? "bg-green-500"
      : lead.replyClassification === "negative" ? "bg-red-500"
        : "bg-violet-500";

  const entries: TimelineEntry[] = [
    { kind: "event", label: "Contacted", at: lead.firstContactedAt ?? "", dot: "bg-gray-400" },
    { kind: "event", label: "Sent", at: lead.firstSentAt ?? "", dot: "bg-blue-400" },
    { kind: "event", label: "Delivered", at: lead.firstDeliveredAt ?? "", dot: "bg-blue-500" },
    { kind: "event", label: "Clicked", at: lead.firstClickedAt ?? "", dot: "bg-violet-500" },
    {
      kind: "event",
      label: lead.replyClassification ? `Replied (${lead.replyClassification})` : "Replied",
      at: lead.firstRepliedAt ?? "",
      dot: replyColor,
    },
    { kind: "event", label: "Bounced", at: lead.firstBouncedAt ?? "", dot: "bg-red-500" },
    { kind: "event", label: "Unsubscribed", at: lead.firstUnsubscribedAt ?? "", dot: "bg-amber-500" },
  ];

  // Place emails at their send time. The lead's firstSentAt is when the initial
  // email went out; follow-up steps are offset by their cumulative daysSinceLastStep.
  // Fall back to the generation createdAt when no send timestamp exists yet.
  if (email) {
    const anchor = lead.firstSentAt ?? email.createdAt ?? "";
    const anchorMs = anchor ? new Date(anchor).getTime() : NaN;
    const initialBody = emailBodyText(email.bodyHtml, email.bodyText);
    // The initial "Initial email" entry: prefer the generation's top-level body. Some
    // generations leave that empty and carry the initial email as sequence step 1 —
    // so never push an empty "Initial email" row here; fall through to claim step 1 below.
    let initialDone = false;
    if (initialBody) {
      entries.push({ kind: "email", label: "Initial email", at: anchor, subject: email.subject ?? null, body: initialBody });
      initialDone = true;
    }
    let cumDays = 0;
    for (const step of email.sequence ?? []) {
      const body = emailBodyText(step.bodyHtml, step.bodyText);
      if (!body) continue;
      cumDays += step.daysSinceLastStep || 0;
      // Step 1 IS the initial email. If the top-level body was empty, this step
      // becomes the "Initial email" entry; otherwise it duplicates the initial — skip.
      const isInitial = step.step === 1 || (cumDays === 0 && body === initialBody);
      if (isInitial) {
        if (!initialDone) {
          entries.push({ kind: "email", label: "Initial email", at: anchor, subject: email.subject ?? null, body });
          initialDone = true;
        }
        continue;
      }
      const at = Number.isFinite(anchorMs) ? new Date(anchorMs + cumDays * 86_400_000).toISOString() : "";
      entries.push({ kind: "email", label: `Follow-up${step.step ? ` (step ${step.step})` : ""}`, at, subject: email.subject ?? null, body });
    }
  }

  // Same-date tie-break: most-advanced stage on top, oldest at the bottom.
  // (Primary sort is still timestamp desc; this only orders entries sharing the
  // same instant — e.g. Sent / Delivered / Initial email all at firstSentAt.)
  const stageRank = (e: TimelineEntry): number => {
    if (e.kind === "email") return e.label === "Initial email" ? 1 : 3; // follow-ups above initial, below Sent
    const l = e.label;
    if (l.startsWith("Replied")) return 9;
    if (l === "Unsubscribed") return 8;
    if (l === "Bounced") return 8;
    if (l === "Clicked") return 7;
    if (l === "Delivered") return 5;
    if (l === "Sent") return 4;
    if (l === "Contacted") return 2;
    return 0;
  };

  // Oldest → newest, top → bottom (past reads down into the future). Same-instant
  // tie-break: least-advanced stage first (Contacted before Sent before Delivered…).
  const sorted = entries
    .filter((e) => !!e.at)
    .sort((a, b) => {
      const dt = new Date(a.at).getTime() - new Date(b.at).getTime();
      return dt !== 0 ? dt : stageRank(a) - stageRank(b);
    });

  if (sorted.length === 0) return null;

  // Split past (already happened) from future (scheduled-but-unsent follow-up
  // steps, placed at their estimated send time). The "Now" divider sits between
  // them so past/present/future are visually distinct.
  const nowMs = Date.now();
  const firstFutureIdx = sorted.findIndex((e) => new Date(e.at).getTime() > nowMs);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Activity timeline</h3>
      <ol className="relative">
        {sorted.map((e, i) => {
          const isFuture = new Date(e.at).getTime() > nowMs;
          // Left gutter: first row shows its absolute date; each later row shows
          // the gap since the previous entry (+2d, +4h…).
          const gutter = i === 0
            ? new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : gapLabel(sorted[i - 1].at, e.at);
          return (
            <Fragment key={`${e.kind}-${e.label}-${e.at}-${i}`}>
              {i === firstFutureIdx && firstFutureIdx !== -1 && (
                <li className="flex items-center gap-2 py-2" aria-hidden>
                  <span className="w-14 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">Now</span>
                  <span className="flex-1 border-t border-dashed border-gray-200" />
                </li>
              )}
              <li className="flex gap-2">
                <div className={`w-14 shrink-0 text-right pr-1 pt-1 text-[11px] tabular-nums ${i === 0 ? "text-gray-500" : "text-gray-400"}`}>
                  {gutter}
                </div>
                <div className={`relative flex-1 pl-4 pb-4 last:pb-0 ${isFuture ? "opacity-70" : ""}`}>
                  {i < sorted.length - 1 && <span className="absolute left-[3px] top-3 bottom-0 w-px bg-gray-200" aria-hidden />}
                  <span className={`absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full ${e.kind === "email" ? "bg-brand-500" : e.dot} ${isFuture ? "ring-2 ring-white outline-1 outline-dashed outline-gray-300" : ""}`} aria-hidden />
                  <p className="text-sm font-medium text-gray-800">
                    {e.kind === "email" && (
                      <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    )}
                    {e.label}
                    {isFuture && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">scheduled</span>}
                  </p>
                  <p className="text-xs text-gray-500" title={new Date(e.at).toLocaleString()}>
                    {new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {e.kind === "email" && (
                    <details className="mt-1.5 group">
                      <summary className="cursor-pointer text-xs text-brand-600 hover:text-brand-700 select-none">
                        {e.subject ? <span className="font-medium text-gray-700">{e.subject}</span> : "View email"}
                      </summary>
                      <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded p-2">
                        <pre className="whitespace-pre-wrap break-words font-sans text-xs text-gray-600">{e.body}</pre>
                        <EmailSignature className="text-xs" />
                      </div>
                    </details>
                  )}
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function LeadsLoadingSkeleton() {
  return (
    <>
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-2">
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-4 h-10 w-full rounded-lg" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_8rem_7rem_5rem] gap-4 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <Skeleton className="h-6 w-6 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
              <Skeleton className="hidden h-4 w-12 rounded md:block" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function LeadsTable({ leads, tab, selectedLead, onSelectLead, statusOf, audienceOf, forceContacted, outcomeDates }: {
  leads: Lead[];
  tab: Tab;
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  statusOf: (lead: Lead) => LeadConsolidatedStatus;
  audienceOf: (lead: Lead) => LeadAudience | null;
  // Outreach tab: every row is the flat universe we contacted, so show a single
  // "Contacted" tag on all rows rather than each lead's most-advanced status
  // (those leads also surface under Clicks/Replies with their real status).
  forceContacted?: boolean;
  // Realized-outcome timestamp per leadId (from the /revenue join) — the Date column
  // for an outcome tab reads this, since the lead-service row carries no outcome date.
  outcomeDates?: Map<string, string | null>;
}) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500 text-sm">No leads in this tab.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3 hidden lg:table-cell">Industry</th>
            <th className="px-4 py-3 hidden md:table-cell">Audience</th>
            <th className="px-4 py-3 hidden sm:table-cell">Status</th>
            <th className="px-4 py-3 hidden md:table-cell">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const full = lead.lead;
            const org = full?.organization ?? null;
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.id === lead.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CompanyLogo domain={org?.primaryDomain ?? null} name={org?.name ?? null} />
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">{org?.name || "Unknown"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{full?.firstName ?? ""} {full?.lastName ?? ""}</p>
                      {full?.headline && <p className="text-xs text-gray-500 truncate max-w-[180px]">{full.headline}</p>}
                    </div>
                    {full?.linkedinUrl && (
                      <span className="text-blue-400 shrink-0">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell"><span className="text-gray-600 truncate block max-w-[160px]" title={org?.industry ?? undefined}>{org?.industry || "-"}</span></td>
                <td className="px-4 py-3 hidden md:table-cell"><AudienceCell audience={audienceOf(lead)} /></td>
                <td className="px-4 py-3 hidden sm:table-cell">{forceContacted ? <OutreachSequenceBadge lead={lead} /> : <StatusBadge status={statusOf(lead)} />}</td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {(() => {
                    const at = isOutcomeTab(tab)
                      ? outcomeDates?.get(lead.id) ?? null
                      : leadDateForTab(lead, tab);
                    return at ? (
                      <span className="text-xs text-gray-500" title={new Date(at).toLocaleString()}>{timeAgo(at)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EngagedLeadsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("positive-replies");
  const [search, setSearch] = useState("");
  const hasAutoSelectedTab = useRef(false);

  const { data, isPending, isPlaceholderData } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  const leads = useMemo(() => data?.leads ?? [], [data]);

  // Brand optimization goal drives the default tab: signups → Website visits,
  // sales_meetings (server default when unset) → Positive replies.
  const { data: econData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    {},
  );
  const optimizationGoal = econData?.salesEconomics?.optimizationGoal ?? null;
  const goal = optimizationGoal ?? "sales_meetings";

  // Realized per-lead OUTCOMES (features-service#476 conversion-tracker attribution)
  // live on the /revenue `leads[]` rows, NOT the lead-service `listBrandLeads` row —
  // so fetch /revenue (same query key as the stat cards → React Query dedupes to one
  // poll) and join by the lead IDENTITY (`lead.leadId` ↔ `ConversionLead.leadId`, not
  // the leads_campaigns row `id`). The outcome tab (Signups/Meetings/Form submissions/
  // Purchases) buckets on the join boolean + dates on its timestamp.
  const featureSlug = useSoleFeatureSlug();
  const revenueEnabled = isRevenueFeature(featureSlug);
  const { data: revenueData } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    {
      enabled: revenueEnabled,
      refetchInterval: POLL_INTERVAL,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
    },
  );
  const outcomeByLeadId = useMemo(() => {
    const m = new Map<string, ConversionLead>();
    for (const l of revenueData?.leads ?? []) m.set(l.leadId, l);
    return m;
  }, [revenueData]);

  const outcomeTab = goalOutcomeTab(goal);
  // The outcome tab shows ONLY once the /revenue join actually serves its per-lead
  // field — absent (all `undefined`) on a pre-#476-prod payload → hidden (no empty tab).
  const outcomeAvailable =
    !!outcomeTab &&
    (revenueData?.leads ?? []).some((l) => l[outcomeTab.leadField] !== undefined);
  // Realized-outcome timestamp per lead-ROW id (LeadsTable's Date column reads it).
  const outcomeDates = useMemo(() => {
    const m = new Map<string, string | null>();
    if (!outcomeTab) return m;
    for (const lead of leads) {
      const cl = lead.leadId ? outcomeByLeadId.get(lead.leadId) : undefined;
      m.set(lead.id, cl?.[outcomeTab.dateField] ?? null);
    }
    return m;
  }, [leads, outcomeByLeadId, outcomeTab]);

  // Audience per lead — read straight off the lead row. lead-service serves
  // `lead.audience` ({id,name,avatarUrl}) from the leads_campaigns attribution,
  // so the column renders on every tab with no client-side membership join.
  const audienceOf = (lead: Lead): LeadAudience | null =>
    lead.audience ? { name: lead.audience.name, avatarUrl: lead.audience.avatarUrl } : null;

  // Base "all" ordering — most-recent activity first (the "all" Date column).
  // Each funnel tab re-sorts by ITS OWN date field below. Null sinks to bottom.
  const sortByTabDate = (arr: Lead[], tab: Tab): Lead[] =>
    [...arr].sort((a, b) => {
      const at = leadDateForTab(a, tab);
      const bt = leadDateForTab(b, tab);
      const d = (bt ? new Date(bt).getTime() : 0) - (at ? new Date(at).getTime() : 0);
      // Deterministic tiebreak: leads sharing a timestamp (batch send → same
      // firstContactedAt) or both-null dates would otherwise fall back to the
      // backend array order, which lead-service does not sort (physical/heap
      // order shifts when a row is UPDATED — e.g. on a follow-up send), so they
      // reshuffle on the 30s poll. Freeze ties by lead id.
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  const sortedLeads = useMemo(() => sortByTabDate(leads, "all"), [leads]);

  // Monotonic status latch: each lead's tab is derived from the email-gateway
  // delivery overlay, which can transiently drop on a poll and bounce a lead
  // back to "Processing" — emptying the tab being viewed, then repopulating.
  // Engagement is append-only, so a less-advanced status on a later poll is a
  // stale read: keep the most-advanced status seen this mount (see #1257 latch
  // philosophy). `statusOf` is the single source the table, tabs, and side
  // panel all bucket on.
  const statusEntries = useMemo(
    () => sortedLeads.map((l) => ({ id: l.id, status: getLeadConsolidatedStatus(l) })),
    [sortedLeads],
  );
  const latchedStatus = useMonotonicStatuses(statusEntries, LEAD_STATUS_ORDER, "leads");
  const statusOf = (lead: Lead): LeadConsolidatedStatus =>
    (latchedStatus.get(lead.id) as LeadConsolidatedStatus | undefined) ?? getLeadConsolidatedStatus(lead);

  // CSV export = the WHOLE leads list (every tab), not the active-tab/search
  // subset. Status label uses the same latched `statusOf` the badge renders, so
  // the exported Status matches on-screen. Recomputed only when leads/latch move.
  const leadsCsv = useMemo(
    () => buildLeadsCsv(leads, (l) => leadStatusLabel(statusOf(l))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, latchedStatus],
  );

  const groupedByTab = useMemo(() => {
    const positive: Lead[] = [];
    const clicks: Lead[] = [];
    const outreach: Lead[] = [];
    for (const lead of leads) {
      if (lead.replyClassification === "positive") positive.push(lead);
      if (lead.clicked) clicks.push(lead);
      if (lead.contacted) outreach.push(lead);
    }
    const groups = new Map<Tab, Lead[]>();
    // Each tab sorted desc by its OWN date column (Clicks → first click, etc.).
    groups.set("positive-replies", sortByTabDate(positive, "positive-replies"));
    groups.set("clicks", sortByTabDate(clicks, "clicks"));
    groups.set("outreach", sortByTabDate(outreach, "outreach"));
    // Realized-outcome bucket: leads the /revenue join flags for the goal's outcome,
    // sorted desc by the outcome timestamp. Only leads present in the join AND flagged
    // true qualify (null/undefined = not reached).
    if (outcomeTab) {
      const field = outcomeTab.leadField;
      const reached = leads.filter((lead) => {
        const cl = lead.leadId ? outcomeByLeadId.get(lead.leadId) : undefined;
        return cl?.[field] === true;
      });
      reached.sort((a, b) => {
        const at = outcomeDates.get(a.id);
        const bt = outcomeDates.get(b.id);
        const d = (bt ? new Date(bt).getTime() : 0) - (at ? new Date(at).getTime() : 0);
        // Same deterministic tiebreak as sortByTabDate — freeze equal/null
        // outcome timestamps by lead id so the tab order is poll-stable.
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
      groups.set(outcomeTab.tab, reached);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, sortedLeads, outcomeTab, outcomeByLeadId, outcomeDates]);

  // Open, once (after leads + the sales-economics query have settled), the leftmost
  // on-path tab that has leads, in the goal's OUTCOME-FIRST order (goal-steps single
  // source: sales_meetings → Positive replies first, visit goals → Website Visits
  // first, Outreach last). Fall through to the next non-empty tab so the user never
  // lands on an empty tab; default to the last (Outreach) when all empty. User manual
  // switches latch the ref and are never overridden by a later poll. Gate on `econData`
  // (not `optimizationGoal`, which is null both while loading AND when unset).
  // Visible tabs, left→right: the realized-outcome tab FIRST (when the /revenue join
  // serves it), then the goal's engagement tabs (outcome-first), Outreach last.
  const visibleTabs: Tab[] = [
    ...(outcomeAvailable && outcomeTab ? [outcomeTab.tab] : []),
    ...goalLeadTabs(goal),
  ];

  useEffect(() => {
    if (hasAutoSelectedTab.current) return;
    if (sortedLeads.length === 0 || econData === undefined) return;
    hasAutoSelectedTab.current = true;
    const count = (t: Tab) => groupedByTab.get(t)?.length ?? 0;
    setActiveTab(visibleTabs.find((t) => count(t) > 0) ?? visibleTabs[visibleTabs.length - 1] ?? "outreach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLeads.length, econData, optimizationGoal, groupedByTab, outcomeAvailable]);

  const activeList = groupedByTab.get(activeTab) ?? sortedLeads;

  const filteredLeads = useMemo(() => {
    if (!search) return activeList;
    const q = search.toLowerCase();
    return activeList.filter((l) => {
      const full = l.lead;
      const name = `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.toLowerCase();
      return name.includes(q)
        || (full?.organization?.name?.toLowerCase().includes(q) ?? false)
        || (full?.headline?.toLowerCase().includes(q) ?? false)
        || (l.email?.toLowerCase().includes(q) ?? false);
    });
  }, [activeList, search]);

  // Tabs = the realized-outcome tab (when available) + the goal's on-path engagement
  // steps, outcome-first (goal-steps single source), off-funnel steps dropped.
  const tabs: { key: Tab; label: string; count: number }[] = visibleTabs.map((key) => ({
    key,
    label: LEAD_TAB_LABEL[key as AnyLeadTab],
    count: groupedByTab.get(key)?.length ?? 0,
  }));

  // Contacted-lead count from the SAME listBrandLeads snapshot the table renders
  // (= the Outreach tab count). Passed to the stat box so the box reads the
  // leads-snapshot single source (303) instead of the legacy /stats email-gateway
  // aggregate (301) — mirrors the brand Overview's outreachContacted override
  // (features-service #371/#372). Both surfaces now move together.
  const contactedCount = groupedByTab.get("outreach")?.length ?? 0;

  // Static-shell-first (CLAUDE.md "Page composition: shell+nav+header render
  // instantly; each card owns its skeleton"). The shell (stat cards, h1, tabs,
  // search) paints immediately; only the table region skeletons while the slow
  // `brandLeads` fetch (lead-service is the bottleneck) is still cold. Gating the
  // WHOLE page on this blanked the screen for the entire load.
  const loading = isPending || isPlaceholderData;

  const selectedFull = selectedLead?.lead ?? null;
  const selectedOrg = selectedFull?.organization ?? null;
  // The lead's generated email (initial + follow-ups) — fetched on-demand from
  // content-generation (via api-service) when a lead is selected, keyed off the
  // leadId already on the row. Interleaved into the timeline. (#2095 pattern.)
  const selectedLeadId = selectedLead?.leadId ?? null;
  const { data: leadEmailData } = useAuthQuery(
    ["leadEmail", selectedLeadId],
    () => getLeadEmail(selectedLeadId as string),
    { enabled: !!selectedLeadId },
  );
  const personLocation = [selectedFull?.city, selectedFull?.state, selectedFull?.country].filter(Boolean).join(", ");
  const orgLocation = [selectedOrg?.city, selectedOrg?.state, selectedOrg?.country].filter(Boolean).join(", ");

  // Brand audiences — shared cache with the Audiences page (usually warm). Used
  // to enrich the panel's Audience card (description / Size / Remaining) by joining
  // the lead's attributed `audience.id`; the name + avatar already ride the row.
  const { data: audiencesData } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId),
    {},
  );
  const selectedAudienceInline = selectedLead?.audience ?? null;
  const selectedAudienceFull =
    selectedAudienceInline
      ? audiencesData?.audiences.find((a) => a.id === selectedAudienceInline.id) ?? null
      : null;

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 overflow-y-auto transition-all`}>
        <OutreachStatCardsAuto outreachOverride={loading ? null : contactedCount} />
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            {loading ? (
              <Skeleton className="ml-2 inline-block h-4 w-56 align-middle" />
            ) : (
              <span className="ml-2 text-sm font-normal text-gray-500">({leads.length.toLocaleString("en-US")} leads)</span>
            )}
          </h1>
          {!loading && (
            <CsvDownloadButton filename={`leads-${brandId}.csv`} csv={leadsCsv} isEmpty={leads.length === 0} />
          )}
        </div>

        {loading ? (
          <LeadsLoadingSkeleton />
        ) : (
          <>
            <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setSelectedLead(null); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.key
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs font-normal text-gray-400">({tab.count})</span>
                </button>
              ))}
            </div>

            <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by name, company, title, or email..." resultCount={filteredLeads.length} totalCount={activeList.length} />

            {leads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
                <p className="text-gray-600 text-sm">Leads appear here once outreach starts.</p>
              </div>
            ) : (
              <LeadsTable leads={filteredLeads} tab={activeTab} selectedLead={selectedLead} onSelectLead={setSelectedLead} statusOf={statusOf} audienceOf={audienceOf} forceContacted={activeTab === "outreach"} outcomeDates={outcomeDates} />
            )}
          </>
        )}
      </div>

      {selectedLead && (
        <div className="absolute inset-0 md:relative md:w-1/2 bg-gray-50 md:border-l border-gray-200 overflow-y-auto z-10">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <button onClick={() => setSelectedLead(null)} className="md:hidden flex items-center gap-2 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="font-semibold text-gray-800 hidden md:block">Lead Details</h2>
            <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600 hidden md:block">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-4 md:p-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Name:</span><p className="font-medium">{selectedFull?.firstName ?? ""} {selectedFull?.lastName ?? ""}</p></div>
                <div><span className="text-gray-500">Email:</span><p className="font-medium">{selectedLead.email}</p>
                  {selectedLead.emailStatus && <span className={`text-xs px-1.5 py-0.5 rounded ${selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" : selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{selectedLead.emailStatus}</span>}
                </div>
                <div><span className="text-gray-500">Title:</span><p className="font-medium">{selectedFull?.currentTitle || "-"}</p></div>
                {selectedFull?.seniority && <div><span className="text-gray-500">Seniority:</span><p className="font-medium capitalize">{selectedFull.seniority}</p></div>}
                {personLocation && <div><span className="text-gray-500">Location:</span><p className="font-medium">{personLocation}</p></div>}
                {selectedFull?.departments?.length ? <div className="sm:col-span-2"><span className="text-gray-500">Departments:</span><p className="font-medium">{selectedFull.departments.join(", ")}</p></div> : null}
                {selectedFull?.functions?.length ? <div className="sm:col-span-2"><span className="text-gray-500">Functions:</span><p className="font-medium">{selectedFull.functions.join(", ")}</p></div> : null}
                <div><span className="text-gray-500">Status:</span><p className="font-medium flex items-center gap-1.5 flex-wrap"><StatusBadge status={statusOf(selectedLead)} />{selectedLead.global?.bounced && <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">Global Bounced</span>}{selectedLead.global?.unsubscribed && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Global Unsubscribed</span>}</p></div>
                {selectedFull?.linkedinUrl && <div className="sm:col-span-2"><span className="text-gray-500">LinkedIn:</span><p><a href={selectedFull.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{selectedFull.linkedinUrl}</a></p></div>}
              </div>
            </div>
            {selectedOrg && (selectedOrg.name || selectedOrg.primaryDomain || selectedOrg.industry) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Organization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Company:</span><p className="font-medium">{selectedOrg.name || "-"}</p></div>
                  <div><span className="text-gray-500">Domain:</span><p className="font-medium">{selectedOrg.primaryDomain || "-"}</p></div>
                  <div><span className="text-gray-500">Industry:</span><p className="font-medium">{selectedOrg.industry || "-"}</p></div>
                  <div><span className="text-gray-500">Revenue:</span><p className="font-medium">{formatRevenue(selectedOrg.annualRevenue)}</p></div>
                  <div><span className="text-gray-500">Size:</span><p className="font-medium">{selectedOrg.estimatedNumEmployees != null ? `${selectedOrg.estimatedNumEmployees.toLocaleString("en-US")} employees` : "-"}</p></div>
                  {selectedOrg.foundedYear != null && <div><span className="text-gray-500">Founded:</span><p className="font-medium">{selectedOrg.foundedYear}</p></div>}
                  {orgLocation && <div><span className="text-gray-500">Location:</span><p className="font-medium">{orgLocation}</p></div>}
                  {selectedOrg.industries?.length ? <div className="sm:col-span-2"><span className="text-gray-500">Other industries:</span><p className="font-medium">{selectedOrg.industries.join(", ")}</p></div> : null}
                  {selectedOrg.shortDescription && <div className="sm:col-span-2"><span className="text-gray-500">About:</span><p className="font-medium text-gray-700 font-normal">{selectedOrg.shortDescription}</p></div>}
                </div>
              </div>
            )}
            {selectedAudienceInline && (
              <AudienceSection inline={selectedAudienceInline} full={selectedAudienceFull} />
            )}
            <LeadTimeline lead={selectedLead} email={leadEmailData?.generation ?? null} />
            {selectedLead.servedAt && (
              <div className="mt-4 text-xs text-gray-400">Served: {new Date(selectedLead.servedAt).toLocaleString()}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
