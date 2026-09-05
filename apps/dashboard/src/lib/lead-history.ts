import { z } from "zod";

/**
 * What happened to ONE person, in order, as lead-service assembles it.
 *
 * This replaces a merge the BROWSER used to do. The panel fetched six services — the
 * delivery evidence and the funnel statements from lead-service, the copy we generated
 * and its planned cadence from content-generation-service, the messages exchanged and
 * the hand-recorded reply statements from instantly-service, the outcomes from
 * features-service — de-duplicated them, sorted them by timestamp and decided what to
 * hide. The customer's own mailbox, which for some prospects holds the ONLY copy of the
 * exchange, was read by nobody at all.
 *
 * Every bug of that week was one defect seen from a different angle: a reply whose words
 * we held rendering as a bare "they replied" line, follow-ups advertised as scheduled
 * after the sequence had already stopped, an exchange sitting in the owner's Gmail and
 * invisible, a reply somebody typed by hand reading exactly like one we could produce.
 * There was no source of truth for what happened to a person, so each consumer invented
 * one and they disagreed.
 *
 * lead-service answers it now (`GET /orgs/leads/{id}/history`): already merged, already
 * de-duplicated, already ordered. This module only parses and reads. It derives NOTHING
 * — no ordering, no de-duplication, no decision about which fact outranks which. Adding
 * any of that here rebuilds the bug one layer up.
 *
 * ALIAS-FREE on purpose (its only import is zod) so it carries REAL unit tests rather
 * than a source-substring guard. Keep it that way.
 */

/** Who owns a fact. `mailbox` is the customer's own Gmail mirror. */
export const HISTORY_SOURCES = [
  "lead-service",
  "delivery",
  "outreach",
  "mailbox",
  "content",
] as const;

/**
 * WHAT a row is.
 *
 * The distinction that matters most to a reader: a reply whose WORDS we hold is a
 * `message`, and a reply somebody wrote down because it never reached us is a
 * `reply_statement` carrying no body. They are different facts and they must not render
 * the same — that is the producer's own rule, and this reader keeps them apart rather
 * than folding both into "replied".
 */
export const HISTORY_EVENT_TYPES = [
  "generated_email",
  "message",
  "delivery",
  "lifecycle",
  "reply_statement",
  "opt_out_statement",
  "step_statement",
  "conversion",
  "followup",
] as const;

const SourceSchema = z.object({
  source: z.string(),
  // `ok` it answered · `unavailable` it could NOT be read · `not_asked` there was
  // nothing in scope to ask it about. The middle one is why a consumer may not render
  // a short list as the whole story.
  status: z.string(),
  reason: z.string().nullable(),
});

/**
 * One row.
 *
 * Deliberately TOLERANT on the closed sets the producer states (`type`, `evidence`,
 * `source`, `milestone`, …): they are read as plain strings, because lead-service owns
 * those vocabularies and widens them as the fleet grows. A `z.enum` here throws the
 * whole panel the day it gains a word — the same rot that took the acquisition-model
 * page down. The renderer answers an unknown token by rendering nothing for it, never
 * by guessing the nearest one it knows.
 *
 * Required field for field where the producer marks it required, so a body that stops
 * carrying one fails loudly rather than reading as a fact that did not happen.
 */
const EventSchema = z
  .object({
    id: z.string(),
    at: z.string().nullable(),
    type: z.string(),
    evidence: z.string(),
    source: z.string(),
    campaignId: z.string().nullable(),
    direction: z.string().nullable(),
    milestone: z.string().optional(),
    from: z.string().nullable().optional(),
    to: z.array(z.string()).optional(),
    subject: z.string().nullable().optional(),
    bodyText: z.string().nullable().optional(),
    // `ok` these are the words · `empty` it genuinely says nothing · `unavailable` we
    // hold the message and could not read it. The last two are NOT the same answer.
    bodyStatus: z.string().optional(),
    threadId: z.string().nullable().optional(),
    heldBy: z.array(z.string()).optional(),
    copy: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    replyKind: z.string().optional(),
    channel: z.string().optional(),
    step: z.string().optional(),
    kind: z.string().optional(),
    event: z.string().optional(),
    valueCents: z.number().nullable().optional(),
    costCents: z.number().nullable().optional(),
    statedBy: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    state: z.string().optional(),
    dueAt: z.string().nullable().optional(),
    followupCount: z.number().optional(),
    stoppedReason: z.string().nullable().optional(),
  })
  // The producer serves more per type than any one surface renders, and it may add
  // more. Passthrough so a field lands the day it ships instead of being stripped here
  // and read as absent from the wire.
  .passthrough();

export const LeadHistorySchema = z.object({
  leadCampaignId: z.string(),
  leadId: z.string(),
  campaignId: z.string(),
  brandId: z.string(),
  email: z.string().nullable(),
  scope: z.string(),
  campaignIds: z.array(z.string()),
  campaignsTruncated: z.boolean(),
  complete: z.boolean(),
  sources: z.array(SourceSchema),
  events: z.array(EventSchema),
});

export type LeadHistory = z.infer<typeof LeadHistorySchema>;
export type LeadHistoryEvent = z.infer<typeof EventSchema>;
export type LeadHistorySource = z.infer<typeof SourceSchema>;

/**
 * The sources that could NOT be read, so a reader can say what is missing.
 *
 * `complete: false` alone is not enough to put on screen: it says something is missing
 * without saying what, and a customer reading a short history needs to know whether the
 * silence is their prospect's or ours.
 */
export function unavailableSources(history: LeadHistory | null | undefined): LeadHistorySource[] {
  return (history?.sources ?? []).filter((s) => s.status === "unavailable");
}

/** Human words for a source, for the line that states what is missing. */
const SOURCE_LABEL: Record<string, string> = {
  "lead-service": "this lead's own record",
  delivery: "delivery tracking",
  outreach: "the outreach provider",
  mailbox: "your mailbox",
  content: "the generated copy",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

/**
 * One sentence naming what could not be read, or null when everything answered.
 *
 * Stated rather than hidden: "we could not read this" and "this did not happen" are
 * different facts, and a history that silently drops a source tells a customer their
 * prospect said nothing.
 */
export function incompleteNote(history: LeadHistory | null | undefined): string | null {
  if (!history) return null;
  const missing = unavailableSources(history);
  if (missing.length > 0) {
    const names = missing.map((s) => sourceLabel(s.source));
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    return `Some of this could not be read right now (${list}), so anything it holds is missing below.`;
  }
  // A person in more campaigns than one read fans out over. The answer is bounded, and
  // a capped answer must never look like a whole one.
  if (history.campaignsTruncated) {
    return "This person is in more campaigns than we read at once, so this is part of their history.";
  }
  return null;
}

/**
 * Does this row carry words a reader can read?
 *
 * `bodyStatus` decides, never the body's emptiness: a message we hold and could not
 * read is a different fact from one that genuinely says nothing, and both differ from
 * words we can show.
 */
export function hasReadableBody(event: LeadHistoryEvent): boolean {
  if (event.bodyStatus === "unavailable" || event.bodyStatus === "empty") return false;
  return typeof event.bodyText === "string" && event.bodyText.trim().length > 0;
}

/**
 * True when the sequence is over and no further email will go out.
 *
 * Read off the producer's own follow-up state rather than re-derived from a reply: it
 * knows whether the sending actually stopped, and the browser guessing that from an
 * inbound message is what promised two more follow-ups to a prospect who had already
 * answered.
 */
export function sequenceStopped(history: LeadHistory | null | undefined): boolean {
  return (history?.events ?? []).some((e) => e.type === "followup" && e.state === "stopped");
}
