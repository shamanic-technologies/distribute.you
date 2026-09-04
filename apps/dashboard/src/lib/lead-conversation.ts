/**
 * The conversation we actually had with a prospect.
 *
 * The lead panel's timeline used to state what a campaign DID — the emails we
 * GENERATED (initial + the follow-up steps of the sequence) and the delivery
 * events email-gateway observed — and it could not show a single word that was
 * exchanged. A customer looking at a lead who replied could see THAT they replied
 * and nothing about WHAT they said, nor what we answered.
 *
 * The words were already on the wire. instantly-service serves the whole thread
 * for one (campaign, lead) pair, oldest first, covering BOTH transports (the
 * Instantly Unibox and our own SMTP/IMAP self-send) behind one shape. This module
 * is the pure part of putting it on screen.
 *
 * ⚠️ THE CAMPAIGN IS THE LEAD'S OWN, NEVER THE URL'S. The thread is resolved
 * against the stored campaign row the lead was served under, and a campaign as a
 * customer knows it is dozens of stored rows (campaign-service mints a fresh one
 * on every workflow switch and keeps the ancestors). The URL names the LIVE row;
 * an older lead belongs to an ancestor, so keying on the URL 404s exactly the
 * leads with the longest conversations. `lead.campaignId` is the row's own.
 *
 * ⚠️ ABSENT IS NOT EMPTY, and the producer already separates the three. A
 * conversation nobody has on record is a 404, a sequence that exists with nothing
 * exchanged is a 200 with no messages, and a thread we hold but could not read is
 * a 502. They mean different things to a reader and must not collapse: falling
 * back to the derived view is right for the first two and a lie for the third.
 *
 * Alias-free on purpose (no `@/…` import) so it carries real unit tests rather
 * than source-substring guards — keep it that way.
 */

/** One message of the exchange, exactly as instantly-service states it. */
export interface ConversationMessage {
  /** `inbound` = the prospect wrote it; `outbound` = we did. */
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  /** ISO 8601 UTC. Empty only when the source carried no timestamp at all. */
  at: string;
  subject: string;
  /** The message as readable TEXT — markup already stripped by the producer. */
  text: string;
}

/** The whole exchange for one (campaign, lead) pair. */
export interface LeadConversation {
  campaignId: string;
  instantlyCampaignId: string;
  leadEmail: string;
  /** The mailbox that carried the outreach; null on a row predating the persist. */
  accountEmail: string | null;
  /** Which pipe carried it — a reader does not need to know this to read it. */
  transport: "instantly" | "smtp";
  messageCount: number;
  messages: ConversationMessage[];
}

/**
 * Why we are not showing a conversation.
 *
 * `absent` — nobody has this exchange on record (the producer's 404). The timeline
 * says nothing extra and renders exactly as it did before this feature: for a lead
 * still sitting in the weekday queue that is the honest answer.
 *
 * `unavailable` — we hold the thread and could not read it (the producer's 502).
 * That is a failure and it is STATED, never dressed up as an empty conversation:
 * "they never wrote back" and "we could not fetch what they wrote" are different
 * facts and a reader acts differently on each.
 */
export type ConversationRefusal = "absent" | "unavailable";

/**
 * Classify a thrown read.
 *
 * Structural on purpose (`{ status }`), so this module stays alias-free rather
 * than importing the api client's error class. Anything that is not one of the
 * producer's two named refusals returns null and is re-thrown by the caller —
 * swallowing an unknown failure into "absent" is the silent-fallback bug.
 */
export function conversationRefusal(err: unknown): ConversationRefusal | null {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 404) return "absent";
  if (status === 502) return "unavailable";
  return null;
}

/**
 * The messages we can place in a chronology, oldest first.
 *
 * Two drops, both because the row would state nothing. A message the source could
 * not DATE has no position in the timeline, and putting it at the top or the
 * bottom invents an ordering nobody observed. A message with neither subject nor
 * body is a card with nothing in it.
 *
 * A stable sort on equal instants keeps the producer's own order, which is what
 * it observed — re-ordering two messages sharing a second is a guess.
 */
export function orderedMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return messages
    .filter((m) => !!m.at && (!!m.text.trim() || !!m.subject.trim()))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const dt = new Date(a.m.at).getTime() - new Date(b.m.at).getTime();
      return dt !== 0 ? dt : a.i - b.i;
    })
    .map(({ m }) => m);
}

/**
 * What to call one message of the exchange.
 *
 * Derived from POSITION rather than from the generation's step numbers, because
 * the two disagree: the sequence says what was PLANNED and the thread says what
 * was SENT, and a lead who replies after step 1 never receives steps 2 and 3. So
 * the words come from what the reader can see happened — the first thing we sent,
 * the ones that followed it in silence, the prospect writing back, and anything we
 * sent after that being an answer rather than another follow-up.
 *
 * Takes the ALREADY-ORDERED list: the label depends on what precedes the message,
 * so computing it against an unsorted array reads the wrong neighbours.
 */
export function messageLabel(
  ordered: ConversationMessage[],
  index: number,
  priorSendOutsideThread = false,
): string {
  const m = ordered[index];
  if (!m) return "";
  if (m.direction === "inbound") return "Their reply";
  const before = ordered.slice(0, index);
  if (before.some((p) => p.direction === "inbound")) return "Our reply";
  // "Initial email" is a claim about the WHOLE scope, not about this thread. A
  // campaign as the customer knows it is many stored rows and the thread covers one
  // of them, so a send the delivery evidence already reports from an earlier row
  // means this message is not the first thing we sent — whatever its position here.
  if (before.length === 0) return priorSendOutsideThread ? "Follow-up" : "Initial email";
  return "Follow-up";
}

/** True once the prospect has written at least one message we can show. */
export function hasInbound(messages: ConversationMessage[]): boolean {
  return orderedMessages(messages).some((m) => m.direction === "inbound");
}

/**
 * How far apart a send's own timestamp and the delivery layer's first-sent event may
 * sit and still be the SAME send.
 *
 * The two come from different systems with different clocks (the provider stamps the
 * message row, email-gateway stamps the delivery event), so they are seconds apart in
 * practice. An hour is generous for that and nowhere near the gap this exists to
 * detect, which is a whole other sequence weeks or months later.
 */
export const THREAD_SEND_MATCH_MS = 60 * 60 * 1000;

/**
 * Does this thread contain the send the delivery evidence is reporting?
 *
 * ⚠️ THE TWO SIDES ARE SCOPED DIFFERENTLY AND THAT IS NOT A BUG TO PAPER OVER. The
 * delivery facts a card carries (`firstSentAt`, `firstDeliveredAt`, `firstRepliedAt`)
 * are the campaign IDENTITY's — every stored row of it, because campaign-service mints
 * a fresh row on each workflow switch and keeps the ancestors. The thread is ONE of
 * those rows: instantly-service resolves a single logical campaign to a single
 * provider campaign. So on a lead contacted under an older row, the thread's first
 * outbound message is NOT the send `firstSentAt` describes — it is a later sequence,
 * from a different mailbox, weeks after.
 *
 * Nesting the delivery rows under it anyway is what makes the panel read out of
 * order: the card sorts at its own instant while displaying a much earlier `Sent`, so
 * a reply that really did land between the two appears ABOVE the send it answered.
 * Nothing errors, every timestamp is real, and the timeline simply states an
 * impossible sequence.
 *
 * False here means the rows belong to a send this thread does not carry, so they get
 * their own entry at their own instant instead.
 */
export function threadCarriesFirstSend(
  ordered: ConversationMessage[],
  firstSentAt: string | null | undefined,
): boolean {
  if (!firstSentAt) return false;
  const sent = new Date(firstSentAt).getTime();
  if (!Number.isFinite(sent)) return false;
  const first = ordered.find((m) => m.direction === "outbound");
  if (!first) return false;
  const at = new Date(first.at).getTime();
  if (!Number.isFinite(at)) return false;
  return Math.abs(at - sent) <= THREAD_SEND_MATCH_MS;
}

/**
 * The follow-up steps still ahead of us.
 *
 * Once the real conversation is on screen, every message that has ALREADY gone out
 * has its own card carrying what it actually said. The derived rows are then only
 * useful for the steps that have NOT happened — the cadence the reader is waiting
 * on. Keeping the past ones would state each sent email twice, once with its real
 * words and once with the generation's.
 *
 * An undated row is dropped: the derived date is what places it after "Now", so a
 * row without one cannot be claimed to be in the future.
 */
export function unsentFollowUps<T extends { at: string }>(followUps: T[], nowMs: number): T[] {
  return followUps.filter((f) => {
    if (!f.at) return false;
    const t = new Date(f.at).getTime();
    return Number.isFinite(t) && t > nowMs;
  });
}

/**
 * WHY the sequence has stopped, or null while it is still running.
 *
 * The panel used to list every follow-up the generation planned, filtered on time
 * alone, so a prospect who had already replied was shown two follow-ups "scheduled"
 * that will never be sent. The provider's campaign is created with
 * `stop_on_reply: true` (instantly-service `send-lead.ts`), so a reply ends the
 * sequence; an unsubscribe ends it because we never contact them again; and a bounce
 * ends it because the address does not accept mail. Promising a send that cannot
 * happen is the status-label bug one surface over: a timeline states what WILL happen,
 * not what was planned before the prospect answered.
 *
 * A WEBSITE VISIT deliberately does NOT stop it. Link tracking is on and nothing in the
 * provider's config stops a sequence on a click, so the follow-ups really are still
 * coming — dropping them there would hide a send the customer is about to pay for.
 *
 * Alias-free like the rest of this module, so it carries real unit tests.
 */
export type SequenceStopReason = "replied" | "unsubscribed" | "bounced";

export function sequenceStopReason(delivery: {
  firstRepliedAt?: string | null;
  firstUnsubscribedAt?: string | null;
  firstBouncedAt?: string | null;
} | null | undefined): SequenceStopReason | null {
  if (!delivery) return null;
  // Unsubscribe first: it is the prospect's own instruction and outranks the rest as
  // the reason nothing more will be sent, even when they also replied.
  if (delivery.firstUnsubscribedAt) return "unsubscribed";
  if (delivery.firstBouncedAt) return "bounced";
  if (delivery.firstRepliedAt) return "replied";
  return null;
}

/**
 * What to say in place of the follow-ups that will not be sent.
 *
 * ⚠️ Only worth saying when it REPLACED something. A reply stops the sequence, so the
 * reason is true whenever one landed — but on a lead whose planned steps had all gone
 * out anyway there is nothing missing to explain, and the sentence then sits under a
 * timeline showing sends AFTER the reply, contradicting the cards above it. The caller
 * renders it only when rows were actually dropped.
 */
export function sequenceStopNote(reason: SequenceStopReason): string {
  if (reason === "unsubscribed") return "No further emails: they asked us to stop.";
  if (reason === "bounced") return "No further emails: their address bounced.";
  return "No further follow-ups: they replied, so the sequence stopped.";
}
