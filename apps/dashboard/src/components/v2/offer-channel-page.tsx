"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatCount } from "@/lib/format-number";
import { TODAY_WINDOWS, type TodayWindow } from "@/lib/revenue-window";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2OfferChannelHref, v2OfferHref, type V2ChannelTab } from "@/lib/v2/routes";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { useBrandRevenueWindow, useBucketCounts } from "@/components/v2/data";
import { ColdEmailChannelSettings } from "@/components/v2/offer-channels-page";
import { PeoplePage } from "@/components/v2/people-page";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { V2Page, useOfferName, type V2Tab } from "@/components/v2/setup-pages";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";

const CHANNEL_TABS: { key: V2ChannelTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "targeting", label: "Targeting" },
  { key: "settings", label: "Settings" },
];

const pct = (v: number) => `${v < 10 || v > 99 ? v.toFixed(1) : Math.round(v)}%`;

/**
 * One channel of an offer, opened from the offer's Channels table. Cold email is the only
 * channel with a page today: its stats, its inbox and sent lists, who it targets and its
 * settings, one tab each.
 */
export function V2OfferChannelPage() {
  const { orgId, brandId, offerId, channelSlug } = useParams<{ orgId: string; brandId: string; offerId: string; channelSlug: string }>();
  const params = useSearchParams();
  const name = useOfferName(brandId, offerId);
  const def = useAcquisitionChannels().find((c) => c.featureSlug === channelSlug);
  const tab = CHANNEL_TABS.find((t) => t.key === params.get("tab"))?.key ?? "overview";
  const channelName = def?.name ?? channelSlug;

  const tabs: V2Tab[] = CHANNEL_TABS.map((t) => ({
    label: t.label,
    href: v2OfferChannelHref(orgId, brandId, offerId, channelSlug, t.key),
    active: t.key === tab,
  }));

  return (
    <V2Page
      crumbs={[
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Channels", href: v2OfferHref(orgId, brandId, offerId, "channels") },
        { label: channelName },
      ]}
      title={
        <span className="flex items-center gap-2.5">
          {def && <AcquisitionChannelMark def={def} size="sm" />}
          {channelName}
        </span>
      }
      tabs={isColdEmailChannel(channelSlug) ? tabs : undefined}
      width="max-w-[1280px]"
    >
      {!isColdEmailChannel(channelSlug) ? (
        <div className="k-card">
          <EmptyNote>This channel has no page yet.</EmptyNote>
        </div>
      ) : tab === "overview" ? (
        <ColdEmailOverview brandId={brandId} />
      ) : tab === "inbox" ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="positive_reply" />
        </div>
      ) : tab === "sent" ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="contacted" />
        </div>
      ) : tab === "targeting" ? (
        <V2AudiencesTable offerId={offerId} />
      ) : (
        <ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={channelSlug} />
      )}
    </V2Page>
  );
}

/**
 * What cold email did: its sending over the window (features-service, the same figures as
 * Today) and where the people it reached stand (lead-service's served bucket counts).
 * Every figure is served; a bar's length is only the count drawn against Contacted.
 * Delivered and Interested are lead-service's PEOPLE counts (`people`): a person can visit
 * AND reply, so the Interested total is its distinct count, never the two buckets added.
 */
export function ColdEmailOverview({ brandId }: { brandId: string }) {
  const [windowDays, setWindowDays] = useState<TodayWindow>(7);
  const win = useBrandRevenueWindow(brandId, windowDays);
  const emails = win.data?.emails ?? null;
  const buckets = useBucketCounts(brandId);
  const counts = buckets.data?.counts ?? null;
  const people = buckets.data?.people ?? null;
  const countsSettled = buckets.isFetchedAfterMount || buckets.data !== undefined;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-1.5" role="group" aria-label="Window">
              {TODAY_WINDOWS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={windowDays === d}
                  onClick={() => setWindowDays(d)}
                  className={windowDays === d ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
                >
                  {d} days
                </button>
              ))}
            </span>
          }
        >
          Sending
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Sent">
            {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={emails ? formatCount(emails.sent) : "—"} unit="emails" />}
          </StatTile>
          <StatTile label="Delivered">
            {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={emails ? formatCount(emails.delivered) : "—"} unit="emails" />}
          </StatTile>
          <StatTile label="Delivery rate">
            {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={emails?.deliveryRatePct != null ? pct(emails.deliveryRatePct) : "—"} />}
          </StatTile>
          <StatTile label="Bounced">
            {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={emails ? formatCount(emails.bounced) : "—"} unit="emails" />}
          </StatTile>
        </div>
      </section>

      <section>
        <SectionTitle>People</SectionTitle>
        <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {!countsSettled ? (
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="px-4 py-3">
                <Shimmer className="h-5 w-full" />
              </div>
            ))
          ) : !counts ? (
            <EmptyNote>Could not read where people stand. Retrying.</EmptyNote>
          ) : (
            <>
              <StepRow label="Contacted" count={counts.contacted} of={counts.contacted} />
              <StepRow label="Delivered" count={people?.delivered ?? null} of={counts.contacted} />
              <InterestedRow total={people?.interested ?? null} visits={counts.website_visit} replies={counts.positive_reply} of={counts.contacted} />
              <StepRow label="Meeting booked" count={counts.meeting_booked} of={counts.contacted} />
              <StepRow label="Meeting attended" count={counts.meeting_attended} of={counts.contacted} />
              <StepRow label="Paid client" count={counts.sale} of={counts.contacted} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** A bar's drawn length: the count against Contacted, never below a visible sliver. */
function barWidth(count: number, of: number): string {
  if (of <= 0 || count <= 0) return "0%";
  return `${Math.max(1, Math.min(100, (count * 100) / of))}%`;
}

function StepRow({ label, count, of }: { label: string; count: number | null; of: number }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)_80px] items-center gap-4 px-4 py-3">
      <span className="text-[13px]">{label}</span>
      <span className="k-inset block h-2 overflow-hidden rounded-full">
        <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: barWidth(count ?? 0, of) }} />
      </span>
      {count === null ? (
        <span className="k-fg4 text-right text-[13px]">{"—"}</span>
      ) : (
        <span className="text-right text-[13px] font-medium tabular-nums">{formatCount(count)}</span>
      )}
    </div>
  );
}

function InterestedRow({ total, visits, replies, of }: { total: number | null; visits: number; replies: number; of: number }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)_80px] items-center gap-4 px-4 py-3">
      <span className="text-[13px]">Interested</span>
      <span className="space-y-1">
        <span className="k-inset flex h-2 overflow-hidden rounded-full">
          <span className="block h-full bg-[var(--data-teal)]" style={{ width: barWidth(visits, of) }} />
          <span className="block h-full bg-[var(--accent)]" style={{ width: barWidth(replies, of) }} />
        </span>
        <span className="k-fg3 flex gap-4 text-[12px] tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--data-teal)]" aria-hidden="true" />
            Website visit {formatCount(visits)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            Positive reply {formatCount(replies)}
          </span>
        </span>
      </span>
      {total === null ? (
        <span className="k-fg4 text-right text-[13px]">{"—"}</span>
      ) : (
        <span className="text-right text-[13px] font-medium tabular-nums">{formatCount(total)}</span>
      )}
    </div>
  );
}
