import { isFreeEmailDomain } from "./free-email-domains";

/**
 * Which mark the Unibox draws for where a message or a person came from. A pure display
 * lookup over crm-service's own `source` / `channel` words. Alias-free (unit-tested).
 *
 * What distribute.you itself did (our cold emails, the visits PostHog records) reads as
 * Distribute: the reader does not need the tools behind it (owner 2026-10-08).
 */
export interface SourceMark {
  key: string;
  name: string;
  /** logo.dev key, when the mark is a vendor's. */
  domain: string | null;
  /** A mark we ship ourselves. */
  src: string | null;
}

const DISTRIBUTE: SourceMark = { key: "distribute", name: "Distribute", domain: null, src: "/logo-distribute.svg" };

const vendor = (key: string, name: string, domain: string): SourceMark => ({ key, name, domain, src: null });

/** A messaging app, named by the channel the source served it on. */
const CHANNEL_MARK: Record<string, SourceMark> = {
  whatsapp: vendor("whatsapp", "WhatsApp", "whatsapp.com"),
  telegram: vendor("telegram", "Telegram", "telegram.org"),
  discord: vendor("discord", "Discord", "discord.com"),
  signal: vendor("signal", "Signal", "signal.org"),
  slack: vendor("slack", "Slack", "slack.com"),
  messenger: vendor("messenger", "Messenger", "messenger.com"),
  instagram: vendor("instagram", "Instagram", "instagram.com"),
  linkedin: vendor("linkedin", "LinkedIn", "linkedin.com"),
  x: vendor("x", "X", "x.com"),
  twitter: vendor("x", "X", "x.com"),
};

const SOURCE_MARK: Record<string, SourceMark> = {
  gmail: vendor("gmail", "Gmail", "gmail.com"),
  instantly: DISTRIBUTE,
  posthog: DISTRIBUTE,
  stripe: vendor("stripe", "Stripe", "stripe.com"),
  gohighlevel: vendor("gohighlevel", "GoHighLevel", "gohighlevel.com"),
  linkedin: CHANNEL_MARK.linkedin,
  x: CHANNEL_MARK.x,
  twitter: CHANNEL_MARK.x,
};

/** The mark for one record: the messaging app when the channel names one, else the source. */
export function sourceMark(source: string, channel: string | null): SourceMark {
  const byChannel = channel ? CHANNEL_MARK[channel] : undefined;
  if (byChannel) return byChannel;
  const bySource = SOURCE_MARK[source];
  if (bySource) return bySource;
  // A source added after this ship reads as its own id, with no logo.
  return { key: source, name: source.replace(/_/g, " "), domain: null, src: null };
}

/** Every place a person was reached, once each, in the order their records list them. */
export function personSourceMarks(presences: { source: string; channel: string }[]): SourceMark[] {
  const seen = new Map<string, SourceMark>();
  for (const p of presences) {
    const m = sourceMark(p.source, p.channel);
    if (!seen.has(m.key)) seen.set(m.key, m);
  }
  return [...seen.values()];
}

/**
 * Who a message's `from` names: `"Christina Kennedy" <christina@acme.com>` reads as its
 * name and address; a bare address has no name. Pure formatting of the served string.
 */
export function parseFrom(from: string | null): { name: string | null; email: string | null } {
  if (!from) return { name: null, email: null };
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  const bare = from.trim();
  return bare.includes("@") ? { name: null, email: bare.toLowerCase() } : { name: bare || null, email: null };
}

/** The company domain behind a person's first work address; a free mailbox has none. */
export function personCompanyDomain(emails: string[]): string | null {
  for (const e of emails) {
    const domain = e.split("@")[1]?.trim().toLowerCase();
    if (domain && !isFreeEmailDomain(domain)) return domain;
  }
  return null;
}
