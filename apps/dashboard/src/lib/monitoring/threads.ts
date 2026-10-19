import { z } from "zod";
import { MESSAGE_KIND_WORD } from "./sending";

/**
 * Monitoring > Emails > Threads (staff only, MONITORING-ADMIN-PORT-1019): every thread our
 * sending infra sent or received, of every kind, ported from the admin console's cold-email
 * Inbox page. instantly-service `/internal/ops/threads` and `/internal/ops/messages?threadId=`
 * through api-service's staff-only passthroughs (`/v1/instantly/ops/*`).
 *
 * Alias-free (zod + a relative import only) so it carries real unit tests. Nothing here computes
 * a figure: it builds the producer's query string, names served tokens, and orders a thread's
 * messages for reading.
 */

// ─── Wire shapes ───────────────────────────────────────────────────────────

export const OpsThreadSchema = z.object({
  threadId: z.string(),
  kind: z.string(),
  subject: z.string().nullable(),
  accountEmail: z.string().nullable(),
  mailboxLogin: z.string().nullable(),
  counterparty: z.string().nullable(),
  transport: z.string().nullable(),
  instantlyCampaignId: z.string().nullable(),
  orgId: z.string().nullable(),
  campaignId: z.string().nullable(),
  leadEmail: z.string().nullable(),
  // null on threads no caller launched (warmup, seeds): seen in prod 2026-10-19.
  brandIds: z.array(z.string()).nullable(),
  deliveryStatus: z.string().nullable(),
  replyClassification: z.string().nullable(),
  replyKind: z.string().nullable(),
  placement: z.string().nullable(),
  messageCount: z.number(),
  inboundCount: z.number(),
  outboundCount: z.number(),
  firstAt: z.string().nullable(),
  lastAt: z.string().nullable(),
});
export type OpsThread = z.infer<typeof OpsThreadSchema>;

export const OpsThreadsSchema = z.object({
  threads: z.array(OpsThreadSchema),
  // null = no further page.
  nextCursor: z.string().nullable(),
});
export type OpsThreads = z.infer<typeof OpsThreadsSchema>;

/** One email of a thread (the thread panel renders more of it than the Monitoring emails table). */
export const OpsThreadMessageSchema = z.object({
  id: z.string(),
  direction: z.string(),
  kind: z.string(),
  transport: z.string().nullable(),
  accountEmail: z.string().nullable(),
  mailboxLogin: z.string().nullable(),
  counterparty: z.string().nullable(),
  subject: z.string().nullable(),
  step: z.number().nullable(),
  contextRef: z.string().nullable(),
  outcome: z.string().nullable(),
  placement: z.string().nullable(),
  spfPass: z.boolean().nullable(),
  dkimPass: z.boolean().nullable(),
  dmarcPass: z.boolean().nullable(),
  occurredAt: z.string(),
});
export type OpsThreadMessage = z.infer<typeof OpsThreadMessageSchema>;

export const OpsThreadMessagesSchema = z.object({
  messages: z.array(OpsThreadMessageSchema),
  nextCursor: z.string().nullable(),
});
export type OpsThreadMessages = z.infer<typeof OpsThreadMessagesSchema>;

// ─── Filters → query string ────────────────────────────────────────────────

/** Threads per page. The producer REQUIRES `limit` (1-500); the unfiltered set is ~70k rows. */
export const THREADS_PAGE_SIZE = 50;
/** Messages read for one thread (no thread in the estate comes near it; the panel says so if one does). */
export const THREAD_MESSAGES_LIMIT = 200;

/** The thread kinds the admin Inbox offered as a filter, same vocabulary. */
export const THREAD_KINDS = ["outreach", "warmup_reply", "warmup", "seed"] as const;
export const THREAD_DIRECTIONS = ["in", "out"] as const;
export const THREAD_PLACEMENTS = ["inbox", "spam", "missing"] as const;

/** Every filter `/ops/threads` accepts. A blank field is left off the request. */
export interface ThreadFilters {
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
  /** Tri-state: absent = any, true = has an answer, false = none. */
  hasInbound?: boolean;
}

/** The free-text filters, in the order they show and go on the wire. */
export const THREAD_TEXT_FILTERS = [
  { key: "account", label: "Sending address", placeholder: "kevin@example.com" },
  { key: "mailbox", label: "Mailbox", placeholder: "login@example.com" },
  { key: "domain", label: "Domain", placeholder: "example.com" },
  { key: "counterparty", label: "Counterparty", placeholder: "prospect@company.com" },
  { key: "orgId", label: "Org id", placeholder: "uuid" },
  { key: "campaignId", label: "Campaign id", placeholder: "uuid" },
] as const;

const SHARED_KEYS = ["kind", "direction", "account", "mailbox", "domain", "counterparty", "orgId", "campaignId", "since", "until", "placement"] as const;

/** `/ops/threads` query. `limit` is always first and always present (a missing one is a 400). */
export function threadsQuery(filters: ThreadFilters, cursor: string | null, limit = THREADS_PAGE_SIZE): string {
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  for (const key of SHARED_KEYS) {
    const v = filters[key];
    if (typeof v === "string" && v.trim() !== "") p.set(key, v.trim());
  }
  if (filters.hasInbound !== undefined) p.set("hasInbound", filters.hasInbound ? "true" : "false");
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

/** `/ops/messages` query for one thread's messages. */
export function threadMessagesQuery(threadId: string, limit = THREAD_MESSAGES_LIMIT): string {
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  p.set("threadId", threadId);
  return p.toString();
}

export function hasActiveFilters(filters: ThreadFilters): boolean {
  if (filters.hasInbound !== undefined) return true;
  return SHARED_KEYS.some((k) => {
    const v = filters[k];
    return typeof v === "string" && v.trim() !== "";
  });
}

// ─── Paging and reading order ──────────────────────────────────────────────

/** Append a page, dropping threads already listed (the producer pages over a moving index). */
export function appendThreads(existing: readonly OpsThread[], page: readonly OpsThread[]): OpsThread[] {
  const seen = new Set(existing.map((t) => t.threadId));
  const out = [...existing];
  for (const t of page) {
    if (seen.has(t.threadId)) continue;
    seen.add(t.threadId);
    out.push(t);
  }
  return out;
}

/** A thread reads oldest first (the producer serves newest first); ties break on id. */
export function threadReadingOrder<T extends { id: string; occurredAt: string }>(messages: readonly T[]): T[] {
  return [...messages].sort((a, b) => {
    const d = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

// ─── Words ─────────────────────────────────────────────────────────────────

/** Message and thread kinds: Monitoring's words, plus the inbound kinds only a thread shows. */
export const THREAD_KIND_WORD: Record<string, string> = {
  ...MESSAGE_KIND_WORD,
  auto_reply: "Auto reply",
  bounce: "Bounce",
  delay: "Delay notice",
};
export const threadKindWord = (kind: string) => THREAD_KIND_WORD[kind] ?? kind;

/**
 * A served token in words: `lead_meeting_requested` -> "Meeting requested",
 * `auto_reply_received` -> "Auto reply received", `bounced` -> "Bounced". Null stays null.
 */
export function servedWord(token: string | null): string | null {
  if (token == null || token === "") return null;
  const words = token.replace(/^lead_/, "").replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The domain an address sits on (display lookup, never a figure). */
export function domainOf(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  return at < 0 || at === email.length - 1 ? null : email.slice(at + 1).toLowerCase();
}
