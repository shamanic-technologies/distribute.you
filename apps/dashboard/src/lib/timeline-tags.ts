/**
 * Unibox timeline tags (owner 2026-10-08): every item of a conversation carries a
 * coloured tag with an icon, so a reader finds the moments that matter at a glance.
 *
 * A pure DISPLAY lookup over what the producer already serves (`kind`, `direction`,
 * `event.step`): nothing is graded here. A step this table does not know keeps its
 * producer word, re-cased, in the neutral tone, so a new step still reads.
 *
 * Tones follow the Unibox families: won = green, hot = amber, lost = rose, a message
 * from them = teal, the rest neutral.
 *
 * Alias-free so it carries real unit tests.
 */

export type TimelineTone = "won" | "hot" | "lost" | "reply" | "neutral";
export type TimelineIcon = "sent" | "reply" | "visit" | "meeting" | "money" | "lost" | "dot";

export interface TimelineTag {
  label: string;
  tone: TimelineTone;
  icon: TimelineIcon;
}

interface ItemLike {
  kind: string;
  direction: string | null;
  event: { step: string } | null;
}

const STEP_TAGS: Record<string, Omit<TimelineTag, "label"> & { label?: string }> = {
  // The client's own CRM (crm-service stage meanings).
  meeting_booked: { tone: "hot", icon: "meeting" },
  meeting_attended: { tone: "won", icon: "meeting" },
  meeting_not_held: { tone: "lost", icon: "meeting" },
  sale: { tone: "won", icon: "money" },
  deal_lost: { tone: "lost", icon: "lost" },
  // The client's own site (PostHog).
  visit: { tone: "hot", icon: "visit", label: "Website visit" },
  // The client's own Stripe.
  payment: { tone: "won", icon: "money" },
  subscription_started: { tone: "won", icon: "money" },
  refund: { tone: "lost", icon: "money" },
  subscription_canceled: { tone: "lost", icon: "lost" },
};

function words(s: string): string {
  const w = s.replace(/[_-]+/g, " ").trim();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function timelineTag(item: ItemLike): TimelineTag {
  if (item.kind === "event") {
    const step = item.event?.step ?? null;
    if (!step) return { label: "Event", tone: "neutral", icon: "dot" };
    const known = STEP_TAGS[step];
    if (known) return { label: known.label ?? words(step), tone: known.tone, icon: known.icon };
    return { label: words(step), tone: "neutral", icon: "dot" };
  }
  if (item.direction === "outbound") return { label: "Sent", tone: "neutral", icon: "sent" };
  if (item.direction === "inbound") return { label: "Received", tone: "reply", icon: "reply" };
  return { label: "Message", tone: "neutral", icon: "dot" };
}
