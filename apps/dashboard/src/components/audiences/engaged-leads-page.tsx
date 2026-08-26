"use client";

import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useMonotonicStatuses } from "@/lib/use-monotonic-status";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { SUPPORT_FAB_CLEARANCE } from "@/components/support/support-button";
import {
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
  leadFunnelStages,
  leadStepErrorMessage,
  trackedStages,
  type WritableStageKey,
} from "@/lib/lead-funnel-stages";
import { salesFunnelByKey } from "@/lib/sales-funnels";
import {
  stageStatesFrom,
  useLeadStepStatements,
  useSetLeadStepStatement,
} from "@/lib/use-lead-step-statements";
import { normalizeSalesFunnelKey } from "@/lib/sales-funnels";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import type { ConversionLead, RevenueOverview } from "@/lib/revenue-view";
import { buildLeadsCsv } from "@/lib/leads-csv";
import { CsvDownloadButton } from "@/components/report/csv-button";
import { OfferMark } from "@/components/marks/offer-mark";
import { EntitySearchBar } from "@/components/entity-search-bar";
import { EmailSignature } from "@/components/email-signature";
import { Skeleton } from "@/components/skeleton";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";
import { tenantBasePath } from "@/lib/offer-path";

// Labels for the Leads tabs. WHICH of them render comes from the active campaigns'
// funnels (`leadTabsForFunnels`); this map only names them.
//
// The base tab says "Contacted", not the funnel step's own word, because this page
// counts PEOPLE while the brand Overview counts the email sequences we sent them —
// two honest numbers that read as one broken one under a shared label (prod: 9,915
// sequences against 7,895 leads on the same brand, the same afternoon).
const LEAD_TAB_LABEL: Record<AnyLeadTab, string> = {
  "positive-replies": "Positive replies",
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
function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Website visit";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    // Handing the lead to Instantly is not reaching them: Instantly dispatches on
    // weekdays inside the recipient's business hours, so this state can outlive the
    // push by three days. The old wording claimed an email had already gone out.
    case "contacted": return "Queued";
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
    // Slate, not a saturated hue: this is a wait, not a step the lead has cleared.
    case "contacted": return "bg-slate-100 text-slate-700 border-slate-200";
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

// `size` is a style rather than a Tailwind class because the class would have to be
// built from the prop, which the compiler cannot see (same reason `AudienceAvatar`
// does it this way). Requests twice the rendered size so it stays crisp on a retina
// screen. `shrink-0` matters wherever the sibling text truncates.
function CompanyLogo({
  domain,
  name,
  size = 24,
}: {
  domain: string | null;
  name: string | null;
  size?: number;
}) {
  const box = { width: size, height: size };
  if (domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=${size * 2}`}
        alt=""
        style={box}
        className="shrink-0 rounded"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.4)) }}
      className="shrink-0 rounded bg-gray-200 flex items-center justify-center font-medium text-gray-500"
    >
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
    </div>
  );
}

// Right-panel "Audience" card — which saved audience this lead was attributed to.
// `inline` = the {id,name,avatarUrl} served on the lead row (always present when
// attributed); `full` = the matching human-service audience row looked up by id
// (description only), null until listAudiences resolves or when the audience was
// archived away. Renders nothing when the lead has no audience.
//
// Size / remaining-to-contact deliberately do NOT live here: the Audiences page
// owns every audience number and the targeting filters. The card links there with
// `?audienceId=` (the deep-link seed CustomerAudiencesPage reads on first paint,
// same as the brand-overview Top-3-audiences card), which opens that audience's
// detail panel with its colored targeting tags. That page lives under the audience's
// OWN offer, so the link waits on the human-service lookup that states it — see
// `audienceOfferId` below for why the route's offer is only the fallback.
/**
 * The OFFER this lead belongs to — what it was contacted to be sold.
 *
 * It sits ABOVE the audience deliberately, and the order is the model: an offer
 * is WHAT we were selling this person, an audience is WHY we picked them for
 * it. The audience was chosen for the offer, so reading the panel top-down
 * gives the proposition before the reason.
 *
 * Rendered straight from `lead.offer`, which lead-service resolves off the
 * campaign the lead was served under. No client-side join — the dashboard holds
 * neither the campaign-to-offer map nor the offer's name, and the audience card
 * below is this repo's own precedent for why that join belongs upstream even
 * where it is possible.
 *
 * A lead with no offer renders NOTHING rather than an empty card: lead-service
 * is fail-soft here, so an absent offer means "we could not say" as often as
 * "there is none", and a card reading `-` would assert the second.
 *
 * A present id with a null NAME still renders, without the name. The
 * attribution is real and the link works; hiding it would lose a true fact over
 * a missing label.
 */
function OfferSection({ offer }: { offer: { id: string; name: string | null } }) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Offer</h3>
      {/* The mark leads the name here exactly as it does in the top bar, the tenant
          switcher, the Offers table and the leads table's own Offer column — an offer
          wears one mark on every surface that names one. */}
      <div className="flex min-w-0 items-center gap-2">
        <OfferMark size="sm" />
        <p className="truncate text-sm font-medium text-gray-800">
          {offer.name ?? <span className="text-gray-500">Unnamed offer</span>}
        </p>
      </div>
      <Link
        href={`/orgs/${orgId}/brands/${brandId}/offers/${offer.id}`}
        className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
      >
        View offer
      </Link>
    </div>
  );
}

function AudienceSection({
  inline,
  full,
}: {
  inline: { id: string; name: string; avatarUrl: string | null };
  full: AudienceWire | null;
}) {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  // Present on the offer and campaign routes, absent on the brand one.
  const routeOfferId = params.offerId as string | undefined;
  // An audience's page lives under the OFFER it was assembled for, so the link is
  // built from the AUDIENCE's own `offerId` — not from whichever route the reader
  // happens to be on. Building it from the route sent every brand-level reader to
  // `/brands/:id/audiences`, a path that does not exist (audiences moved down to
  // the offer), so the card's one affordance was a 404 on the brand Leads page.
  // The route id stays as the fallback for the case the lookup misses (an audience
  // archived out of the list): inside an offer, that offer's page is the right one.
  const audienceOfferId = full?.offerId ?? routeOfferId ?? null;
  // No offer resolvable ⟹ NO link. Some audiences predate the offer level and are
  // filed under none, so there is no page to open; a link to a 404 is worse than a
  // card that simply states the audience. Same render while the lookup is in
  // flight — we do not claim either way before we know.
  const detailHref = audienceOfferId
    ? `${tenantBasePath(orgId, brandId, audienceOfferId)}/audiences?audienceId=${inline.id}`
    : null;
  const avatarUrl = inline.avatarUrl ?? full?.avatarUrl ?? null;
  const description = full?.description ?? null;
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
      {detailHref && (
        <Link
          href={detailHref}
          className="mt-3 inline-block text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          View audience details
        </Link>
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
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${leadStatusStyle(status)}`}>{leadStatusLabel(status)}</span>;
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
function LeadTimeline({ lead, email }: { lead: Lead; email: LeadEmailGeneration | null }) {
  const replyColor =
    lead.replyClassification === "positive" ? "bg-green-500"
      : lead.replyClassification === "negative" ? "bg-red-500"
        : "bg-violet-500";

  // A lead handed to Instantly with no send observed yet. The push and the message
  // still waiting to go out are ONE fact, so they share a row; the moment a real send
  // exists the queue step becomes technical noise and disappears.
  const sentAt = lead.firstSentAt ?? "";
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
        at: lead.firstContactedAt || anchor,
        dot: "bg-slate-400",
        note: SEND_WINDOW_NOTE,
      }]
    : [
        { label: "Sent", at: sentAt, dot: "bg-blue-400" },
        ...(lead.firstDeliveredAt ? [{ label: "Delivered", at: lead.firstDeliveredAt, dot: "bg-blue-500" }] : []),
      ];

  // The card sits at the moment the message left (or started waiting), so it sorts
  // into the chronology at the right place even though it prints no date itself.
  const initialAt = queuedOnly ? (lead.firstContactedAt || anchor) : sentAt;
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
    { kind: "event", label: "Website visit", at: lead.firstClickedAt ?? "", dot: "bg-violet-500" },
    {
      kind: "event",
      label: lead.replyClassification ? `Replied (${lead.replyClassification})` : "Replied",
      at: lead.firstRepliedAt ?? "",
      dot: replyColor,
    },
    { kind: "event", label: "Bounced", at: lead.firstBouncedAt ?? "", dot: "bg-red-500" },
    { kind: "event", label: "Unsubscribed", at: lead.firstUnsubscribedAt ?? "", dot: "bg-amber-500" },
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
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Activity timeline</h3>
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
                    {e.body && (
                      <details className="mt-1.5 group">
                        <summary className="cursor-pointer text-xs text-brand-600 hover:text-brand-700 select-none">
                          {e.subject ? <span className="font-medium text-gray-700">{e.subject}</span> : "View email"}
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
  const brandId = params.brandId as string;
  // The OFFER this page is scoped to, when the route names one. lead-service has no
  // offer filter yet, so the ROWS are still the brand's — the money and the
  // audiences joined onto them are the offer's, which is every scope the backend
  // can honestly answer today.
  const offerId = params.offerId as string | undefined;
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
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
    { refetchInterval: POLL_INTERVAL },
  );

  const leads = useMemo(() => data?.leads ?? [], [data]);

  const featureSlug = useSoleFeatureSlug();

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
  const campaignRows = useCampaignRows(brandId, featureSlug);
  const activeFunnelKeys = useMemo(() => {
    const scoped = campaignId
      ? campaignRows.rows.filter((r) => r.campaign.id === campaignId)
      : campaignRows.activeRows;
    return scoped
      .map((r) => r.campaign.funnelKey)
      .filter((k): k is NonNullable<typeof k> => k != null)
      .map(normalizeSalesFunnelKey);
  }, [campaignRows.rows, campaignRows.activeRows, campaignId]);
  const funnelTabs = useMemo(() => leadTabsForFunnels(activeFunnelKeys), [activeFunnelKeys]);

  // Realized per-lead OUTCOMES (features-service#476 conversion-tracker attribution)
  // live on the /revenue `leads[]` rows, NOT the lead-service `listBrandLeads` row —
  // so fetch /revenue (same query key as the stat cards → React Query dedupes to one
  // poll) and join by the lead IDENTITY (`lead.leadId` ↔ `ConversionLead.leadId`, not
  // the leads_campaigns row `id`). The outcome tab (Signups/Meetings/Form submissions/
  // Sales) buckets on the join boolean + dates on its timestamp.
  const revenueEnabled = isRevenueFeature(featureSlug);
  const { data: revenueData } = useAuthQuery(
    campaignId
      ? ["featureRevenue", brandId, featureSlug, "campaign", campaignId]
      : offerId
        ? ["featureRevenue", brandId, featureSlug, "offer", offerId]
        : ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId, { campaignId, offerId }),
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

  // One descriptor per outcome the active funnels terminate in — a brand selling
  // through several has several, so this is a list rather than a per-goal lookup.
  const outcomeTabs = useMemo(
    () => funnelTabs.outcomes.map(outcomeTabDescriptor),
    [funnelTabs],
  );
  const availableOutcomeTabs = useMemo(
    () =>
      outcomeTabs.filter((t) =>
        (revenueData?.leads ?? []).some((l) => l[t.leadField] !== undefined),
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
  const audienceOf = (lead: Lead): LeadAudience | null =>
    lead.audience ? { name: lead.audience.name, avatarUrl: lead.audience.avatarUrl } : null;

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
  // source: sales_meetings → Positive replies first, visit goals → Website Visits
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
    if (!campaignRows.settled) return;
    hasAutoSelectedTab.current = true;
    const count = (t: Tab) => groupedByTab.get(t)?.length ?? 0;
    setActiveTab(visibleTabs.find((t) => count(t) > 0) ?? visibleTabs[visibleTabs.length - 1] ?? "outreach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLeads.length, campaignRows.settled, groupedByTab, outcomeAvailable]);

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
  // Scope the by-lead email to the brand in view: the same person can be a lead under
  // several brands in one org, each with its own generated email. Without brandId the
  // read returns the wrong brand's email under this brand's lead. brandId is in the key
  // so switching brand refetches the correct generation.
  const { data: leadEmailData } = useAuthQuery(
    ["leadEmail", selectedLeadId, brandId],
    () => getLeadEmail(selectedLeadId as string, brandId),
    { enabled: !!selectedLeadId },
  );
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
  const selectedAudienceInline = selectedLead?.audience ?? null;
  const selectedAudienceFull =
    selectedAudienceInline
      ? audiencesData?.audiences.find((a) => a.id === selectedAudienceInline.id) ?? null
      : null;


  // ── Funnel-stage statements for the open lead ────────────────────────────────
  // Campaign scope only: the panel walks ONE chain, and a brand runs several funnels
  // at once. `activeFunnelKeys` is already narrowed to this campaign's own row above,
  // so there is nothing extra to fetch and no goal to fall back to.
  const panelFunnel = campaignId && activeFunnelKeys[0] ? salesFunnelByKey(activeFunnelKeys[0]) : null;
  const panelStages = useMemo(
    () => (panelFunnel ? leadFunnelStages(panelFunnel.key) : []),
    [panelFunnel],
  );
  const { data: stepStatements } = useLeadStepStatements(
    campaignId && selectedLead ? selectedLead.id : null,
  );
  const setStage = useSetLeadStepStatement(selectedLead?.id ?? null);
  // The target of the statement in flight. Held here rather than derived from the
  // mutation, because the spinner belongs on the button the person pressed and
  // `isPending` alone cannot say which of the two that was.
  const [panelPending, setPanelPending] = useState<{ key: WritableStageKey; next: "outcome" | "never" } | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const panelStates = useMemo(() => stageStatesFrom(stepStatements), [stepStatements]);
  // What we already measured, off the /revenue join the stat cards above already poll —
  // so a tracker-reported outcome and a hand-stated one both show, with no second read.
  const panelTracked = useMemo(() => {
    const cl = selectedLead?.leadId ? outcomeByLeadId.get(selectedLead.leadId) : undefined;
    return trackedStages(cl);
  }, [selectedLead, outcomeByLeadId]);

  const onSetStage = (key: WritableStageKey, next: "outcome" | "never") => {
    setPanelError(null);
    setPanelPending({ key, next });
    setStage.mutate(
      { step: key, kind: next },
      {
        // lead-service writes the refusal as a sentence for a person to read (a `never`
        // on a step that already happened, a value on a `never`). Surface ITS reason
        // through the helper, never the thrown Error's own message field, which apiCall
        // sets to the whole downstream body verbatim.
        onError: (err) => {
          console.error("[dashboard] setLeadStepStatement failed", err);
          setPanelError(leadStepErrorMessage(err));
        },
        onSettled: () => setPanelPending(null),
      },
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-full relative">
      <div className={`${selectedLead ? 'hidden md:block md:w-1/2' : 'w-full'} p-4 md:p-8 pb-24 overflow-y-auto transition-all`}>
        <OutreachStatCardsAuto outreachOverride={loading ? null : contactedCount} outreachLabel="Contacted" />
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

            {coveredLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
                <p className="text-gray-600 text-sm">Leads appear here once outreach starts.</p>
              </div>
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
                <div><span className="text-gray-500">Email:</span>
                  {selectedLead.email ? <p><CopyableEmail email={selectedLead.email} /></p> : <p className="font-medium">-</p>}
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
            {selectedLead.offer && <OfferSection offer={selectedLead.offer} />}
            {selectedAudienceInline && (
              <AudienceSection inline={selectedAudienceInline} full={selectedAudienceFull} />
            )}
            {/* Campaign scope only. A brand runs several funnels at once, so there is no
                single chain to walk this lead through and the section states nothing. */}
            {campaignId && panelFunnel && (
              <LeadFunnelStageSection
                funnelName={panelFunnel.name}
                stages={panelStages}
                states={panelStates}
                tracked={panelTracked}
                pending={panelPending}
                error={panelError}
                onSet={onSetStage}
              />
            )}
            {/* No `Served:` footer. It printed an internal pipeline instant, in a
                different date format than every row above it, for a step the customer
                has no use for. The one place `servedAt` is worth showing is the row's
                own Status/Date pair while the lead still reads `Processing`. */}
            <LeadTimeline lead={selectedLead} email={leadEmailData?.generation ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}
