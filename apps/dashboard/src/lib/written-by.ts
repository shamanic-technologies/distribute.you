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
  /** "Opus 5.5" beside Claude's mark, "3 Flash" beside Gemini's; the served name verbatim otherwise. */
  label: string;
  /** The served public name, whole ("Claude Opus 5.5"), for the hover. */
  name: string;
  /** The product mark we ship (`public/model-logos`); null = no logo, never a guessed one. */
  logoSrc: string | null;
}

/**
 * Each vendor's model family and its PRODUCT mark (Claude's starburst, Gemini's sparkle, never the
 * company's logo), shipped as files: logo.dev only knows company sites. The mark says the family,
 * so the label drops the word. A display lookup on chat-service's vendor id.
 */
const MODEL_FAMILIES: Readonly<Record<string, { family: string; logo: string }>> = {
  anthropic: { family: "Claude", logo: "claude" },
  google: { family: "Gemini", logo: "gemini" },
  openai: { family: "GPT", logo: "openai" },
  deepseek: { family: "DeepSeek", logo: "deepseek" },
  zai: { family: "GLM", logo: "glm" },
  moonshot: { family: "Kimi", logo: "kimi" },
  mistral: { family: "Mistral", logo: "mistral" },
  xai: { family: "Grok", logo: "grok" },
};

export function modelTag(model: { name: string; vendor: { id: string } }): ModelTag {
  const known = MODEL_FAMILIES[model.vendor.id];
  if (!known) return { label: model.name, name: model.name, logoSrc: null };
  const prefix = `${known.family} `;
  const label = model.name.startsWith(prefix) ? model.name.slice(prefix.length) : model.name;
  return { label, name: model.name, logoSrc: `/model-logos/${known.logo}.svg` };
}

/**
 * A model known only by its served NAME (Research refs carry no vendor id): the family whose word
 * opens the name ("Claude Opus 5.5", "Gemini 3 Flash") gives the mark; none matches = no logo.
 */
export function modelTagFromName(name: string): ModelTag {
  const known = Object.values(MODEL_FAMILIES).find((f) => name.toLowerCase().startsWith(`${f.family.toLowerCase()} `));
  if (!known) return { label: name, name, logoSrc: null };
  return { label: name.slice(known.family.length + 1), name, logoSrc: `/model-logos/${known.logo}.svg` };
}

/** Every product mark the lookup names, for the test that each file ships. */
export function modelLogoFiles(): string[] {
  return Object.values(MODEL_FAMILIES).map((f) => `${f.logo}.svg`);
}

/**
 * How many tags fit a width (owner 2026-10-19): all of them, else as many as fit beside a "+N more"
 * chip, never fewer than the first. Widths in px, measured off the rendered chips; pure.
 */
export function tagsThatFit(available: number, label: number, chips: readonly number[], more: number, gap: number): number {
  const n = chips.length;
  const used = (k: number) => label + chips.slice(0, k).reduce((a, w) => a + w + gap, 0);
  if (used(n) <= available) return n;
  let k = 1;
  while (k + 1 < n && used(k + 1) + gap + more <= available) k += 1;
  return k;
}
