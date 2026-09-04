"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { LEADS_POLL_INTERVAL, POLL_INTERVAL } from "@/lib/query-options";
import { invalidateLeadOutcome } from "@/lib/write-invalidation";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import { CompanyLogo } from "@/components/company-logo";
import { LeadBoard, type LeadBoardCard } from "@/components/leads/lead-board";
import type { OptOutChannel } from "@/lib/opt-out-channel";
import { leadBoardColumnFor, type LeadBoardColumnKey } from "@/lib/lead-board";
import { leadStatusLabel, leadStatusPill } from "@/lib/lead-status";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { SUPPORT_FAB_CLEARANCE } from "@/components/support/support-button";
import {
  listCampaignsByBrand,
  listBrandLeads,
  listCampaignLeads,
  getLeadConsolidatedStatus,
  leadDateForStatus,
  getFeatureRevenue,
  keepLastGoodFeatureRevenue,
  getLeadEmail,
  listAudiences,
  type Lead,
  type LeadConsolidatedStatus,
  type LeadEmailGeneration,
  type LeadCampaignEvidence,
  type AudienceWire,
} from "@/lib/api";
import {
  leadTabsForFunnels,
  outcomeTabDescriptor,
  type AnyLeadTab,
  type OutcomeTab,
} from "@/lib/goal-steps";
import { friendlyDate, friendlyDateTime } from "@/lib/friendly-datetime";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { LeadFunnelStageSection } from "@/components/leads/lead-funnel-stage-section";
import {
  leadFunnelLegStages,
  leadStepErrorMessage,
  leadStepWithdrawErrorMessage,
  trackedStages,
  type LeadStageState,
  type WritableStageKey,
} from "@/lib/lead-funnel-stages";
import { salesFunnelByKey } from "@/lib/sales-funnels";
import {
  impliedStages,
  stageStatesFrom,
  stageCostsFrom,
  stageValuesFrom,
  useLeadStepStatements,
  useSetAnyLeadStepStatement,
  useSetLeadStepStatement,
  useWithdrawLeadStepStatement,
  withdrawableStages,
} from "@/lib/use-lead-step-statements";
import {
  listManualQualifications,
  setManualQualification,
  recordLeadOptOut,
  withdrawLeadOptOut,
  withdrawManualQualification,
} from "@/lib/api";
import type { ReplyKind } from "@/lib/reply-kind";
import { useMutation } from "@tanstack/react-query";
import { normalizeSalesFunnelKey } from "@/lib/sales-funnels";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { campaignLegFor } from "@/lib/campaign-leg";
import { statedCampaignLeg } from "@/lib/stated-campaign-leg";
import { useFunnelLegIndex } from "@/lib/use-funnel-leg-index";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import type { LeadOutcome, RevenueOverview } from "@/lib/revenue-view";
import { buildLeadsCsv } from "@/lib/leads-csv";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { OfferMark } from "@/components/marks/offer-mark";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { EmailSignature } from "@/components/email-signature";
import { Skeleton } from "@/components/skeleton";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";
import { tenantBasePath } from "@/lib/offer-path";
import {
  buildLeadCampaignTree,
  firstCampaignRowId,
  type CampaignInfo,
} from "@/lib/lead-campaign-tree";
import { LeadCampaignSections } from "@/components/audiences/lead-campaign-sections";

// Labels for the Leads tabs. WHICH of them render comes from the active campaigns'
// funnels (`leadTabsForFunnels`); this map only names them.
//
// The base tab says "Contacted", not the funnel step's own word, because this page
// counts PEOPLE while the brand Overview counts the email sequences we sent them —
// two honest numbers that read as one broken one under a shared label (prod: 9,915
// sequences against 7,895 leads on the same brand, the same afternoon).
/**
 * The producer's own maximum for one manual-qualifications read (`limit`, max 500).
 * Asking for it explicitly rather than taking the default 200 means the board reads as
 * many stated kinds as one request can carry; past that it says so.
 */
const MAX_REPLY_KINDS = 500;

const LEAD_TAB_LABEL: Record<AnyLeadTab, string> = {
  "positive-replies": "Sales interests",
  clicks: "Website Visits",
  outreach: "Contacted",
  signups: "Signups",
  meetings: "Meetings",
  "form-submissions": "Form submissions",
  sales: "Sales",
};

const OUTCOME_TABS: ReadonlySet<string> = new Set<OutcomeTab>([
  "signups",
  "meetings",
  "form-submissions",
  "sales",
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

// "all" is NOT a rendered tab — it's the base ordering for `sortedLeads`. The All
// UI tab was removed; the funnel tabs are the four below.
type Tab = "positive-replies" | "clicks" | "outreach" | "all" | OutcomeTab;

// The Date column reports the date of the STATUS on the same row, so the two cells
// state one fact together. It used to be per-TAB — Outreach dated every row at
// `firstContactedAt` — so a row reading "Replied" was dated the day we handed the
// lead to Instantly, days before the reply it names. Read as one line, which is how
// a row is read, that was false. `leadDateForStatus` (lib/api.ts) is the single map
// from a badge to the timestamp that proves it; the outcome tabs are the exception
// (their date is the realized-outcome instant from the /revenue join, and a signup
// has no delivery status to date).
// The WORD and the PILL both moved to `lib/lead-status.ts`. This table's badge, the
// lead panel and the board card draw the same status the same way — a second spelling
// or a second palette is how one lead comes to read "Delivered" in blue here and
// "Sent" in green on a card one click away.

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

// Per-lead audience — served ready-made on the lead row by lead-service
// (`lead.audience` = {id,name,avatarUrl} from the leads_campaigns attribution).
// Null when the lead was never attributed to an audience.
//
// `extra` = how many FURTHER audiences this person carries across their other
// campaigns. The table lists one row per person now, and a person contacted by
// several campaigns was picked by each of them for its own reason — so a cell
// stating one name alone would state one campaign's answer as the person's. The
// panel lists them per campaign; the cell only says there are more.
type LeadAudience = { name: string; avatarUrl: string | null; extra?: number };

function AudienceCell({ audience }: { audience: LeadAudience | null }) {
  if (!audience) return <span className="text-xs text-gray-300">-</span>;
  const extra = audience.extra ?? 0;
  // `min-w-0` + `truncate`: an audience name is free text and a long one used to push
  // the row past a phone's viewport (measured at 360px), which is the whole reason the
  // table scrolled sideways.
  return (
    <div className="flex min-w-0 items-center gap-2">
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
      <span className="truncate text-gray-700">{audience.name}</span>
      {extra > 0 && (
        <span
          className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500"
          title={`${extra + 1} audiences across this person's campaigns`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

// Right-panel email: click anywhere on it to copy the address to the clipboard.
//
// The address itself is PLAIN TEXT (`text-gray-800`, no underline) on purpose —
// link styling on a value that does not navigate reads as a `mailto:` and the
// click then does something else entirely. The copy intent is carried the way
// Stripe / PatternFly / Shoelace carry it instead: a persistent copy glyph beside
// the value that darkens on hover, a hover surface on the whole hit area, and a
// "Copy" tooltip that becomes "Copied" once it lands. Confirms with a check +
// "Copied" for ~1.5s, then reverts.
function CopyableEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(email).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      (err) => console.error("Failed to copy email to clipboard", err),
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy"}
      aria-label={`Copy email address ${email}`}
      className="group -mx-1 rounded px-1 py-0.5 font-medium text-left inline-flex items-center gap-1.5 text-gray-800 break-all cursor-pointer transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      <span>{email}</span>
      {copied ? (
        <span className="shrink-0 inline-flex items-center gap-1 text-xs text-green-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Copied
        </span>
      ) : (
        <svg className="w-3.5 h-3.5 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: LeadConsolidatedStatus }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusPill(status)}`}>{leadStatusLabel(status)}</span>;
}

// The queue step, named for what it is. Instantly holds the lead until its next
// weekday sending window, so this row routinely precedes the first email by days.
const QUEUED_LABEL = "Queued for sending";
const SEND_WINDOW_NOTE =
  "We only send on weekdays, 8am to 5pm during the recipient's local business hours.";

// The lifecycle of ONE message, rendered inside that message's card. A bare "Sent"
// row on its own does not say sent WHAT, and a lead has several messages.
type MessageEvent = { label: string; at: string; dot: string; note?: string };

// A timeline entry: a MESSAGE we generated (a demarcated, expandable card carrying
// its own delivery rows), or a lead-level EVENT that belongs to no single message.
//
// The split is what the wire can actually prove. lead-service forwards LEAD-level
// first-occurrence timestamps, not per-step ones, so:
//   - `Sent` / `Delivered` belong to the initial email — the first send IS it.
//   - `Website visit` / `Replied` / `Bounced` / `Unsubscribed` belong to no message
//     in particular: a reply can land after follow-up 2, so filing it under the
//     initial email would state something we did not observe. They stay top-level,
//     where their position in the chronology already says which send preceded them.
//   - Follow-up cards carry NO delivery rows, because there is no per-step delivery
//     data to carry. Inventing one is the thing not to do; the gap is a producer
//     feature request (lead-service / email-gateway), not a client-side guess.
type TimelineEntry = {
  kind: "message" | "event";
  at: string;
  label: string;
  dot: string;
  // Explains a row whose label alone raises a question. Only the queue row uses it,
  // to say why a pushed lead has not been emailed.
  note?: string;
  subject?: string | null;
  body?: string;
  // Delivery rows nested under a message card. A message that has any prints NO date
  // of its own: its instant IS its `Sent` row's instant, and showing both is the
  // duplication #3155 removed ("Initial email · Jul 30" over "Sent · Jul 30").
  events?: MessageEvent[];
  // `at` is DERIVED rather than observed, so the row prints NO date. An unsent
  // follow-up is offset from the generation time rather than a real send, so any
  // date shown for it drifts by however long the lead waits in the weekday queue.
  // The left gutter's gap (`+3d`) already carries the cadence, and it is the only
  // place timing is stated — a second relative figure beside it ("10d after the
  // first email" next to a `+7d` gutter) asks the reader to reconcile two numbers.
  estimated?: boolean;
};

function emailBodyText(html: string | null | undefined, text: string | null | undefined): string {
  if (text && text.trim()) return text.trim();
  if (html && html.trim()) return htmlToText(html);
  return "";
}

// Split the generated message into its initial email and its follow-up steps.
// `anchor` is when the initial email went out; each follow-up is offset by the
// cumulative `daysSinceLastStep`. When `estimated`, the anchor is the generation time
// instead of a real send, so the follow-up rows show no date at all rather than one
// they cannot honour — the gutter's gap is left to carry the cadence.
function deriveEmailRows(
  email: LeadEmailGeneration,
  anchor: string,
  estimated: boolean,
): { initial: { subject: string | null; body: string } | null; followUps: TimelineEntry[] } {
  const anchorMs = anchor ? new Date(anchor).getTime() : NaN;
  const topLevelBody = emailBodyText(email.bodyHtml, email.bodyText);
  // Some generations leave the top-level body empty and carry the initial email as
  // sequence step 1, so never claim an empty initial here — fall through and let the
  // step claim it below.
  let initial = topLevelBody ? { subject: email.subject ?? null, body: topLevelBody } : null;
  const followUps: TimelineEntry[] = [];
  let cumDays = 0;
  for (const step of email.sequence ?? []) {
    const body = emailBodyText(step.bodyHtml, step.bodyText);
    if (!body) continue;
    cumDays += step.daysSinceLastStep || 0;
    // Step 1 IS the initial email. If the top-level body was empty this step becomes
    // the initial; otherwise it duplicates it, so skip.
    const isInitial = step.step === 1 || (cumDays === 0 && body === topLevelBody);
    if (isInitial) {
      if (!initial) initial = { subject: email.subject ?? null, body };
      continue;
    }
    followUps.push({
      kind: "message",
      label: `Follow-up${step.step ? ` (step ${step.step})` : ""}`,
      at: Number.isFinite(anchorMs) ? new Date(anchorMs + cumDays * 86_400_000).toISOString() : "",
      dot: "bg-brand-500",
      subject: email.subject ?? null,
      body,
      ...(estimated ? { estimated: true } : {}),
    });
  }
  return { initial, followUps };
}

// Per-lead activity timeline: delivery events (from the email-gateway
// first-occurrence timestamps forwarded by lead-service) interleaved with the
// generated message (initial + each follow-up step), oldest first.
//
// The state the reader cares about is whether an email has actually LEFT. Instantly
// holds a pushed lead until its next weekday sending window, so a lead can sit
// queued for days: while that is true the timeline shows one queue row carrying the
// waiting message, and once a real send exists that row is gone and the message
// rides the Sent row instead. The two are never both on screen.
//
// The timeline is grouped BY MESSAGE. Each message is a demarcated card you can open
// to read it, and its own delivery rows sit inside it — "Sent" alone never says sent
// WHAT, and a lead receives several messages. A message card prints no date of its
// own when it has delivery rows: its instant IS its `Sent` row's, and stating both is
// the duplication removed in #3155.
//
// The email content is fetched on-demand by leadId (content-generation). Renders
// nothing until at least one event timestamp OR an email is present.
//
// READING the message is BETA-gated; the timeline's SHAPE is not. What a campaign
// did — an initial email left, three follow-ups are scheduled at this cadence, it
// was delivered, they visited, they replied — is what the page is for and stays GA.
// The copy itself (subject + body + signature) is ours, so it sits behind
// `useIsBetaUser` with the badge the gate rule requires beside it. The generation is
// still FETCHED for everyone, deliberately: the follow-up ROWS are derived from its
// sequence steps, so skipping the read would delete the cadence from the timeline
// rather than merely hiding the words. Consequence accepted: the body travels to the
// browser and is readable in devtools. It is the org's own copy to its own leads, so
// this is a display decision, not a security boundary — same posture as every other
// beta gate in this app.
/**
 * The delivery facts a timeline reads.
 *
 * Structural, and satisfied by BOTH the lead row (the brand-wide roll-up) and one of
 * lead-service's per-campaign cards — they carry the same field names for the same
 * facts at two scopes. That is what lets one timeline serve a campaign card without a
 * second implementation, and it is why the scope is the CALLER's to state.
 */
interface TimelineDelivery {
  replyClassification: "positive" | "negative" | "neutral" | null;
  firstSentAt?: string | null;
  firstContactedAt?: string | null;
  firstDeliveredAt?: string | null;
  firstClickedAt?: string | null;
  firstRepliedAt?: string | null;
  firstBouncedAt?: string | null;
  firstUnsubscribedAt?: string | null;
}

function LeadTimeline({
  delivery,
  email,
  scopeNote,
  heading = "Activity timeline",
  bare = false,
}: {
  delivery: TimelineDelivery;
  email: LeadEmailGeneration | null;
  /** WHICH campaign these rows are about, stated only where the answer is not
   *  "the one campaign above". Null renders no line. */
  scopeNote?: string | null;
  heading?: string;
  /** Rendered INSIDE a campaign card, so it drops the card chrome and separates with a
   *  rule like the audience row above it. The card is what frames it. */
  bare?: boolean;
}) {
  const canReadEmailCopy = useIsBetaUser();
  const replyColor =
    delivery.replyClassification === "positive" ? "bg-green-500"
      : delivery.replyClassification === "negative" ? "bg-red-500"
        : "bg-violet-500";

  // A lead handed to Instantly with no send observed yet. The push and the message
  // still waiting to go out are ONE fact, so they share a row; the moment a real send
  // exists the queue step becomes technical noise and disappears.
  const sentAt = delivery.firstSentAt ?? "";
  const queuedOnly = !sentAt;
  const anchor = sentAt || email?.createdAt || "";
  const derived = email ? deriveEmailRows(email, anchor, queuedOnly) : null;
  const initial = derived?.initial ?? null;

  const entries: TimelineEntry[] = [];

  // The initial email's own lifecycle. Queued: it has not left, so the single row
  // says so and carries the send-window note. Sent: the rows we actually observed.
  // `Delivered` is dropped when absent rather than shown empty.
  const initialEvents: MessageEvent[] = queuedOnly
    ? [{
        label: QUEUED_LABEL,
        // The push timestamp when we have it; otherwise the generation time, which is
        // when the message started waiting. Either way the row claims no send.
        at: delivery.firstContactedAt || anchor,
        dot: "bg-slate-400",
        note: SEND_WINDOW_NOTE,
      }]
    : [
        { label: "Sent", at: sentAt, dot: "bg-blue-400" },
        ...(delivery.firstDeliveredAt ? [{ label: "Delivered", at: delivery.firstDeliveredAt, dot: "bg-blue-500" }] : []),
      ];

  // The card sits at the moment the message left (or started waiting), so it sorts
  // into the chronology at the right place even though it prints no date itself.
  const initialAt = queuedOnly ? (delivery.firstContactedAt || anchor) : sentAt;
  if (initialAt) {
    entries.push({
      kind: "message",
      label: "Initial email",
      at: initialAt,
      dot: "bg-brand-500",
      subject: initial?.subject ?? null,
      body: initial?.body,
      events: initialEvents,
    });
  }

  // Lead-level, deliberately NOT nested under a message: the wire gives one
  // first-occurrence per lead, and a visit or a reply can follow any step. Their
  // place in the chronology is what says which send preceded them.
  entries.push(
    { kind: "event", label: "Website visit", at: delivery.firstClickedAt ?? "", dot: "bg-violet-500" },
    {
      kind: "event",
      label: delivery.replyClassification ? `Replied (${delivery.replyClassification})` : "Replied",
      at: delivery.firstRepliedAt ?? "",
      dot: replyColor,
    },
    { kind: "event", label: "Bounced", at: delivery.firstBouncedAt ?? "", dot: "bg-red-500" },
    { kind: "event", label: "Unsubscribed", at: delivery.firstUnsubscribedAt ?? "", dot: "bg-amber-500" },
  );

  entries.push(...(derived?.followUps ?? []));

  // Same-instant tie-break only (the primary sort is the timestamp): a message card
  // comes before the lead-level events sharing its instant, because those are
  // responses to it. Delivery rows no longer compete here — they live inside a card.
  const stageRank = (e: TimelineEntry): number => {
    const l = e.label;
    if (e.kind === "message") return 1;
    if (l.startsWith("Replied")) return 9;
    if (l === "Unsubscribed") return 8;
    if (l === "Bounced") return 8;
    if (l === "Website visit") return 7;
    return 0;
  };

  // Oldest → newest, top → bottom (past reads down into the future).
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
    <div
      className={
        bare
          ? "mt-3 border-t border-gray-200 pt-3"
          : "bg-white rounded-lg border border-gray-200 p-4 mb-4"
      }
    >
      <h3
        className={
          bare
            ? "mb-2 text-[11px] font-medium uppercase tracking-wider text-gray-400"
            : "text-xs font-medium text-gray-500 uppercase tracking-wider mb-3"
        }
      >
        {heading}
      </h3>
      {scopeNote && <p className="-mt-2 mb-3 text-xs text-gray-500">{scopeNote}</p>}
      <ol className="relative">
        {sorted.map((e, i) => {
          const isFuture = new Date(e.at).getTime() > nowMs;
          // Left gutter: the GAP since the previous entry (+2d, +4h…), and nothing
          // else. The first row has no previous entry, so it has no gap — it used to
          // repeat its own date here, which printed "Jul 30" one inch from the
          // "Jul 30, 2026" on the row itself. Each piece of timing is stated once:
          // the gap in the gutter, the calendar date on the row.
          const gutter = i === 0 ? "" : gapLabel(sorted[i - 1].at, e.at);
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
                {/* The gap below a row is keyed on the INDEX, like the connector line
                    right under it. It used to be a `:last-child` modifier, which
                    resolves against the PARENT — and this div is the second and final
                    child of its `<li>` on every row, so the modifier fired every time
                    and the padding never applied at all. Consecutive message cards
                    therefore sat edge to edge; the rows before the "Now" divider only
                    looked spaced because that divider carries its own `py-2`. */}
                <div className={`relative flex-1 pl-4 ${i < sorted.length - 1 ? "pb-4" : ""} ${isFuture ? "opacity-70" : ""}`}>
                  {i < sorted.length - 1 && <span className="absolute left-[3px] top-3 bottom-0 w-px bg-gray-200" aria-hidden />}
                  <span className={`absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full ${e.dot} ${isFuture ? "ring-2 ring-white outline-1 outline-dashed outline-gray-300" : ""}`} aria-hidden />
                  {/* A message is a demarcated block; a lead-level event is a plain
                      row. Tint plus a full 1px border, never a thick side accent. */}
                  <div className={e.kind === "message" ? "rounded-lg border border-brand-200 bg-brand-50 px-3 py-2" : ""}>
                    <p className="text-sm font-medium text-gray-800">
                      {e.kind === "message" && (
                        <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )}
                      {e.label}
                      {e.note && (
                        <span className="ml-1 inline-flex">
                          <InfoTooltip tip={e.note} placement="bottom" />
                        </span>
                      )}
                      {isFuture && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-gray-400">scheduled</span>}
                    </p>
                    {/* A message with delivery rows states no date here — its instant IS
                        its `Sent` row's. A derived timestamp gets none either: the
                        gutter's gap carries the cadence and `scheduled` says it has not
                        happened. What is left is a scheduled send, and a FUTURE instant
                        gets its plain calendar date with no clock time — Instantly sends
                        inside a weekday window, so an exact minute would be invented. */}
                    {!e.estimated && !e.events?.length && (
                      <p className="text-xs text-gray-500" title={new Date(e.at).toLocaleString()}>
                        {isFuture ? friendlyDate(e.at) : friendlyDateTime(e.at)}
                      </p>
                    )}
                    {/* The message itself. Beta-gated: the subject is content too, so
                        the summary is inside the gate rather than a GA line hiding a
                        gated body. A non-beta reader sees the card, its cadence and
                        its delivery rows, and no copy. */}
                    {canReadEmailCopy && e.body && (
                      <details className="mt-1.5 group">
                        <summary className="cursor-pointer text-xs text-brand-600 hover:text-brand-700 select-none">
                          {e.subject ? <span className="font-medium text-gray-700">{e.subject}</span> : "View email"}
                          <span className="ml-1.5 inline-flex align-middle"><MaturityBadge level="beta" /></span>
                        </summary>
                        <div className="mt-1.5 bg-white border border-brand-200 rounded p-2">
                          <pre className="whitespace-pre-wrap break-words font-sans text-xs text-gray-600">{e.body}</pre>
                          <EmailSignature className="text-xs" />
                        </div>
                      </details>
                    )}
                    {/* This message's own delivery rows. "Sent" on its own never said
                        sent WHAT; inside the card it does. */}
                    {!!e.events?.length && (
                      <ul className="mt-2 space-y-1 border-t border-brand-200 pt-2">
                        {e.events.map((ev) => (
                          <li key={`${ev.label}-${ev.at}`} className="flex items-baseline gap-2">
                            <span className={`w-[5px] h-[5px] shrink-0 translate-y-[-1px] rounded-full ${ev.dot}`} aria-hidden />
                            <span className="text-xs font-medium text-gray-700">{ev.label}</span>
                            {ev.note && (
                              <span className="inline-flex">
                                <InfoTooltip tip={ev.note} placement="bottom" />
                              </span>
                            )}
                            <span className="ml-auto text-xs text-gray-500" title={new Date(ev.at).toLocaleString()}>
                              {friendlyDateTime(ev.at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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

function LeadsTable({ leads, tab, selectedLead, onSelectLead, statusOf, audienceOf, outcomeDates }: {
  leads: Lead[];
  tab: Tab;
  selectedLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  // Every row states its OWN most-advanced status, on every tab. The Outreach tab
  // used to overwrite the badge with the queue state for the whole flat universe,
  // which meant a lead we had really sent to read as still waiting in the table
  // while its own detail panel said Sent.
  statusOf: (lead: Lead) => LeadConsolidatedStatus;
  audienceOf: (lead: Lead) => LeadAudience | null;
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
      {/* Below `md` the table narrows to two columns — the company cell and the status
          cell — because Contact, Audience and Date fold into them (see the cells
          below). The 720px floor applies only once every column is back;
          unconditional, it forced a sideways scroll on a phone even though four
          columns were already hidden, which also hid the status tag entirely. */}
      {/* `table-fixed` below `md` is what makes the truncation bite: in the default
          auto layout a column grows to its content, so a long audience or company name
          widened the row past the viewport no matter how many `truncate`s it carried
          (measured at 360px: one cell reached 649px). Two columns, 62/38. */}
      <table className="w-full table-fixed text-sm md:table-auto md:min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 w-[62%] md:w-auto">Company</th>
            <th className="px-4 py-3 hidden md:table-cell">Contact</th>
            <th className="px-4 py-3 hidden lg:table-cell">Offer</th>
            <th className="px-4 py-3 hidden md:table-cell">Audience</th>
            <th className="px-4 py-3 w-[38%] md:w-auto">Status</th>
            <th className="px-4 py-3 hidden md:table-cell">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((lead) => {
            const full = lead.lead;
            const org = full?.organization ?? null;
            const audience = audienceOf(lead);
            const companyName = org?.name || "Unknown";
            // The date belongs to the status on this row, so the Status and Date
            // cells state one fact together. Read once, rendered by BOTH the stacked
            // mobile line and the Date column — the two can never disagree.
            const status = statusOf(lead);
            const dateAt = isOutcomeTab(tab)
              ? outcomeDates?.get(lead.id) ?? null
              : leadDateForStatus(lead, status);
            const dateNode = dateAt ? (
              <span className="text-xs text-gray-500" title={new Date(dateAt).toLocaleString()}>{timeAgo(dateAt)}</span>
            ) : (
              <span className="text-xs text-gray-300">-</span>
            );
            return (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`cursor-pointer hover:bg-gray-50 transition ${selectedLead?.id === lead.id ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-3">
                  {/* Below `md` this cell carries the row's identity: one large company
                      mark, then the company name with the audience under it in the
                      lighter treatment (the Audience column is hidden at this width).
                      A lead attributed to no audience simply has no second line — a
                      dash would read as a value. */}
                  <div className="md:hidden flex items-center gap-3">
                    <CompanyLogo domain={org?.primaryDomain ?? null} name={org?.name ?? null} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{companyName}</p>
                      {audience && <p className="truncate text-xs text-gray-500">{audience.name}</p>}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2.5">
                    <CompanyLogo domain={org?.primaryDomain ?? null} name={org?.name ?? null} />
                    <span className="font-medium text-gray-800 truncate max-w-[160px]">{companyName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
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
                {/* The OFFER this lead was contacted to be sold, read straight off
                    `lead.offer` — the same served field the right panel renders, never
                    a client-side join (the dashboard holds neither the campaign-to-offer
                    map nor the offer's name). The mark is the SHARED `OfferMark` the
                    breadcrumb, the tenant switcher and the Offers table draw, so one
                    thing wears one mark everywhere. No offer resolvable ⟹ a plain dash
                    and NO mark: a column has to hold its cell shape, but a mark beside
                    nothing would assert an attribution we do not have. */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {lead.offer ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <OfferMark size="sm" />
                      <span className="truncate text-gray-700 max-w-[160px]" title={lead.offer.name ?? undefined}>
                        {lead.offer.name ?? <span className="text-gray-500">Unnamed offer</span>}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell"><AudienceCell audience={audience} /></td>
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                  {/* The Date column is hidden below `md`, so the tag carries the date
                      underneath it — never both at once. */}
                  <div className="mt-1 md:hidden">{dateNode}</div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{dateNode}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EngagedLeadsPage({
  campaignId,
  scopeNote,
}: {
  campaignId?: string;
  /**
   * One line stating WHICH leads this page returns, for a route whose scope the
   * heading alone does not settle. The brand-level route uses it because "the
   * brand's leads" is very nearly, but not exactly, every offer's leads added up —
   * a lead contacted by a campaign that names no offer is here and under no offer.
   * A page that cannot say that truthfully passes nothing and renders no line.
   */
  scopeNote?: string;
} = {}) {
  const params = useParams();
  const searchParams = useSearchParams();
  const brandId = params.brandId as string;
  // The OFFER this page is scoped to, when the route names one. lead-service has no
  // offer filter yet, so the ROWS are still the brand's — the money and the
  // audiences joined onto them are the offer's, which is every scope the backend
  // can honestly answer today.
  const offerId = params.offerId as string | undefined;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  // Board first: it is the view that answers where a lead IS.
  //
  // At CAMPAIGN grain it is the ONLY view — no switch, no funnel tabs, no table. A
  // campaign sells one funnel and its leads are worked one by one, so "where is this
  // person" is the whole question and a second view of the same rows is a control that
  // only ever answers a question the page beside it already answers.
  //
  // At BRAND grain the toggle stays, and that is not an oversight: with no campaignId
  // the reply-kind read is disabled and `canMove` is false, so the board there shows
  // the coarse machine classification and can write nothing. Taking the table away
  // would leave a read-only board with no dates, no sort and no pagination.
  const [view, setView] = useState<"board" | "table">("board");
  const [activeTab, setActiveTab] = useState<Tab>("positive-replies");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const hasAutoSelectedTab = useRef(false);

  // Campaign-scoped (v2 staff preview) when a campaignId is passed, else brand-scoped.
  // Both readers return the same Lead[] shape; the campaign variant filters to one
  // campaign's leads_campaigns rows.
  const { data, isPending, isPlaceholderData } = useAuthQuery(
    campaignId ? ["campaignLeads", campaignId] : ["brandLeads", brandId],
    () => (campaignId ? listCampaignLeads(campaignId) : listBrandLeads(brandId)),
    // The one read on a slower tier: unpaginated by design and huge on a heavy brand.
    // Every user action that can change it invalidates it explicitly below.
    { refetchInterval: LEADS_POLL_INTERVAL },
  );

  // lead-service answers a brand-scoped read with ONE ROW PER PERSON already
  // (`DISTINCT ON (lead_id)`), so there is nothing to dedupe here. What a person's
  // several campaigns did lives on `lead.campaigns`, served under `?include=campaigns`
  // — the row is the person, the cards are their campaigns.
  const leads = useMemo(() => data?.leads ?? [], [data]);

  // Every campaign of the brand, keyed by its own id — what the panel's tree needs to
  // name a campaign's funnel, channel and leg. The key is byte-equal to the one
  // `useCampaignRows` already polls below, so this costs no request. Its OWN rows are
  // feature-filtered and identity-collapsed, which is right for a table listing
  // campaigns and wrong here: this person may have been contacted by a channel the
  // brand's table does not list, and by a stopped ancestor of a live campaign.
  const { data: allCampaignsData } = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId),
    { refetchInterval: POLL_INTERVAL },
  );
  const campaignInfoOf = useCallback(
    (id: string): CampaignInfo | null => {
      const c = allCampaignsData?.campaigns.find((x) => x.id === id);
      if (!c) return null;
      return {
        // Normalized here rather than in the tree: the wire carries two spellings of
        // every funnel, and the normalizer is typed against the closed key union.
        funnelKey: c.funnelKey ? normalizeSalesFunnelKey(c.funnelKey) : null,
        featureSlug: c.featureSlug,
        legKey: c.legKey,
        status: c.status,
      };
    },
    [allCampaignsData],
  );

  // Deep-link seed: `?leadRowId=` (a funnel-leg board card navigates here rather
  // than carrying its own copy of the lead panel) opens that lead's panel on first
  // paint. Seeded once the rows arrive -- a one-shot latch, so a poll can never
  // re-open a panel the reader has closed, and selection is local state thereafter.
  // A row the page never received simply opens nothing: the leads list is what
  // decides, never the URL.
  const initialLeadRowId = searchParams.get("leadRowId");
  const hasSeededLead = useRef(false);
  useEffect(() => {
    if (hasSeededLead.current || !initialLeadRowId) return;
    const seeded = leads.find((l) => l.id === initialLeadRowId);
    if (!seeded) return;
    hasSeededLead.current = true;
    setSelectedLead(seeded);
  }, [initialLeadRowId, leads]);

  // The published channel catalogue, derived from the `["features"]` query this app
  // already holds — a `useMemo`, not a request. Read twice below: to decide whether the
  // open campaign's channel has money to report, and to place its leg in the funnel.
  const channels = useAcquisitionChannels();

  // WHICH CHANNEL this page is about. A campaign is (offer x funnel x channel) and
  // states its channel on its own row, so a campaign-scoped page reads THAT — never the
  // brand's sole GA feature, which is a different channel for every campaign that is not
  // on it. Under the sole slug this page fetched `sales-cold-email-outreach` while the
  // reader had a `feedback-request-cold-email-outreach` campaign open: the row filter
  // below then matched no campaign, so no funnel resolved and the lead panel drew no
  // "Funnel progress" section at all, while the stat row above stated the other
  // channel's money. The read is the key the campaign Overview and the top bar already
  // poll, so it costs no request.
  const { campaign: scopedCampaign, featureSlug, settled: scopeSettled } =
    useScopedFeatureSlug(campaignId);
  const campaignScoped = Boolean(campaignId);

  // WHICH TABS this page shows comes from the funnels the brand's ACTIVE campaigns
  // sell. At brand level that is the UNION over every live campaign; under a campaign
  // it is that campaign's own funnel, the one thing it sells.
  //
  // Never the brand goal: that column is retired in brand-service (NOT NULL with a
  // server default, so it reads "website purchases" for a brand that stated nothing)
  // and it collapses the two meeting funnels onto one word, so a brand booking
  // meetings off replies was offered a Website Visits tab it never buys.
  //
  // At brand level that is `activeRows`, never `rows`: the table those rows feed also
  // lists PAUSED campaigns, and a funnel nobody is running has no leads arriving —
  // offering its tab describes something the brand no longer sells. Under a campaign
  // it is that campaign's OWN row whatever its status, so a paused campaign's page
  // still states the funnel it sold.
  //
  // Only the BRAND branch reads those rows, and it keeps its own feature: with no
  // campaign to bound it, the brand list stays pinned to the one feature it always was.
  // A campaign takes its funnel off its OWN row instead — the rows are filtered by
  // feature, so a campaign on any other channel is not among them and asking them for
  // its funnel is asking a list that cannot contain it.
  const soleFeatureSlug = useSoleFeatureSlug();
  const campaignRows = useCampaignRows(brandId, soleFeatureSlug);
  const activeFunnelKeys = useMemo(() => {
    const keys = campaignScoped
      ? [scopedCampaign?.funnelKey ?? null]
      : campaignRows.activeRows.map((r) => r.campaign.funnelKey);
    return keys
      .filter((k): k is NonNullable<typeof k> => k != null)
      .map(normalizeSalesFunnelKey);
  }, [campaignRows.activeRows, campaignScoped, scopedCampaign]);
  const funnelTabs = useMemo(() => leadTabsForFunnels(activeFunnelKeys), [activeFunnelKeys]);

  // Realized per-lead OUTCOMES (features-service#476 conversion-tracker attribution)
  // live on the /revenue `leads[]` rows, NOT the lead-service `listBrandLeads` row —
  // so fetch /revenue (same query key as the stat cards → React Query dedupes to one
  // poll) and join by the lead IDENTITY (`lead.leadId` ↔ `LeadOutcome.leadId`, not
  // the leads_campaigns row `id`). The outcome tab (Signups/Meetings/Form submissions/
  // Sales) buckets on the join boolean + dates on its timestamp.
  // Gated on the channel CATALOGUE under a campaign, not on the brand's revenue-feature
  // set: that set decides which features get a revenue page on a BRAND-scoped surface,
  // and gating a campaign on it blanks every campaign that is not on the brand's one GA
  // channel. And never fire under a GUESSED slug — until the campaign resolves we do not
  // know its channel, and a read fired on the wrong one lands in that channel's cache
  // entry and answers about somebody else's money.
  const revenueEnabled =
    featureSlug !== null &&
    (campaignScoped
      ? acquisitionChannelForFeatureSlug(featureSlug, channels) !== null
      : isRevenueFeature(featureSlug));
  const { data: revenueData } = useAuthQuery(
    campaignId
      ? ["featureRevenue", brandId, featureSlug, "campaign", campaignId]
      : offerId
        ? ["featureRevenue", brandId, featureSlug, "offer", offerId]
        : ["featureRevenue", brandId, featureSlug],
    // A campaign belongs to exactly one offer, so `campaignId` alone is the narrower
    // scope AND makes these args byte-equal to the campaign Overview's — same key, same
    // request, one poll.
    () =>
      getFeatureRevenue(featureSlug as string, brandId, campaignId ? { campaignId } : { offerId }),
    {
      enabled: revenueEnabled,
      refetchInterval: POLL_INTERVAL,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
    },
  );
  // Leads that reached SOMETHING, keyed by id. The `/revenue` body used to carry every
  // contacted lead fully hydrated (9,854 rows / 10.8MB on a real brand) and this map is
  // all any browser surface ever did with them — a lead with no outcome is looked up and
  // found absent either way. The parser narrows it now; see `RevenueOverview.leadOutcomes`.
  const outcomeByLeadId = useMemo(() => {
    const m = new Map<string, LeadOutcome>();
    for (const l of revenueData?.leadOutcomes ?? []) m.set(l.leadId, l);
    return m;
  }, [revenueData]);

  // One descriptor per outcome the active funnels terminate in — a brand selling
  // through several has several, so this is a list rather than a per-goal lookup.
  const outcomeTabs = useMemo(
    () => funnelTabs.outcomes.map(outcomeTabDescriptor),
    [funnelTabs],
  );
  // Gated on whether features-service ATTRIBUTES the outcome (#476), never on whether
  // anyone has converted yet — a brand with the tracker live and zero signups keeps its
  // tab. That is why the presence answer is computed at the parser, over the full array,
  // before it is narrowed to the leads that reached something.
  const availableOutcomeTabs = useMemo(
    () =>
      outcomeTabs.filter((t) =>
        (revenueData?.outcomeFieldsServed ?? []).includes(t.leadField),
      ),
    [outcomeTabs, revenueData],
  );
  // The leftmost available outcome drives the Date column + the row buckets.
  const outcomeTab = availableOutcomeTabs[0] ?? null;
  // The outcome tab shows ONLY once the /revenue join actually serves its per-lead
  // field — absent (all `undefined`) on a pre-#476-prod payload → hidden (no empty tab).
  const outcomeAvailable = outcomeTab != null;
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
  //
  // The row names the audience of the campaign it represents; `extra` counts the
  // person's OTHER distinct audiences across their remaining campaigns, read off the
  // served cards. Without it a cell states one campaign's answer as the whole of what
  // we know. The panel lists them per campaign.
  const audienceOf = (lead: Lead): LeadAudience | null => {
    if (!lead.audience) return null;
    const ids = new Set<string>([lead.audience.id]);
    for (const card of lead.campaigns ?? []) {
      if (card.audienceId) ids.add(card.audienceId);
    }
    return {
      name: lead.audience.name,
      avatarUrl: lead.audience.avatarUrl,
      extra: Math.max(0, ids.size - 1),
    };
  };

  // Ordered by the value the Date column SHOWS — the timestamp of each row's own
  // status, newest first. Sorting on a different field than the column displays
  // makes the column read as unordered, so the two move together. Null sinks to
  // the bottom. (Unlatched status here: this decides row ORDER only, while the
  // latch below exists to keep a row's rendered BUCKET from bouncing on a poll.)
  const sortByStatusDate = (arr: Lead[]): Lead[] =>
    [...arr].sort((a, b) => {
      const at = leadDateForStatus(a, getLeadConsolidatedStatus(a));
      const bt = leadDateForStatus(b, getLeadConsolidatedStatus(b));
      const d = (bt ? new Date(bt).getTime() : 0) - (at ? new Date(at).getTime() : 0);
      // Deterministic tiebreak: leads sharing a timestamp (batch send → same
      // firstContactedAt) or both-null dates would otherwise fall back to the
      // backend array order, which lead-service does not sort (physical/heap
      // order shifts when a row is UPDATED — e.g. on a follow-up send), so they
      // reshuffle on the 30s poll. Freeze ties by lead id.
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  const sortedLeads = useMemo(() => sortByStatusDate(leads), [leads]);

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
    // Every engagement tab sorts by the same thing its Date column shows: each
    // row's own status date. The tabs differ in MEMBERSHIP, not in what a date means.
    groups.set("positive-replies", sortByStatusDate(positive));
    groups.set("clicks", sortByStatusDate(clicks));
    groups.set("outreach", sortByStatusDate(outreach));
    // Realized-outcome bucket: leads the /revenue join flags for the funnel's outcome,
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
        // Same deterministic tiebreak as sortByStatusDate — freeze equal/null
        // outcome timestamps by lead id so the tab order is poll-stable.
        return d !== 0 ? d : a.id.localeCompare(b.id);
      });
      groups.set(outcomeTab.tab, reached);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, sortedLeads, outcomeTab, outcomeByLeadId, outcomeDates]);

  // Open, once (after leads + the sales-economics query have settled), the leftmost
  // on-path tab that has leads, in the OUTCOME-FIRST order (goal-steps single
  // source: sales_meetings → Sales interests first, visit goals → Website Visits
  // first, Outreach last). Fall through to the next non-empty tab so the user never
  // lands on an empty tab; default to the last (Outreach) when all empty. User manual
  // switches latch the ref and are never overridden by a later poll.
  // Visible tabs, left→right: the realized-outcome tab FIRST (when the /revenue join
  // serves it), then the funnels' engagement tabs (outcome-first), Outreach last.
  const visibleTabs: Tab[] = [
    ...availableOutcomeTabs.map((t) => t.tab),
    ...funnelTabs.engagement,
  ];

  // The population the tabs can actually reach — every tab is an ENGAGEMENT step
  // (contacted, clicked, replied, outcome), so a lead that lead-service served but
  // that carries no delivery evidence belongs to no bucket and is unreachable from
  // this page. Counting the raw list in the header therefore advertised rows the
  // table could never show (reported: "(6 leads)" above a 5-row Outreach tab whose
  // stat card also read 5). Header count, CSV export and the empty state all read
  // this set so the page describes one population. Deduped (the tabs are nested
  // subsets, not a partition) and kept in the base "all" order.
  const coveredLeads = useMemo(() => {
    const covered = new Set<string>();
    for (const tab of visibleTabs) {
      for (const lead of groupedByTab.get(tab) ?? []) covered.add(lead.id);
    }
    return sortedLeads.filter((l) => covered.has(l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedByTab, sortedLeads, visibleTabs.join("|")]);

  // CSV export = the WHOLE covered list (every tab), not the active-tab/search
  // subset. Status label uses the same latched `statusOf` the badge renders, so
  // the exported Status matches on-screen. Recomputed only when leads/latch move.
  const leadsCsv = useMemo(
    () => buildLeadsCsv(coveredLeads, (l) => leadStatusLabel(statusOf(l))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coveredLeads, latchedStatus],
  );

  useEffect(() => {
    if (hasAutoSelectedTab.current) return;
    if (sortedLeads.length === 0) return;
    // Wait for the CAMPAIGNS query, which is what decides the tab set now: firing the
    // latch first lands on a tab the funnels do not even offer, and it is one-shot, so
    // a later answer cannot correct it.
    if (!(campaignScoped ? scopeSettled : campaignRows.settled)) return;
    hasAutoSelectedTab.current = true;
    const count = (t: Tab) => groupedByTab.get(t)?.length ?? 0;
    setActiveTab(visibleTabs.find((t) => count(t) > 0) ?? visibleTabs[visibleTabs.length - 1] ?? "outreach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLeads.length, campaignRows.settled, scopeSettled, campaignScoped, groupedByTab, outcomeAvailable]);

  const activeList = groupedByTab.get(activeTab) ?? sortedLeads;

  // ONE predicate, so the table and the board answer the same query. A second copy is
  // how a search comes to mean one thing in a row and another on a card.
  const matchesSearch = (l: Lead, q: string): boolean => {
    const full = l.lead;
    const name = `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.toLowerCase();
    return name.includes(q)
      || (full?.organization?.name?.toLowerCase().includes(q) ?? false)
      || (full?.headline?.toLowerCase().includes(q) ?? false)
      || (l.email?.toLowerCase().includes(q) ?? false);
  };

  const filteredLeads = useMemo(() => {
    if (!search) return activeList;
    const q = search.toLowerCase();
    return activeList.filter((l) => matchesSearch(l, q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList, search]);

  // The board spans the WHOLE population rather than one tab's slice — it is a
  // partition, so scoping it to a tab would draw a board with most of its cards
  // missing and no way to tell that from an empty pipeline.
  const searchedLeads = useMemo(() => {
    if (!search) return coveredLeads;
    const q = search.toLowerCase();
    return coveredLeads.filter((l) => matchesSearch(l, q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coveredLeads, search]);

  // ── The BOARD ────────────────────────────────────────────────────────────────
  // The tabs answer "how many cleared each bar"; the board answers "where is each
  // lead". Same data, a different statement, so both are offered rather than one
  // replacing the other — the table keeps the search, the sort, the dates and the
  // export a board has nowhere to put.
  //
  // It renders only when exactly ONE funnel is in scope. A brand selling through
  // several has no single order to lay columns out in, which is the same refusal
  // `leadFunnelStages` already makes and for the same reason.
  // A move on the board is a WRITE whose only visible effect is the card jumping
  // column, and that jump comes from a re-read. Holding what was just stated keeps the
  // card where the person put it while the producer answers — the producer's own
  // answer always wins, and a refusal drops it. Keyed on the lead's email, which is
  // what the statement is written against.
  // `null` is a real entry here, not an absence: it is a statement somebody just took
  // BACK, held over the same two round trips a set is. `has` therefore decides whether
  // the latch speaks, never `??`, which would read a cleared entry as silence and fall
  // straight back to the kind that was just withdrawn.
  //
  // It carries the COLUMN too, and that half is new: where a card sits is
  // `standing.state` now, which lead-service only re-answers on the re-read — so
  // without the held column the card would snap straight back the instant it was
  // dropped. The hold is TRANSIENT by construction (dropped in `onMove`'s `onSuccess`,
  // once both invalidations have settled): a permanent client override would hide the
  // producer legitimately answering something else, which is the one thing this change
  // exists to stop. A move that does not take is a real answer — stating "Interested"
  // on a campaign whose funnel is entered by a website visit is a positive reply, and
  // a positive reply is not the step that campaign sells — and the reader must see it.
  const [statedReplyKinds, setStatedReplyKinds] = useState<
    Map<string, { kind: string; at: string; column: LeadBoardColumnKey } | null>
  >(new Map());

  // The columns are TRIAGE states, not funnel rungs, so they need no funnel to lay out
  // in — which is why the board is offered at brand level too now. The funnel's own
  // rungs are stated on the lead's panel, where the cost and value of a rung are asked
  // for; the board answers the other question, "is this one still in play".
  //
  // The FINE reply kind a person stated lives with instantly-service and is keyed on
  // the CAMPAIGN, so it is read ONCE for the whole campaign and joined by email — never
  // per card, which would make a board of 500 leads 500 requests.
  const { data: qualifications } = useAuthQuery(
    ["campaignReplyKinds", campaignId ?? "none"],
    () => listManualQualifications({ campaignId, limit: MAX_REPLY_KINDS }),
    { enabled: Boolean(campaignId) },
  );
  const replyKindByEmail = useMemo(() => {
    const rows = qualifications?.qualifications ?? [];
    // Sorted newest-first by the producer, and capped at its own maximum. A campaign
    // with more statements than that reads its most recent ones; say so rather than
    // letting the older cards fall silently back to the machine's classification.
    if (rows.length >= MAX_REPLY_KINDS) {
      console.warn(
        `[dashboard] reply kinds capped at ${MAX_REPLY_KINDS}; older statements are not on this board`,
      );
    }
    const out = new Map<string, { kind: string; at: string }>();
    for (const q of rows) {
      // A statement somebody TOOK BACK is served alongside the standing ones — it is the
      // audit of what was asserted — so it is skipped rather than being the newest row
      // that wins. Rendering it would put a kind on the card that nobody stands behind.
      if (q.withdrawnAt) continue;
      // Newest first, so the FIRST row for an email is that lead's current statement.
      // The instant rides along with it: a stated kind is dated by WHEN SOMEBODY SAID
      // IT, never by the delivery event underneath, which is a different moment.
      if (q.email && !out.has(q.email) && q.replyKind) {
        out.set(q.email, { kind: q.replyKind, at: q.qualifiedAt });
      }
    }
    return out;
  }, [qualifications]);

  // Cards come off the lead row the page already holds plus that one campaign-scoped
  // read. No per-lead fetch.
  const boardCards: LeadBoardCard[] = useMemo(() => {
    const out: LeadBoardCard[] = [];
    for (const lead of searchedLeads) {
      // A statement somebody just made outranks the served one for the round trip it
      // takes to land. `has` decides whether the latch speaks, never `??`: `null` is a
      // real entry there — a statement just taken BACK — and `??` would read it as
      // silence and fall straight back to the kind that was withdrawn.
      const held = lead.email && statedReplyKinds.has(lead.email)
        ? (statedReplyKinds.get(lead.email) ?? null)
        : undefined;
      const statement =
        held !== undefined ? held : lead.email ? (replyKindByEmail.get(lead.email) ?? null) : null;
      const stated = statement?.kind ?? null;
      // WHERE the card sits is lead-service's own answer, rendered — never derived
      // from the reply signals on the row beside it. Those signals are still what the
      // table's badge and the panel's timeline read; "is this person still in play" is
      // funnel-aware commercial policy with one owner. See `lib/lead-standing.ts`.
      // The held column speaks only over the round trip a move takes, and only when
      // the latch is the thing speaking — a served qualification carries no column.
      const column = held?.column ?? leadBoardColumnFor(lead.standing);
      if (!column) continue;
      const full = lead.lead;
      const name = `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.trim() || lead.email || "Lead";
      out.push({
        id: lead.id,
        email: lead.email ?? null,
        name,
        // Absent on the slim projection and routinely hotlink-blocked at the source,
        // so the card falls back to an initial rather than a broken image.
        photoUrl: full?.photoUrl ?? null,
        orgName: full?.organization?.name ?? null,
        orgDomain: full?.organization?.primaryDomain ?? null,
        column,
        replyKind: stated,
        // The card states what we last OBSERVED about this person, not the column it
        // is already sitting in — a tag reading "Sales interest" under a heading
        // reading "Sales interest" spends the card's one tag saying nothing. The
        // status is the shared `getLeadConsolidatedStatus`, so the card and the
        // table's own badge cannot name one lead two ways, and the date below is
        // `leadDateForStatus` of that same status: one statement, one event.
        statusLabel: leadStatusLabel(getLeadConsolidatedStatus(lead)),
        statusPill: leadStatusPill(getLeadConsolidatedStatus(lead)),
        // When a kind was STATED, the card is dated by that statement; otherwise by the
        // timestamp that proves the lead's own delivery status — the same one map the
        // table's Date column reads, so the two surfaces cannot date one lead two ways.
        // Neither available means the card says nothing rather than borrowing a date.
        statusAt: statement?.at ?? leadDateForStatus(lead, getLeadConsolidatedStatus(lead)),
      });
    }
    return out;
  }, [searchedLeads, replyKindByEmail, statedReplyKinds]);

  // A campaign page has no table to switch to, so it has no switch either.
  const boardOnly = Boolean(campaignId);
  const showBoard = boardOnly || view === "board";

  const [boardError, setBoardError] = useState<string | null>(null);
  // A board move states a REPLY KIND, the same write the lead panel makes — never a
  // funnel-step statement, which is what the funnel columns used to write and which
  // asks for a cost this board has nowhere to collect.
  const moveOnBoard = useMutation({
    mutationFn: ({ email, kind }: { email: string; kind: ReplyKind }) =>
      setManualQualification({ campaignId: campaignId as string, email, status: kind }),
  });
  // Moving a card INTO Opt-out is a different write to a different producer: it states
  // that a named person asked us to stop and how they told us, it is scoped to the
  // PERSON rather than to this campaign, and it stops the sending everywhere. Kept as
  // its own mutation rather than folded into the one above — flattening them is what
  // would let a reply kind be written where a consent record belongs.
  const optOutOnBoard = useMutation({
    mutationFn: ({ email, channel }: { email: string; channel: OptOutChannel }) =>
      recordLeadOptOut({ email, channel }),
  });
  // And moving one OUT is the withdrawal of that record. It resumes nothing that was
  // stopped, which is why it is the only move the board asks somebody to confirm.
  const withdrawOptOutOnBoard = useMutation({
    mutationFn: ({ email }: { email: string }) => withdrawLeadOptOut({ email }),
  });

  // Paginate the active-tab (post-search) list at 50/page. Pure display slice —
  // the tab count badge + CSV export stay whole-list. Reset to page 0 whenever the
  // tab or search changes (else you land on an out-of-range page after the subset
  // shrinks). Clamp defensively in case a poll shrinks the list under the cursor.
  const PAGE_SIZE = 50;
  const pageCount = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedLeads = useMemo(
    () => filteredLeads.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredLeads, safePage],
  );
  useEffect(() => {
    setPage(0);
  }, [activeTab, search]);

  // Tabs = the realized-outcome tab (when available) + the goal's on-path engagement
  // steps, outcome-first (goal-steps single source), off-funnel steps dropped.
  const tabs: { key: Tab; label: string; count: number }[] = visibleTabs.map((key) => ({
    key,
    label: LEAD_TAB_LABEL[key as AnyLeadTab],
    count: groupedByTab.get(key)?.length ?? 0,
  }));


  // The two numbers the stat row states, taken off the SAME rows the board partitions
  // into columns — the page's own population, and how many of those people stand at
  // sales interest. Placement is `leadBoardColumnFor(standing)`, lead-service's own
  // funnel-aware answer, exactly as the board reads it (plus the same held latch, so a
  // move the person just made counts here for the round trip it takes to land): a card
  // and a column disagreeing about one screen is the self-contradictory-surface bug.
  //
  // Computed over `coveredLeads`, NOT `searchedLeads`: the cards describe the population,
  // the board's own columns thin out with the search box like the table does.
  //
  // Deliberately NOT `spend.positiveRepliesCount`. That is features-service's aggregate
  // over REPLY signals; the board renders `standing.state`, which is funnel-aware, and on
  // a funnel entered by a website visit the two are legitimately different numbers (67
  // leads who clicked through stand at `sales_interest` on `form_magnet`, where a
  // reply-based count sees none of them).
  const boardPopulation = useMemo(() => {
    let leads = 0;
    let salesInterest = 0;
    for (const lead of coveredLeads) {
      const held =
        lead.email && statedReplyKinds.has(lead.email)
          ? (statedReplyKinds.get(lead.email) ?? null)
          : undefined;
      const column = held?.column ?? leadBoardColumnFor(lead.standing);
      if (!column) continue;
      leads += 1;
      if (column === "sales_interest") salesInterest += 1;
    }
    return {
      leads,
      // A share of two counts THIS row states side by side — a description of the board
      // on screen, not a metric divided out of served fields. Null on an empty
      // population: "we have nothing to divide by", never a 0%.
      salesInterest: {
        count: salesInterest,
        sharePct: leads > 0 ? (salesInterest / leads) * 100 : null,
      },
    };
  }, [coveredLeads, statedReplyKinds]);

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
  // Scope the by-lead email to the brand in view: the same person can be a lead under
  // several brands in one org, each with its own generated email. Without brandId the
  // read returns the wrong brand's email under this brand's lead. brandId is in the key
  // so switching brand refetches the correct generation.
  const personLocation = [selectedFull?.city, selectedFull?.state, selectedFull?.country].filter(Boolean).join(", ");
  const orgLocation = [selectedOrg?.city, selectedOrg?.state, selectedOrg?.country].filter(Boolean).join(", ");

  // Brand audiences — shared cache with the Audiences page (usually warm). Used
  // to enrich the panel's Audience card (description / Size / Remaining) by joining
  // the lead's attributed `audience.id`; the name + avatar already ride the row.
  const { data: audiencesData } = useAuthQuery(
    offerId ? ["audiences", brandId, "offer", offerId] : ["audiences", brandId],
    () => listAudiences(brandId, { offerId }),
    {},
  );
  // The OPEN PERSON's campaigns, nested offer > funnel > campaign.
  //
  // The cards are lead-service's own (`?include=campaigns`), never a grouping of rows: a
  // brand-scoped read answers one row per person, so grouping rows draws one card
  // however many campaigns the person is really in.
  const leadCampaignTree = useMemo(
    () => buildLeadCampaignTree(selectedLead?.campaigns ?? [], campaignInfoOf),
    [selectedLead, campaignInfoOf],
  );

  // ONE CARD OPEN AT A TIME, and the first one by default so a person in a single
  // campaign never has to click to see anything. Latched on the lead's identity rather
  // than set in an effect: a poll must not re-open a card the reader closed, and a
  // freshly opened lead must not inherit the previous one's open row.
  const [openCampaign, setOpenCampaign] = useState<{ leadRowId: string; rowId: string | null } | null>(null);
  const defaultOpenRowId = firstCampaignRowId(leadCampaignTree);
  const openCampaignRowId =
    selectedLead && openCampaign?.leadRowId === selectedLead.id
      ? openCampaign.rowId
      : defaultOpenRowId;
  const toggleCampaign = useCallback(
    (rowId: string) => {
      if (!selectedLead) return;
      setOpenCampaign((prev) => {
        const current =
          prev?.leadRowId === selectedLead.id ? prev.rowId : defaultOpenRowId;
        return { leadRowId: selectedLead.id, rowId: current === rowId ? null : rowId };
      });
    },
    [selectedLead, defaultOpenRowId],
  );

  // Which campaign the open card belongs to — what the email read below is scoped by.
  const openCampaignId = useMemo(() => {
    for (const offer of leadCampaignTree.offers) {
      for (const funnel of offer.funnels) {
        for (const node of funnel.campaigns) {
          if (node.rowId === openCampaignRowId) return node.campaignId;
        }
      }
    }
    return null;
  }, [leadCampaignTree, openCampaignRowId]);

  //
  // Scoped to the OPEN CAMPAIGN as well, because a person contacted by several campaigns
  // of one brand has ONE GENERATION PER CAMPAIGN — 5,539 leads carry two or more — and
  // without the scope this returns whichever the read picked, under another campaign's
  // name. `openCampaignId` is in the key so opening a second card refetches rather than
  // showing the first card's copy.
  const { data: leadEmailData } = useAuthQuery(
    ["leadEmail", selectedLeadId, brandId, openCampaignId],
    () => getLeadEmail(selectedLeadId as string, brandId, openCampaignId ?? undefined),
    { enabled: !!selectedLeadId },
  );

  // Everything the panel can resolve about a card's audience. The card carries an id
  // only — the resolved name and avatar ride the ROW, and only for the campaign the row
  // represents — so the rest comes from the audiences list the page already holds.
  // An audience in neither (archived away, or still loading) keeps its id and says so
  // rather than being dropped: the attribution is real either way.
  const audienceForCard = useCallback(
    (card: LeadCampaignEvidence) => {
      if (!card.audienceId) return null;
      const full = audiencesData?.audiences.find((a) => a.id === card.audienceId) ?? null;
      const inline = selectedLead?.audience?.id === card.audienceId ? selectedLead.audience : null;
      return {
        id: card.audienceId,
        name: inline?.name ?? full?.name ?? null,
        avatarUrl: inline?.avatarUrl ?? full?.avatarUrl ?? null,
        description: full?.description ?? null,
        offerId: full?.offerId ?? null,
      };
    },
    [audiencesData, selectedLead],
  );


  // ── Funnel-stage statements for the open lead ────────────────────────────────
  // Campaign scope only: the panel walks ONE funnel's steps, and a brand runs several funnels
  // at once. `activeFunnelKeys` is already narrowed to this campaign's own row above,
  // so there is nothing extra to fetch and no goal to fall back to.
  const panelFunnel = campaignId && activeFunnelKeys[0] ? salesFunnelByKey(activeFunnelKeys[0]) : null;
  // WHICH ARROW of that funnel this campaign performs. A funnel is sold leg by leg, so
  // walking the whole funnel here offers a control for arrows this campaign does not
  // run — each of which has its own page, worked by whoever performs it. The channel
  // is the campaign's own feature slug, and its legs come off the catalogue the page
  // already holds (a `useMemo` over the `["features"]` query, so no extra request).
  //
  // The campaign's OWN statement wins where it makes one: `legKey` names the arrow it
  // was bought for, and unlike the derivation it stays correct once a channel performs
  // several arrows of one funnel. The derivation is the fallback for every campaign
  // that predates the column. Both reads are already in flight — the campaign row is
  // the key the top bar polls, the leg catalogue is a platform-wide one — so this costs
  // no request.
  const legIndex = useFunnelLegIndex();
  const panelLeg = useMemo(() => {
    if (!panelFunnel || !featureSlug) return null;
    const stated = statedCampaignLeg(panelFunnel, scopedCampaign?.legKey, legIndex);
    if (stated) return stated;
    const channel = acquisitionChannelForFeatureSlug(featureSlug, channels);
    return campaignLegFor(panelFunnel, channel?.legs);
  }, [panelFunnel, featureSlug, channels, scopedCampaign?.legKey, legIndex]);
  // A leg we cannot place falls back to the whole funnel, the sentence this panel read
  // before legs existed. `later` is never rendered — it is what a `never` also ends.
  const panelWalk = useMemo(
    () => (panelFunnel ? leadFunnelLegStages(panelFunnel.key, panelLeg) : { stages: [], later: [] }),
    [panelFunnel, panelLeg],
  );
  const panelStages = panelWalk.stages;
  const { data: stepStatements } = useLeadStepStatements(
    campaignId && selectedLead ? selectedLead.id : null,
  );
  const setStage = useSetLeadStepStatement(selectedLead?.id ?? null);
  // The target of the statement in flight. Held here rather than derived from the
  // mutation, because the spinner belongs on the button the person pressed and
  // `isPending` alone cannot say which of the two that was.
  const [panelPending, setPanelPending] = useState<
    { key: WritableStageKey; next: "outcome" | "never" | "withdraw" } | null
  >(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  // The statement just pressed, shown while the producer is answering. lead-service
  // decides more than the one field written — it can supersede an earlier `never`, and
  // it stamps the source and the time — so the READ still re-fetches and wins; this
  // only fills the two round trips a write takes, during which the row would otherwise
  // read exactly as it did before the click. Scoped to the lead row it was made on, so
  // opening another lead cannot inherit it.
  const [statedStage, setStatedStage] = useState<
    { leadRowId: string; key: WritableStageKey; next: LeadStageState | "withdrawn" } | null
  >(null);
  const panelStates = useMemo(() => {
    const served = stageStatesFrom(stepStatements);
    if (!statedStage || statedStage.leadRowId !== selectedLead?.id) return served;
    // A withdrawal is the ABSENCE of a statement, so the optimistic form of it is the
    // key going away — not a third state the row would have to know how to render.
    if (statedStage.next === "withdrawn") {
      const { [statedStage.key]: _dropped, ...rest } = served;
      return rest;
    }
    return { ...served, [statedStage.key]: statedStage.next };
  }, [stepStatements, statedStage, selectedLead]);
  // What a stated outcome was worth, so the amount somebody typed reads back where they
  // typed it. Absent when nobody said — never a zero standing in for an unpriced deal.
  const panelValues = useMemo(() => stageValuesFrom(stepStatements), [stepStatements]);
  // What the CUSTOMER said each hand-stated stage cost them. Their own money, recorded
  // because they told us and never charged. Present-with-null is a statement made
  // before the cost was asked for, which reads as unanswered rather than as a zero.
  const panelCosts = useMemo(() => stageCostsFrom(stepStatements), [stepStatements]);
  // Which stages carry somebody's OWN words, so their active button becomes the way to
  // take them back. A tracker-reported outcome is not this person's to undo, and
  // lead-service refuses it — so the control is not offered rather than offered and
  // refused.
  const panelWithdrawable = useMemo(() => withdrawableStages(stepStatements), [stepStatements]);
  // Stages the FUNNEL concluded rather than anybody stating — they render as the answer
  // they are and offer no control.
  const panelImplied = useMemo(() => impliedStages(stepStatements), [stepStatements]);
  // What we already measured, off the /revenue join the stat cards above already poll —
  // so a tracker-reported outcome and a hand-stated one both show, with no second read.
  const panelTracked = useMemo(() => {
    const cl = selectedLead?.leadId ? outcomeByLeadId.get(selectedLead.leadId) : undefined;
    return trackedStages(cl);
  }, [selectedLead, outcomeByLeadId]);

  // ── The reply row's own statement ────────────────────────────────────────────
  // Scoped to THIS (campaign, lead) rather than the org-wide list: one lead's reply is
  // one row, and pulling 500 of somebody else's to find it is a page's worth of network
  // for a single pill.
  const replyEmail = selectedLead?.email ?? null;
  const { data: replyData } = useAuthQuery(
    ["leadReplyKind", campaignId ?? "none", replyEmail ?? "none"],
    () => listManualQualifications({ campaignId, email: replyEmail as string, limit: 1 }),
    { enabled: Boolean(campaignId && replyEmail) },
  );
  // Rows come back newest-first, so the first STANDING one is the statement that holds.
  // A withdrawn row is served too (it is the audit of what was asserted), so taking
  // `[0]` verbatim renders a kind nobody stands behind — the whole point of taking it
  // back. `replyKind` is the resolved vocabulary; `status` is the raw thing a person
  // clicked and is deliberately not rendered.
  const replyKind =
    replyData?.qualifications.find((q) => !q.withdrawnAt)?.replyKind ?? null;
  // The kind just picked, shown before the producer has answered. A picker that keeps
  // reading "Replied, kind not stated" for the whole write reads as a control that did
  // nothing. Dropped the moment the producer answers — its own resolution is what
  // stands, this only fills the gap.
  // `kind: null` is a statement just TAKEN BACK, held over the same round trip a set is.
  const [statedReply, setStatedReply] = useState<{ email: string; kind: ReplyKind | null } | null>(
    null,
  );
  const shownReplyKind = statedReply && statedReply.email === replyEmail ? statedReply.kind : replyKind;
  const [replyPending, setReplyPending] = useState(false);
  const queryClient = useQueryClient();
  const setReply = useMutation({
    mutationFn: (kind: ReplyKind) =>
      setManualQualification({ campaignId: campaignId as string, email: replyEmail as string, status: kind }),
    onSuccess: (res) => {
      // The response IS the row this query reads (`limit: 1`, newest first), so write it
      // rather than invalidating: a re-read is a second round trip spent learning what
      // the producer has already told us, and it is that wait the pill sat through.
      queryClient.setQueryData(["leadReplyKind", campaignId ?? "none", replyEmail ?? "none"], {
        qualifications: [res.qualification],
      });
      setStatedReply(null);
      // A reply kind decides whether the sequence keeps sending, so the lead rows the
      // table renders can change with it.
      queryClient.invalidateQueries({ queryKey: campaignId ? ["campaignLeads", campaignId] : ["brandLeads", brandId] });
      // And a positive reply IS an outcome, so the stat row above the table, the money
      // at every grain and the per-audience costs all move with it.
      invalidateLeadOutcome(queryClient);
    },
  });

  const withdrawReply = useMutation({
    mutationFn: () =>
      withdrawManualQualification({ campaignId: campaignId as string, email: replyEmail as string }),
    onSuccess: () => {
      // The response carries the withdrawn row, not the list — and after a withdrawal
      // nothing stands, which is a statement about the WHOLE list rather than about one
      // row. Re-read both keys rather than reconstructing that here: the board joins on
      // the campaign-wide one and the panel on this pair, and they must not disagree
      // about whether anybody has said anything.
      queryClient.invalidateQueries({
        queryKey: ["leadReplyKind", campaignId ?? "none", replyEmail ?? "none"],
      });
      queryClient.invalidateQueries({ queryKey: ["campaignReplyKinds", campaignId ?? "none"] });
      setStatedReply(null);
      if (replyEmail) {
        setStatedReplyKinds((prev) => {
          const next = new Map(prev);
          next.delete(replyEmail);
          return next;
        });
      }
      // The kind decided whether the sequence kept sending, so the lead rows can move.
      queryClient.invalidateQueries({
        queryKey: campaignId ? ["campaignLeads", campaignId] : ["brandLeads", brandId],
      });
      // Taking the statement back un-counts the outcome, at every grain that counted it.
      invalidateLeadOutcome(queryClient);
    },
  });

  const onWithdrawReply = () => {
    setPanelError(null);
    if (replyEmail) setStatedReply({ email: replyEmail, kind: null });
    setReplyPending(true);
    withdrawReply.mutate(undefined, {
      onError: (err) => {
        console.error("[dashboard] withdrawManualQualification failed", err);
        // Nothing was taken back, so stop showing it as gone.
        setStatedReply(null);
        setPanelError(leadStepWithdrawErrorMessage(err));
      },
      onSettled: () => setReplyPending(false),
    });
  };

  const onSetReply = (kind: ReplyKind) => {
    setPanelError(null);
    if (replyEmail) setStatedReply({ email: replyEmail, kind });
    setReplyPending(true);
    setReply.mutate(kind, {
      onError: (err) => {
        console.error("[dashboard] setManualQualification failed", err);
        // Nothing was recorded, so stop showing it — the panel error says why.
        setStatedReply(null);
        setPanelError(leadStepErrorMessage(err));
      },
      onSettled: () => setReplyPending(false),
    });
  };

  const withdrawStage = useWithdrawLeadStepStatement(selectedLead?.id ?? null);

  const onWithdrawStage = (key: WritableStageKey) => {
    setPanelError(null);
    if (selectedLead) setStatedStage({ leadRowId: selectedLead.id, key, next: "withdrawn" });
    setPanelPending({ key, next: "withdraw" });
    withdrawStage.mutate(
      { step: key },
      {
        onError: (err) => {
          console.error("[dashboard] withdrawLeadStepStatement failed", err);
          // Nothing was taken back, so stop showing it as gone.
          setStatedStage(null);
          setPanelError(leadStepWithdrawErrorMessage(err));
        },
        onSettled: () => setPanelPending(null),
      },
    );
  };

  const onSetStage = (
    key: WritableStageKey,
    next: "outcome" | "never",
    costCents: number,
    valueCents?: number,
  ) => {
    setPanelError(null);
    if (selectedLead) setStatedStage({ leadRowId: selectedLead.id, key, next });
    setPanelPending({ key, next });
    setStage.mutate(
      // `costCents` always rides along: lead-service refuses a statement without it on
      // both kinds, and the control asked the person for it rather than defaulting one.
      // The VALUE rides along only when the control asked for one — lead-service refuses
      // a value on a `never`, and refuses a `sale` outcome WITHOUT one, so the key is
      // omitted rather than sent as undefined-shaped noise.
      valueCents === undefined
        ? { step: key, kind: next, costCents }
        : { step: key, kind: next, costCents, valueCents },
      {
        // lead-service writes the refusal as a sentence for a person to read (a `never`
        // on a step that already happened, a value on a `never`). Surface ITS reason
        // through the helper, never the thrown Error's own message field, which apiCall
        // sets to the whole downstream body verbatim.
        onError: (err) => {
          console.error("[dashboard] setLeadStepStatement failed", err);
          // Nothing was recorded, so stop showing it — the panel error says why.
          setStatedStage(null);
          setPanelError(leadStepErrorMessage(err));
        },
        onSettled: () => setPanelPending(null),
      },
    );
  };

  return (
    // The list keeps the WHOLE page width at every size and the detail panel OVERLAYS
    // it. It used to be a two-up split that squeezed the list to half-width whenever a
    // lead was open — which on the board meant five columns reflowing into a 50% rail
    // the moment somebody opened a card, i.e. the set they were reading moved under
    // them as the cost of looking at one row of it. An overlay costs the list nothing
    // and is what the mobile branch already did.
    <div className="flex flex-col h-full relative">
      <div className="w-full p-4 md:p-8 pb-24 overflow-y-auto transition-all">
        <OutreachStatCardsAuto
          leadsOverride={loading ? null : boardPopulation.leads}
          salesInterestOverride={loading ? null : boardPopulation.salesInterest}
        />
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            {loading ? (
              <Skeleton className="ml-2 inline-block h-4 w-56 align-middle" />
            ) : (
              <span className="ml-2 text-sm font-normal text-gray-500">({coveredLeads.length.toLocaleString("en-US")} leads)</span>
            )}
          </h1>
          {!loading && (
            <CsvDownloadButton filename={`leads-${brandId}.csv`} csv={leadsCsv} isEmpty={coveredLeads.length === 0} label="Export leads" />
          )}
        </div>

        {scopeNote && <p className="-mt-2 mb-4 text-sm text-gray-500">{scopeNote}</p>}

        {loading ? (
          <LeadsLoadingSkeleton />
        ) : (
          <>
            {/* Brand grain only. A campaign page draws the board and nothing else, so
                a switch there would offer a view it does not have. */}
            {!boardOnly && (
              <div className="mb-4 inline-flex rounded-lg border border-brand-200 bg-brand-50 p-0.5">
                {(["board", "table"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setView(option)}
                    aria-pressed={view === option}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition ${
                      view === option
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-brand-600 hover:text-brand-700"
                    }`}
                  >
                    {option === "board" ? "Board" : "Table"}
                  </button>
                ))}
              </div>
            )}

            {/* The tabs belong to the table: they pick which slice it lists, and the
                board is a partition of the whole population. Not rendered at all at
                campaign grain, hidden behind the toggle at brand grain. */}
            {!boardOnly && (
            <div className={`flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto ${showBoard ? "hidden" : ""}`}>
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
            )}

            <EntitySearchBar value={search} onChange={setSearch} placeholder="Search by name, company, title, or email..." resultCount={showBoard ? searchedLeads.length : filteredLeads.length} totalCount={showBoard ? coveredLeads.length : activeList.length} />

            {coveredLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
                <p className="text-gray-600 text-sm">Leads appear here once outreach starts.</p>
              </div>
            ) : showBoard ? (
              <LeadBoard
                cards={boardCards}
                busy={
                  moveOnBoard.isPending ||
                  optOutOnBoard.isPending ||
                  withdrawOptOutOnBoard.isPending
                }
                error={boardError}
                canMove={Boolean(campaignId)}
                filterKey={search}
                onOpen={(leadRowId) => {
                  const lead = coveredLeads.find((l) => l.id === leadRowId);
                  if (lead) setSelectedLead(lead);
                }}
                onMove={(move) => {
                  setBoardError(null);
                  const email = move.email;
                  // A reply kind holds the card in the column it was dropped in for the
                  // round trip. An opt-out holds it in Opt-out for the same reason. A
                  // WITHDRAWAL holds nothing on purpose: where the person lands once the
                  // record is released is lead-service's answer, and guessing at it here
                  // would be this app deciding a standing again.
                  if (move.type !== "withdrawal") {
                    const held =
                      move.type === "reply"
                        ? { kind: move.replyKind as string, column: move.column }
                        // Opt-out states a channel, not a reply kind. The card's own tag
                        // keeps reading whatever was last observed about the person; the
                        // hold is only about WHERE it sits.
                        : { kind: null as unknown as string, column: "opt_out" as LeadBoardColumnKey };
                    setStatedReplyKinds((prev) =>
                      // Stamped now because that is when the person said it — the read
                      // that replaces this carries the producer's own instant.
                      new Map(prev).set(email, held.kind
                        ? { kind: held.kind, at: new Date().toISOString(), column: held.column }
                        : null),
                    );
                  }

                  const drop = () =>
                    setStatedReplyKinds((prev) => {
                      const next = new Map(prev);
                      next.delete(email);
                      return next;
                    });

                  const settle = () => {
                    // The campaign's kinds and the lead rows both change with a
                    // statement (a reply kind decides whether the sequence keeps
                    // sending), so both are re-read.
                    const settled = Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["campaignReplyKinds", campaignId ?? "none"] }),
                      queryClient.invalidateQueries({
                        queryKey: campaignId ? ["campaignLeads", campaignId] : ["brandLeads", brandId],
                      }),
                    ]);
                    // The card moved because an outcome changed, so every figure that
                    // counts that outcome is re-read with it.
                    invalidateLeadOutcome(queryClient);
                    // Dropped once the re-read lands, and NOT before: the hold exists to
                    // cover the round trip and no longer. Keeping it past the re-read
                    // would pin the card to the column somebody dropped it in even when
                    // lead-service places it somewhere else — which it legitimately does
                    // (a positive reply is not the step a visit-led campaign sells), and
                    // which the reader has to see.
                    //
                    // Detached rather than awaited HERE: a promise returned from
                    // `onSuccess` keeps the mutation `isPending`, which is what the
                    // board's `busy` disables its buttons on — so awaiting the leads
                    // refetch would lock the whole picker for the length of a read that
                    // runs to tens of megabytes on a live campaign.
                    void settled.then(drop);
                  };

                  // The producer writes its refusal as a sentence for a person to read.
                  // Surface ITS reason, never the thrown Error's own message, which
                  // apiCall sets to the whole downstream body.
                  const fail = (err: unknown) => {
                    console.error("[dashboard] board move failed", err);
                    drop();
                    setBoardError(leadStepErrorMessage(err));
                  };

                  if (move.type === "reply") {
                    moveOnBoard.mutate(
                      { email, kind: move.replyKind },
                      { onSuccess: settle, onError: fail },
                    );
                    return;
                  }
                  if (move.type === "optOut") {
                    optOutOnBoard.mutate(
                      { email, channel: move.channel },
                      { onSuccess: settle, onError: fail },
                    );
                    return;
                  }
                  withdrawOptOutOnBoard.mutate({ email }, { onSuccess: settle, onError: fail });
                }}
              />
            ) : (
              <>
                <LeadsTable leads={pagedLeads} tab={activeTab} selectedLead={selectedLead} onSelectLead={setSelectedLead} statusOf={statusOf} audienceOf={audienceOf} outcomeDates={outcomeDates} />
                {/* The right gutter clears the floating WhatsApp support FAB, which
                    sits at z-30 over the rightmost 64/72px at every scroll position
                    — without it a tap on `Next` lands on the FAB. */}
                {filteredLeads.length > PAGE_SIZE && (
                  <div className={`mt-4 flex items-center justify-between ${SUPPORT_FAB_CLEARANCE}`}>
                    <span className="text-sm text-gray-500">
                      {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length.toLocaleString("en-US")}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {/* Dropped below sm: the gutter above costs 80px, and at
                          390px this indicator is what pushes the row to wrap.
                          The range on the left already states the position. */}
                      <span className="hidden sm:inline text-sm text-gray-500">Page {safePage + 1} of {pageCount}</span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                        disabled={safePage >= pageCount - 1}
                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selectedLead && (
        // Full-screen on a phone, a right-hand sheet on desktop — pinned to the
        // right edge and floating over the list rather than taking width from it.
        // `z-20` sits above the board's own rail and below the support FAB (z-30),
        // which is why the panel body carries its own bottom clearance.
        <div className="absolute inset-0 md:left-auto md:w-[30rem] md:max-w-[92vw] bg-gray-50 border-gray-200 md:border-l md:shadow-2xl overflow-y-auto z-20 pb-24">
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
                <div><span className="text-gray-500">Email:</span>
                  {selectedLead.email ? <p><CopyableEmail email={selectedLead.email} /></p> : <p className="font-medium">-</p>}
                  {selectedLead.emailStatus && <span className={`text-xs px-1.5 py-0.5 rounded ${selectedLead.emailStatus === "verified" ? "bg-green-100 text-green-700" : selectedLead.emailStatus === "guessed" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{selectedLead.emailStatus}</span>}
                </div>
                <div><span className="text-gray-500">Title:</span><p className="font-medium">{selectedFull?.currentTitle || "-"}</p></div>
                {selectedFull?.seniority && <div><span className="text-gray-500">Seniority:</span><p className="font-medium capitalize">{selectedFull.seniority}</p></div>}
                {personLocation && <div><span className="text-gray-500">Location:</span><p className="font-medium">{personLocation}</p></div>}
                {selectedFull?.departments?.length ? <div className="sm:col-span-2"><span className="text-gray-500">Departments:</span><p className="font-medium">{selectedFull.departments.join(", ")}</p></div> : null}
                {selectedFull?.functions?.length ? <div className="sm:col-span-2"><span className="text-gray-500">Functions:</span><p className="font-medium">{selectedFull.functions.join(", ")}</p></div> : null}
                {(selectedLead.global?.bounced || selectedLead.global?.unsubscribed) && (
                  <div><span className="text-gray-500">Across every brand:</span><p className="font-medium flex items-center gap-1.5 flex-wrap">{selectedLead.global?.bounced && <span className="text-xs px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">Global Bounced</span>}{selectedLead.global?.unsubscribed && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">Global Unsubscribed</span>}</p></div>
                )}
                {selectedFull?.linkedinUrl && <div className="sm:col-span-2"><span className="text-gray-500">LinkedIn:</span><p><a href={selectedFull.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{selectedFull.linkedinUrl}</a></p></div>}
              </div>
            </div>
            {/* Campaign scope only. A brand runs several funnels at once, so there is no
                single funnel to walk this lead through and the section states nothing. */}
            {campaignId && panelFunnel && (
              <LeadFunnelStageSection
                funnelName={panelFunnel.name}
                stages={panelStages}
                laterStages={panelWalk.later}
                states={panelStates}
                tracked={panelTracked}
                delivery={<StatusBadge status={statusOf(selectedLead)} />}
                implied={panelImplied}
                values={panelValues}
                costs={panelCosts}
                pending={panelPending}
                error={panelError}
                onSet={onSetStage}
                withdrawable={panelWithdrawable}
                onWithdraw={onWithdrawStage}
                reply={{
                  kind: shownReplyKind,
                  pending: replyPending,
                  onSet: onSetReply,
                  // Only offered while something STANDS. Every row this read serves is a
                  // human statement, so a standing kind is by construction somebody's own
                  // words — unlike a funnel step, where a tracker can be the author.
                  onWithdraw: shownReplyKind ? onWithdrawReply : undefined,
                }}
              />
            )}
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
            {/* This person's campaigns, each holding what IT decided about them. The
                offer, the audience AND the timeline live in here rather than as
                panel-level cards: all three are a campaign's answer, and stating one of
                them at person level presents one campaign's answer as the person's.

                The open card's timeline reads that campaign's OWN delivery evidence
                (lead-service `?include=campaigns`) and that campaign's OWN generated
                email (content-generation-service `?campaignId=`), so two cards can and
                do differ. A card the provider holds no evidence for says so rather than
                drawing an all-false timeline: "we cannot tell" is not "nothing
                happened". */}
            <LeadCampaignSections
              tree={leadCampaignTree}
              audienceFor={audienceForCard}
              openRowId={openCampaignRowId}
              onToggle={toggleCampaign}
              renderDetail={(node) =>
                node.card.delivery ? (
                  <LeadTimeline
                    delivery={node.card.delivery}
                    email={leadEmailData?.generation ?? null}
                    heading="Activity"
                    bare
                  />
                ) : (
                  <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-500">
                    No delivery events recorded for this campaign yet.
                  </p>
                )
              }
            />
            {/* No `Served:` footer. It printed an internal pipeline instant, in a
                different date format than every row above it, for a step the customer
                has no use for. The one place `servedAt` is worth showing is the row's
                own Status/Date pair while the lead still reads `Processing`.

                The BRAND-wide timeline, kept only where there are campaigns whose cards
                do not already account for it: with one campaign it would print the same
                rows twice under two headings. It reads the row's own delivery fields,
                which lead-service serves as the roll-up across every campaign of the
                brand — including any this read's scope did not return. */}
            {leadCampaignTree.campaignCount !== 1 && (
              <LeadTimeline
                delivery={selectedLead}
                email={leadCampaignTree.campaignCount === 0 ? (leadEmailData?.generation ?? null) : null}
                scopeNote={
                  leadCampaignTree.campaignCount > 1
                    ? "Everything this brand did, across every campaign above."
                    : null
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
