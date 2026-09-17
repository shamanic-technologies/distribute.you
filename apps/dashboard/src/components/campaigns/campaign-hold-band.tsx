"use client";

import Link from "next/link";

import { listCampaignEvents } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  CAMPAIGN_HOLD_EVENTS,
  campaignHoldCopy,
  readCampaignHold,
} from "@/lib/campaign-hold";

/**
 * Why this campaign is not running, on the campaign's own page, in plain language.
 *
 * A campaign that reads `ongoing` can be correctly suspended by the backend for hours,
 * and every cause looked the same on screen: spent today's budget, never funded, out of
 * credit, broken on our side. Three of those the customer can act on in one click and the
 * fourth is ours to fix, so telling them apart is the whole point.
 *
 * Renders NOTHING on a healthy campaign, and nothing on a paused one — the status pill
 * beside the heading already says a paused campaign is not running, and a band repeating
 * it would be one screen answering one question twice.
 *
 * The verdict comes off campaign-service and nothing else (`lib/campaign-hold.ts`); this
 * component only asks for the events and renders the sentence.
 */
export function CampaignHoldBand({
  campaignId,
  orgId,
  campaignBasePath,
  paused,
}: {
  campaignId: string;
  orgId: string;
  /** `.../offers/:offerId/campaigns/:id`, for the budget link. */
  campaignBasePath: string;
  /** The campaign's own status. A paused campaign states itself on the pill. */
  paused: boolean;
}) {
  const { data } = useAuthQuery(
    ["campaignHold", campaignId],
    // 25 events is plenty: a campaign under a hold emits nothing else, because the two
    // causes are exclusive by construction. A scheduler hold means the run never starts,
    // so it produces no gate checks at all; a credit refusal happens inside a run, so
    // every gate check it produces is the refusal. A healthy campaign's page of passed
    // gate checks simply resolves to no hold.
    () => listCampaignEvents(campaignId, { event: CAMPAIGN_HOLD_EVENTS, limit: 25 }),
    { ...pollOptions, enabled: !paused },
  );

  if (paused) return null;
  const hold = data ? readCampaignHold(data.events) : null;
  if (!hold) return null;

  const copy = campaignHoldCopy(hold);
  const href =
    copy.action === "campaign_budget"
      ? `${campaignBasePath}/settings`
      : copy.action === "billing"
        ? `/orgs/${orgId}/billing`
        : null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-800">{copy.headline}</p>
      <p className="mt-1 text-sm text-amber-700">{copy.body}</p>
      {href && copy.actionLabel ? (
        <Link
          href={href}
          className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:no-underline"
        >
          {copy.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
