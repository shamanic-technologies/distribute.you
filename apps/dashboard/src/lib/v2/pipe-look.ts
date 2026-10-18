/**
 * The LOOK of a pipe in dashboard v2.
 *
 * A pipe is one LEG (the arrow a campaign moves a lead along, named by the step it
 * lands on) performed through one ACQUISITION CHANNEL. A campaign is one pipe working
 * one OFFER (offer x leg x channel). A pipe reads by its channel's own words; the LOOK
 * (colour, glyph) is ours, keyed per (channel, landing step), else per channel.
 *
 * Alias-free so it carries real unit tests.
 */

export type PipeGlyph = "ring" | "diamond" | "arc" | "triangle" | "hex" | "square";

export interface PipeIdentity {
  /** Stable join key: `<channel slug>|<landing step token>`. */
  key: string;
  name: string;
  /** CSS colour (a `--data-*` token of the v2 palette) for the pipe's mark. */
  color: string;
  glyph: PipeGlyph;
}

const PIPE_LOOKS: Record<string, { color: string; glyph: PipeGlyph }> = {
  "sales-cold-email-outreach|website_visit": { color: "var(--data-teal)", glyph: "ring" },
  "sales-cold-email-outreach|conversation": { color: "var(--data-violet)", glyph: "arc" },
  "feedback-request-cold-email-outreach|conversation": { color: "var(--data-rose)", glyph: "hex" },
  "feedback-request-cold-email-outreach|website_visit": { color: "var(--data-amber)", glyph: "diamond" },
  "pr-expert-quote-outreach|website_visit": { color: "var(--data-lime)", glyph: "triangle" },
  "sales-crm-email-outreach|conversation": { color: "var(--data-sky)", glyph: "ring" },
  "sales-crm-email-outreach|website_visit": { color: "var(--data-amber)", glyph: "triangle" },
};

/** A channel's look whatever step it lands on: single-leg channels, or older rows stating no leg. */
const CHANNEL_LOOKS: Record<string, { color: string; glyph: PipeGlyph }> = {
  "ai-meeting-booking": { color: "var(--data-lime)", glyph: "triangle" },
  "pr-cold-email-outreach": { color: "var(--data-amber)", glyph: "diamond" },
  "pr-expert-quote-outreach": { color: "var(--data-sky)", glyph: "hex" },
  "pr-expert-quote-opportunities": { color: "var(--data-violet)", glyph: "ring" },
  "google-ads": { color: "var(--data-amber)", glyph: "triangle" },
};

const FALLBACK = { color: "var(--fg-3)", glyph: "square" as PipeGlyph };

export function pipeKey(channelSlug: string, landingStep: string | null): string {
  return `${channelSlug}|${landingStep ?? "unplaced"}`;
}

/** The pipe performing a (channel, landing step) pair, named by the channel's own words. */
export function pipeFor(channelSlug: string, landingStep: string | null, channelName: string): PipeIdentity {
  const key = pipeKey(channelSlug, landingStep);
  const look = PIPE_LOOKS[key] ?? CHANNEL_LOOKS[channelSlug] ?? FALLBACK;
  return { key, name: channelName, color: look.color, glyph: look.glyph };
}
