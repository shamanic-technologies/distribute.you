import type { OpsDns, OpsMessage, OpsPaidToDate } from "@/lib/api";

/**
 * Pure helpers for the cold-email ops section. No React, no runtime `@` import
 * (the one above is type-only and erased at build), so this module carries REAL
 * unit tests rather than source-substring guards. Keep it that way.
 *
 * Nothing here computes a FIGURE. Every number on those pages is a field
 * instantly-service served; what lives here is how a filter becomes a query
 * string, how a served value is LABELLED, and which order a thread's messages
 * read in.
 */

// ---------------------------------------------------------------------------
// Inbox filters → query string
// ---------------------------------------------------------------------------

/**
 * How many threads / messages one page asks for.
 *
 * The producer REQUIRES `limit` (an integer 1-500) and the unfiltered thread set
 * is ~70k rows server-side, so there is no "fetch everything" shape at all: the
 * inbox pages with `nextCursor` and this is the page size.
 */
export const INBOX_PAGE_SIZE = 50;

/** The producer's own bounds on `limit`. A value outside them is a 400, not a clamp. */
export const INBOX_LIMIT_MIN = 1;
export const INBOX_LIMIT_MAX = 500;

/** The two values the producer accepts for `direction`. Anything else is a 400. */
export const INBOX_DIRECTIONS = ["in", "out"] as const;
export type InboxDirection = (typeof INBOX_DIRECTIONS)[number];

/**
 * Every filter the producer accepts on BOTH list reads, plus the two that are
 * specific to one of them (`hasInbound` on threads, `threadId` on messages).
 *
 * A field left blank is OMITTED rather than sent empty: the producer reads an
 * empty string as "not filtering", so sending one is noise on the wire and makes
 * two identical requests carry two different query strings — which would give
 * them two different React Query cache entries for one answer.
 */
export interface InboxFilters {
  kind?: string;
  direction?: string;
  account?: string;
  mailbox?: string;
  domain?: string;
  counterparty?: string;
  orgId?: string;
  campaignId?: string;
  since?: string;
  until?: string;
  placement?: string;
  /** Threads only — the producer ignores it on `/messages`. */
  hasInbound?: boolean;
  /** Messages only. */
  threadId?: string;
}

/** The filter keys shared by both reads, in the order they go on the wire. */
const SHARED_KEYS = [
  "kind",
  "direction",
  "account",
  "mailbox",
  "domain",
  "counterparty",
  "orgId",
  "campaignId",
  "since",
  "until",
  "placement",
] as const;

function appendShared(params: URLSearchParams, filters: InboxFilters): void {
  for (const key of SHARED_KEYS) {
    const value = filters[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed === "") continue;
    params.set(key, trimmed);
  }
}

function appendCursor(params: URLSearchParams, cursor: string | null | undefined): void {
  if (typeof cursor === "string" && cursor !== "") params.set("cursor", cursor);
}

/**
 * Build the `/instantly/ops/threads` query string. `limit` always goes first and
 * is always present — it is required downstream, and a missing one is a 400 that
 * reads on screen as an empty inbox.
 */
export function buildThreadsQuery(
  filters: InboxFilters,
  opts?: { limit?: number; cursor?: string | null },
): string {
  const params = new URLSearchParams();
  params.set("limit", String(opts?.limit ?? INBOX_PAGE_SIZE));
  appendShared(params, filters);
  // A tri-state on the wire: absent = no opinion, `true` / `false` = a filter.
  if (filters.hasInbound !== undefined) params.set("hasInbound", filters.hasInbound ? "true" : "false");
  appendCursor(params, opts?.cursor);
  return params.toString();
}

/**
 * Build the `/instantly/ops/messages` query string. `hasInbound` is deliberately
 * NOT forwarded: the producer drops it on this read, so sending it would split
 * the cache on a value that changes no answer.
 */
export function buildMessagesQuery(
  filters: InboxFilters,
  opts?: { limit?: number; cursor?: string | null },
): string {
  const params = new URLSearchParams();
  params.set("limit", String(opts?.limit ?? INBOX_PAGE_SIZE));
  appendShared(params, filters);
  if (typeof filters.threadId === "string" && filters.threadId.trim() !== "") {
    params.set("threadId", filters.threadId.trim());
  }
  appendCursor(params, opts?.cursor);
  return params.toString();
}

/** True when at least one filter is set — used to say whether the list is narrowed. */
export function hasActiveFilters(filters: InboxFilters): boolean {
  if (filters.hasInbound !== undefined) return true;
  return SHARED_KEYS.some((key) => {
    const value = filters[key];
    return typeof value === "string" && value.trim() !== "";
  });
}

// ---------------------------------------------------------------------------
// Thread reading order
// ---------------------------------------------------------------------------

/**
 * A thread reads OLDEST FIRST, the way the conversation happened.
 *
 * The producer serves messages newest-first (it is a cursor list over a
 * descending index), so a panel rendering them in wire order shows the reply
 * above the send it answers. This reverses on `occurredAt`, breaking ties on the
 * message id so two messages at the same instant cannot swap between polls.
 */
export function threadReadingOrder<T extends Pick<OpsMessage, "id" | "occurredAt">>(
  messages: readonly T[],
): T[] {
  return [...messages].sort((a, b) => {
    const at = Date.parse(a.occurredAt);
    const bt = Date.parse(b.occurredAt);
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Append a freshly-loaded page to the rows already on screen, dropping anything
 * the list already holds.
 *
 * The producer pages over a DESCENDING index, so a row that moves (a thread
 * whose `lastAt` advances between two page requests) can legitimately come back
 * on a later page. Appending blindly would then render it twice, and React would
 * warn about the duplicate key. First occurrence wins, so the position a reader
 * has already scrolled past never shifts under them.
 */
export function appendPage<T>(existing: readonly T[], page: readonly T[], idOf: (row: T) => string): T[] {
  const seen = new Set(existing.map(idOf));
  const out = [...existing];
  for (const row of page) {
    const id = idOf(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

/**
 * The one sentence every `paidToDate` figure carries.
 *
 * The producer computes it as a monthly rate multiplied by elapsed months and
 * says so in its own `source` field. It is NOT a ledger of charges, so a surface
 * that prints it without that word is presenting an estimate as money spent.
 */
export const PAID_TO_DATE_NOTE =
  "Estimate: the monthly rate multiplied by the months elapsed, not a ledger of charges.";

/** True when the producer labelled this figure an estimate rather than a measurement. */
export function isEstimate(paid: OpsPaidToDate | null | undefined): boolean {
  return paid?.source === "estimate";
}

/**
 * The word that rides beside a `paidToDate` amount. `null` when there is nothing
 * to qualify — absent is not "measured".
 */
export function paidToDateQualifier(paid: OpsPaidToDate | null | undefined): string | null {
  if (!paid) return null;
  return isEstimate(paid) ? "estimate" : paid.source;
}

// ---------------------------------------------------------------------------
// DNS verdicts (a DISPLAY classification of served fields, never a measurement)
// ---------------------------------------------------------------------------

export type DnsVerdict = "ok" | "weak" | "missing";

export interface DnsBadge {
  label: string;
  verdict: DnsVerdict;
  /** What the record actually says, for the hover / detail line. */
  detail: string | null;
}

/**
 * The four records an operator grades a sending domain on, each reduced to one
 * word plus what it actually says.
 *
 * `weak` is its own verdict rather than a shade of `missing`: an SPF ending
 * `?all` and no SPF at all are different problems, and collapsing them tells an
 * operator to go and add a record that is already there.
 */
export function dnsBadges(dns: OpsDns): DnsBadge[] {
  const spf: DnsBadge = !dns.spf.present
    ? { label: "SPF", verdict: "missing", detail: null }
    : {
        label: "SPF",
        // `-all` and `~all` both tell a receiver to distrust an unlisted sender;
        // `?all` and `+all` tell it to accept anything, which is no policy.
        verdict: dns.spf.allQualifier === "-all" || dns.spf.allQualifier === "~all" ? "ok" : "weak",
        detail: dns.spf.raw,
      };

  const dmarc: DnsBadge = !dns.dmarc.present
    ? { label: "DMARC", verdict: "missing", detail: null }
    : {
        label: "DMARC",
        verdict: dns.dmarc.policy === "reject" || dns.dmarc.policy === "quarantine" ? "ok" : "weak",
        detail: dns.dmarc.raw,
      };

  const dkim: DnsBadge =
    dns.dkimSelectors.length > 0
      ? { label: "DKIM", verdict: "ok", detail: dns.dkimSelectors.join(", ") }
      : { label: "DKIM", verdict: "missing", detail: null };

  const mx: DnsBadge =
    dns.mx.length > 0
      ? { label: "MX", verdict: "ok", detail: dns.mx.join(", ") }
      : { label: "MX", verdict: "missing", detail: null };

  return [spf, dmarc, dkim, mx];
}

/** How many DNS probes came back with an error, so the panel can say a record is unread rather than absent. */
export function dnsErrorCount(dns: OpsDns): number {
  return Object.keys(dns.errors).length;
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Human labels for the lifecycle states. The vocabulary is the PRODUCER's and it
 * can grow, so an unknown token renders VERBATIM rather than being dropped or
 * folded into a default — a state nobody labelled is still a state.
 */
const LIFECYCLE_LABELS: Record<string, string> = {
  in_production: "In production",
  in_recovery: "In recovery",
  deactivated_by_instantly: "Deactivated by Instantly",
  deactivated_by_user: "Deactivated by user",
  unclassified: "Unclassified",
};

export function lifecycleLabel(status: string): string {
  return LIFECYCLE_LABELS[status] ?? status;
}

/** Same rule for the sending pools: label what we know, print what we do not. */
const POOL_LABELS: Record<string, string> = {
  "google-workspace": "Google Workspace",
  "gandi-relay": "Gandi relay",
  "mailforge-relay": "Mailforge relay",
  "dfy-google": "DFY Google",
  unknown: "Unattributed",
};

export function poolLabel(pool: string): string {
  return POOL_LABELS[pool] ?? pool;
}

/** Message typologies, in the order a reader thinks about them. Unknown prints verbatim. */
const MESSAGE_KIND_LABELS: Record<string, string> = {
  outreach: "Outreach",
  manual_reply: "Manual reply",
  reply: "Reply",
  auto_reply: "Auto reply",
  bounce: "Bounce",
  warmup: "Warmup",
  warmup_reply: "Warmup reply",
  seed: "Seed test",
};

export function messageKindLabel(kind: string): string {
  return MESSAGE_KIND_LABELS[kind] ?? kind;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Cents to a currency string. `null` in, `null` out — never a fabricated $0. */
export function formatCents(cents: number | null | undefined, currency: string | null | undefined): string | null {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return null;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency && currency.length === 3 ? currency : "USD",
    maximumFractionDigits: 2,
  });
}

/** A served percentage, one decimal. `null` = not measured, and stays a dash upstream. */
export function formatPct(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
  return `${pct.toFixed(1)}%`;
}

/**
 * The day a ramp projection reaches its ceiling, so a cap can be read as "50 on
 * Sep 24" rather than as seven rows of numbers. Returns the FIRST date at the
 * highest cap the projection carries; `null` for an empty projection, which is
 * "we were not told", never "today".
 */
export function rampReaches(
  projection: readonly { date: string; cap: number }[],
): { date: string; cap: number } | null {
  if (projection.length === 0) return null;
  let best = projection[0];
  for (const point of projection) {
    if (point.cap > best.cap) best = point;
  }
  return best;
}
