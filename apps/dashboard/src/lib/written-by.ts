/**
 * WHAT A MESSAGE WE SENT WAS WRITTEN WITH (owner 2026-10-19, WRITTEN-BY-1019).
 *
 * We take responsibility for our messages: every one is written BY Distribute, WITH a model and
 * tactics. So beside a message's label ("Initial email") sit discreet tags: the model (its
 * product logo + name, "Opus 5.5") and each tactic's NAME ("Blind angle"), its client line
 * on hover. Never a workflow name or id, never a cost, no "under test" mark, no block.
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
    // `name` = the tactic's catalogue name, the tag's text (features-service, additive).
    tactics: z.array(z.object({ line: z.string(), name: z.string().nullish() }).passthrough()),
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
/** What the tags show, whichever list answered: the model and the tactics. */
export type WrittenByShown = Pick<WrittenByEntry, "model" | "tactics">;

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

/** The tags one message shows: its model, then each named tactic. Null = no tag at all. */
export function writtenWithTags(shown: WrittenByShown | null): {
  model: ModelTag | null;
  tactics: { name: string; line: string }[];
} | null {
  if (!shown) return null;
  const model = shown.model ? modelTag(shown.model) : null;
  const tactics = shown.tactics.flatMap((t) => (t.name ? [{ name: t.name, line: t.line }] : []));
  return model || tactics.length > 0 ? { model, tactics } : null;
}

/** A model as a tag: the PRODUCT's logo (Claude, not Anthropic) and its name without the family word. */
export interface ModelTag {
  /** "Opus 5.5" where the logo already says the product (Claude); the served name verbatim otherwise. */
  label: string;
  /** The served public name, whole ("Claude Opus 5.5"), for the hover. */
  name: string;
  /** For `ProviderLogo`; null = no logo, never a guessed one. */
  logoDomain: string | null;
}

/**
 * The model family each vendor serves and the site whose logo stands for it: the PRODUCT's where
 * one exists (claude.ai draws Claude's mark, anthropic.com the company's). `family` is set only
 * where that logo says the family, so the name drops the word; a company logo (Google's G beside
 * Gemini) keeps the whole name. A display lookup on chat-service's vendor id.
 */
const MODEL_FAMILIES: Readonly<Record<string, { family: string | null; logoDomain: string }>> = {
  anthropic: { family: "Claude", logoDomain: "claude.ai" },
  google: { family: null, logoDomain: "google.com" },
  openai: { family: null, logoDomain: "chatgpt.com" },
  deepseek: { family: null, logoDomain: "deepseek.com" },
  zai: { family: null, logoDomain: "z.ai" },
  moonshot: { family: null, logoDomain: "kimi.com" },
  mistral: { family: null, logoDomain: "mistral.ai" },
  xai: { family: null, logoDomain: "x.ai" },
};

export function modelTag(model: { name: string; vendor: { id: string } }): ModelTag {
  const known = MODEL_FAMILIES[model.vendor.id];
  if (!known) return { label: model.name, name: model.name, logoDomain: null };
  const prefix = known.family ? `${known.family} ` : null;
  const label = prefix && model.name.startsWith(prefix) ? model.name.slice(prefix.length) : model.name;
  return { label, name: model.name, logoDomain: known.logoDomain };
}
