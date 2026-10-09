import { isProactiveFrom, OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "../outbound-leg-key";

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
 * Crew names (Herald, Scout, Pilot...) are RETIRED (owner 2026-10-04): the poetic names
 * now name sales path combinations (features-service `name` on each sales path row), and
 * the catalogue serves `crewName: null`, so a crew reads by its channel's own words. The
 * LOOK (colour, glyph) is ours, keyed per (channel, landing step), else per channel.
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

const CREW_LOOKS: Record<string, { color: string; glyph: CrewGlyph }> = {
  "sales-cold-email-outreach|website_visit": { color: "var(--data-teal)", glyph: "ring" },
  "sales-cold-email-outreach|conversation": { color: "var(--data-violet)", glyph: "arc" },
  "feedback-request-cold-email-outreach|conversation": { color: "var(--data-rose)", glyph: "hex" },
  "feedback-request-cold-email-outreach|website_visit": { color: "var(--data-amber)", glyph: "diamond" },
  "pr-expert-quote-outreach|website_visit": { color: "var(--data-lime)", glyph: "triangle" },
  "sales-crm-email-outreach|conversation": { color: "var(--data-sky)", glyph: "ring" },
  "sales-crm-email-outreach|website_visit": { color: "var(--data-amber)", glyph: "triangle" },
};

/** A channel's look whatever step it lands on: single-leg channels, or older rows stating no leg. */
const CHANNEL_LOOKS: Record<string, { color: string; glyph: CrewGlyph }> = {
  "ai-meeting-booking": { color: "var(--data-lime)", glyph: "triangle" },
  "pr-cold-email-outreach": { color: "var(--data-amber)", glyph: "diamond" },
  "pr-expert-quote-outreach": { color: "var(--data-sky)", glyph: "hex" },
  "pr-expert-quote-opportunities": { color: "var(--data-violet)", glyph: "ring" },
  "google-ads": { color: "var(--data-amber)", glyph: "triangle" },
};

const FALLBACK = { color: "var(--fg-3)", glyph: "square" as CrewGlyph };

export function crewKey(channelSlug: string, landingStep: string | null): string {
  return `${channelSlug}|${landingStep ?? "unplaced"}`;
}

/**
 * The crew performing a (channel, landing step) pair. `crewName` is the name the
 * producer publishes for it (`crewNameFor`); `channelName` is the channel's own words,
 * used only when the producer names no crew.
 */
export function crewFor(
  channelSlug: string,
  landingStep: string | null,
  channelName: string,
  crewName: string | null = null,
): CrewIdentity {
  const key = crewKey(channelSlug, landingStep);
  const look = CREW_LOOKS[key] ?? CHANNEL_LOOKS[channelSlug] ?? FALLBACK;
  return { key, name: crewName ?? channelName, color: look.color, glyph: look.glyph };
}

/**
 * The crews a customer can put to work today: every other name above is kept for the
 * campaigns staff run, and a crew already working for a brand is still listed for it.
 * Owner-decided (2026-09-29): three, always shown on Crew, and the only three offered
 * when a mission is added.
 */
export interface OfferedCrew {
  featureSlug: string;
  legKey: string;
}

export const OFFERED_CREWS: readonly OfferedCrew[] = [
  { featureSlug: "sales-cold-email-outreach", legKey: OUTBOUND_LEG_TO_CONVERSATION },
  { featureSlug: "sales-cold-email-outreach", legKey: OUTBOUND_LEG_TO_WEBSITE_VISIT },
  { featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked" },
];

/**
 * When a crew works. An ENTRY leg starts from nothing, so the crew spends its daily
 * budget every day ("Daily"). A leg that starts FROM a step only wakes when a lead
 * reaches that step, so it spends against a cap and only when something happens.
 * Read off the leg's own shape, never off a list of crews.
 */
export type CrewTriggerKind = "daily" | "event";

export interface CrewTrigger {
  kind: CrewTriggerKind;
  /** What sets it off, as a customer reads it: "Daily" or the step it waits for. */
  label: string;
  /** What it brings, plural: "Positive replies", "Meetings booked". */
  outcome: string;
}

/** The plural of a step a customer reads under a crew. An unlisted step keeps its own words. */
const OUTCOME_PLURAL: Record<string, string> = {
  conversation: "Positive replies",
  website_visit: "Website visits",
  meeting_booked: "Meetings booked",
  meeting_attended: "Meetings attended",
  signup: "Signups",
  form_submitted: "Form submissions",
  paid_client: "Paid clients",
};

/** A step's name in the plural ("Positive replies"), as the trigger tags read it; the served label otherwise. */
export function stepPlural(stepKey: string, label: string): string {
  return OUTCOME_PLURAL[stepKey] ?? label;
}

export function crewTrigger(
  leg: { fromKey: string | null; fromLabel: string | null; toKey: string; toLabel: string } | null,
): CrewTrigger | null {
  if (!leg) return null;
  const outcome = OUTCOME_PLURAL[leg.toKey] ?? leg.toLabel;
  if (isProactiveFrom(leg.fromKey)) return { kind: "daily", label: "Daily", outcome };
  // Not proactive, so it starts on a named step.
  return { kind: "event", label: leg.fromLabel ?? (leg.fromKey as string), outcome };
}

/** The initial drawn in a crew's avatar tile. */
export function crewInitial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
