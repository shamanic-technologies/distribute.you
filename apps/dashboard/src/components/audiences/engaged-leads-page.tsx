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
import {
  LEAD_BOARD_COLUMNS,
  LEAD_BOARD_PAGE_SIZE,
  type LeadBoardColumnKey,
} from "@/lib/lead-board";
import { leadStatusLabel, leadStatusPill } from "@/lib/lead-status";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { SUPPORT_FAB_CLEARANCE } from "@/components/support/support-button";
import {
  listCampaignsByBrand,
  fetchLeadsCsv,
  getLeadBucketCounts,
  getLeadStandingCounts,
  getLeadHistory,
  listLeadsPage,
  type LeadScope,
  getLeadConsolidatedStatus,
  leadDateForStatus,
  getFeatureRevenue,
  keepLastGoodFeatureRevenue,
  getOfferSalesFunnels,
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
import {
  LeadFunnelStageSection,
  StageStatementForm,
} from "@/components/leads/lead-funnel-stage-section";
import { LeadLocationMap } from "@/components/leads/lead-location-map";
import {
  closeWonFunnelKey,
  dealCause,
  leadCloseWonState,
  saleValuePrefillUsd,
} from "@/lib/lead-close-won";
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
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { campaignLegFor } from "@/lib/campaign-leg";
import { statedCampaignLeg } from "@/lib/stated-campaign-leg";
import { useFunnelLegIndex } from "@/lib/use-funnel-leg-index";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import type { LeadOutcome, RevenueOverview } from "@/lib/revenue-view";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  LEADS_PAGE_SIZE,
  boardColumnTotals,
  leadBucketCountsQuery,
  leadsColumnPageQuery,
  leadsPageQuery,
  leadsSearchParam,
  leadsSearchProblem,
  pageCountFor,
  reachablePopulation,
  standingCountsQuery,
  tabCount,
} from "@/lib/leads-server-page";
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
  leadPanelScope,
  type CampaignInfo,
} from "@/lib/lead-campaign-tree";
import { LeadCampaignSections } from "@/components/audiences/lead-campaign-sections";
import { LeadScopeCards } from "@/components/audiences/lead-scope-cards";
import { LeadHistoryTimeline } from "@/components/audiences/lead-history-timeline";

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

/**
 * How long the search box holds still before it becomes a request. The box itself is
 * never debounced — only what goes on the wire — so typing stays instant while the
 * whole-population search behind it fires once.
 */
const LEADS_SEARCH_DEBOUNCE_MS = 300;

/**
 * ONE board column's page, and its poll.
 *
 * At module scope and taking everything it needs, so the five calls in the page are five
 * ordinary hook calls in a fixed order rather than a loop somebody has to re-reason about
 * the day a column is added.
 *
 * The key carries `shown`, so growing a column is a new entry rather than a mutation of
 * the one on screen: the global `keepPreviousData` keeps the current cards up while the
 * wider page lands, so a press never blanks the column it is growing.
 */
function useBoardColumnPage(args: {
  column: LeadBoardColumnKey;
  scope: LeadScope;
  scopeKey: string;
  search: string;
  shown: number;
  enabled: boolean;
}) {
  return useAuthQuery(
    ["leadsPage", args.scopeKey, "column", args.column, args.search, args.shown],
    () =>
      listLeadsPage(
        args.scope,
        leadsColumnPageQuery({
          column: args.column,
          search: args.search,
          shown: args.shown,
        }),
      ),
    { enabled: args.enabled, refetchInterval: LEADS_POLL_INTERVAL },
  );
}

/**
 * One lead as the board draws it.
 *
 * `column` is passed IN rather than derived: lead-service selected this row by standing,
 * so re-deriving a column here would be a second opinion over the answer that fetched it.
 */
function toBoardCard(
  lead: Lead,
  column: LeadBoardColumnKey,
  // A bare string, like the card's own field: lead-service and instantly-service own the
  // kind vocabulary and can widen it before this app ships, so a kind with no label here
  // renders as itself rather than failing to type.
  replyKind: string | null,
  statedAt: string | null,
): LeadBoardCard {
  const full = lead.lead;
  const status = getLeadConsolidatedStatus(lead);
  return {
    id: lead.id,
    email: lead.email ?? null,
    name: `${full?.firstName ?? ""} ${full?.lastName ?? ""}`.trim() || lead.email || "Lead",
    // Absent on the slim projection and routinely hotlink-blocked at the source, so the
    // card falls back to an initial rather than a broken image.
    photoUrl: full?.photoUrl ?? null,
    orgName: full?.organization?.name ?? null,
    orgDomain: full?.organization?.primaryDomain ?? null,
    column,
    replyKind,
    // The card states what we last OBSERVED about this person, not the column it is
    // already sitting in — a tag reading "Sales interest" under a heading reading "Sales
    // interest" spends the card's one tag saying nothing. The status is the shared
    // `getLeadConsolidatedStatus`, so the card and the table's own badge cannot name one
    // lead two ways, and the date below is `leadDateForStatus` of that same status: one
    // statement, one event.
    statusLabel: leadStatusLabel(status),
    statusPill: leadStatusPill(status),
    // When a kind was STATED, the card is dated by that statement; otherwise by the
    // timestamp that proves the lead's own delivery status. Neither available means the
    // card says nothing rather than borrowing a date.
    statusAt: statedAt ?? leadDateForStatus(lead, status),
  };
}

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

// ⚠️ Most-advanced FIRST, and this list MUST stay in the same order as
// `getLeadConsolidatedStatus` (lib/api.ts). `useMonotonicStatuses` suppresses a
// "downgrade", so a `bounced` ranked below `sent` here would pin a bounced lead on Sent
// however the derivation reads it.
const LEAD_STATUS_ORDER: LeadConsolidatedStatus[] = [
  "replied",
  "clicked",
  "bounced",
  "unsubscribed",
  "delivered",
  "sent",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

// Every tab a Leads page can render, and every one of them asks lead-service for its
// own bucket. `"all"` used to sit in this union as the base ordering key for an array
// held in the browser; there is no such array any more, and it had no bucket to ask for
// — a read naming no bucket returns the whole scoped population INCLUDING the people
// carrying no evidence at all, who can appear under no tab. So it is gone, and this
// union is now exactly `AnyLeadTab`.
type Tab = AnyLeadTab;

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
// The panel used to assemble a lead's timeline HERE, in the browser, out of six
// services: the delivery evidence and funnel statements from lead-service, the copy we
// generated and its planned cadence from content-generation-service, the messages
// exchanged and the hand-recorded reply statements from instantly-service, the outcomes
// from features-service. The customer's own mailbox, which for some prospects holds the
// ONLY copy of the exchange, was read by nobody. It fetched all of it, de-duplicated it,
// sorted it and decided what to hide.
//
// That merge is DELETED. lead-service assembles it now and `LeadHistoryTimeline` draws
// what it sends. Every timeline bug of that week was one defect seen from a different
// angle - a reply whose words we held rendering as a bare "they replied", follow-ups
// promised after the sequence had stopped, an exchange in the owner's Gmail invisible,
// a reply somebody typed by hand reading exactly like one we could produce - and all of
// them came from this file deciding what happened to a person. Do not bring it back.

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

const CAUSE_TIP =
  "Whether the outreach we run for you is what produced this deal. Say no when it came from something else you already do — a referral, an event, a pipeline you already had — even though we had also emailed them. A no costs you nothing: the deal still counts as yours and stays in your revenue. It only keeps its value out of the return we report on our own outreach, so that number is about what we actually caused.";

/**
 * Whether one lead's deal is won, and the control that states it.
 *
 * The one place in the table that WRITES. Everything it needs comes off the row the
 * page already holds — lead-service decides `won` (a standing of `customer` means the
 * funnel's last step is reached) — so a column over pages of rows costs no request per
 * lead.
 *
 * Three states, and the middle one is not the absence of the other two: a funnel we
 * cannot place has no sale step to offer, so the cell states nothing rather than a
 * blank that reads as "not won" or a button that would be refused.
 */
function CloseWonCell({ lead, prefillUsd, busy, onState }: {
  lead: Lead;
  /** The brand's own stated lifetime revenue for THIS lead's funnel, in whole dollars. */
  prefillUsd: number | null;
  busy: boolean;
  onState: (input: { costCents: number; valueCents: number; causedByOutreach: boolean }) => void;
}) {
  // Which of the two answers the person has picked, if any. `null` means they have not
  // picked yet, and the submit stays disabled — the whole point of the column is that
  // the answer is STATED, so defaulting one here would put words in their mouth and
  // record them as if somebody had said them.
  const [cause, setCause] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const state = leadCloseWonState(lead);

  if (state === "unavailable") return <span className="text-gray-300">-</span>;

  if (state === "won" || state === "won-unstated") {
    const caused = dealCause(lead);
    // Three readings, and the third is why they are three: a deal nobody was asked
    // about is not a deal we did not cause. It reads in the neutral grey and says so,
    // rather than borrowing either verdict's colour.
    const tone =
      caused === "outreach"
        ? "bg-green-50 text-green-700 border-green-200"
        : caused === "other"
          ? "bg-gray-100 text-gray-600 border-gray-200"
          : "bg-gray-50 text-gray-500 border-gray-200";
    const label =
      caused === "outreach" ? "Won, ours" : caused === "other" ? "Won, not ours" : "Won";
    const tip =
      caused === "outreach"
        ? "You said our outreach caused this deal, so its value counts toward the return on the outreach we run for you."
        : caused === "other"
          ? "You said something else of yours caused this deal. It stays in your own revenue; we leave its value out of the return we report on our outreach."
          : "Nobody was asked whose win this was — it was recorded before we started asking, or it came from your conversion tracker, which cannot know why somebody bought.";
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${tone}`}>
          {label}
        </span>
        <InfoTooltip tip={tip} />
      </span>
    );
  }

  // Every press inside this cell stops the row's own click: the row opens the detail
  // panel, and a form whose inputs open a panel underneath them is unusable.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  if (asking) {
    return (
      <div onClick={stop} className="flex flex-col items-end gap-1">
        {/* Asked BEFORE the amounts, because it is the question the column exists for
            and the one a person can answer without looking anything up. Two named
            buttons rather than a checkbox: "did we cause this" has two real answers and
            an unticked box would read as the second one without anybody choosing it. */}
        <div className="flex items-center justify-end gap-1 flex-wrap">
          <span className="text-xs text-gray-500">Caused by us?</span>
          {([true, false] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={(e) => {
                stop(e);
                setCause(value);
              }}
              aria-pressed={cause === value}
              className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                cause === value
                  ? value
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-100 text-gray-700 border-gray-300"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {value ? "Yes" : "No"}
            </button>
          ))}
          <InfoTooltip tip={CAUSE_TIP} />
        </div>
        <StageStatementForm
          label="Close won"
          tone="outcome"
          // lead-service refuses a sale with no value, so the form always asks — the
          // prefill is what it opens with, not what it sends.
          needsValue
          defaultValueUsd={prefillUsd}
          busy={busy}
          // Held back until the cause is answered. The form's own submit already
          // refuses a blank amount; this is the same rule for the same reason.
          disabled={cause === null}
          onSubmit={({ costCents, valueCents }) => {
            if (cause === null) return;
            setAsking(false);
            setCause(null);
            onState({ costCents, valueCents: valueCents as number, causedByOutreach: cause });
          }}
          onCancel={() => {
            setAsking(false);
            setCause(null);
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        stop(e);
        setAsking(true);
      }}
      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
    >
      Mark won
    </button>
  );
}

function LeadsTable({ leads, tab, selectedLead, onSelectLead, statusOf, audienceOf, outcomeDates, closeWon }: {
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
  /**
   * The Close won column: what to open the deal-value field with per lead, the write
   * itself, which row is in flight, and a refusal already turned into a sentence.
   *
   * Absent and the column does not render at all — this table is the same component at
   * four grains and a surface with no writer must not draw a control that cannot write.
   */
  closeWon?: {
    prefillUsd: (lead: Lead) => number | null;
    onState: (
      lead: Lead,
      input: { costCents: number; valueCents: number; causedByOutreach: boolean },
    ) => void;
    pendingRowId: string | null;
    error: string | null;
  };
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
      {/* The floor stays at 720px WITH the Close won column, deliberately. Raising it to
          fit the two-input form made a 820px tablet scroll sideways (measured: the card
          wanted 840 in 754), and the form does not need it — it wraps onto three lines
          in a ~196px cell and stays usable, and only ONE row is ever asking. The steady
          state of the column is a small button or a tag, both of which fit easily. */}
      <table className="w-full table-fixed text-sm md:table-auto md:min-w-[720px]">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3 w-[62%] md:w-auto">Company</th>
            <th className="px-4 py-3 hidden md:table-cell">Contact</th>
            <th className="px-4 py-3 hidden lg:table-cell">Offer</th>
            <th className="px-4 py-3 hidden md:table-cell">Audience</th>
            <th className="px-4 py-3 w-[38%] md:w-auto">Status</th>
            <th className="px-4 py-3 hidden md:table-cell">Date</th>
            {/* LAST, and hidden below `lg` — one breakpoint later than the columns
                beside it, because this one holds a two-input form rather than a value.
                Measured: at `md` the cell is ~120px and the form wraps onto four lines;
                from `lg` it sits on one. Below that the lead panel states the same
                thing, with the same prefill, in a column that has room for it. */}
            {closeWon && <th className="px-4 py-3 hidden lg:table-cell">Close won</th>}
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
                {closeWon && (
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <CloseWonCell
                      lead={lead}
                      prefillUsd={closeWon.prefillUsd(lead)}
                      busy={closeWon.pendingRowId === lead.id}
                      onState={(input) => closeWon.onState(lead, input)}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* A refusal is stated once, under the table, rather than per row: the write is
          row-scoped but the message is lead-service's sentence about the last one, and
          repeating it in every cell would say it as many times as there are rows. */}
      {closeWon?.error && (
        <p className="px-4 py-3 text-xs text-red-600 border-t border-gray-100">{closeWon.error}</p>
      )}
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
  // WHAT the reader is standing in, for the one board blurb whose sentence depends on
  // it: "disqualified as leads for this <scope>" is a judgement about ONE grain, and
  // this page renders at four. Read off the route rather than the data — the sentence
  // is about where the reader is, not about what the leads did.
  const boardScopeNoun = campaignId
    ? "campaign"
    : params.funnelKey
      ? "sales funnel"
      : offerId
        ? "offer"
        : "brand";
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

  // ── The reads ────────────────────────────────────────────────────────────────
  // This page used to ask for a brand's ENTIRE lead population and derive everything in
  // the browser: the tab counts, the search, the sort, the export and the board all came
  // out of one array. That array is 44.5 MB over 12,945 rows on one real brand and 99 MB
  // on the largest of the seven past the limit, so it was far over the 2 MB on-disk cache
  // entry cap, was never written, and the table cold-loaded on EVERY visit. That is the
  // loading skeleton this replaces — not a caching bug, a payload that could not be cached.
  //
  // lead-service answers each of those questions directly now. Two reads here: every
  // bucket's COUNT (no lead rows at all), and ONE page of the active bucket. Both are
  // small enough to be written to disk, so the table paints on arrival.
  //
  // lead-service answers a scoped read with ONE ROW PER PERSON (`DISTINCT ON (lead_id)`),
  // so there is nothing to dedupe here. What a person's several campaigns did lives on
  // `lead.campaigns`, served under `?include=campaigns` — the row is the person, the
  // cards are their campaigns.
  const scope = useMemo<LeadScope>(
    () => (campaignId ? { campaignId } : { brandId }),
    [campaignId, brandId],
  );
  const scopeKey = campaignId ? `campaign:${campaignId}` : `brand:${brandId}`;

  // What the WIRE carries for the search box. Debounced, because a request per keystroke
  // would be evaluated over the whole population; and refused locally when the producer
  // would 400 it (blank, over 200 characters, over 8 words), so a bad search says why
  // instead of taking the table down.
  const debouncedSearch = useDebouncedValue(search, LEADS_SEARCH_DEBOUNCE_MS);
  const searchProblem = leadsSearchProblem(search);
  const wireSearch = leadsSearchParam(debouncedSearch) ?? "";

  // Every tab's size in one round trip, without a single lead row. It takes the SAME
  // search the list takes, so the counts follow the search box rather than describing a
  // different set from the rows underneath them.
  const {
    data: bucketCounts,
    isError: countsError,
    isPending: countsPending,
  } = useAuthQuery(
    ["leadBucketCounts", scopeKey, wireSearch],
    () => getLeadBucketCounts(scope, leadBucketCountsQuery(wireSearch)),
    { refetchInterval: LEADS_POLL_INTERVAL },
  );

  // ONE page of the active tab's bucket. The key carries the scope, the tab, the search
  // and the page number, so two windows onto one brand can never share an entry — and
  // each entry is a few hundred KB rather than tens of megabytes.
  //
  // `sort=activity` is the ordering the Date column shows: newest first on the timestamp
  // that proves each lead's most advanced status. It used to be computed here over the
  // whole array; it is the producer's now, over the same rule, with a total order so a
  // page can neither repeat a lead nor skip one.
  const {
    data: pageData,
    isPending,
    isPlaceholderData,
    isError: pageError,
  } = useAuthQuery(
    ["leadsPage", scopeKey, activeTab, wireSearch, page],
    () => listLeadsPage(scope, leadsPageQuery({ tab: activeTab, search: wireSearch, page })),
    { refetchInterval: LEADS_POLL_INTERVAL },
  );

  const leads = useMemo(() => pageData?.leads ?? [], [pageData]);
  // How many leads the ACTIVE tab holds in total — what the pager is a window onto.
  // `null` means the producer did not say, which is never read as zero.
  const activeTotal = pageData?.total ?? tabCount(bucketCounts, activeTab);

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
  // live on the /revenue `leads[]` rows rather than on the lead row itself — so fetch
  // /revenue (same query key as the stat cards, so React Query dedupes it to one poll)
  // and join by the lead IDENTITY (`lead.leadId` ↔ `LeadOutcome.leadId`, not the
  // leads_campaigns row `id`).
  //
  // Two things it is read for, and one it is NOT: it dates each row's outcome, and it
  // decides which outcome tabs EXIST at all. It no longer decides tab MEMBERSHIP — that
  // is a bucket lead-service answers, off the same attributed ledger, because membership
  // has to be pageable and a client-side join can only ever see the page in hand.
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

  // The rows arrive ORDERED — `sort=activity`, newest first on the timestamp that proves
  // each lead's most advanced status, which is the value the Date column shows. That
  // used to be sorted here over the whole population; it is the producer's now, over the
  // same rule and with a total order (ties broken on the row id), so a page can neither
  // repeat a lead nor skip one. Re-sorting a PAGE here would be worse than redundant: it
  // would order 50 rows among themselves and read as if the whole tab were ordered.

  // Monotonic status latch: each lead's tab is derived from the email-gateway
  // delivery overlay, which can transiently drop on a poll and bounce a lead
  // back to "Processing" — emptying the tab being viewed, then repopulating.
  // Engagement is append-only, so a less-advanced status on a later poll is a
  // stale read: keep the most-advanced status seen this mount (see #1257 latch
  // philosophy). `statusOf` is the single source the table, tabs, and side
  // panel all bucket on.
  const statusEntries = useMemo(
    () => leads.map((l) => ({ id: l.id, status: getLeadConsolidatedStatus(l) })),
    [leads],
  );
  const latchedStatus = useMonotonicStatuses(statusEntries, LEAD_STATUS_ORDER, "leads");
  const statusOf = (lead: Lead): LeadConsolidatedStatus =>
    (latchedStatus.get(lead.id) as LeadConsolidatedStatus | undefined) ?? getLeadConsolidatedStatus(lead);

  // There is no client-side bucketing left. Which leads are in a tab is the QUESTION
  // this page asks lead-service (`?bucket=`), and the answer arrives already narrowed,
  // ordered and bounded — so the rows on screen ARE the active tab's page. Bucketing a
  // page here would partition 50 rows and read as if it had partitioned the tab.
  //
  // Note the outcome tabs moved with the rest: lead-service buckets them off its own
  // attributed conversion ledger (tracker-reported and hand-stated alike, withdrawn
  // statements excluded), which is the ledger features-service reads to price them. The
  // `/revenue` join is still read below, for the outcome DATE on each row and for
  // deciding which outcome tabs EXIST at all — never for membership, which cannot be
  // paged.

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

  // The population the tabs can actually reach, for the title.
  //
  // Every tab is an ENGAGEMENT step (contacted, clicked, replied, outcome), so a lead
  // lead-service served that carries no delivery evidence belongs to no bucket and is
  // unreachable from this page. Counting the whole scoped population here would
  // advertise rows the table can never show — about 5,000 of the 12,945 on the brand
  // that surfaced this — which is the bug #3071 fixed, so `bucket-counts.total` is
  // deliberately NOT what this reads. It reads the CONTACTED bucket, the base tab that
  // holds every lead we contacted whatever the funnel, and therefore the union's floor.
  // `null` while the counts are unsettled: a population we have not been told is not a
  // population of zero.
  const reachableCount = reachablePopulation(bucketCounts);

  // Opened once, on the leftmost tab that has anybody in it, in the OUTCOME-FIRST order
  // (goal-steps single source). It reads the COUNTS rather than the rows now, which is
  // what makes it right: it used to look at the loaded array, so with a page it would
  // have judged a tab empty because the page it happened to hold was.
  useEffect(() => {
    if (hasAutoSelectedTab.current) return;
    // Wait for the CAMPAIGNS query, which is what decides the tab set: firing the latch
    // first lands on a tab the funnels do not even offer, and it is one-shot, so a later
    // answer cannot correct it. And wait for the counts, for the same reason.
    if (!(campaignScoped ? scopeSettled : campaignRows.settled)) return;
    if (!bucketCounts) return;
    hasAutoSelectedTab.current = true;
    const populated = visibleTabs.find((t) => (tabCount(bucketCounts, t) ?? 0) > 0);
    setActiveTab(populated ?? visibleTabs[visibleTabs.length - 1] ?? "outreach");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketCounts, campaignRows.settled, scopeSettled, campaignScoped, outcomeAvailable]);

  // The rows on screen ARE the active tab's page: narrowed, searched and ordered by
  // lead-service. The three client-side steps this replaces — bucket, filter by a local
  // predicate, then slice — each only ever saw whatever was in memory, which is the whole
  // reason the page had to hold a brand's entire population to be correct.
  //
  // The SEARCH went with them. It used to be a local predicate over name, company,
  // headline and email; lead-service searches the same four fields over the WHOLE
  // matching population, so a match on page 40 is now findable, which it never was.
  const pagedLeads = leads;

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

  // A campaign page has no table to switch to, so it has no switch either.
  const boardOnly = Boolean(campaignId);
  const showBoard = boardOnly || view === "board";

  // The board's reads: ONE COUNT and ONE PAGE PER COLUMN.
  //
  // It used to be a single bounded read of the widest bucket, sorted into columns in the
  // browser, on the reasoning that a partition cannot page the way a list can. The
  // partition part is right and the conclusion was not: what could not page was a column
  // drawn as a SLICE of somebody else's page. lead-service partitions by standing now, so
  // each column is its own page with its own total, and the cap — and the line that had
  // to apologise for it — are gone.
  //
  // The counts come first and cost no rows. They also decide which columns are worth
  // reading at all: an empty column's page is not fetched once its size is known, while
  // before the counts land every column is read in parallel rather than waiting a round
  // trip to find out.
  const { data: standingCounts } = useAuthQuery(
    ["leadStandingCounts", scopeKey, wireSearch],
    () => getLeadStandingCounts(scope, standingCountsQuery(wireSearch)),
    { enabled: showBoard, refetchInterval: LEADS_POLL_INTERVAL },
  );
  const columnTotals = boardColumnTotals(standingCounts);

  // How far each column is drawn. It lives HERE rather than in the board because it
  // drives a fetch now: growing a column asks lead-service for a wider page of that
  // column, not for a bigger slice of one we already hold.
  const [columnShown, setColumnShown] = useState<Record<string, number>>({});
  // A search re-queries every column, so how far the reader had grown one describes a
  // set that no longer exists.
  useEffect(() => {
    setColumnShown({});
  }, [wireSearch]);

  const columnArgs = (column: LeadBoardColumnKey) => ({
    column,
    scope,
    scopeKey,
    search: wireSearch,
    shown: columnShown[column] ?? LEAD_BOARD_PAGE_SIZE,
    // Before the counts land every column is read; after, an empty one is not read again.
    enabled: showBoard && (columnTotals == null || columnTotals[column] > 0),
  });
  // Five explicit calls rather than a loop: the column set is a module constant, but a
  // hook in a loop is a rule nobody should have to re-check on the day a column is added.
  const contactedColumn = useBoardColumnPage(columnArgs("contacted"));
  const salesInterestColumn = useBoardColumnPage(columnArgs("sales_interest"));
  const disqualifiedColumn = useBoardColumnPage(columnArgs("disqualified"));
  const optOutColumn = useBoardColumnPage(columnArgs("opt_out"));
  const unresolvedColumn = useBoardColumnPage(columnArgs("unresolved"));
  const columnReads: Record<LeadBoardColumnKey, ReturnType<typeof useBoardColumnPage>> = {
    contacted: contactedColumn,
    sales_interest: salesInterestColumn,
    disqualified: disqualifiedColumn,
    opt_out: optOutColumn,
    unresolved: unresolvedColumn,
  };

  const boardLeads = useMemo(
    () => LEAD_BOARD_COLUMNS.flatMap((c) => columnReads[c.key].data?.leads ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      contactedColumn.data,
      salesInterestColumn.data,
      disqualifiedColumn.data,
      optOutColumn.data,
      unresolvedColumn.data,
    ],
  );
  // How many people the board is about, for the search bar. The columns partition the
  // population, so adding their served sizes is a count of the same kind — and it is
  // deliberately NOT `standingCounts.total`, which includes the people nobody wrote to
  // and who therefore appear in no column at all.
  const boardDrawnTotal = columnTotals
    ? LEAD_BOARD_COLUMNS.reduce((sum, c) => sum + columnTotals[c.key], 0)
    : null;
  const boardReadError = LEAD_BOARD_COLUMNS.some((c) => columnReads[c.key].isError);

  // Cards come off each column's own rows plus that one campaign-scoped read of the fine
  // reply kinds. No per-lead fetch.
  //
  // A card is placed by the column it was READ from, not by re-deriving one from the row:
  // lead-service filtered that page by standing, so asking `leadBoardColumnFor` again
  // would be a second opinion over the answer that selected the row in the first place.
  // The one thing that overrides it is a statement somebody just made, which speaks for
  // the round trip it takes to land.
  const boardColumns = useMemo(() => {
    const out = {} as Record<
      LeadBoardColumnKey,
      { cards: LeadBoardCard[]; total: number | null; pending: boolean }
    >;
    for (const column of LEAD_BOARD_COLUMNS) {
      const read = columnReads[column.key];
      const cards: LeadBoardCard[] = [];
      for (const lead of read.data?.leads ?? []) {
        // `has` decides whether the latch speaks, never `??`: `null` is a real entry
        // there — a statement just taken BACK — and `??` would read it as silence and
        // fall straight back to the kind that was withdrawn.
        const held =
          lead.email && statedReplyKinds.has(lead.email)
            ? (statedReplyKinds.get(lead.email) ?? null)
            : undefined;
        const statement =
          held !== undefined ? held : lead.email ? (replyKindByEmail.get(lead.email) ?? null) : null;
        if (held?.column && held.column !== column.key) continue;
        cards.push(toBoardCard(lead, column.key, statement?.kind ?? null, statement?.at ?? null));
      }
      // A card held into THIS column by a move the reader just made, whose served page
      // still has it somewhere else. Without this the card vanishes for the round trip.
      for (const lead of boardLeads) {
        const held =
          lead.email && statedReplyKinds.has(lead.email)
            ? (statedReplyKinds.get(lead.email) ?? null)
            : undefined;
        if (!held?.column || held.column !== column.key) continue;
        if (cards.some((c) => c.id === lead.id)) continue;
        cards.push(toBoardCard(lead, column.key, held.kind, held.at));
      }
      // A column is LOADING only while it could still receive rows. `isPending` alone
      // cannot say that: a column the counts report EMPTY is never read again (see the
      // `enabled` gate above), and a disabled query in v5 stays `isPending` FOREVER — so
      // every empty column sat on a loading state that could not resolve. Two honest
      // states instead: nothing drawn and nothing to draw is "nobody here", nothing
      // drawn and a read still owed is a skeleton. An errored read is settled too — the
      // board states the failure separately rather than skeletoning forever.
      const knownEmpty = columnTotals != null && columnTotals[column.key] === 0;
      out[column.key] = {
        cards,
        total: columnTotals?.[column.key] ?? null,
        pending: !knownEmpty && read.data === undefined && !read.isError,
      };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardLeads, replyKindByEmail, statedReplyKinds, columnTotals, boardReadError]);

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

  // The pager is a window onto `activeTotal` — the size of the whole tab, which
  // lead-service states — not onto the rows in memory. That distinction is the point:
  // it used to count pages over a slice of the loaded array, which is only correct when
  // the array IS the population. Reset to page 0 whenever the tab or the search changes,
  // and clamp so a tab that shrank under the cursor lands on a page that exists.
  const PAGE_SIZE = LEADS_PAGE_SIZE;
  const pageCount = pageCountFor(activeTotal);
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => {
    setPage(0);
  }, [activeTab, wireSearch]);
  // A clamp that only ever moves the cursor BACK, and only once the producer has told us
  // how big the tab is — never on an unsettled read, which would bounce the reader to
  // page 1 mid-poll.
  useEffect(() => {
    if (activeTotal == null) return;
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [activeTotal, page, pageCount]);

  // Tabs = the realized-outcome tab (when available) + the goal's on-path engagement
  // steps, outcome-first (goal-steps single source), off-funnel steps dropped. Each
  // states its OWN size, straight off `bucket-counts` — the whole tab, not the page.
  // `null` while that read is unsettled: a tab we have not been told the size of is not
  // a tab with nobody in it.
  const tabs: { key: Tab; label: string; count: number | null }[] = visibleTabs.map((key) => ({
    key,
    label: LEAD_TAB_LABEL[key as AnyLeadTab],
    count: tabCount(bucketCounts, key),
  }));


  // The stat row states SERVED figures, never a count of the rows this page happens to
  // hold.
  //
  // It used to count its two numbers off the board's own rows, which was correct while
  // the page held every lead and became a lie the moment that read gained a bound: the
  // board fetched a bounded page of the population, so the row printed that bound as
  // if it were the population. Measured on one production campaign: `Leads 200`
  // and `Sales Interests 19 (9.5%)` directly under a heading correctly reading
  // `2,052 leads`, beside a served website-visit figure of 85 — three populations on one
  // screen, every number real, none of them agreeing.
  //
  // So the row reads what the producers already answer: the population from
  // lead-service's bucket counts (the SAME number the heading states, so the two cannot
  // disagree), and the sales-interest pair from features-service's funnel steps — the
  // one `salesInterestSharePct` the campaign Overview reads, so those two surfaces
  // cannot state it two ways either.
  //
  // Consequence to hold: the row's sales interests count REPLY SIGNALS while the board's
  // own column renders lead-service's funnel-aware standing, and on a funnel entered by
  // a website visit those legitimately differ. The board states its own bound above
  // itself; closing that gap needs standing counts from lead-service, which is a
  // producer ask, not a number to derive here.

  // Static-shell-first (CLAUDE.md "Page composition: shell+nav+header render
  // instantly; each card owns its skeleton"). The shell (stat cards, h1, tabs,
  // search) paints immediately; only the table region skeletons while the page read is
  // still in flight. Gating the WHOLE page on this blanked the screen for the entire load.
  //
  // `isPlaceholderData` is what makes a tab or page CHANGE paint a skeleton rather than
  // the previous tab's rows under the new tab's name: the global `keepPreviousData` hands
  // back the old key's data while the new one loads, and rendering that would show one
  // tab's leads under another's heading.
  // ...and only the TABLE's own page read may gate it. The board draws from five
  // per-column reads of its own, each with its own skeleton, so holding it behind the
  // table's page meant a board whose rows were already on disk still waited on a request
  // it does not use — the opposite of the local-first paint every other surface gets.
  const loading = (isPending || isPlaceholderData) && !showBoard;

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
  // What the OFFER said each of its funnels is worth, read for ONE reason: it is what
  // the deal-value field opens with when somebody states a won deal, so they confirm
  // their own stated lifetime revenue instead of retyping it per lead.
  //
  // OFFER-scoped, because that is the grain the brand states a lifetime revenue at: it
  // is a property of (offer, funnel), so a brand-wide read would open the field with a
  // number a DIFFERENT proposition is worth. The key is byte-equal to the one the Sales
  // Funnels card already polls, so this dedupes to no extra request.
  //
  // Consequence, accepted: at BRAND grain there is no offer to name — a lead can be on
  // any of the brand's — so the read is disabled and the field opens EMPTY, exactly as
  // it did before. Reading the brand-wide figure there instead would be this surface
  // borrowing a sibling offer's number, which is the one thing a prefill must not do.
  const { data: salesFunnelsData } = useAuthQuery(
    ["offerSalesFunnels", brandId, offerId ?? "none"],
    () => getOfferSalesFunnels(brandId, offerId as string),
    { enabled: !!offerId },
  );
  // The prefill for ONE lead: its own campaign's funnel, never a sibling funnel's. An
  // offer is sold through several funnels at once and prices each one, and the lead is
  // on exactly one of them.
  const prefillUsdFor = useCallback(
    (lead: Lead) => saleValuePrefillUsd(salesFunnelsData?.funnels, closeWonFunnelKey(lead)),
    [salesFunnelsData],
  );

  // Stating a won deal from a TABLE ROW. The row-scoped hook is what the board already
  // uses for the same reason: the target is decided at press time, so holding it in
  // state first so a per-lead hook could be built would race the submit.
  const [closeWonError, setCloseWonError] = useState<string | null>(null);
  const [closeWonRowId, setCloseWonRowId] = useState<string | null>(null);
  const setAnyStage = useSetAnyLeadStepStatement();
  const stateCloseWon = useCallback(
    (
      lead: Lead,
      input: { costCents: number; valueCents: number; causedByOutreach: boolean },
    ) => {
      setCloseWonError(null);
      setCloseWonRowId(lead.id);
      setAnyStage.mutate(
        { leadRowId: lead.id, step: "sale", kind: "outcome", ...input },
        {
          onSettled: () => setCloseWonRowId(null),
          // lead-service writes its refusal for a person to read; the raw thrown error
          // is the whole downstream body verbatim and never reaches a customer.
          onError: (err) => setCloseWonError(leadStepErrorMessage(err)),
        },
      );
    },
    [setAnyStage],
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

  // WHICH levels of Brand > Offer > Funnel > Funnel leg > Channel > Audience every one
  // of this person's campaigns agrees on. The agreed ones are stated as their own
  // stacked cards above; only what varies is left to the nested list, so a
  // campaign-scoped panel reads as six cards, a funnel-scoped one as three cards over a
  // list of leg x channel, and a brand-scoped one as one card over the whole nest.
  const panelScope = useMemo(() => leadPanelScope(leadCampaignTree), [leadCampaignTree]);

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

  // The per-campaign generated-email read and the per-campaign thread read are GONE
  // from here. Both were sources this file merged by hand; lead-service asks them now
  // and hands back one ordered list.
  // WHAT HAPPENED TO THIS PERSON, assembled by lead-service.
  //
  // This is the read that replaced a merge done HERE, across six services, with the
  // customer's own mailbox read by nobody. It arrives ordered and de-duplicated, with
  // the words of every message in both directions — including the exchanges that never
  // reached the outreach provider at all and live only in the owner's Gmail.
  //
  // Keyed on the `leads_campaigns` row, which is what the producer scopes by. The OPEN
  // card is the only one read for, exactly as its thread was: a panel listing eleven
  // campaigns must not fire eleven of these.
  const isBetaUserForPanel = useIsBetaUser();
  // Whether the copy we GENERATED but never sent may be read. A real message is always
  // readable — it is the customer's own conversation — while an unsent draft is our
  // writing and stays behind the beta gate, unless this scope has already produced the
  // thing it was bought for, in which case the customer is owed the words that did it.
  const canReadDraftCopy = isBetaUserForPanel || Boolean(selectedLead?.clicked || selectedLead?.replyClassification === "positive");
  const openHistoryRowId = panelScope.sole?.rowId ?? openCampaignRowId;
  const { data: openHistory, isError: openHistoryError } = useAuthQuery(
    ["leadHistory", openHistoryRowId ?? "none", brandId, "campaign"],
    () => getLeadHistory(openHistoryRowId as string, { brandId, scope: "campaign" }),
    { enabled: Boolean(openHistoryRowId) },
  );

  // The roll-up across every campaign of the brand, for the panel's brand-wide section.
  // Asked of the producer under its own `scope`, rather than added up here.
  const brandHistoryRowId = selectedLead?.id ?? null;
  const { data: brandHistory } = useAuthQuery(
    ["leadHistory", brandHistoryRowId ?? "none", brandId, "brand"],
    () => getLeadHistory(brandHistoryRowId as string, { brandId, scope: "brand" }),
    { enabled: Boolean(brandHistoryRowId && leadCampaignTree.campaignCount !== 1) },
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
  // WHICH funnel this panel walks. Exactly two scopes STATE one, and neither guesses:
  //
  //  - a CAMPAIGN states its own — `activeFunnelKeys` is already narrowed to that
  //    campaign's row above, so there is nothing extra to fetch;
  //  - a FUNNEL route states it in the URL, and that funnel is the page's whole subject.
  //
  // Brand and offer state NOTHING, deliberately: several funnels run at once there, so
  // there is no single walk and the section does not render at all.
  //
  // The route key is read the way every other funnel-scoped surface reads it —
  // `campaignFunnel` normalizes both wire spellings and THROWS on a key the catalogue
  // does not carry, which is the same contract `funnel-scoped-pages` and the leg page
  // already honour on this route. Absent (`params.funnelKey` undefined at the other
  // three scopes) is null, which is a different statement from unknown.
  const routeFunnelKey = params.funnelKey
    ? (decodeURIComponent(params.funnelKey as string) as SalesFunnelKeyWire)
    : null;
  const panelFunnel = campaignId
    ? activeFunnelKeys[0]
      ? salesFunnelByKey(activeFunnelKeys[0])
      : null
    : campaignFunnel(routeFunnelKey);
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
  //
  // A leg is a CAMPAIGN's answer and only a campaign's: off a campaign route there is
  // no arrow to narrow to, and `featureSlug` there is the brand's SOLE channel rather
  // than one this page is about — so deriving a leg from it would slice the funnel by
  // a channel the reader never named. Null instead, which walks the whole funnel: the
  // UNION of every arrow, since `funnelLegs` tiles the steps end to end and that union
  // is exactly what a funnel-scoped reader can state.
  const legIndex = useFunnelLegIndex();
  const panelLeg = useMemo(() => {
    if (!campaignId || !panelFunnel || !featureSlug) return null;
    const stated = statedCampaignLeg(panelFunnel, scopedCampaign?.legKey, legIndex);
    if (stated) return stated;
    const channel = acquisitionChannelForFeatureSlug(featureSlug, channels);
    return campaignLegFor(panelFunnel, channel?.legs);
  }, [campaignId, panelFunnel, featureSlug, channels, scopedCampaign?.legKey, legIndex]);
  // A leg we cannot place falls back to the whole funnel, the sentence this panel read
  // before legs existed. `later` is never rendered — it is what a `never` also ends.
  const panelWalk = useMemo(
    () => (panelFunnel ? leadFunnelLegStages(panelFunnel.key, panelLeg) : { stages: [], later: [] }),
    [panelFunnel, panelLeg],
  );
  const panelStages = panelWalk.stages;
  // Read wherever the section RENDERS, which is wherever a funnel is stated — the gate
  // is `panelFunnel`, not `campaignId`. A statement is keyed on the leads_campaigns row
  // the table already carries, so a funnel-scoped reader writes exactly as the leg board
  // one level down already does; there is no campaign to have.
  const { data: stepStatements } = useLeadStepStatements(
    panelFunnel && selectedLead ? selectedLead.id : null,
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
  const standingQualification =
    replyData?.qualifications.find((q) => !q.withdrawnAt) ?? null;
  const replyKind = standingQualification?.replyKind ?? null;
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
          // The population lead-service counted, not the page of it we fetched. `null`
          // while the counts are unsettled — a population we have not been told is not a
          // population of zero — and the row then states its single Outreach card, the
          // same reading it has always had off a scope that supplies no count.
          contactedOverride={reachableCount}
        />
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-display text-xl font-bold text-gray-800">
            Leads
            {reachableCount == null ? (
              <Skeleton className="ml-2 inline-block h-4 w-56 align-middle" />
            ) : (
              <span className="ml-2 text-sm font-normal text-gray-500">({reachableCount.toLocaleString("en-US")} leads)</span>
            )}
          </h1>
          {reachableCount != null && (
            /* The export is FETCHED on press — lead-service streams the whole matching
               set, honouring the scope, the active tab and the search, so a download is
               what the page is showing. It used to be built here from the population in
               memory, which is what forced the page to hold it. */
            <CsvDownloadButton
              filename={`leads-${brandId}.csv`}
              csv={() =>
                fetchLeadsCsv(
                  scope,
                  leadsPageQuery({ tab: activeTab, search: wireSearch, page: 0 }),
                )
              }
              isEmpty={reachableCount === 0}
              label="Export leads"
            />
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
                  {/* A tab whose size we have not been told states NOTHING — never
                      `(0)`, which claims nobody is in it. */}
                  {tab.count != null && (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      ({tab.count.toLocaleString("en-US")})
                    </span>
                  )}
                </button>
              ))}
            </div>
            )}

            {/* The counts are the PRODUCER's: how many match the search across the whole
                population, against how big the set is without it. Counting the rows in
                memory would state "50 of 50" on every page of every search. */}
            <EntitySearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by name, company, title, or email..."
              resultCount={(showBoard ? boardDrawnTotal : activeTotal) ?? 0}
              totalCount={(showBoard ? reachableCount : tabCount(bucketCounts, activeTab)) ?? 0}
            />
            {/* A search the producer would refuse is refused HERE, with the reason, and
                never sent — the alternative is a 400 that empties the table. */}
            {searchProblem && (
              <p className="mt-2 text-sm text-red-600">{searchProblem}</p>
            )}

            {reachableCount === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No leads yet</h3>
                <p className="text-gray-600 text-sm">Leads appear here once outreach starts.</p>
              </div>
            ) : showBoard ? (
              <>
              {/* No bound to apologise for: each column states its own size and draws
                  and grows its own page. */}
              <LeadBoard
                columns={boardColumns}
                scopeNoun={boardScopeNoun}
                onShowMore={(column) =>
                  setColumnShown((prev) => ({
                    ...prev,
                    [column]: (prev[column] ?? LEAD_BOARD_PAGE_SIZE) + LEAD_BOARD_PAGE_SIZE,
                  }))
                }
                busy={
                  moveOnBoard.isPending ||
                  optOutOnBoard.isPending ||
                  withdrawOptOutOnBoard.isPending
                }
                error={boardError}
                canMove={Boolean(campaignId)}
                onOpen={(leadRowId) => {
                  const lead = boardLeads.find((l) => l.id === leadRowId);
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
              </>
            ) : (
              <>
                <LeadsTable
                  leads={pagedLeads}
                  tab={activeTab}
                  selectedLead={selectedLead}
                  onSelectLead={setSelectedLead}
                  statusOf={statusOf}
                  audienceOf={audienceOf}
                  outcomeDates={outcomeDates}
                  closeWon={{
                    prefillUsd: prefillUsdFor,
                    onState: stateCloseWon,
                    pendingRowId: closeWonRowId,
                    error: closeWonError,
                  }}
                />
                {/* The right gutter clears the floating WhatsApp support FAB, which
                    sits at z-30 over the rightmost 64/72px at every scroll position
                    — without it a tap on `Next` lands on the FAB. */}
                {activeTotal != null && activeTotal > PAGE_SIZE && (
                  <div className={`mt-4 flex items-center justify-between ${SUPPORT_FAB_CLEARANCE}`}>
                    <span className="text-sm text-gray-500">
                      {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, activeTotal)} of {activeTotal.toLocaleString("en-US")}
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
            {/* Wherever a funnel is STATED: the campaign's own, or the one the funnel
                route names. At brand and offer grain several funnels run at once, so
                there is no single walk and the section states nothing at all. */}
            {panelFunnel && (
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
                // The same prefill the table column opens with, off the same resolver:
                // one lead's deal is worth one thing, whichever surface asks for it.
                saleValuePrefillUsd={selectedLead ? prefillUsdFor(selectedLead) : null}
                withdrawable={panelWithdrawable}
                onWithdraw={onWithdrawStage}
                // A reply kind is recorded against a CAMPAIGN — instantly-service owns
                // that vocabulary and keys it on (campaign, email) — so off a campaign
                // route there is nothing to write it to and the read is disabled. Null
                // rather than a picker that would meet a refusal: the Replied row then
                // reads exactly as it did before the control existed, which is the
                // honest surface for a statement this scope cannot make.
                reply={
                  campaignId
                    ? {
                        kind: shownReplyKind,
                        pending: replyPending,
                        onSet: onSetReply,
                        // Only offered while something STANDS. Every row this read serves
                        // is a human statement, so a standing kind is by construction
                        // somebody's own words — unlike a funnel step, where a tracker
                        // can be the author.
                        onWithdraw: shownReplyKind ? onWithdrawReply : undefined,
                      }
                    : null
                }
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
            {/* Where those two `Location:` rows PUT this lead, shown rather than
                spelled. It renders below the Organization card because it is about
                both halves at once — the person and the employer — so it cannot sit
                inside either. It draws nothing when we recognise neither country. */}
            <LeadLocationMap person={selectedFull ?? null} organization={selectedOrg ?? null} />
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
            {/* The hierarchy this person sits in, ONE CARD PER LEVEL, for every level
                their campaigns agree on. What varies is the list underneath. */}
            <LeadScopeCards
              offer={panelScope.offer}
              funnelKey={panelScope.funnelKey}
              sole={
                panelScope.sole
                  ? {
                      featureSlug: panelScope.sole.info?.featureSlug ?? null,
                      legKey: panelScope.sole.info?.legKey ?? null,
                      audience: audienceForCard(panelScope.sole.card),
                    }
                  : null
              }
            />
            {panelScope.sole ? (
              /* One campaign: every level above is already its own card, so there is
                 nothing to nest and nothing to switch between — the timeline is the
                 whole of what is left to say. */
              openHistory ? (
                <LeadHistoryTimeline
                  history={openHistory}
                  heading="Activity"
                  canReadDraftCopy={canReadDraftCopy}
                />
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Activity
                  </h3>
                  {/* Reveal on SETTLE: a failed read says so rather than skeletoning
                      forever, and "we could not read this" is never rendered as
                      "nothing happened". */}
                  <p className="text-sm text-gray-500">
                    {openHistoryError
                      ? "We could not read this person's history right now."
                      : "Loading..."}
                  </p>
                </div>
              )
            ) : (
            <LeadCampaignSections
              tree={leadCampaignTree}
              audienceFor={audienceForCard}
              openRowId={openCampaignRowId}
              onToggle={toggleCampaign}
              /* Neither band repeats a card two inches above it. */
              showOffers={!panelScope.offer}
              showFunnels={panelScope.funnelKey ? false : undefined}
              renderDetail={(node) =>
                // Only the OPEN card is read for — a person in eleven campaigns must
                // not fire eleven of these — so only that card can draw one.
                node.rowId === openCampaignRowId && openHistory ? (
                  <LeadHistoryTimeline
                    history={openHistory}
                    heading="Activity"
                    canReadDraftCopy={canReadDraftCopy}
                    bare
                  />
                ) : (
                  <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-500">
                    {node.rowId === openCampaignRowId && openHistoryError
                      ? "We could not read this campaign's history right now."
                      : "Loading..."}
                  </p>
                )
              }
            />
            )}
            {/* No `Served:` footer. It printed an internal pipeline instant, in a
                different date format than every row above it, for a step the customer
                has no use for. The one place `servedAt` is worth showing is the row's
                own Status/Date pair while the lead still reads `Processing`.

                The BRAND-wide timeline, kept only where there are campaigns whose cards
                do not already account for it: with one campaign it would print the same
                rows twice under two headings. It reads the row's own delivery fields,
                which lead-service serves as the roll-up across every campaign of the
                brand — including any this read's scope did not return. */}
            {leadCampaignTree.campaignCount !== 1 && brandHistory && (
              <LeadHistoryTimeline
                history={brandHistory}
                heading="Everything this brand did"
                canReadDraftCopy={canReadDraftCopy}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
