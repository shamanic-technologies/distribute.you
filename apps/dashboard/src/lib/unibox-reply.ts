/**
 * The Unibox reply box (owner 2026-10-13: « il faut pouvoir envoyer un email écrit à la
 * main depuis l'Unibox »): a person who wrote back to our cold email is answered by hand,
 * in the SAME thread, from the mailbox that wrote to them.
 *
 * instantly-service owns everything about the send (`POST /orgs/replies`, gateway
 * `POST /v1/replies`): which mailbox, which persona and signature, which thread. The
 * dashboard names the person by the address we wrote to and supplies the words, declared
 * `sent_by: "human"`. Nothing here picks a sender.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

type PresenceLike = { source: string; emails: string[] };
type ItemLike = { source: string; direction: string | null; from: string | null; at: string | null };

const INSTANTLY = "instantly";

function addressOf(from: string | null): string | null {
  if (!from) return null;
  const m = from.match(/<([^>]+)>/);
  const raw = (m ? m[1] : from).trim().toLowerCase();
  return raw.includes("@") ? raw : null;
}

/**
 * The address to answer, or null when there is no cold email thread to answer: the
 * person never wrote back to one of our cold emails (instantly-service would refuse,
 * `no_reply_to_thread`). It is an address WE wrote to (the instantly presence), the one
 * their latest reply came from when they hold several.
 */
export function replyTarget(person: { presences: PresenceLike[] }, items: ItemLike[]): string | null {
  const written = person.presences
    .filter((p) => p.source === INSTANTLY)
    .flatMap((p) => p.emails.map((e) => e.trim().toLowerCase()))
    .filter((e) => e.includes("@"));
  if (written.length === 0) return null;
  const inbound = items.filter((i) => i.source === INSTANTLY && i.direction === "inbound");
  if (inbound.length === 0) return null;
  for (let i = inbound.length - 1; i >= 0; i--) {
    const from = addressOf(inbound[i].from);
    if (from && written.includes(from)) return from;
  }
  return written[0];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Plain typed text as the HTML the endpoint takes: one `<p>` per paragraph, line breaks kept. */
export function replyBodyHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export const ReplySentSchema = z.object({
  success: z.literal(true),
  status: z.literal("sent"),
  reply: z.object({
    leadEmail: z.string(),
    accountEmail: z.string(),
    from: z.string(),
    subject: z.string(),
    messageId: z.string(),
  }),
});
export type ReplySent = z.infer<typeof ReplySentSchema>["reply"];

export const AmbiguousThreadSchema = z.object({
  code: z.literal("ambiguous_thread"),
  candidates: z.array(z.object({ campaign_id: z.string(), last_message_at: z.string().nullable() })).min(1),
});

/**
 * Several threads (the person wrote back on several campaigns): the one with the newest
 * message is the conversation on screen. The producer lists them newest first; the
 * dates are compared anyway so the pick never rests on an order.
 */
export function newestThread(candidates: { campaign_id: string; last_message_at: string | null }[]): string {
  const at = (c: { last_message_at: string | null }) => (c.last_message_at ? Date.parse(c.last_message_at) : -Infinity);
  return candidates.reduce((best, c) => (at(c) > at(best) ? c : best)).campaign_id;
}

/** Our own sentence for a refused send, by status and the producer's `code`. Never its raw message. */
export function replyErrorMessage(status: number | null, code: string | null): string {
  if (code === "no_reply_to_thread") return "No reply from them yet, so there is no thread to answer.";
  if (status === 404 || code === "campaign_not_found") return "We never emailed this address, so there is no thread to answer.";
  if (code === "sending_account_unresolved" || code === "mailbox_credential_unavailable")
    return "We could not reach the mailbox that wrote to them. Your reply was not sent.";
  if (code === "reply_dispatch_failed") return "The mailbox refused the send. Your reply was not sent. Try again.";
  return "Your reply was not sent. Try again.";
}

export type LocalReply = { sentAt: string; text: string; reply: ReplySent };

/**
 * A reply sent from this screen shows at once, until the served thread carries it: an
 * outbound cold email item dated from a minute before the send on.
 */
export function pendingReplies(local: LocalReply[], items: ItemLike[]): LocalReply[] {
  const served = items
    .filter((i) => i.source === INSTANTLY && i.direction === "outbound" && i.at)
    .map((i) => Date.parse(i.at!));
  return local.filter((l) => !served.some((t) => t >= Date.parse(l.sentAt) - 60_000));
}
