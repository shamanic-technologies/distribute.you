// The channels a brand can acquire buyers through. A channel is WHERE we go to
// find them; a sales funnel (see `sales-funnels.ts`) is what happens once one of
// them lands. The two are separate models on purpose: the same funnel can be fed
// by cold email today and by paid clicks later.
//
// A CHANNEL IS A FEATURE SLUG, and features-service owns WHICH channels exist.
// It publishes them as ordinary features, each stating the sales funnels it may
// be sold through, so this module DERIVES the list from the features the app
// already fetches rather than keeping a copy of it. A copy is what this file
// used to be, and it went stale the way a copy always does: the producer sold
// thirty-three channels while the copy listed two and called the rest "coming
// soon", so a channel live upstream could not be funded here at all.
//
// What stays local is the MARK, and only the mark. Which logo or glyph stands
// for a channel is a rendering decision this app owns; nothing upstream states
// it, and a channel we have not drawn yet is still a channel. So an unmarked
// channel keeps its name, its funnels and its money, and simply draws no tile:
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
export type OwnChannelGlyph = "envelope" | "chat-circle" | "chat-teardrop";

/**
 * How the channel is marked.
 *
 * A channel run on somebody else's platform wears that platform's real logo,
 * fetched by domain (logo.dev) like every other provider on the product. A
 * channel that is OURS has no vendor to borrow a mark from, so it gets a
 * Phosphor duotone glyph in a tinted tile, the same treatment the sales funnels
 * use. Tones are whole class strings because Tailwind cannot see a class
 * assembled at runtime, and every tint used here is in the `html.dark` remap.
 */
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
   * which is how a chain is sold one leg at a time: the legs we do not automate are
   * worked at their side. Null when the producer states nothing, which is read
   * as the behaviour that came before the field shipped rather than as a denial.
   */
  operatedBy: string | null;
  /**
   * The legs this channel performs: the step it moves a lead FROM and the step it
   * moves it TO. `from: null` means the lead was not on the chain at all, which is
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
   * Which sales funnels the feature may be sold through.
   *
   * An EMPTY array is a statement and the reason this predicate works: every
   * feature that is not an acquisition channel (PR, hiring, VC, press kits,
   * expert quotes) states `[]`, so selling through nothing IS not being a
   * channel. ABSENT means the producer did not answer, which is read as the
   * behaviour that came before the field shipped rather than as a denial.
   */
  salesFunnels?: string[];
  /**
   * What the feature states about being a channel. Structural and fully optional:
   * the producer added it after this reader existed, and a row without it is a
   * channel we simply know less about, never an error.
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
    tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  },
  "feedback-request-cold-email-outreach": {
    kind: "own",
    glyph: "chat-circle",
    tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
  },
  "sales-crm-email-outreach": {
    kind: "own",
    glyph: "envelope",
    tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
  },
  "cold-sms-outreach": {
    kind: "own",
    glyph: "chat-teardrop",
    tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
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
 * A feature is a channel when it states at least one sales funnel it can be sold
 * through. That predicate is the producer's own statement rather than a list
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
    .filter((f) => f.salesFunnels === undefined || f.salesFunnels.length > 0)
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
