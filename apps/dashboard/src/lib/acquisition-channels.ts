// The channels a brand can acquire buyers through. A channel is WHERE we go to
// find them, and each performs one or more LEGS (see `legs.ts`): the moves that take
// a lead from one step to another.
//
// A CHANNEL IS A FEATURE SLUG, and features-service owns WHICH channels exist.
// It publishes them as ordinary features, each stating what it is as a channel
// (`acquisitionChannel`), so this module DERIVES the list from the features the app
// already fetches rather than keeping a copy of it. A copy is what this file
// used to be, and it went stale the way a copy always does: the producer sold
// thirty-three channels while the copy listed two and called the rest "coming
// soon", so a channel live upstream could not be funded here at all.
//
// What stays local is the MARK, and only the mark. Which logo or glyph stands
// for a channel is a rendering decision this app owns; nothing upstream states
// it, and a channel we have not drawn yet is still a channel. So an unmarked
// channel keeps its name, its legs and its money, and simply draws no tile:
// a mark we would have to invent is worse than none.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

/**
 * Which glyph stands for a channel that is OURS.
 *
 * A token rather than a component, so this module keeps no React or icon import
 * and stays a plain unit-testable catalogue. The mark component maps it.
 */
export type OwnChannelGlyph =
  | "envelope"
  | "chat-circle"
  | "chat-teardrop"
  | "calendar-plus"
  | "quotes"
  | "megaphone"
  | "phone"
  | "microphone"
  | "newspaper"
  | "handshake"
  | "user-check"
  | "list"
  | "file-text"
  | "share-network"
  | "users"
  | "bell"
  | "broadcast"
  | "calendar-check"
  | "video-camera";

/**
 * How the channel is marked.
 *
 * A channel run on somebody else's platform wears that platform's real logo,
 * fetched by domain (logo.dev) like every other provider on the product. A
 * channel that is OURS has no vendor to borrow a mark from, so it gets a
 * Phosphor duotone glyph in a tinted tile, the same treatment the legs use. Tones are whole class strings because Tailwind cannot see a class
 * assembled at runtime, and every tint used here is in the `html.dark` remap.
 */
/**
 * The ONE tone every channel of OURS wears: the charter's TERTIARY.
 *
 * Orange rather than indigo, and the reason is the primary: indigo sits ~19 degrees off
 * the charter blue, so a tile wearing it reads as the primary rather than as a third
 * accent. Orange is the remaining member of the rotated set that is unmistakably its own
 * colour beside both the primary and the secondary the legs wear.
 *
 * Same argument as `LEG_TONE`, one column over: a row states its leg and then the
 * channel it buys it through, so the two tiles have to read as two KINDS of thing. Four
 * colours across the channels made them read as four kinds of channel, which is not a
 * distinction anybody needs, since the glyph and the vendor logo already say which
 * channel it is. A channel bought on somebody else's platform keeps that platform's real
 * logo on a white tile and takes no tone at all; a logo is not a tint.
 */
export const OWN_CHANNEL_TONE = { iconBg: "bg-orange-50", iconText: "text-orange-600" } as const;

export type AcquisitionChannelMark =
  | { kind: "vendor"; domain: string }
  | { kind: "own"; glyph: OwnChannelGlyph; tone: { iconBg: string; iconText: string } };

/** A channel we can sell, identified by the features-service slug it IS. */
export type AcquisitionChannelDef = {
  /** The features-service feature slug. This IS the channel's identity. */
  featureSlug: string;
  /** What the channel is called. Read off the feature, never restated here. */
  name: string;
  /** What running it means for the brand, in one line under the name. */
  summary: string;
  /** Its tile, or null for a channel this app has not drawn yet. */
  mark: AcquisitionChannelMark | null;
  /**
   * WHO puts the hours in. `platform` is us; `customer` is the brand's own team,
   * and the legs we do not automate are
   * worked at their side. Null when the producer states nothing, which is read
   * as the behaviour that came before the field shipped rather than as a denial.
   */
  operatedBy: string | null;
  /**
   * The legs this channel performs: the step it moves a lead FROM and the step it
   * moves it TO. `from: null` means the lead was on no step at all, which is
   * what an entry channel does. Empty when the producer states nothing.
   */
  legs: ChannelLeg[];
};

/** One leg, as the authenticated feature row states it: bare step keys. */
export type ChannelLeg = { from: string | null; to: string };

/**
 * What this module reads off a features-service feature.
 *
 * Structural on purpose: the app's own `Feature` satisfies it, and so does a
 * fixture, so nothing has to import the wire type to build a channel.
 */
export interface ChannelSource {
  slug: string;
  name: string;
  description: string;
  displayOrder?: number;
  /**
   * What the feature states about being a channel. NULL (or absent) is the producer
   * saying this feature is not one — PR, hiring, VC, press kits — which is exactly
   * the predicate this module filters on.
   */
  acquisitionChannel?: {
    operatedBy?: string;
    family?: string;
    stepTransitions?: { from?: string | null; to?: string }[];
  } | null;
}

/**
 * The tile each channel wears, keyed on its feature slug.
 *
 * Display metadata, and the ONLY thing about a channel this app decides. A slug
 * missing from here is not an error and not a gap in the catalogue: it draws no
 * tile and is otherwise a channel like any other.
 *
 * A channel bought on somebody else's platform wears that platform's logo. The
 * ones with no vendor to borrow from are the media we own outright, so they take
 * a glyph in a tint the dark remap covers.
 */
export const CHANNEL_MARKS: Record<string, AcquisitionChannelMark> = {
  "sales-cold-email-outreach": {
    kind: "own",
    glyph: "envelope",
    tone: OWN_CHANNEL_TONE,
  },
  "feedback-request-cold-email-outreach": {
    kind: "own",
    glyph: "chat-circle",
    tone: OWN_CHANNEL_TONE,
  },
  "sales-crm-email-outreach": {
    kind: "own",
    glyph: "envelope",
    tone: OWN_CHANNEL_TONE,
  },
  // A calendar rather than an envelope, although it answers by email: the row it
  // draws on states the LEG it performs, and this one ends on a booked meeting.
  // Deliberately not the glyph its leg wears: the two sit side by side on a campaign
  // row, and one glyph twice reads as one thing.
  "ai-meeting-booking": {
    kind: "own",
    glyph: "calendar-plus",
    tone: OWN_CHANNEL_TONE,
  },
  "cold-sms-outreach": {
    kind: "own",
    glyph: "chat-teardrop",
    tone: OWN_CHANNEL_TONE,
  },
  // Earned media: a journalist asks a question and the brand's expert answers it,
  // so the placement carries a link back and the channel's one leg lands on a
  // website visit. A quote mark rather than an envelope, although the answer
  // travels by API: the row it draws on states what the channel PRODUCES, and an
  // envelope there would read as one more outbound cold-email channel.
  "pr-expert-quote-outreach": {
    kind: "own",
    glyph: "quotes",
    tone: OWN_CHANNEL_TONE,
  },
  "cold-whatsapp-outreach": { kind: "vendor", domain: "whatsapp.com" },
  "cold-linkedin-outreach": { kind: "vendor", domain: "linkedin.com" },
  "cold-x-outreach": { kind: "vendor", domain: "x.com" },
  "cold-instagram-outreach": { kind: "vendor", domain: "instagram.com" },
  "cold-reddit-outreach": { kind: "vendor", domain: "reddit.com" },
  "google-ads": { kind: "vendor", domain: "ads.google.com" },
  "meta-ads": { kind: "vendor", domain: "facebook.com" },
  "linkedin-ads": { kind: "vendor", domain: "linkedin.com" },
  "tiktok-ads": { kind: "vendor", domain: "tiktok.com" },
  "youtube-ads": { kind: "vendor", domain: "youtube.com" },
  "x-ads": { kind: "vendor", domain: "x.com" },
  "reddit-ads": { kind: "vendor", domain: "reddit.com" },
  "bing-ads": { kind: "vendor", domain: "bing.com" },
  "quora-ads": { kind: "vendor", domain: "quora.com" },
  // The rest of the published catalogue. Glyphs follow the `icon` token the
  // producer states on each channel (`megaphone`, `phone`, `mic`, `newspaper`,
  // `handshake`, `user-check`, ...), mapped onto Phosphor duotone, so a mark is
  // never invented: the producer already says what the channel looks like and
  // this only picks the face. The organic-publishing channels wear the platform
  // they publish on, since that is what a reader recognises.
  "pr-cold-email-outreach": { kind: "own", glyph: "megaphone", tone: OWN_CHANNEL_TONE },
  "cold-call-outreach": { kind: "own", glyph: "phone", tone: OWN_CHANNEL_TONE },
  "newsletter-sponsorships": { kind: "own", glyph: "envelope", tone: OWN_CHANNEL_TONE },
  "podcast-sponsorships": { kind: "own", glyph: "microphone", tone: OWN_CHANNEL_TONE },
  "creator-sponsorships": { kind: "own", glyph: "users", tone: OWN_CHANNEL_TONE },
  "paid-directory-listings": { kind: "own", glyph: "list", tone: OWN_CHANNEL_TONE },
  "seo-content": { kind: "own", glyph: "file-text", tone: OWN_CHANNEL_TONE },
  "press-placements": { kind: "own", glyph: "newspaper", tone: OWN_CHANNEL_TONE },
  "podcast-guesting": { kind: "own", glyph: "broadcast", tone: OWN_CHANNEL_TONE },
  "affiliate-programme": { kind: "own", glyph: "share-network", tone: OWN_CHANNEL_TONE },
  "organic-linkedin-publishing": { kind: "vendor", domain: "linkedin.com" },
  "organic-x-publishing": { kind: "vendor", domain: "x.com" },
  "organic-reddit-publishing": { kind: "vendor", domain: "reddit.com" },
  "organic-youtube-publishing": { kind: "vendor", domain: "youtube.com" },
  "agency-meeting-booking": { kind: "own", glyph: "calendar-plus", tone: OWN_CHANNEL_TONE },
  "your-team-meeting-booking": { kind: "own", glyph: "calendar-plus", tone: OWN_CHANNEL_TONE },
  "agency-meeting-attendance": { kind: "own", glyph: "bell", tone: OWN_CHANNEL_TONE },
  "your-team-meeting-attendance": { kind: "own", glyph: "bell", tone: OWN_CHANNEL_TONE },
  "agency-closing-calls": { kind: "own", glyph: "handshake", tone: OWN_CHANNEL_TONE },
  "your-team-closing-calls": { kind: "own", glyph: "handshake", tone: OWN_CHANNEL_TONE },
  "agency-signup-conversion": { kind: "own", glyph: "user-check", tone: OWN_CHANNEL_TONE },
  "your-team-signup-conversion": { kind: "own", glyph: "user-check", tone: OWN_CHANNEL_TONE },
};

/** The tile for one slug, or null for a channel this app has not drawn. */
export function channelMarkForSlug(
  featureSlug: string | null | undefined,
): AcquisitionChannelMark | null {
  if (!featureSlug) return null;
  return CHANNEL_MARKS[featureSlug] ?? null;
}

/**
 * Every channel the environment sells, built from the features it serves.
 *
 * A feature is a channel when it states what it is as one (`acquisitionChannel`).
 * That predicate is the producer's own statement rather than a list
 * kept here, which is the whole point: a channel published upstream is offerable
 * the moment it is published, and one retired upstream stops being offered
 * without an edit here.
 *
 * Ordered by the producer's own `displayOrder` so the channels read in the same
 * sequence wherever they are listed. A feature stating no order sorts last, by
 * name, rather than jumping to the front on a falsy zero.
 */
export function acquisitionChannelsFromFeatures(
  features: ChannelSource[],
): AcquisitionChannelDef[] {
  return features
    .filter((f) => f.acquisitionChannel != null)
    .map((f) => ({
      featureSlug: f.slug,
      name: f.name,
      summary: f.description,
      mark: channelMarkForSlug(f.slug),
      operatedBy: f.acquisitionChannel?.operatedBy ?? null,
      legs: (f.acquisitionChannel?.stepTransitions ?? [])
        .filter((t): t is { from?: string | null; to: string } => typeof t?.to === "string")
        .map((t) => ({ from: t.from ?? null, to: t.to })),
    }))
    .sort((a, b) => {
      const orderOf = (slug: string) =>
        features.find((f) => f.slug === slug)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const delta = orderOf(a.featureSlug) - orderOf(b.featureSlug);
      return delta !== 0 ? delta : a.name.localeCompare(b.name);
    });
}

/**
 * Which channel a campaign runs on, read from the feature slug it states.
 *
 * A campaign carries its feature slug on the wire, and that slug IS the channel,
 * so this is a display lookup rather than an inference. It used to sniff the
 * workflow slug for the substring "email", which answered "cold email" for every
 * email workflow whatever its offer; with two cold-email channels that guess
 * cannot tell them apart, and it was never able to.
 *
 * Returns null for a slug the given set does not carry, and the caller then
 * prints a plain word rather than borrowing another channel's mark.
 */
export function acquisitionChannelForFeatureSlug(
  featureSlug: string | null | undefined,
  channels: AcquisitionChannelDef[],
): AcquisitionChannelDef | null {
  if (!featureSlug) return null;
  return channels.find((c) => c.featureSlug === featureSlug) ?? null;
}
