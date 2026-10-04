"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferUserFields } from "@/lib/api";
import { formatCount } from "@/lib/format-number";
import { SINCE_INCEPTION } from "@/lib/revenue-window";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2OfferChannelHref, v2OfferHref, type V2ChannelTab } from "@/lib/v2/routes";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { useBrandRevenueWindow, useBucketCounts } from "@/components/v2/data";
import { ColdEmailChannelSettings, giveListsFrom } from "@/components/v2/offer-channels-page";
import { PeoplePage } from "@/components/v2/people-page";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { useAudienceTable } from "@/components/v2/use-audience-table";
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
        <ColdEmailOverview
          brandId={brandId}
          offerId={offerId}
          tabHref={(t) => v2OfferChannelHref(orgId, brandId, offerId, channelSlug, t)}
        />
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
 * What cold email did: its sending since inception (features-service, the same figures as
 * Today) and where the people it reached stand (lead-service's served bucket counts).
 * Every figure is served; a bar's length is only the count drawn against Contacted.
 * Delivered and Interested are lead-service's PEOPLE counts (`people`): a person can visit
 * AND reply, so the Interested total is its distinct count, never the two buckets added.
 */
export function ColdEmailOverview({
  brandId,
  offerId,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  tabHref: (tab: V2ChannelTab) => string;
}) {
  const win = useBrandRevenueWindow(brandId, SINCE_INCEPTION);
  const emails = win.data?.emails ?? null;
  const buckets = useBucketCounts(brandId);
  const counts = buckets.data?.counts ?? null;
  const people = buckets.data?.people ?? null;
  const countsSettled = buckets.isFetchedAfterMount || buckets.data !== undefined;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Since you started</span>}>Sending</SectionTitle>
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

      {/* Where people stand: one card at 2/3, one vertical bar per step; the tabs' summaries at 1/3 (owner 2026-10-04). */}
      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section>
        <SectionTitle>People</SectionTitle>
        <div className="k-card p-4">
          {!countsSettled ? (
            <Shimmer className="h-[200px] w-full rounded-[8px]" />
          ) : !counts ? (
            <EmptyNote>Could not read where people stand. Retrying.</EmptyNote>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <StepBar label="Contacted" count={counts.contacted} of={counts.contacted} />
                <StepBar label="Delivered" count={people?.delivered ?? null} of={counts.contacted} />
                <InterestedBar total={people?.interested ?? null} visits={counts.website_visit} replies={counts.positive_reply} of={counts.contacted} />
                <StepBar label="Meeting booked" count={counts.meeting_booked} of={counts.contacted} />
                <StepBar label="Meeting attended" count={counts.meeting_attended} of={counts.contacted} />
                <StepBar label="Paid client" count={counts.sale} of={counts.contacted} />
              </div>
              <div className="k-fg3 mt-4 flex gap-4 text-[12px] tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--data-teal)]" aria-hidden="true" />
                  Website visit {formatCount(counts.website_visit)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  Positive reply {formatCount(counts.positive_reply)}
                </span>
              </div>
            </>
          )}
        </div>
      </section>
      <TabSummaries brandId={brandId} offerId={offerId} contacted={counts?.contacted ?? null} replies={counts?.positive_reply ?? null} countsSettled={countsSettled} tabHref={tabHref} />
      </div>
    </div>
  );
}

/**
 * One short card per other tab (Inbox, Sent, Targeting, Settings): its served headline and
 * a link to the tab. The reads are the tabs' own query keys, so opening a tab paints at once.
 */
function TabSummaries({
  brandId,
  offerId,
  contacted,
  replies,
  countsSettled,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  contacted: number | null;
  replies: number | null;
  countsSettled: boolean;
  tabHref: (tab: V2ChannelTab) => string;
}) {
  const audiences = useAudienceTable({ offerId });
  const fields = useAuthQuery(["offerUserFields", brandId, offerId], () => getOfferUserFields(brandId, offerId), {
    ...pollOptions,
    enabled: !!brandId && !!offerId,
  });
  const give = giveListsFrom(fields.data?.fields);
  const fieldsSettled = fields.isFetchedAfterMount || fields.data !== undefined;

  return (
    <section>
      <SectionTitle>At a glance</SectionTitle>
      <div className="flex flex-col gap-3">
        <SummaryCard label="Inbox" href={tabHref("inbox")} loading={!countsSettled} value={replies} unit={replies === 1 ? "positive reply" : "positive replies"} />
        <SummaryCard label="Sent" href={tabHref("sent")} loading={!countsSettled} value={contacted} unit={contacted === 1 ? "person emailed" : "people emailed"} />
        <SummaryCard
          label="Targeting"
          href={tabHref("targeting")}
          loading={audiences.activeTabLoading}
          value={audiences.activeTabRows}
          unit={audiences.activeTabRows === 1 ? "audience" : "audiences"}
        />
        <SummaryCard
          label="Settings"
          href={tabHref("settings")}
          loading={!fieldsSettled}
          value={give ? give.giveForFree.length : null}
          unit="we give free"
          sub={give ? `${give.neverGive.length} we never give` : null}
        />
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  href,
  loading,
  value,
  unit,
  sub,
}: {
  label: string;
  href: string;
  loading: boolean;
  value: number | null;
  unit: string;
  sub?: string | null;
}) {
  return (
    <div className="k-card px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="k-label">{label}</span>
        <Link href={href} className="k-fg3 text-[12px] hover:text-[var(--fg-1)]">
          See more →
        </Link>
      </div>
      <div className="mt-1">
        {loading ? <Shimmer className="h-7 w-24" /> : <Figure value={value === null ? <span className="k-fg4">{"—"}</span> : formatCount(value)} unit={unit} sub={sub} />}
      </div>
    </div>
  );
}

/** A bar's drawn height: the count against Contacted, never below a visible sliver. */
function barHeight(count: number, of: number): string {
  if (of <= 0 || count <= 0) return "0%";
  return `${Math.max(1.5, Math.min(100, (count * 100) / of))}%`;
}

function BarColumn({ label, value, children }: { label: string; value: number | null; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      {value === null ? (
        <span className="k-fg4 text-[13px]">{"—"}</span>
      ) : (
        <span className="text-[13px] font-medium tabular-nums">{formatCount(value)}</span>
      )}
      <div className="k-inset flex h-[140px] w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-[6px]">{children}</div>
      <span className="k-fg2 h-8 text-center text-[11px] leading-4">{label}</span>
    </div>
  );
}

function StepBar({ label, count, of }: { label: string; count: number | null; of: number }) {
  return (
    <BarColumn label={label} value={count}>
      <div className="w-full bg-[var(--accent)]" style={{ height: barHeight(count ?? 0, of) }} />
    </BarColumn>
  );
}

/** Interested: positive replies stacked on website visits, labelled with the distinct total lead-service serves. */
function InterestedBar({ total, visits, replies, of }: { total: number | null; visits: number; replies: number; of: number }) {
  return (
    <BarColumn label="Interested" value={total}>
      <div className="w-full bg-[var(--accent)]" style={{ height: barHeight(replies, of) }} />
      <div className="w-full bg-[var(--data-teal)]" style={{ height: barHeight(visits, of) }} />
    </BarColumn>
  );
}
