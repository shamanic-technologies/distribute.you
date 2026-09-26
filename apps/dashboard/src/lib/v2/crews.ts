/**
 * The CREW vocabulary of dashboard v2.
 *
 * A crew is one LEG (the arrow a campaign moves a lead along, named by the step it
 * lands on) performed through one ACQUISITION CHANNEL. It is presented like a
 * teammate with a proper name, so a reader can say "Scout brought 40 visits" rather
 * than "the cold-email-to-website-visit leg". A MISSION is a crew working one OFFER,
 * which is exactly a campaign identity (offer x funnel x channel) — so missions need
 * nothing new from any service.
 *
 * Names are OURS, stable per (channel, landing step), and there are only as many as
 * we have crews. A pair not listed here is named by its channel, which is true,
 * rather than by a made-up name nobody chose.
 *
 * Alias-free so it carries real unit tests.
 */

export interface CrewIdentity {
  /** Stable join key: `<channel slug>|<landing step token>`. */
  key: string;
  name: string;
  /** Tailwind tint pair for the crew's avatar tile. Whole class strings, so the
   *  compiler sees them. */
  tone: string;
}

const CREW_NAMES: Record<string, { name: string; tone: string }> = {
  "sales-cold-email-outreach|website_visit": { name: "Scout", tone: "bg-sky-100 text-sky-700" },
  "sales-cold-email-outreach|conversation": { name: "Herald", tone: "bg-violet-100 text-violet-700" },
  "feedback-request-cold-email-outreach|conversation": { name: "Echo", tone: "bg-rose-100 text-rose-700" },
  "feedback-request-cold-email-outreach|website_visit": { name: "Relay", tone: "bg-amber-100 text-amber-700" },
  "pr-expert-quote-outreach|website_visit": { name: "Quill", tone: "bg-emerald-100 text-emerald-700" },
  "sales-crm-email-outreach|conversation": { name: "Anchor", tone: "bg-indigo-100 text-indigo-700" },
  "sales-crm-email-outreach|website_visit": { name: "Beacon", tone: "bg-teal-100 text-teal-700" },
};

const FALLBACK_TONE = "bg-gray-100 text-gray-700";

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
    ? { key, name: named.name, tone: named.tone }
    : { key, name: channelName, tone: FALLBACK_TONE };
}

/** The initial drawn in a crew's avatar tile. */
export function crewInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
