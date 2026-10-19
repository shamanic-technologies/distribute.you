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
 * `/v1/features/orgs/leads/{leadId}/written-by`): one entry per writer record (campaign x
 * person), newest first. A sent message reads the entry of ITS campaign written at or before
 * it. A message with no such entry (a reply or follow-up a workflow drafted itself, not
 * recorded yet) shows NOTHING: never the nearest entry, never a guess.
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

export const WrittenBySchema = z
  .object({
    leadId: z.string(),
    campaignId: z.string().nullable(),
    entries: z.array(WrittenByEntrySchema),
  })
  .passthrough();

export type WrittenByEntry = z.infer<typeof WrittenByEntrySchema>;
export type WrittenBy = z.infer<typeof WrittenBySchema>;

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

/** True when an entry has something to show: a model, a tactic line, or the under-test mark. */
export function hasWrittenBy(entry: WrittenByEntry | null): entry is WrittenByEntry {
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
