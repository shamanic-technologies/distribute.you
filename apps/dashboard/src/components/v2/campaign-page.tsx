"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getConversationCounts, getLeadBucketCounts } from "@/lib/api";
import { type RevenueWindow } from "@/lib/revenue-window";
import { formatCentsAsUsdAdaptive, formatCount } from "@/lib/format-number";
import { shownFigure, shownReturn } from "@/lib/maturity";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useStaffMode } from "@/lib/use-staff-mode";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { campaignNameFor, stepPluralLabel } from "@/lib/legs";
import { isProactiveFrom, sameLegKey } from "@/lib/outbound-leg-key";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { v2CampaignHref, v2Href, v2OfferHref, type V2CampaignTab } from "@/lib/v2/routes";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { CampaignRoiChart } from "@/components/v2/campaign-roi-chart";
import { CampaignWorkflowsPage } from "@/components/workflows/campaign-workflows-page";
import { useCampaigns, type V2Campaign } from "@/components/v2/use-campaigns";
import { LEG_STEPS, LegSteps, StepBar, SummaryCard, useCampaignWindow } from "@/components/v2/offer-channel-page";
import { ColdEmailChannelSettings } from "@/components/v2/offer-channels-page";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { PeoplePage } from "@/components/v2/people-page";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { useAudienceTable } from "@/components/v2/use-audience-table";
import { StaffOnly } from "@/components/v2/staff-only";
import { StatBasisSwitch } from "@/components/v2/stat-basis-switch";
import { V2Page, type V2Tab } from "@/components/v2/setup-pages";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { FunnelCampaignPage, FunnelPartOf, useFunnelCampaignById, useFunnelCapsWords } from "@/components/v2/funnel-campaigns";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { CampaignHoldNote, useCampaignHold } from "@/components/v2/campaign-hold";
import { costToShowCents, roiToShow } from "@/lib/expected-return";

const CAMPAIGN_TABS: { key: V2CampaignTab; label: string; staff?: boolean }[] = [
  { key: "overview", label: "Overview" },
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "targeting", label: "Targeting" },
  { key: "settings", label: "Settings" },
  { key: "workflows", label: "Workflows", staff: true },
];

/**
 * `/campaigns/:campaignId`: a campaign that is a sales funnel (owner 2026-10-10) when the
 * brand's list holds that id, else the campaign page below. Waits for that list to answer
 * once (it is small and persisted), so neither page flashes "not found" for the other's id.
 */
export function V2CampaignRoute() {
  const { brandId, campaignId } = useParams<{ brandId: string; campaignId: string }>();
  const funnel = useFunnelCampaignById(brandId, campaignId);
  if (funnel.campaign) return <FunnelCampaignPage campaign={funnel.campaign} />;
  // Never WAITS on the funnel list (owner 2026-10-10: a campaign page must not block on it):
  // the campaign page starts its own reads at once; only its "not found" waits for the list.
  return <V2CampaignPage funnelListSettled={funnel.settled} />;
}

/**
 * One campaign (offer x leg x channel), opened from the sidebar's Campaigns. The channel
 * page's anatomy and tabs, every read narrowed to this campaign: lead-service resolves its
 * id to the whole campaign identity (its ancestors included), the audience table and the
 * settings take it as their scope, and its money is the campaign row's own served group.
 */
export function V2CampaignPage({ funnelListSettled = true }: { funnelListSettled?: boolean } = {}) {
  const { orgId, brandId, campaignId } = useParams<{ orgId: string; brandId: string; campaignId: string }>();
  const params = useSearchParams();
  const { staffMode } = useStaffMode();
  const { settled, campaignById } = useCampaigns(orgId, brandId, { allOffers: true });
  const campaign = campaignById.get(campaignId) ?? null;
  // The live row of the identity: a link naming an ancestor row still lands on today's campaign.
  const id = campaign?.row.campaign.id ?? campaignId;
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const c = campaign?.row.campaign ?? null;
  const def = c ? channels.find((ch) => ch.featureSlug === c.featureSlug) : undefined;
  const name = c ? (campaignNameFor(catalogue, c.featureSlug, c.legKey)) : null;
  const shownName = name ?? campaign?.pipe.name ?? " ";
  // A PART of a sales-funnel campaign runs and pauses only with it (campaign-service 409s a
  // status or budget write on it): its page names that campaign instead of offering controls.
  const partOfId = c?.salesFunnelCampaignId ?? null;
  const partOf = useFunnelCampaignById(brandId, partOfId ?? "");

  const visible = CAMPAIGN_TABS.filter((t) => !t.staff || staffMode);
  const tab = visible.find((t) => t.key === params.get("tab"))?.key ?? "overview";
  const tabHref = (t: V2CampaignTab) => v2CampaignHref(orgId, brandId, id, t);
  const tabs: V2Tab[] = visible.map((t) => ({ label: t.label, href: tabHref(t.key), active: t.key === tab }));

  if (settled && !campaign && !funnelListSettled) {
    // The id may be a sales-funnel campaign whose list has not answered yet: no "not found" flash.
    return (
      <V2Page crumbs={[{ label: "Campaigns" }, { label: " " }]} title={<Shimmer className="h-8 w-56" />} width="max-w-[1280px]">
        <Shimmer className="h-[240px] w-full rounded-[12px]" />
      </V2Page>
    );
  }
  if (settled && !campaign) {
    return (
      <V2Page crumbs={[{ label: "Campaigns" }, { label: "Not found" }]}>
        <div className="k-card">
          <EmptyNote>This campaign does not exist on this brand.</EmptyNote>
        </div>
      </V2Page>
    );
  }

  const offerId = campaign?.offerId ?? null;
  return (
    <V2Page
      crumbs={
        offerId
          ? [
              { label: campaign?.offerName ?? "Offer", href: v2OfferHref(orgId, brandId, offerId) },
              // The campaign this part runs in (its max budget and volume), else the Campaigns
              // overview: never the staff Sales path page (owner 2026-10-10).
              partOfId
                ? { label: partOf.campaign?.salesFunnelName ?? "Campaign", href: v2CampaignHref(orgId, brandId, partOfId) }
                : { label: "Campaigns", href: v2Href(orgId, brandId, "campaigns") },
              { label: shownName },
            ]
          : [{ label: "Campaigns" }, { label: " " }]
      }
      title={
        campaign ? (
          <span className="flex min-w-0 items-center gap-2.5">
            {name && <PathAvatar name={name} size={32} />}
            <span className="truncate">{shownName}</span>
          </span>
        ) : (
          <Shimmer className="h-8 w-56" />
        )
      }
      sub={
        campaign ? (
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            {/* The leg read as a path, the channel standing on the arrow it performs:
                "Positive reply → [AI Meeting Booking] → Meeting booked"; an entry leg starts at the channel. */}
            {campaign.leg?.fromLabel && (
              <>
                <span className="k-fg2">{campaign.leg.fromLabel}</span>
                <span className="k-fg3">→</span>
              </>
            )}
            {def && (
              <span className="k-chip inline-flex items-center gap-1.5">
                <AcquisitionChannelMark def={def} size="xs" />
                {def.name}
              </span>
            )}
            {campaign.leg && (
              <>
                <span className="k-fg3">→</span>
                <span className="k-fg2">{campaign.leg.toLabel}</span>
              </>
            )}
          </span>
        ) : undefined
      }
      actions={
        campaign && partOfId ? (
          <FunnelPartOf orgId={orgId} campaign={partOf.campaign} />
        ) : campaign ? (
          <>
            <StatBasisSwitch />
            <CampaignControlsTrigger brandId={brandId} campaignId={id} />
          </>
        ) : undefined
      }
      tabs={campaign ? tabs : undefined}
      width="max-w-[1280px]"
    >
      {!campaign || !offerId ? (
        <Shimmer className="h-[240px] w-full rounded-[12px]" />
      ) : tab === "overview" && campaign.leg && !isProactiveFrom(campaign.leg.fromKey) ? (
        <ConversationOverview brandId={brandId} campaign={campaign} tabHref={tabHref} />
      ) : tab === "overview" ? (
        <CampaignOverview brandId={brandId} offerId={offerId} campaignId={id} campaign={campaign} tabHref={tabHref} />
      ) : tab === "inbox" ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="positive_reply" campaignId={id} />
        </div>
      ) : tab === "sent" ? (
        <div className="k-card overflow-hidden">
          <PeoplePage bucket="contacted" campaignId={id} />
        </div>
      ) : tab === "targeting" ? (
        <V2AudiencesTable campaignId={id} offerId={offerId} />
      ) : tab === "settings" ? (
        <div className="space-y-8">
          {/* The channel page's settings (give lists, rates per step). Its money is its campaign's
              caps, stated on that campaign's page (owner 2026-10-10): a part has no budget of its own. */}
          {c?.featureSlug && isColdEmailChannel(c.featureSlug) && (
            <ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={c.featureSlug} />
          )}
        </div>
      ) : (
        <StaffOnly>
          <div className="-mx-4 md:-mx-6">
            <CampaignWorkflowsPage campaignId={id} panel="drawer" staffGated />
          </div>
        </StaffOnly>
      )}
    </V2Page>
  );
}

/**
 * "Spent" is what was billed (cost status actual). The follow-ups RESERVED when a first
 * email went out and not sent yet stand on their own line, as the served provisioned
 * figure (2026-10-06: a client read "$67 spent" over 185 emails, part of it follow-ups
 * still to go; owner: "+$22 provisioned for follow-ups"). The browser subtracts nothing.
 */
export function SpentTile({ win }: { win: { data: RevenueWindow | null; pending: boolean } }) {
  const spend = win.data?.spend ?? null;
  const provisioned = spend?.provisionedSpentCents ?? null;
  return (
    <StatTile label="Spent">
      {win.pending ? (
        <Shimmer className="h-7 w-16" />
      ) : (
        <>
          <Figure value={spend ? formatCentsAsUsdAdaptive(spend.actualSpentCents) : "—"} />
          {provisioned != null && provisioned > 0 && (
            <p className="k-fg3 mt-1 text-[12px] leading-4">+{formatCentsAsUsdAdaptive(provisioned)} provisioned for follow-ups</p>
          )}
        </>
      )}
    </StatTile>
  );
}

/**
 * The campaign's ROI tile, first on both campaign kinds (cold email and answering), with the
 * expected (i) every ROI label carries. Green above break-even (lib/format-roi.ts roiIsGood).
 */
function RoiTile({ campaign }: { campaign: V2Campaign }) {
  const { basis } = useStatBasis();
  const roi = shownReturn(campaign.row.revenue?.economicsMaturity, basis);
  return (
    <StatTile label={<RoiLabel />}>
      <Figure value={<RoiValue roi={roiToShow(roi, campaign.row.revenue?.expectedReturn)} learning={roi.learning} />} />
    </StatTile>
  );
}

/**
 * What this campaign did, all served: where the people it reached stand (lead-service's
 * bucket counts on the campaign, people not emails), what it spent and what one outcome
 * cost (the campaign row's own revenue group, Learning where the producer says so). Then
 * the leg's steps at 2/3 and the other tabs' headlines at 1/3, as the channel page.
 */
function CampaignOverview({
  brandId,
  offerId,
  campaignId,
  campaign,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  campaignId: string;
  campaign: V2Campaign;
  tabHref: (tab: V2CampaignTab) => string;
}) {
  const { basis } = useStatBasis();
  const q = useAuthQuery(["leadBucketCounts", `campaign:${campaignId}`, ""], () => getLeadBucketCounts({ campaignId }, {}), pollOptions);
  const counts = q.data?.counts ?? null;
  const people = q.data?.people ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const audiences = useAudienceTable({ campaignId, offerId });
  const catalogue = useLegCatalogue();

  const leg = LEG_STEPS.find((l) => sameLegKey(l.legKey, campaign.row.campaign.legKey)) ?? null;
  const g = campaign.row.revenue ?? null;
  const replyLed = leg?.bucket === "positive_reply";
  const cost = shownFigure(g?.outcomesMaturity, (h) => (replyLed ? h.cpprCents : h.cpcCents), basis);
  // The served expected cost of one outcome where the measured one is Learning (owner 2026-10-11).
  const costShown = costToShowCents(cost, g?.expectedReturn, replyLed ? "conversation" : "website_visit");

  const win = useCampaignWindow(brandId, campaign.row.campaign.id, campaign.row.campaign.featureSlug ?? null);
  const emails = win.data?.emails ?? null;
  const queued = win.data?.queuedEmails ?? null;
  // Emails, every step of a sequence (owner 2026-10-06: "emails, not sequences").
  const emailCount = (v: number | null | undefined) =>
    win.pending ? <Shimmer className="h-7 w-16" /> : <Figure value={v != null ? formatCount(v) : "—"} unit={v === 1 ? "email" : "emails"} />;
  const outcomes = leg && counts ? counts[leg.bucket] : null;

  // A person is "person", several are "people" (owner 2026-10-06: "1 people").
  const count = (v: number | null | undefined) =>
    !settled ? <Shimmer className="h-7 w-16" /> : <Figure value={v != null ? formatCount(v) : "—"} unit={v === 1 ? "person" : "people"} />;

  return (
    <div className="space-y-8">
      <CampaignHold campaign={campaign} />
      <section>
        <SectionTitle right={<span>Since it started</span>}>This campaign</SectionTitle>
        {/* Owner's order (2026-10-06), ONE row on desktop: ROI, Contacted, Queued, Sent, Delivered, outcome, Spent, cost per outcome. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <RoiTile campaign={campaign} />
          <StatTile label="Contacted">{count(counts?.contacted)}</StatTile>
          <StatTile label="Queued">{emailCount(queued)}</StatTile>
          <StatTile label="Sent">{emailCount(emails?.sent)}</StatTile>
          <StatTile label="Delivered">{emailCount(emails?.delivered)}</StatTile>
          <StatTile label={leg ? (outcomes === 1 ? leg.outcome : stepPluralLabel(catalogue, campaign.leg?.toKey, leg.outcome)) : "Outcomes"}>{count(outcomes)}</StatTile>
          <SpentTile win={win} />
          <StatTile label={replyLed ? "Cost / reply" : "Cost / visit"}>
            <Figure
              value={costShown.cents != null ? formatCentsAsUsdAdaptive(costShown.cents) : cost.learning ? "Learning" : "—"}
              sub={costShown.expected ? "Expected" : undefined}
            />
          </StatTile>
        </div>
      </section>

      <CampaignRoiChart
        brandId={brandId}
        campaignId={campaignId}
        featureSlug={campaign.row.campaign.featureSlug ?? null}
        economics={g?.economicsMaturity}
      />

      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LegSteps
          brandId={brandId}
          featureSlug={campaign.row.campaign.featureSlug ?? null}
          title={leg?.title ?? campaign.leg?.label ?? "Steps"}
          outcome={leg?.outcome ?? null}
          bucket={leg?.bucket ?? null}
          campaignId={campaignId}
        />
        <section>
          <SectionTitle>At a glance</SectionTitle>
          <div className="flex flex-col gap-3">
            <SummaryCard
              label="Inbox"
              href={tabHref("inbox")}
              loading={!settled}
              value={counts?.positive_reply ?? null}
              unit={counts?.positive_reply === 1 ? "positive reply" : "positive replies"}
            />
            <SummaryCard
              label="Sent"
              href={tabHref("sent")}
              loading={!settled}
              value={people?.sent ?? null}
              unit={people?.sent === 1 ? "person emailed" : "people emailed"}
            />
            <SummaryCard
              label="Targeting"
              href={tabHref("targeting")}
              loading={audiences.activeTabLoading}
              value={audiences.activeTabRows}
              unit={audiences.activeTabRows === 1 ? "audience" : "audiences"}
            />
            <SettingsSummary brandId={brandId} campaign={campaign} tabHref={tabHref} />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * A campaign that ANSWERS (a leg starting on a step, AI Meeting Booking: Positive reply →
 * Meeting booked) sends no cold email and holds nobody: the people it answers stay held by
 * the campaign that reached them. So the cold-email steps (Queued, Sent, Delivered) mean
 * nothing here. Its own steps are the replies handed to it, the conversations still going,
 * the meetings booked; the conversations it dropped are a card, not a step.
 *
 * lead-service serves the four counts per ACTING campaign (`getConversationCounts`), a
 * partition per person: handed = ongoing + booked + dropped.
 */
function ConversationOverview({
  brandId,
  campaign,
  tabHref,
}: {
  brandId: string;
  campaign: V2Campaign;
  tabHref: (tab: V2CampaignTab) => string;
}) {
  const win = useCampaignWindow(brandId, campaign.row.campaign.id, campaign.row.campaign.featureSlug ?? null);
  const q = useAuthQuery(["conversationCounts", campaign.row.campaign.id], () => getConversationCounts(campaign.row.campaign.id), pollOptions);
  const conv = q.data ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const from = campaign.leg?.fromLabel ?? "Positive reply";
  const to = campaign.leg?.toLabel ?? "Meeting booked";
  // Count headings read the catalogue's served plural (features-service `pluralLabel`).
  const catalogue = useLegCatalogue();
  const fromPlural = stepPluralLabel(catalogue, campaign.leg?.fromKey, from);
  const toPlural = stepPluralLabel(catalogue, campaign.leg?.toKey, to);
  const count = (v: number | null | undefined) =>
    !settled ? <Shimmer className="h-7 w-16" /> : <Figure value={v != null ? formatCount(v) : "—"} unit="people" />;

  return (
    <div className="space-y-8">
      <CampaignHold campaign={campaign} />
      <section>
        <SectionTitle right={<span>Since it started</span>}>This campaign</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <RoiTile campaign={campaign} />
          <StatTile label={fromPlural}>{count(conv?.handed)}</StatTile>
          <StatTile label="Ongoing conversations">{count(conv?.ongoing)}</StatTile>
          <StatTile label={toPlural}>{count(conv?.meetingsBooked)}</StatTile>
          <StatTile label="Dropped conversations">{count(conv?.dropped)}</StatTile>
          <SpentTile win={win} />
        </div>
      </section>

      <CampaignRoiChart
        brandId={brandId}
        campaignId={campaign.row.campaign.id}
        featureSlug={campaign.row.campaign.featureSlug ?? null}
        economics={campaign.row.revenue?.economicsMaturity}
      />

      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle>{campaign.leg?.label ?? "Steps"}</SectionTitle>
          <div className="k-card p-4">
            {!settled ? (
              <Shimmer className="h-[200px] w-full rounded-[8px]" />
            ) : !conv ? (
              <EmptyNote>Could not read this campaign&apos;s conversations. Retrying.</EmptyNote>
            ) : (
              <div className="flex items-end gap-3">
                <StepBar label={fromPlural} count={conv.handed} of={conv.handed} />
                <StepBar label="Ongoing conversations" count={conv.ongoing} of={conv.handed} />
                <StepBar label={to} count={conv.meetingsBooked} of={conv.handed} />
              </div>
            )}
          </div>
        </section>
        <section>
          <SectionTitle>At a glance</SectionTitle>
          <div className="flex flex-col gap-3">
            <SettingsSummary brandId={brandId} campaign={campaign} tabHref={tabHref} />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Why this campaign reads running and sends nothing, in the customer's words (campaign-service's
 * verdict, `lib/campaign-hold.ts`). Nothing on a healthy or paused campaign. Its limits live on
 * the sales-funnel campaign it is a part of, so "Raise the limit" opens that page.
 */
function CampaignHold({ campaign }: { campaign: V2Campaign }) {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const hold = useCampaignHold(campaign.row.campaign.id, campaign.running);
  if (!hold) return null;
  const partOfId = campaign.row.campaign.salesFunnelCampaignId ?? null;
  return (
    <CampaignHoldNote
      hold={hold}
      limitsHref={partOfId ? v2CampaignHref(orgId, brandId, partOfId) : null}
      billingHref={v2Href(orgId, brandId, "billing")}
    />
  );
}

/**
 * What this campaign may spend: the caps of the campaign it is a part of (owner 2026-10-10, billing's
 * max budget and max volume), else whether it runs. A part has no budget of its own.
 */
function SettingsSummary({ brandId, campaign, tabHref }: { brandId: string; campaign: V2Campaign; tabHref: (tab: V2CampaignTab) => string }) {
  const partOfId = campaign.row.campaign.salesFunnelCampaignId ?? null;
  const caps = useFunnelCapsWords(brandId, partOfId);
  return (
    <SummaryCard
      label="Settings"
      href={tabHref("settings")}
      loading={partOfId !== null && caps === null}
      value={null}
      text={partOfId ? caps : campaign.running ? "On" : "Off"}
      unit=""
    />
  );
}
