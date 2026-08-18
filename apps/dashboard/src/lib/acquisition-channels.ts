// The channels a brand can acquire buyers through. A channel is WHERE we go to
// find them; a sales funnel (see `sales-funnels.ts`) is what happens once one of
// them lands. The two are separate models on purpose: the same funnel can be fed
// by cold email today and by paid clicks later.
//
// A CHANNEL IS A FEATURE SLUG. There is no second vocabulary for it anywhere in
// the fleet, and none should be introduced: features-service owns what a feature
// is, campaign-service states which one a campaign runs, billing funds a
// (funnel, feature) pair. So this file holds DISPLAY METADATA for a feature slug
// (a name, a line of copy, a mark), and identity lives upstream.
//
// The channels that are COMING carry no feature slug, because they exist in no
// service yet. Inventing the slug they will one day have would put an identifier
// on screen that nothing can resolve, so they are their own list instead: a
// channel we can run and one we cannot are two different kinds of row.
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

/** A channel we run today. Identified by the features-service slug it IS. */
export type AcquisitionChannelDef = {
  /** The features-service feature slug. This IS the channel's identity. */
  featureSlug: string;
  /** What the channel is called. Read as the card's title. */
  name: string;
  /** What running it means for the brand, in one line under the name. */
  summary: string;
  mark: AcquisitionChannelMark;
};

/**
 * A channel we cannot run yet.
 *
 * Deliberately NOT an `AcquisitionChannelDef` with a flag: it has no feature
 * slug to be identified by, so it cannot be funded, cannot carry a campaign and
 * cannot be resolved from one. `id` is a local display key and nothing else:
 * never send it anywhere.
 */
export type ComingSoonChannelDef = {
  id: string;
  name: string;
  summary: string;
  mark: AcquisitionChannelMark;
};

export const ACQUISITION_CHANNELS: AcquisitionChannelDef[] = [
  {
    featureSlug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    summary: "We email your buyers from our own domains, on your behalf.",
    mark: {
      kind: "own",
      glyph: "envelope",
      tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
    },
  },
  {
    featureSlug: "feedback-request-cold-email-outreach",
    name: "Feedback Request Cold Email Outreach",
    summary: "We ask your buyers about the problem you solve, rather than pitching them.",
    mark: {
      kind: "own",
      glyph: "chat-circle",
      tone: { iconBg: "bg-purple-50", iconText: "text-purple-600" },
    },
  },
];

export const COMING_SOON_CHANNELS: ComingSoonChannelDef[] = [
  {
    id: "google-ads",
    name: "Google Ads",
    summary: "Paid clicks from Google Search.",
    mark: { kind: "vendor", domain: "google.com" },
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    summary: "Paid reach on Facebook and Instagram.",
    mark: { kind: "vendor", domain: "meta.com" },
  },
  {
    id: "linkedin-ads",
    name: "LinkedIn Ads",
    summary: "Paid reach on LinkedIn.",
    mark: { kind: "vendor", domain: "linkedin.com" },
  },
  {
    id: "x-ads",
    name: "X Ads",
    summary: "Paid reach on X.",
    mark: { kind: "vendor", domain: "x.com" },
  },
  {
    id: "reddit-ads",
    name: "Reddit Ads",
    summary: "Paid reach in the subreddits your buyers read.",
    mark: { kind: "vendor", domain: "reddit.com" },
  },
  {
    id: "cold-whatsapp",
    name: "Sales Cold WhatsApp Outreach",
    summary: "We message your buyers on WhatsApp, from our own numbers.",
    mark: { kind: "vendor", domain: "whatsapp.com" },
  },
  {
    id: "cold-sms",
    name: "Sales Cold SMS Outreach",
    summary: "We text your buyers, from our own numbers.",
    mark: {
      kind: "own",
      glyph: "chat-teardrop",
      tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
    },
  },
];

/**
 * Which channel a campaign runs on, read from the feature slug it states.
 *
 * A campaign carries its feature slug on the wire, and that slug IS the channel,
 * so this is a display lookup rather than an inference. It used to sniff the
 * workflow slug for the substring "email", which answered "cold email" for every
 * email workflow whatever its offer; with two cold-email channels that guess
 * cannot tell them apart, and it was never able to.
 *
 * Returns null for a slug this catalogue does not carry (a PR / hiring / VC
 * feature, or one shipped upstream before it was given a mark here), and the
 * caller then prints a plain word rather than borrowing another channel's mark.
 */
export function acquisitionChannelForFeatureSlug(
  featureSlug: string | null | undefined,
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelDef | null {
  if (!featureSlug) return null;
  return channels.find((c) => c.featureSlug === featureSlug) ?? null;
}
