// The channels a brand can acquire buyers through. A channel is WHERE we go to
// find them; a sales funnel (see `sales-funnels.ts`) is what happens once one of
// them lands. The two are separate models on purpose: the same funnel can be fed
// by cold email today and by paid clicks later.
//
// Only one channel is live today, so the section reads mostly as a roadmap. It
// still carries the selection model, because "which channels do you run" is the
// question this section exists to answer, and a list that cannot be answered is
// a picture of a feature rather than the feature.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

export type AcquisitionChannelKey =
  | "cold_email"
  | "google_ads"
  | "meta_ads"
  | "linkedin_ads"
  | "x_ads"
  | "reddit_ads"
  | "cold_whatsapp"
  | "cold_sms";

/**
 * How the channel is marked.
 *
 * A channel run on somebody else's platform wears that platform's real logo,
 * fetched by domain (logo.dev) like every other provider on the product. A
 * channel that is OURS has no vendor to borrow a mark from, so it gets a
 * Phosphor duotone icon in a tinted tile, the same treatment the sales funnels
 * use. Tones are whole class strings because Tailwind cannot see a class
 * assembled at runtime, and every tint used here is in the `html.dark` remap.
 */
export type AcquisitionChannelMark =
  | { kind: "vendor"; domain: string }
  | { kind: "own"; tone: { iconBg: string; iconText: string } };

export type AcquisitionChannelDef = {
  key: AcquisitionChannelKey;
  /** What the channel is called. Read as the card's title. */
  name: string;
  /** What running it means for the brand, in one line under the name. */
  summary: string;
  mark: AcquisitionChannelMark;
  /** True while we cannot run it yet, so the card states that instead of offering it. */
  comingSoon: boolean;
};

export const ACQUISITION_CHANNELS: AcquisitionChannelDef[] = [
  {
    key: "cold_email",
    name: "Sales Cold Email Outreach",
    summary: "We email your buyers from our own domains, on your behalf.",
    mark: { kind: "own", tone: { iconBg: "bg-blue-50", iconText: "text-blue-600" } },
    comingSoon: false,
  },
  {
    key: "google_ads",
    name: "Google Ads",
    summary: "Paid clicks from Google Search.",
    mark: { kind: "vendor", domain: "google.com" },
    comingSoon: true,
  },
  {
    key: "meta_ads",
    name: "Meta Ads",
    summary: "Paid reach on Facebook and Instagram.",
    mark: { kind: "vendor", domain: "meta.com" },
    comingSoon: true,
  },
  {
    key: "linkedin_ads",
    name: "LinkedIn Ads",
    summary: "Paid reach on LinkedIn.",
    mark: { kind: "vendor", domain: "linkedin.com" },
    comingSoon: true,
  },
  {
    key: "x_ads",
    name: "X Ads",
    summary: "Paid reach on X.",
    mark: { kind: "vendor", domain: "x.com" },
    comingSoon: true,
  },
  {
    key: "reddit_ads",
    name: "Reddit Ads",
    summary: "Paid reach in the subreddits your buyers read.",
    mark: { kind: "vendor", domain: "reddit.com" },
    comingSoon: true,
  },
  {
    key: "cold_whatsapp",
    name: "Sales Cold WhatsApp Outreach",
    summary: "We message your buyers on WhatsApp, from our own numbers.",
    mark: { kind: "vendor", domain: "whatsapp.com" },
    comingSoon: true,
  },
  {
    key: "cold_sms",
    name: "Sales Cold SMS Outreach",
    summary: "We text your buyers, from our own numbers.",
    mark: { kind: "own", tone: { iconBg: "bg-indigo-50", iconText: "text-indigo-600" } },
    comingSoon: true,
  },
];

/**
 * Which catalogue channel a campaign runs on, read from its workflow slug.
 *
 * A campaign carries no channel field on the wire. The workflow it runs IS the
 * channel, and the product is cold-email-only today, so an email workflow is the
 * cold-email channel. Anything else returns null and the caller falls back to
 * naming the slug rather than claiming a channel we have no catalogue entry for.
 */
export function acquisitionChannelForWorkflowSlug(
  workflowSlug: string | null | undefined,
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelDef | null {
  if (!workflowSlug) return null;
  if (!workflowSlug.includes("email")) return null;
  return channels.find((c) => c.key === "cold_email") ?? null;
}

/** The channels we can actually run today. */
export function liveAcquisitionChannels(
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelDef[] {
  return channels.filter((c) => !c.comingSoon);
}

export function acquisitionChannelByKey(
  key: AcquisitionChannelKey,
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelDef {
  const def = channels.find((c) => c.key === key);
  if (!def) throw new Error(`Unknown acquisition channel: ${key}`);
  return def;
}

/**
 * A brand always runs at least one live channel, so the section opens on the
 * first one rather than on an empty list that describes nothing.
 */
export function initialSelectedChannelKeys(
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelKey[] {
  const first = liveAcquisitionChannels(channels)[0];
  return first ? [first.key] : [];
}

/**
 * The channels a brand runs come FIRST, in their declared order, and the rest
 * follow. A channel it runs and one it does not are two different kinds of row.
 */
export function partitionChannelsBySelection(
  isSelected: (key: AcquisitionChannelKey) => boolean,
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): { selected: AcquisitionChannelDef[]; unselected: AcquisitionChannelDef[] } {
  return {
    selected: channels.filter((c) => isSelected(c.key)),
    unselected: channels.filter((c) => !isSelected(c.key)),
  };
}

/** A channel we cannot run yet cannot be chosen. */
export function canSelectChannel(def: AcquisitionChannelDef): boolean {
  return !def.comingSoon;
}

/**
 * Why this channel cannot be dropped, or null when it can. A brand with no
 * channel running is a brand we cannot reach anyone for, so the last live one
 * stays on and the card says so instead of silently ignoring the click.
 */
export function removeChannelBlockedReason(
  key: AcquisitionChannelKey,
  selectedKeys: AcquisitionChannelKey[],
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): string | null {
  const def = acquisitionChannelByKey(key, channels);
  if (def.comingSoon) return null;
  const liveSelected = selectedKeys.filter(
    (k) => !acquisitionChannelByKey(k, channels).comingSoon,
  );
  if (liveSelected.length > 1) return null;
  if (!liveSelected.includes(key)) return null;
  return "This is the only channel we can run for you today, so it stays on.";
}
