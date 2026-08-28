"use client";

/**
 * WHICH CHANNEL a surface is about — the campaign's own, whenever a campaign is open.
 *
 * A campaign is (offer x funnel x channel), and campaign-service states the channel on
 * the row as its `featureSlug`. `useSoleFeatureSlug()` answers a different question: it
 * returns the brand's ONE GA feature, which is right for a brand-scoped surface and
 * silently wrong the moment a campaign on any other channel is open. The failure is not
 * a blank screen — every read fires, every figure is real, and the page simply describes
 * a channel the reader is not looking at:
 *
 *   - a campaign row filtered by `featureSlug === soleSlug` does not contain the open
 *     campaign at all, so a surface deriving the funnel from those rows derives nothing
 *     and renders no funnel-scoped section whatsoever;
 *   - `/revenue?campaignId=` fired under the sole slug answers for the wrong channel's
 *     money, so the stat row above states one channel's spend under another's name.
 *
 * Measured on the brand that surfaced it: a `feedback-request-cold-email-outreach`
 * campaign whose Leads page fetched `sales-cold-email-outreach` throughout and drew no
 * "Funnel progress" section on any lead. The campaign Overview had already been fixed
 * (it reads `campaign?.featureSlug`); this is the same narrowing, in one place, so the
 * surfaces that share a screen cannot state different channels.
 *
 * The read is the key the campaign Overview, the top bar and the Audiences page ALREADY
 * poll, so every consumer of this hook costs no request.
 */

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getCampaign, type Campaign } from "@/lib/api";
import { useSoleFeatureSlug } from "@/lib/sole-feature";

export interface ScopedFeatureSlug {
  /** The open campaign, or null off a campaign route / before the read lands. */
  campaign: Campaign | null;
  /**
   * The channel this surface is about: the campaign's own when one is open, the brand's
   * sole GA feature otherwise.
   *
   * NULL while a campaign read is in flight or errored — never the sole slug as a
   * stand-in. A read fired under a guessed channel lands in that channel's cache entry
   * and answers about somebody else's money, which is the bug this hook exists to close.
   */
  featureSlug: string | null;
  /**
   * Whether the answer above is final. Reveal-on-settle: an ERRORED campaign read is
   * settled, so a surface gating a one-shot latch on it cannot hang forever.
   */
  settled: boolean;
}

export function useScopedFeatureSlug(campaignId?: string): ScopedFeatureSlug {
  const soleFeatureSlug = useSoleFeatureSlug();
  const campaignScoped = Boolean(campaignId);
  const { data, isPending, isError } = useAuthQuery(
    ["campaign", campaignId ?? "none"],
    () => getCampaign(campaignId as string),
    { ...pollOptions, enabled: campaignScoped },
  );
  const campaign = data?.campaign ?? null;
  return {
    campaign,
    featureSlug: campaignScoped ? campaign?.featureSlug ?? null : soleFeatureSlug,
    settled: campaignScoped ? !isPending || isError : true,
  };
}
