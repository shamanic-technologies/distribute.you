/**
 * HOW somebody told us to stop contacting them.
 *
 * A prospect rarely clicks the unsubscribe link. They send an SMS, they call, they say
 * it to somebody's face, they answer a thread a colleague forwarded them — and for as
 * long as the link was the only way in, none of that could be recorded and the person
 * kept being emailed. Recording it is a CONSENT statement, so the channel is required
 * rather than optional: an opt-out nobody can audit later is exactly what a consent
 * record must not be.
 *
 * Mirrors instantly-service's own closed vocabulary value for value (via email-gateway,
 * which deliberately forwards it rather than copying it). It owns this list; this file
 * renders it, so when it widens, this widens — do NOT invent a value here. A value
 * invented here is refused upstream, and a value missing here simply cannot be stated.
 *
 * The labels answer the question the form asks — "how did they tell us?" — so they read
 * as the end of that sentence rather than as nouns.
 *
 * Alias-free so it carries real unit tests. Keep it that way.
 */

export type OptOutChannel =
  | "sms"
  | "phone_call"
  | "email_reply"
  | "forwarded_thread"
  | "in_person"
  | "web_form"
  | "other";

export interface OptOutChannelOption {
  channel: OptOutChannel;
  /** What a person picks. Written as the end of "how did they tell us?". */
  label: string;
}

/**
 * Ordered by how often it actually happens, commonest first, so the ordinary case is
 * the first thing under the cursor and "Some other way" is where it belongs — last,
 * and never a default anybody lands on by accident.
 */
export const OPT_OUT_CHANNELS: readonly OptOutChannelOption[] = [
  { channel: "email_reply", label: "In a reply" },
  { channel: "sms", label: "By SMS" },
  { channel: "phone_call", label: "On a call" },
  { channel: "forwarded_thread", label: "In a forwarded thread" },
  { channel: "in_person", label: "In person" },
  { channel: "web_form", label: "Through a form" },
  { channel: "other", label: "Some other way" },
];

const BY_CHANNEL = new Map(OPT_OUT_CHANNELS.map((o) => [o.channel, o]));

/**
 * The option for a served value, or null when the producer sends one this build does
 * not carry.
 *
 * Null rather than a fabricated label, same as every other mirrored vocabulary here:
 * instantly-service can widen the set before this app ships, so an unknown value means
 * "a channel we do not name yet" and the caller says that instead of inventing a word
 * for it.
 */
export function optOutChannelOption(channel: string | null | undefined): OptOutChannelOption | null {
  if (!channel) return null;
  return BY_CHANNEL.get(channel as OptOutChannel) ?? null;
}
