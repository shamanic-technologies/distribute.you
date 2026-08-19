// Which mark a channel wears in the constellation.
//
// The rule is OWNERSHIP, not taste, and it is the same one the dashboard's
// acquisition-channels card follows. A channel we run on somebody else's
// platform wears that platform's REAL logo, fetched by domain, because a
// provider mark is never ours to redraw and this repo does not hand-roll
// provider SVGs. A channel that is OURS wears OUR mark, because it is ours.
//
// The join is a display lookup — slug to a logo domain — which is the one kind
// of client-side join this codebase allows. It derives no figure.
//
// A slug with no entry falls through to our own mark rather than to a broken
// image: a channel published tomorrow renders correctly with no edit here, just
// without a borrowed logo until someone adds one.

/** Channels run on a platform whose logo is the honest mark for them. */
const VENDOR_DOMAINS: Record<string, string> = {
  // Paid reach
  "google-ads": "google.com",
  "meta-ads": "meta.com",
  "linkedin-ads": "linkedin.com",
  "tiktok-ads": "tiktok.com",
  "youtube-ads": "youtube.com",
  "x-ads": "x.com",
  "reddit-ads": "reddit.com",
  "bing-ads": "bing.com",
  "quora-ads": "quora.com",
  "paid-directory-listings": "g2.com",
  // Outbound on somebody else's network
  "cold-linkedin-outreach": "linkedin.com",
  "cold-x-outreach": "x.com",
  "cold-instagram-outreach": "instagram.com",
  "cold-reddit-outreach": "reddit.com",
  "cold-whatsapp-outreach": "whatsapp.com",
  // Publishing on somebody else's network
  "organic-linkedin-publishing": "linkedin.com",
  "organic-x-publishing": "x.com",
  "organic-reddit-publishing": "reddit.com",
  "organic-youtube-publishing": "youtube.com",
};

export type ChannelMark =
  | { kind: "vendor"; domain: string }
  | { kind: "own" };

/**
 * A channel's mark. A channel we run ourselves wears OUR mark — it is ours, and
 * that is the whole distinction this map encodes. A two-letter contraction was
 * tried and dropped: "FR" for Feedback Request reads as a country code, and an
 * abbreviation of our own naming is not a mark, it is something to decode.
 */
export function channelMark(slug: string): ChannelMark {
  const domain = VENDOR_DOMAINS[slug];
  if (domain) return { kind: "vendor", domain };
  return { kind: "own" };
}

/** Our own mark, for the channels that are ours. */
export const OWN_MARK_SRC = "/landing/logo/logo-distribute.svg";

/**
 * The image URL for a vendor mark. Returns null with no token, so the caller
 * falls back to our own mark rather than emitting a URL that 401s — a broken
 * image on the constellation reads as a channel we cannot actually run.
 */
export function vendorLogoUrl(
  domain: string,
  size: number,
  token: string | undefined = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN,
): string | null {
  if (!token) return null;
  // Twice the rendered size, for retina.
  return `https://img.logo.dev/${domain}?token=${token}&size=${size * 2}`;
}
