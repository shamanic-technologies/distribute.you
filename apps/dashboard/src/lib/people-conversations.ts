/**
 * Conversations: one person, every channel, one thread.
 *
 * crm-service owns the merge (its gold person layer): who the brand is in conversation
 * with across Gmail, cold email, WhatsApp / Telegram / Discord and the client's own CRM,
 * merged on email / phone only on positive evidence, with ONE state per person and the
 * whole exchange oldest first. This module parses what it serves and names it for a
 * reader. Nothing here merges, orders, counts or grades: the list's order, the totals,
 * the per-source counts and the state are all crm-service's.
 *
 * ⚠️ `source`, `channel` and `state` are parsed as STRINGS, never as a closed enum. The
 * producer adds sources (PostHog and Stripe are on their way) and a strict enum here would
 * turn its additive ship into a parse failure that blanks the whole page.
 *
 * ⚠️ ABSENT IS NOT EMPTY. A source the brand never connected, a source read with nobody in
 * it and a source that failed to read are three different sentences, never one zero.
 *
 * Alias-free (zod and nothing else) so it carries real unit tests.
 */
import { z } from "zod";

export const PeopleSourceReadSchema = z.object({
  source: z.string(),
  status: z.string().nullable(),
  scope: z.string(),
  people: z.coerce.number(),
  presences: z.coerce.number(),
  sourceCount: z.coerce.number().nullable(),
  sourceCountBasis: z.string().nullable(),
  error: z.string().nullable(),
});

export const PersonPresenceSchema = z.object({
  source: z.string(),
  sourceRef: z.string(),
  displayName: z.string().nullable(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  firstActivityAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  messageCount: z.coerce.number().nullable(),
  inboundCount: z.coerce.number().nullable(),
  outboundCount: z.coerce.number().nullable(),
  channel: z.string(),
});

export const PersonSchema = z.object({
  personKey: z.string(),
  identityKeys: z.array(z.string()),
  displayName: z.string().nullable(),
  company: z.string().nullable(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  sources: z.array(z.string()),
  firstActivityAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  state: z.string(),
  stateSource: z.string(),
  /**
   * What decided `state`, verbatim. With `stateSource` lead_service it names the lead row
   * (`leadCampaignId`) whose standing it is: the key of that conversation's stored timeline.
   */
  stateDetail: z.record(z.string(), z.unknown()).nullish(),
  presences: z.array(PersonPresenceSchema),
  /**
   * Search only (crm-service `q`): why the person matched. Identity fields carry `value`;
   * a message carries its subject and an excerpt around the query.
   */
  matches: z
    .array(
      z.object({
        field: z.string(),
        value: z.string().optional(),
        source: z.string().optional(),
        at: z.string().nullish(),
        direction: z.string().nullish(),
        subject: z.string().nullish(),
        excerpt: z.string().optional(),
      }),
    )
    .optional(),
  messageMatches: z.coerce.number().optional(),
  /**
   * The person's lead family (features-service's verdict, joined by crm-service): won |
   * hot | lost | cold, null when they are not one of our leads. Parsed as a string.
   */
  family: z.string().nullish(),
  familyLostReason: z.string().nullish(),
  /**
   * Leads lead-service paired with this person's CRM contact on a GUESS (its "to confirm"
   * band). NOT merged: each lead is its own person, so this is only a hint on the row.
   * Optional so a cached page from before crm-service v0.24.0 still parses.
   */
  possibleLeads: z
    .array(
      z.object({
        crmContactId: z.string(),
        email: z.string().nullable(),
        fullName: z.string().nullable(),
        company: z.string().nullable(),
        /** The lead's id at lead-service: the key its rulings take. Optional until crm-service serves it. */
        leadId: z.string().nullish(),
      }),
    )
    .optional(),
});

export const PeopleListSchema = z.object({
  brandId: z.string(),
  scope: z.object({
    status: z.string(),
    lastBuiltAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
  sources: z.array(PeopleSourceReadSchema),
  total: z.coerce.number(),
  limit: z.coerce.number(),
  offset: z.coerce.number(),
  nextOffset: z.coerce.number().nullable(),
  people: z.array(PersonSchema),
  /**
   * The lead families over this list's population (search applied, family filter NOT
   * applied: each count is what its button returns). `status` "failed" carries `error`.
   */
  families: z
    .object({
      status: z.string(),
      error: z.string().nullable(),
      filter: z.string().nullable(),
      counts: z.object({
        won: z.coerce.number(),
        hot: z.coerce.number(),
        lost: z.coerce.number(),
        cold: z.coerce.number(),
      }),
    })
    .optional(),
});

export const PersonTimelineItemSchema = z.object({
  at: z.string().nullable(),
  source: z.string(),
  channel: z.string(),
  kind: z.string(),
  direction: z.string().nullable(),
  subject: z.string().nullable(),
  text: z.string().nullable(),
  from: z.string().nullable(),
  to: z.array(z.string()),
  /**
   * Gmail only (null elsewhere): google-service's verdict on `text`. `cleaned` false =
   * `text` is not the sender's words alone (judge pending/failed, snippet); `original` is
   * the full body verbatim. Optional until every cached timeline carries it.
   */
  textClean: z
    .object({
      status: z.string(),
      cleaned: z.boolean(),
      original: z.string().nullable(),
    })
    .nullish(),
  event: z
    .object({
      step: z.string(),
      dateBasis: z.string(),
    })
    .nullable(),
  /**
   * A sent cold email's identity (crm-service, forwarded from instantly-service): `subjectKey`
   * equals lead-service's fact id for that email, so the Unibox pairs the email with its
   * "Initial email" / "Followup" label on identity, never on time. Null on inbound mail and
   * non-Instantly items; optional until every stored thread is re-read.
   */
  outreachFact: z
    .object({
      subjectKey: z.string(),
      step: z.coerce.number().nullable(),
      position: z.string(),
    })
    .nullish(),
});

export const PersonTimelineSchema = z.object({
  brandId: z.string(),
  person: PersonSchema,
  builtAt: z.string(),
  sources: z.array(
    z.object({
      source: z.string(),
      status: z.string(),
      items: z.coerce.number(),
      error: z.string().nullable(),
    }),
  ),
  itemCount: z.coerce.number(),
  items: z.array(PersonTimelineItemSchema),
});

export type PeopleSourceRead = z.infer<typeof PeopleSourceReadSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type PeopleList = z.infer<typeof PeopleListSchema>;
export type PersonTimeline = z.infer<typeof PersonTimelineSchema>;
export type PersonTimelineItem = z.infer<typeof PersonTimelineItemSchema>;

/** How many people one page of the people read holds. */
export const PEOPLE_PAGE_SIZE = 100;

const SOURCE_LABEL: Record<string, string> = {
  gmail: "Gmail",
  instantly: "Cold email",
  matrix: "Messaging apps",
  gohighlevel: "GoHighLevel",
  posthog: "PostHog",
  stripe: "Stripe",
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  crm: "CRM",
};

/** A served word as a reader sees it: `sales_interest` -> `Sales interest`. */
function wordsOf(raw: string): string {
  const s = raw.replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : raw;
}

/** The name of a source. An unknown one (a source added after this ship) reads as its own id. */
export function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? wordsOf(source);
}

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? wordsOf(channel);
}

/** The lead row whose standing decided the person's state, when lead-service decided it. */
export function personLeadRowId(person: Pick<Person, "stateSource" | "stateDetail">): string | null {
  if (person.stateSource !== "lead_service") return null;
  const id = person.stateDetail?.leadCampaignId;
  return typeof id === "string" && id ? id : null;
}

/** The person's ONE state, crm-service's word, only re-cased. */
export function stateLabel(state: string): string {
  return wordsOf(state);
}

/**
 * The status a reader sees: lead-service's tag, and nothing for anyone lead-service does
 * not hold (owner 2026-10-08: "Deal open" is not a status lead-service has). crm-service
 * still decides a CRM-only person's state from their deal, Stripe or thread; that word
 * is not shown as a status. The source logos say where the person came from.
 */
export function personStatusLabel(person: Pick<Person, "state" | "stateSource">): string | null {
  if (person.stateSource !== "lead_service") return null;
  return stateLabel(person.state);
}

/** Who to call the person: their name, else their first address or number. */
export function personName(p: Pick<Person, "displayName" | "emails" | "phones" | "personKey">): string {
  return p.displayName?.trim() || p.emails[0] || p.phones[0] || p.personKey;
}

/**
 * The "maybe the same person" hint for a CRM contact lead-service paired with a lead on a
 * guess: "Maybe the same as Brice Jackson (drjackson@mabnr.com), to confirm". The lead stays
 * its own row; nothing here decides who is a lead. Null when there is no guessed pairing.
 */
export function possibleLeadHint(p: Pick<Person, "possibleLeads">): string | null {
  const names = (p.possibleLeads ?? []).map(possibleLeadName).filter((x): x is string => x !== null);
  if (names.length === 0) return null;
  return `Maybe the same as ${names.join(" or ")}, to confirm`;
}

export type PossibleLead = NonNullable<Person["possibleLeads"]>[number];

/** One guessed lead as a reader names it: "Brice Jackson (drjackson@mabnr.com)". */
export function possibleLeadName(l: Pick<PossibleLead, "fullName" | "email">): string | null {
  const name = l.fullName?.trim();
  const email = l.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || null;
}

/** What a ruling just made says until crm-service re-reads the pairing. */
export function possibleLeadRuledLine(name: string, ruling: "accepted" | "rejected"): string {
  return ruling === "accepted" ? `Marked as the same as ${name}` : `Marked as not the same as ${name}`;
}

/** The distinct channels a person was reached on, in the order their records list them. */
export function personChannels(p: Pick<Person, "presences">): string[] {
  return [...new Set(p.presences.map((x) => x.channel))];
}

/**
 * One source's line under the list. The three non-answers stay three sentences; an `ok`
 * line says how many people that source brought. (The source's own count and its basis
 * are crm-service's reconciliation evidence, worded for staff, so they stay off this line.)
 */
export function sourceLine(s: PeopleSourceRead): { tone: "ok" | "off" | "failed" | "pending"; text: string } {
  const name = sourceLabel(s.source);
  if (s.status === null) return { tone: "pending", text: `${name}: not read yet` };
  if (s.status === "not_connected") {
    return { tone: "off", text: `${name}: not connected${s.scope === "org" ? " on this organization" : ""}` };
  }
  if (s.status === "failed") return { tone: "failed", text: `${name}: could not be read${s.error ? ` (${s.error})` : ""}` };
  return { tone: "ok", text: `${name}: ${s.people.toLocaleString("en-US")} ${s.people === 1 ? "person" : "people"}` };
}

/** What a timeline source said when it served nothing, so an empty thread is explained. */
export function timelineSourceNote(s: PersonTimeline["sources"][number]): string | null {
  const name = sourceLabel(s.source);
  if (s.status === "failed") return `${name} could not be read${s.error ? `: ${s.error}` : ""}.`;
  // A source the brand never connected says nothing under a thread (owner 2026-10-08).
  return null;
}
