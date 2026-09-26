/**
 * The CREW vocabulary of dashboard v2.
 *
 * A crew is one LEG (the arrow a campaign moves a lead along, named by the step it
 * lands on) performed through one ACQUISITION CHANNEL. It is presented like a
 * teammate with a proper name, so a reader can say "Scout brought 40 visits" rather
 * than "the cold-email-to-website-visit leg". A MISSION is a crew working one OFFER,
 * which is exactly a campaign identity (offer x leg x channel) — so missions need
 * nothing new from any service.
 *
 * Names are OURS, stable per (channel, landing step), and there are only as many as
 * we have crews. A pair not listed here is named by its channel, which is true,
 * rather than by a made-up name nobody chose.
 *
 * Alias-free so it carries real unit tests.
 */

export type CrewGlyph = "ring" | "diamond" | "arc" | "triangle" | "hex" | "square";

export interface CrewIdentity {
  /** Stable join key: `<channel slug>|<landing step token>`. */
  key: string;
  name: string;
  /** CSS colour (a `--data-*` token of the v2 palette) for the crew's mark. */
  color: string;
  glyph: CrewGlyph;
}

const CREW_NAMES: Record<string, { name: string; color: string; glyph: CrewGlyph }> = {
  "sales-cold-email-outreach|website_visit": { name: "Scout", color: "var(--data-teal)", glyph: "ring" },
  "sales-cold-email-outreach|conversation": { name: "Herald", color: "var(--data-violet)", glyph: "arc" },
  "feedback-request-cold-email-outreach|conversation": { name: "Echo", color: "var(--data-rose)", glyph: "hex" },
  "feedback-request-cold-email-outreach|website_visit": { name: "Relay", color: "var(--data-amber)", glyph: "diamond" },
  "pr-expert-quote-outreach|website_visit": { name: "Quill", color: "var(--data-lime)", glyph: "triangle" },
  "sales-crm-email-outreach|conversation": { name: "Anchor", color: "var(--data-sky)", glyph: "ring" },
  "sales-crm-email-outreach|website_visit": { name: "Beacon", color: "var(--data-amber)", glyph: "triangle" },
};

const FALLBACK = { color: "var(--fg-3)", glyph: "square" as CrewGlyph };

export function crewKey(channelSlug: string, landingStep: string | null): string {
  return `${channelSlug}|${landingStep ?? "unplaced"}`;
}

/**
 * The crew performing a (channel, landing step) pair. `channelName` is the
 * catalogue's own name for the channel, used only when the pair has no crew name.
 */
export function crewFor(
  channelSlug: string,
  landingStep: string | null,
  channelName: string,
): CrewIdentity {
  const key = crewKey(channelSlug, landingStep);
  const named = CREW_NAMES[key];
  return named
    ? { key, name: named.name, color: named.color, glyph: named.glyph }
    : { key, name: channelName, ...FALLBACK };
}

/** The initial drawn in a crew's avatar tile. */
export function crewInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
