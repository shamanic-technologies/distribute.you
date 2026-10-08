/**
 * One conversation's STORED timeline (owner 2026-10-08): lead-service
 * `GET /orgs/leads/{id}/timeline?brandId=&offerId=`, through the gateway's `/v1/leads/:id/timeline`.
 *
 * A conversation is a person x offer x brand. lead-service owns the whole vocabulary: what each
 * fact IS (`label`), whether it is ours (`attributable`), and the conversation's own tags (its
 * last word, how far it went). This module parses that read and NAMES each served word for a
 * reader. Nothing here grades a fact or derives a tag: an unknown word keeps the producer's
 * spelling, re-cased, so a label added upstream still reads.
 *
 * ⚠️ Every vocabulary field is parsed as a STRING, never an enum: lead-service widens it before
 * this app ships, and a closed enum here would blank the panel on its additive ship.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";
import type { TimelineIcon, TimelineTag, TimelineTone } from "./timeline-tags";

export const ConversationItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  source: z.string(),
  occurredAt: z.string().nullable(),
  attributable: z.boolean().nullable(),
  attributionBasis: z.string().nullable(),
  campaignId: z.string().nullable(),
  offerId: z.string().nullable(),
  url: z.string().nullable(),
  withdrawnAt: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()),
});

export const ConversationTimelineSchema = z.object({
  leadId: z.string(),
  brandId: z.string(),
  offerId: z.string().nullable(),
  items: z.array(ConversationItemSchema),
  tags: z.object({
    lastWord: z.string(),
    lastWordAt: z.string().nullable(),
    furthestStep: z.string().nullable(),
    furthestStepAttributable: z.boolean().nullable(),
  }),
});

export type ConversationItem = z.infer<typeof ConversationItemSchema>;
export type ConversationTimeline = z.infer<typeof ConversationTimelineSchema>;

function words(raw: string): string {
  const s = raw.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : raw;
}

type Look = { label: string; tone: TimelineTone; icon: TimelineIcon };

/** What each fact IS, in words, coloured like the Unibox families (won, hot, lost, reply). */
const ITEM_LOOK: Record<string, Look> = {
  initial_email: { label: "Initial email", tone: "neutral", icon: "sent" },
  followup: { label: "Followup", tone: "neutral", icon: "sent" },
  bounced: { label: "Bounced", tone: "lost", icon: "lost" },
  opened: { label: "Opened", tone: "neutral", icon: "dot" },
  website_visit: { label: "Website visit", tone: "hot", icon: "visit" },
  link_click: { label: "Link click", tone: "hot", icon: "visit" },
  unsubscribed: { label: "Unsubscribed", tone: "lost", icon: "lost" },
  tagged_as_spam: { label: "Tagged as spam", tone: "lost", icon: "lost" },
  interested: { label: "Interested", tone: "hot", icon: "flame" },
  not_interested: { label: "Not interested", tone: "lost", icon: "lost" },
  question: { label: "Question", tone: "reply", icon: "reply" },
  hand_over: { label: "Handed over", tone: "reply", icon: "reply" },
  wrong_contact: { label: "Wrong contact", tone: "lost", icon: "lost" },
  opt_out: { label: "Opt out", tone: "lost", icon: "lost" },
  auto_reply: { label: "Auto reply", tone: "neutral", icon: "reply" },
  reply: { label: "Reply", tone: "reply", icon: "reply" },
  signup: { label: "Signup", tone: "hot", icon: "check" },
  form_filled: { label: "Form filled", tone: "hot", icon: "check" },
  meeting_booked: { label: "Meeting booked", tone: "hot", icon: "meeting" },
  meeting_attended: { label: "Meeting attended", tone: "won", icon: "meeting" },
  paid_client: { label: "Paid client", tone: "won", icon: "money" },
};

/** A served item label as a tag. An unknown label keeps its word, in the neutral tone. */
export function conversationItemTag(label: string): TimelineTag {
  return ITEM_LOOK[label] ?? { label: words(label), tone: "neutral", icon: "dot" };
}

const LAST_WORD_LOOK: Record<string, Look> = {
  no_reply: { label: "No reply", tone: "neutral", icon: "dot" },
  interested: { label: "Interested", tone: "hot", icon: "flame" },
  not_interested: { label: "Not interested", tone: "lost", icon: "lost" },
  question: { label: "Question", tone: "reply", icon: "reply" },
  hand_over: { label: "Handed over", tone: "reply", icon: "reply" },
  wrong_contact: { label: "Wrong contact", tone: "lost", icon: "lost" },
  opted_out: { label: "Opted out", tone: "lost", icon: "lost" },
  reply: { label: "Replied", tone: "reply", icon: "reply" },
};

/** The conversation's last word (the latest thing a PERSON said), as a tag. */
export function lastWordTag(lastWord: string): TimelineTag {
  return LAST_WORD_LOOK[lastWord] ?? { label: words(lastWord), tone: "neutral", icon: "dot" };
}

const STEP_LOOK: Record<string, Look> = {
  contacted: { label: "Contacted", tone: "neutral", icon: "sent" },
  website_visited: { label: "Website visited", tone: "hot", icon: "visit" },
  conversation_ongoing: { label: "Conversation ongoing", tone: "hot", icon: "reply" },
  form_filled: { label: "Form filled", tone: "hot", icon: "check" },
  meeting_booked: { label: "Meeting booked", tone: "hot", icon: "meeting" },
  meeting_attended: { label: "Meeting attended", tone: "won", icon: "meeting" },
  paid_client: { label: "Paid client", tone: "won", icon: "money" },
};

/**
 * How far the conversation went, as a tag; null when no fact is stored yet. `ours` false (an
 * existing client reads Paid client) is said in words beside it, never hidden.
 */
export function furthestStepTag(step: string | null): TimelineTag | null {
  if (!step) return null;
  return STEP_LOOK[step] ?? { label: words(step), tone: "neutral", icon: "dot" };
}

/** The live facts: a fact its source took back is kept by lead-service but not shown. */
export function liveItems(timeline: ConversationTimeline): ConversationItem[] {
  return timeline.items.filter((i) => i.withdrawnAt === null);
}

const SOURCE_WORD: Record<string, string> = {
  reply: "Reply",
  tracker: "Website",
  manual: "Stated by hand",
  crm: "Their CRM",
  reply_statement: "Read off the reply",
  never: "Stated by hand",
};

/** Where a fact came from, in words. */
export function conversationSourceWord(source: string): string {
  return SOURCE_WORD[source] ?? words(source);
}

/**
 * Lays lead-service's labels onto another thread (the Unibox's crm-service thread). A thread
 * item takes the label of the stored fact recorded at the SAME instant (both read the same
 * provider record: a reply carries its own received time). A thread item no fact matches keeps
 * its own tag; a fact no thread item matches is returned in `unmatched` so it is still shown.
 * Pure: a join on the instant, never a judgement on the content.
 */
export function joinConversationLabels<T extends { at: string | null }>(
  thread: T[],
  facts: ConversationItem[],
): { labels: (TimelineTag | null)[]; unmatched: ConversationItem[] } {
  const byInstant = new Map<number, ConversationItem>();
  for (const f of facts) {
    if (!f.occurredAt) continue;
    const t = Date.parse(f.occurredAt);
    if (!Number.isNaN(t) && !byInstant.has(t)) byInstant.set(t, f);
  }
  const used = new Set<string>();
  const labels = thread.map((item) => {
    if (!item.at) return null;
    const f = byInstant.get(Date.parse(item.at));
    if (!f || used.has(f.id)) return null;
    used.add(f.id);
    return conversationItemTag(f.label);
  });
  return { labels, unmatched: facts.filter((f) => !used.has(f.id)) };
}
