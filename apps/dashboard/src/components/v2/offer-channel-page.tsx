"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getCampaignRevenueWindow, getLeadBucketCounts, getOfferUserFields, listCampaignsByBrand } from "@/lib/api";
import { legCampaignId } from "@/lib/v2/leg-campaign";
import { formatCount } from "@/lib/format-number";
import { SINCE_INCEPTION, type RevenueWindow } from "@/lib/revenue-window";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { OUTBOUND_LEG_TO_CONVERSATION, OUTBOUND_LEG_TO_WEBSITE_VISIT } from "@/lib/outbound-leg-key";
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

// A rate that rounds to 0.0% but is not zero reads "<0.1%", never a false 0.0%.
const pct = (v: number) => (v > 0 && v < 0.05 ? "<0.1%" : `${v < 10 || v > 99 ? v.toFixed(1) : Math.round(v)}%`);

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
        { label: "Outbound", href: v2OfferHref(orgId, brandId, offerId, "sales-path") },
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
          channelSlug={channelSlug}
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

/** The two legs cold email works, each drawn as its own steps, stopping at its outcome. */
export const LEG_STEPS = [
  { legKey: OUTBOUND_LEG_TO_WEBSITE_VISIT, title: "Website visits", outcome: "Website visit", bucket: "website_visit" },
  { legKey: OUTBOUND_LEG_TO_CONVERSATION, title: "Positive replies", outcome: "Positive reply", bucket: "positive_reply" },
] as const;

/**
 * What cold email did: its sending since inception (features-service, the same figures as
 * Today) and, per leg, where the people it reached stand (lead-service's served bucket
 * counts, read on the leg's campaign). Every figure is served; a bar's length is only the
 * count drawn against Queued. People and Queued come first because one person gets
 * several emails: People counts persons, Queued and Sent count emails (every step).
 */
export function ColdEmailOverview({
  brandId,
  offerId,
  channelSlug,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  channelSlug: string;
  tabHref: (tab: V2ChannelTab) => string;
}) {
  const win = useBrandRevenueWindow(brandId, SINCE_INCEPTION);
  const emails = win.data?.emails ?? null;
  const queued = win.data?.queuedEmails ?? null;
  useEffect(() => {
    if (win.data?.queuedEmails === null) console.error("[cold-email overview] queued emails unreadable", { reason: win.data.queuedEmailsUnavailableReason });
  }, [win.data?.queuedEmails, win.data?.queuedEmailsUnavailableReason]);
  const buckets = useBucketCounts(brandId);
  const counts = buckets.data?.counts ?? null;
  const countsSettled = buckets.isFetchedAfterMount || buckets.data !== undefined;
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), { enabled: !!brandId });
  const campaigns = campaignsQ.data?.campaigns ?? null;
  const shownLegs = campaigns
    ? LEG_STEPS.flatMap((leg) => {
        const campaignId = legCampaignId(campaigns, offerId, leg.legKey);
        return campaignId ? [{ ...leg, campaignId }] : [];
      })
    : [];

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Since you started</span>}>Sending</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="People">
            {!countsSettled ? <Shimmer className="h-7 w-16" /> : <Figure value={counts ? formatCount(counts.contacted) : "—"} unit="people" />}
          </StatTile>
          {/* Emails waiting to go out right now, served by features-service (a snapshot, not a window figure). */}
          <StatTile label="Queued">
            {win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={queued != null ? formatCount(queued) : "—"} unit="emails" />}
          </StatTile>
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

      {/* One steps card per leg at 2/3, the tabs' summaries at 1/3 (owner 2026-10-04). */}
      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* A leg no campaign aims at gets no card (owner 2026-10-04). */}
        {campaigns === null && !campaignsQ.isError ? (
          <Shimmer className="h-[240px] w-full rounded-[12px]" />
        ) : (
          <div className={`grid gap-x-3 gap-y-8 ${shownLegs.length > 1 ? "md:grid-cols-2" : ""}`}>
            {shownLegs.map((leg) => (
              <LegSteps
                key={leg.legKey}
                brandId={brandId}
                featureSlug={channelSlug}
                title={leg.title}
                outcome={leg.outcome}
                bucket={leg.bucket}
                campaignId={leg.campaignId}
              />
            ))}
          </div>
        )}
        <TabSummaries
          brandId={brandId}
          offerId={offerId}
          sent={emails?.sent ?? null}
          sentPending={win.pending}
          replies={counts?.positive_reply ?? null}
          countsSettled={countsSettled}
          tabHref={tabHref}
        />
      </div>
    </div>
  );
}

/** One leg's steps: Queued, Sent, Delivered, then the leg's outcome, read on the leg's campaign (people). */
/**
 * One campaign's figures since it started, from features-service's campaign window (its own
 * spend, its email counts, the follow-ups provisioned). Every figure is served. The campaign
 * page's cards and the steps bars read the same key.
 */
export function useCampaignWindow(brandId: string, campaignId: string, featureSlug: string | null) {
  const slug = featureSlug ?? "";
  const q = useAuthQuery(
    ["campaignRevenueWindow", campaignId, slug, SINCE_INCEPTION],
    () => getCampaignRevenueWindow(slug, brandId, campaignId, SINCE_INCEPTION),
    { ...pollOptions, enabled: !!slug },
  );
  return { data: (q.data ?? null) as RevenueWindow | null, pending: q.data === undefined && !q.isError };
}

/**
 * A leg's steps as bars. Queued, Sent and Delivered count EMAILS, every step of a sequence
 * (owner 2026-10-06: "the bar charts must reflect the emails not the contacts"), off the
 * campaign window; the outcome is lead-service's count of people. Queued is the emails
 * waiting RIGHT NOW (a snapshot, not a total above Sent), so the bars share the tallest as
 * their scale rather than Queued's.
 */
export function LegSteps({
  brandId,
  featureSlug,
  title,
  outcome,
  bucket,
  campaignId,
}: {
  brandId: string;
  featureSlug: string | null;
  title: string;
  /** Null on a leg whose outcome lead-service counts no bucket for: the steps stop at Delivered. */
  outcome: string | null;
  bucket: "website_visit" | "positive_reply" | null;
  campaignId: string;
}) {
  const q = useAuthQuery(["leadBucketCounts", `campaign:${campaignId}`, ""], () => getLeadBucketCounts({ campaignId }, {}), pollOptions);
  const counts = q.data?.counts ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const win = useCampaignWindow(brandId, campaignId, featureSlug);
  const queued = win.data?.queuedEmails ?? null;
  const sent = win.data?.emails?.sent ?? null;
  const delivered = win.data?.emails?.delivered ?? null;
  const outcomes = outcome && bucket && counts ? counts[bucket] : null;
  const scale = Math.max(queued ?? 0, sent ?? 0, delivered ?? 0, outcomes ?? 0);

  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="k-card p-4">
        {!settled || win.pending ? (
          <Shimmer className="h-[200px] w-full rounded-[8px]" />
        ) : !counts && !win.data ? (
          <EmptyNote>Could not read this campaign&apos;s emails. Retrying.</EmptyNote>
        ) : (
          <div className="flex items-end gap-3">
            <StepBar label="Queued" count={queued} of={scale} />
            <StepBar label="Sent" count={sent} of={scale} />
            <StepBar label="Delivered" count={delivered} of={scale} />
            {outcome && bucket && <StepBar label={outcome} count={outcomes} of={scale} />}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One short card per other tab (Inbox, Sent, Targeting, Settings): its served headline and
 * a link to the tab. The reads are the tabs' own query keys, so opening a tab paints at once.
 */
function TabSummaries({
  brandId,
  offerId,
  sent,
  sentPending,
  replies,
  countsSettled,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  sent: number | null;
  sentPending: boolean;
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
        <SummaryCard label="Sent" href={tabHref("sent")} loading={sentPending} value={sent} unit={sent === 1 ? "email sent" : "emails sent"} />
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

export function SummaryCard({
  label,
  href,
  loading,
  value,
  unit,
  sub,
  text,
}: {
  label: string;
  href: string;
  loading: boolean;
  value: number | null;
  unit: string;
  sub?: string | null;
  /** A figure that is not a count (a budget), already formatted; replaces `value`. */
  text?: string | null;
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
        {loading ? <Shimmer className="h-7 w-24" /> : <Figure value={text ?? (value === null ? <span className="k-fg4">{"—"}</span> : formatCount(value))} unit={unit} sub={sub} />}
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

export function StepBar({ label, count, of }: { label: string; count: number | null; of: number }) {
  return (
    <BarColumn label={label} value={count}>
      <div className="w-full bg-[var(--accent)]" style={{ height: barHeight(count ?? 0, of) }} />
    </BarColumn>
  );
}
