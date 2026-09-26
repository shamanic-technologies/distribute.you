"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MaturityBadge } from "@/components/maturity-badge";
import { getCampaign } from "@/lib/api";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import {
  canFollowUpNow,
  followupNotice,
  leadFollowup,
  type FollowupFix,
} from "@/lib/lead-followup";
import type { LeadHistory } from "@/lib/lead-history";
import { tenantBasePath } from "@/lib/offer-path";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { useFollowUpNow } from "@/lib/use-lead-followup";

/**
 * What we owe this person next, at the foot of their timeline.
 *
 * The timeline says what already happened; this says what is about to. Without it a
 * reader who has just seen a prospect answer has no way to tell whether the reply is
 * being handled in an hour or in nine days, and no way to bring it forward.
 *
 * CAMPAIGN-scoped by construction — only the two campaign-scoped timelines mount it. The
 * debt belongs to the (person, campaign) pair, so on the brand-wide roll-up there would be
 * several due dates behind one sentence and the button would not know which one it moves.
 */
export function LeadNextFollowup({
  history,
  leadRowId,
}: {
  history: LeadHistory;
  /** The `leads_campaigns` row this timeline is about — what the write is keyed on. */
  leadRowId: string;
}) {
  const followup = leadFollowup(history);
  // The line is GA; bringing the follow-up forward is beta. It writes an email to a
  // prospect ahead of schedule, so it stays with the beta cohort until it has run.
  const isBeta = useIsBetaUser();
  const { mutate, isPending, isError, error } = useFollowUpNow(leadRowId);
  // What the person just asked for, held locally over the round trip. Both calls take a
  // moment (the write, then the re-read of the history it invalidates), and for both of
  // them the line renders exactly as it did before the press — which reads as a dead
  // button. Dropped as soon as the producer answers, so nothing here can outlive a
  // refusal.
  const [asked, setAsked] = useState(false);

  const notice = followupNotice(followup);
  const line = asked && !isError ? "Next follow-up due now" : notice.line;
  const channels = useAcquisitionChannels();
  const channelName = (slug: string | null) =>
    slug ? (acquisitionChannelForFeatureSlug(slug, channels)?.name ?? channelSlugLabel(slug)) : null;
  const answeredBy =
    followup.state === "scheduled" && followup.answerer?.state === "answered"
      ? channelName(followup.answerer.answeredByFeatureSlug)
      : null;

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
      <div className="min-w-0">
        <p
          className={`text-xs ${notice.tone === "warning" ? "font-medium text-amber-700" : "truncate text-gray-500"}`}
        >
          {line}
          {answeredBy && <span className="text-gray-400"> by {answeredBy}</span>}
        </p>
        {notice.detail && <p className="text-[11px] text-gray-500">{notice.detail}</p>}
        {notice.fix && (
          <FollowupFixLink
            fix={notice.fix}
            campaignId={history.campaignId}
            brandId={history.brandId}
            channelName={notice.fix.kind === "start" ? channelName(notice.fix.featureSlug) : null}
          />
        )}
        {/* WHY the sequence ended, in the producer's own words. A bare "no further
            follow-ups" reads as something broken; "they booked a meeting" does not. */}
        {followup.state === "stopped" && followup.reason && (
          <p className="truncate text-[11px] text-gray-400">{followup.reason}</p>
        )}
        {isError && (
          <p className="text-[11px] text-red-600">{error?.message ?? "Could not move it."}</p>
        )}
      </div>
      {/* Never offered on a stopped schedule: it ended because the prospect booked, opted
          out, or answered, so a control offering to write to them anyway offers the one
          thing that state exists to prevent. Absent rather than present-and-refusing. */}
      {isBeta && canFollowUpNow(followup) && (
        <button
          type="button"
          onClick={() => {
            setAsked(true);
            mutate(undefined, { onError: () => setAsked(false) });
          }}
          disabled={isPending}
          className={`inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 ${
            isPending ? "cursor-wait" : "hover:bg-gray-50 disabled:opacity-40"
          }`}
        >
          {isPending ? "Moving..." : "Follow up now"}
          <MaturityBadge level="beta" />
        </button>
      )}
    </div>
  );
}

/**
 * Where the customer fixes a follow-up nobody will answer: the offer's own Settings,
 * where each channel carries its start switch. The customer decides; nothing here starts,
 * funds or spends anything.
 *
 * The link is built from the CAMPAIGN's own offer (the key every campaign surface already
 * polls), never the route: a brand-scoped reader has no offer in its URL. No offer we can
 * name means no link rather than one that 404s.
 */
function FollowupFixLink({
  fix,
  campaignId,
  brandId,
  channelName,
}: {
  fix: FollowupFix;
  campaignId: string;
  brandId: string;
  channelName: string | null;
}) {
  const params = useParams<{ orgId?: string }>();
  const orgId = params?.orgId ?? null;
  const { data } = useAuthQuery(["campaign", campaignId], () => getCampaign(campaignId), {
    enabled: Boolean(orgId),
  });
  const offerId = data?.campaign.offerId ?? null;
  if (!orgId || !offerId) return null;
  const label =
    fix.kind === "restart"
      ? "Turn it back on in offer settings"
      : channelName
        ? `Start ${channelName} in offer settings`
        : "Start the channel that answers them";
  return (
    <Link
      href={`${tenantBasePath(orgId, brandId, offerId)}/settings`}
      className="text-[11px] font-medium text-brand-600 hover:underline"
    >
      {label}
    </Link>
  );
}
