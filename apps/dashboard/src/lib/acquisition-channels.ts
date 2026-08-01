// The channels a brand can acquire buyers through. A channel is WHERE we go to
// find them; a sales funnel (see `sales-funnels.ts`) is what happens once one of
// them lands. The two are separate models on purpose: the same funnel can be fed
// by cold email today and by paid clicks later.
//
// Only one channel is live today, so the section STATES what we run for a brand
// rather than asking it to choose. brand-service stores no channel selection, so
// a control here would take the answer and persist none of it; the choice
// arrives the day there is a field to write it to.
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

/**
 * The channels we run today come FIRST, in their declared order, then the ones
 * that are coming. A channel we can run and one we cannot are two different
 * kinds of row, so they are two groups rather than one list with a marker on
 * some of its members.
 */
export function partitionChannelsByAvailability(
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): { live: AcquisitionChannelDef[]; comingSoon: AcquisitionChannelDef[] } {
  return {
    live: channels.filter((c) => !c.comingSoon),
    comingSoon: channels.filter((c) => c.comingSoon),
  };
}
