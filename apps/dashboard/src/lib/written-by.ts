/**
 * WHO WROTE A MESSAGE WE SENT, AND HOW (owner 2026-10-19, WRITTEN-BY-1019).
 *
 * A client read one of his cold emails and asked why it never named his company: it came
 * from a version we were testing. So every message we sent on a client's behalf states the
 * LLM that wrote it (vendor logo + public name) and the plain client lines of the tactics
 * the writing version follows, marked "Under test" while that version is still being tested.
 * Never a workflow name or id, never a cost.
 *
 * features-service `GET /orgs/leads/:leadId/written-by` (gateway
 * `/v1/features/orgs/leads/{leadId}/written-by`), two lists:
 * - `messages`: one row per message we sent the person, ANY channel (first email, follow-up,
 *   WhatsApp, LinkedIn, Gmail...), keyed on lead-service's message id: the timeline fact id
 *   (an email's outreach subject key, `ievt:...`) or the crm fact id of a Unibox message. A
 *   rendered message matches its row on that id, exactly. Only `writtenBy: workflow` is shown;
 *   `person` / `unknown` show nothing (WRITTEN-BY-EVERY-MESSAGE-1019).
 * - `entries`: one per writer record (campaign x person), newest first. Read ONLY for a message
 *   with no `messages` row (no id to match, or `messages` unreadable): the entry of ITS campaign
 *   written at or before it. No such entry shows NOTHING: never the nearest one, never a guess.
 *
 * Every vocabulary is a plain string (the producer widens them). Alias-free (zod only) so it
 * carries real unit tests.
 */
import { z } from "zod";

export const WrittenByEntrySchema = z
  .object({
    campaignId: z.string(),
    writtenAt: z.string(),
    model: z
      .object({
        name: z.string(),
        vendor: z.object({ id: z.string(), name: z.string() }).passthrough(),
      })
      .passthrough()
      .nullable(),
    modelUnavailableReason: z.string().nullable(),
    tactics: z.array(z.object({ line: z.string() }).passthrough()),
    tacticsUnavailableReason: z.string().nullable(),
    underTest: z.boolean().nullable(),
    underTestUnavailableReason: z.string().nullable(),
  })
  .passthrough();

export const WrittenByMessageSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    channel: z.string().nullable(),
    campaignId: z.string().nullable(),
    sentAt: z.string().nullable(),
    // `workflow` | `person` | `unknown`, read as a string: the producer widens its vocabularies.
    writtenBy: z.string(),
    model: WrittenByEntrySchema.shape.model,
    modelUnavailableReason: z.string().nullable(),
    tactics: WrittenByEntrySchema.shape.tactics,
    tacticsUnavailableReason: z.string().nullable(),
    underTest: z.boolean().nullable(),
    underTestUnavailableReason: z.string().nullable(),
  })
  .passthrough();

export const WrittenBySchema = z
  .object({
    leadId: z.string(),
    campaignId: z.string().nullable(),
    entries: z.array(WrittenByEntrySchema),
    // features-service v0.179.290. `.nullish()`: null = unreadable (with its reason), and a
    // snapshot persisted before the field still parses.
    messages: z.array(WrittenByMessageSchema).nullish(),
    messagesUnavailableReason: z.string().nullish(),
  })
  .passthrough();

export type WrittenByEntry = z.infer<typeof WrittenByEntrySchema>;
export type WrittenByMessage = z.infer<typeof WrittenByMessageSchema>;
export type WrittenBy = z.infer<typeof WrittenBySchema>;
/** What a line shows, whichever list answered: the model, the tactic lines, the under-test mark. */
export type WrittenByShown = Pick<WrittenByEntry, "model" | "tactics" | "underTest">;

/**
 * The entry that wrote one sent message: same campaign, written at or before the message,
 * the latest such. Null when the message names no campaign or time, or no entry fits.
 */
export function writtenByForMessage(
  entries: readonly WrittenByEntry[],
  message: { campaignId: string | null | undefined; at: string | null | undefined },
): WrittenByEntry | null {
  if (!message.campaignId || !message.at) return null;
  const sentAt = Date.parse(message.at);
  if (Number.isNaN(sentAt)) return null;
  let best: WrittenByEntry | null = null;
  let bestAt = Number.NEGATIVE_INFINITY;
  for (const e of entries) {
    if (e.campaignId !== message.campaignId) continue;
    const at = Date.parse(e.writtenAt);
    if (Number.isNaN(at) || at > sentAt || at <= bestAt) continue;
    best = e;
    bestAt = at;
  }
  return best;
}

/**
 * Who wrote one rendered message. Its own `messages` row first, on the exact id: shown only when
 * a workflow wrote it (a person or an unknown writer shows nothing). Only a message with no row
 * reads the entry of its campaign (`writtenByForMessage`). Null = nothing to show.
 */
export function writtenByForRow(
  writtenBy: Pick<WrittenBy, "entries" | "messages"> | null,
  row: { id: string | null | undefined; campaignId: string | null | undefined; at: string | null | undefined },
): WrittenByShown | null {
  if (!writtenBy) return null;
  const own = row.id && writtenBy.messages ? writtenBy.messages.find((m) => m.id === row.id) : undefined;
  if (own) return own.writtenBy === "workflow" ? own : null;
  return writtenByForMessage(writtenBy.entries, row);
}

/**
 * lead-service's message id of a Unibox thread item: an email's outreach subject key, else the
 * crm fact id crm-service states in the item's `ref` (`factId`). Null = no id: the row then reads
 * the campaign entry, never a guess on time or channel.
 */
export function writtenMessageId(item: {
  outreachFact?: { subjectKey: string } | null;
  ref?: Record<string, string | null> | null;
}): string | null {
  return item.outreachFact?.subjectKey ?? item.ref?.factId ?? null;
}

/** True when an entry has something to show: a model, a tactic line, or the under-test mark. */
export function hasWrittenBy<T extends WrittenByShown>(entry: T | null): entry is T {
  return entry !== null && (entry.model !== null || entry.tactics.length > 0 || entry.underTest === true);
}

/**
 * The vendor's site, for its logo (`ProviderLogo`). A display lookup on chat-service's vendor
 * id; an id this build does not know draws no logo, never a guessed one.
 */
const VENDOR_DOMAINS: Readonly<Record<string, string>> = {
  anthropic: "anthropic.com",
  google: "google.com",
  openai: "openai.com",
  deepseek: "deepseek.com",
  zai: "z.ai",
  moonshot: "moonshot.ai",
  mistral: "mistral.ai",
  xai: "x.ai",
};

export function vendorDomain(vendorId: string): string | null {
  return VENDOR_DOMAINS[vendorId] ?? null;
}
