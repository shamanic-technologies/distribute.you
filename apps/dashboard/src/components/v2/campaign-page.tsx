"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getConversationCounts, getLeadBucketCounts } from "@/lib/api";
import { type RevenueWindow } from "@/lib/revenue-window";
import { formatCentsAsUsdAdaptive, formatCount } from "@/lib/format-number";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { shownFigure, shownReturn } from "@/lib/maturity";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useStaffMode } from "@/lib/use-staff-mode";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { crewTrigger } from "@/lib/v2/crews";
import { v2CampaignHref, v2OfferHref, type V2CampaignTab } from "@/lib/v2/routes";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";
import { CampaignRoiChart } from "@/components/v2/campaign-roi-chart";
import { CampaignWorkflowsPage } from "@/components/workflows/campaign-workflows-page";
import { useMissions, type Mission } from "@/components/v2/use-missions";
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

/**
 * A step label as a count heading: "Positive reply" -> "Positive replies", "Booking call" ->
 * "Booking calls", and a participle step ("Meeting booked") stays as it is.
 */
const plural = (noun: string) =>
  /ed$/i.test(noun) ? noun : /[^aeiou]y$/i.test(noun) ? `${noun.slice(0, -1)}ies` : `${noun}s`;

const CAMPAIGN_TABS: { key: V2CampaignTab; label: string; staff?: boolean }[] = [
  { key: "overview", label: "Overview" },
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "targeting", label: "Targeting" },
  { key: "settings", label: "Settings" },
  { key: "workflows", label: "Workflows", staff: true },
];

/**
 * One campaign (offer x leg x channel), opened from the sidebar's Campaigns. The channel
 * page's anatomy and tabs, every read narrowed to this campaign: lead-service resolves its
 * id to the whole campaign identity (its ancestors included), the audience table and the
 * settings take it as their scope, and its money is the campaign row's own served group.
 */
export function V2CampaignPage() {
  const { orgId, brandId, campaignId } = useParams<{ orgId: string; brandId: string; campaignId: string }>();
  const params = useSearchParams();
  const { staffMode } = useStaffMode();
  const { settled, missionByCampaignId } = useMissions(orgId, brandId, { allOffers: true });
  const mission = missionByCampaignId.get(campaignId) ?? null;
  // The live row of the identity: a link naming an ancestor row still lands on today's campaign.
  const id = mission?.row.campaign.id ?? campaignId;
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const c = mission?.row.campaign ?? null;
  const def = c ? channels.find((ch) => ch.featureSlug === c.featureSlug) : undefined;
  const name = c ? (catalogue.campaignNames.get(`${c.featureSlug}|${c.legKey}`) ?? null) : null;
  const shownName = name ?? mission?.crew.name ?? " ";

  const visible = CAMPAIGN_TABS.filter((t) => !t.staff || staffMode);
  const tab = visible.find((t) => t.key === params.get("tab"))?.key ?? "overview";
  const tabHref = (t: V2CampaignTab) => v2CampaignHref(orgId, brandId, id, t);
  const tabs: V2Tab[] = visible.map((t) => ({ label: t.label, href: tabHref(t.key), active: t.key === tab }));

  if (settled && !mission) {
    return (
      <V2Page crumbs={[{ label: "Campaigns" }, { label: "Not found" }]}>
        <div className="k-card">
          <EmptyNote>This campaign does not exist on this brand.</EmptyNote>
        </div>
      </V2Page>
    );
  }

  const offerId = mission?.offerId ?? null;
  return (
    <V2Page
      crumbs={
        offerId
          ? [
              { label: mission?.offerName ?? "Offer", href: v2OfferHref(orgId, brandId, offerId) },
              { label: "Outbound", href: v2OfferHref(orgId, brandId, offerId, "sales-path") },
              { label: shownName },
            ]
          : [{ label: "Campaigns" }, { label: " " }]
      }
      title={
        mission ? (
          <span className="flex min-w-0 items-center gap-2.5">
            {name && <PathAvatar name={name} size={32} />}
            <span className="truncate">{shownName}</span>
          </span>
        ) : (
          <Shimmer className="h-8 w-56" />
        )
      }
      sub={
        mission ? (
          <span className="flex flex-wrap items-center gap-2 text-[13px]">
            {/* The leg read as a path, the channel standing on the arrow it performs:
                "Positive reply → [AI Meeting Booking] → Meeting booked"; an entry leg starts at the channel. */}
            {mission.leg?.fromLabel && (
              <>
                <span className="k-fg2">{mission.leg.fromLabel}</span>
                <span className="k-fg3">→</span>
              </>
            )}
            {def && (
              <span className="k-chip inline-flex items-center gap-1.5">
                <AcquisitionChannelMark def={def} size="xs" />
                {def.name}
              </span>
            )}
            {mission.leg && (
              <>
                <span className="k-fg3">→</span>
                <span className="k-fg2">{mission.leg.toLabel}</span>
              </>
            )}
          </span>
        ) : undefined
      }
      actions={
        mission ? (
          <>
            <StatBasisSwitch />
            <CampaignControlsTrigger
              brandId={brandId}
              campaignId={id}
              totalCentsOverride={mission.row.budgetCents}
              cap={crewTrigger(mission.leg)?.kind === "event"}
            />
          </>
        ) : undefined
      }
      tabs={mission ? tabs : undefined}
      width="max-w-[1280px]"
    >
      {!mission || !offerId ? (
        <Shimmer className="h-[240px] w-full rounded-[12px]" />
      ) : tab === "overview" && mission.leg?.fromKey ? (
        <ConversationOverview brandId={brandId} mission={mission} tabHref={tabHref} />
      ) : tab === "overview" ? (
        <CampaignOverview brandId={brandId} offerId={offerId} campaignId={id} mission={mission} tabHref={tabHref} />
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
          {/* The channel page's settings (give lists, rates per step), then this campaign's daily budget. */}
          {c?.featureSlug && isColdEmailChannel(c.featureSlug) && (
            <ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={c.featureSlug} />
          )}
          <CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={id} />
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

/** The campaign's ROI is an expected value (its pipeline over what it cost), so it says so. */
const CAMPAIGN_ROI_TIP = "Expected, not measured yet. What the people this campaign reached should be worth, divided by what it cost.";

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
  mission,
  tabHref,
}: {
  brandId: string;
  offerId: string;
  campaignId: string;
  mission: Mission;
  tabHref: (tab: V2CampaignTab) => string;
}) {
  const { basis } = useStatBasis();
  const budgetHidden = useDailyBudgetHidden();
  const q = useAuthQuery(["leadBucketCounts", `campaign:${campaignId}`, ""], () => getLeadBucketCounts({ campaignId }, {}), pollOptions);
  const counts = q.data?.counts ?? null;
  const people = q.data?.people ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const audiences = useAudienceTable({ campaignId, offerId });

  const leg = LEG_STEPS.find((l) => l.legKey === mission.row.campaign.legKey) ?? null;
  const g = mission.row.revenue ?? null;
  const replyLed = leg?.bucket === "positive_reply";
  const cost = shownFigure(g?.outcomesMaturity, (h) => (replyLed ? h.cpprCents : h.cpcCents), basis);
  const cap = crewTrigger(mission.leg)?.kind === "event";

  const roi = shownReturn(g?.economicsMaturity, basis);
  const win = useCampaignWindow(brandId, mission.row.campaign.id, mission.row.campaign.featureSlug ?? null);
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
      <section>
        <SectionTitle right={<span>Since it started</span>}>This campaign</SectionTitle>
        {/* Owner's order (2026-10-06), ONE row on desktop: ROI, Contacted, Queued, Sent, Delivered, outcome, Spent, cost per outcome. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <StatTile label="ROI" note={<InfoTooltip tip={CAMPAIGN_ROI_TIP} placement="bottom" />}>
            {/* Green above break-even, as every ROI in the dashboard (lib/format-roi.ts roiIsGood). */}
            <Figure
              value={
                roi.learning ? (
                  "Learning"
                ) : roi.value == null ? (
                  "—"
                ) : (
                  <span className={roiIsGood(roi.value) ? "text-[var(--run)]" : ""}>{formatRoi(roi.value)}</span>
                )
              }
            />
          </StatTile>
          <StatTile label="Contacted">{count(counts?.contacted)}</StatTile>
          <StatTile label="Queued">{emailCount(queued)}</StatTile>
          <StatTile label="Sent">{emailCount(emails?.sent)}</StatTile>
          <StatTile label="Delivered">{emailCount(emails?.delivered)}</StatTile>
          <StatTile label={leg ? (outcomes === 1 ? leg.outcome : plural(leg.outcome)) : "Outcomes"}>{count(outcomes)}</StatTile>
          <SpentTile win={win} />
          <StatTile label={replyLed ? "Cost / reply" : "Cost / visit"}>
            <Figure value={cost.learning ? "Learning" : cost.value == null ? "—" : formatCentsAsUsdAdaptive(cost.value)} />
          </StatTile>
        </div>
      </section>

      <CampaignRoiChart
        brandId={brandId}
        campaignId={campaignId}
        featureSlug={mission.row.campaign.featureSlug ?? null}
        economics={g?.economicsMaturity}
      />

      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <LegSteps
          brandId={brandId}
          featureSlug={mission.row.campaign.featureSlug ?? null}
          title={leg?.title ?? mission.leg?.label ?? "Steps"}
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
            {/* A plan's budget is fixed, so a subscriber's Settings card states the switch alone. */}
            <SummaryCard
              label="Settings"
              href={tabHref("settings")}
              loading={false}
              value={null}
              text={budgetHidden ? (mission.running ? "On" : "Off") : fmtDailyBudgetUsd(mission.row.budgetCents)}
              unit={budgetHidden ? "" : cap ? "cap / day" : "/ day"}
            />
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
  mission,
  tabHref,
}: {
  brandId: string;
  mission: Mission;
  tabHref: (tab: V2CampaignTab) => string;
}) {
  const budgetHidden = useDailyBudgetHidden();
  const win = useCampaignWindow(brandId, mission.row.campaign.id, mission.row.campaign.featureSlug ?? null);
  const q = useAuthQuery(["conversationCounts", mission.row.campaign.id], () => getConversationCounts(mission.row.campaign.id), pollOptions);
  const conv = q.data ?? null;
  const settled = q.isFetchedAfterMount || q.data !== undefined;
  const cap = crewTrigger(mission.leg)?.kind === "event";
  const from = mission.leg?.fromLabel ?? "Positive reply";
  const to = mission.leg?.toLabel ?? "Meeting booked";
  const count = (v: number | null | undefined) =>
    !settled ? <Shimmer className="h-7 w-16" /> : <Figure value={v != null ? formatCount(v) : "—"} unit="people" />;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Since it started</span>}>This campaign</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile label={plural(from)}>{count(conv?.handed)}</StatTile>
          <StatTile label="Ongoing conversations">{count(conv?.ongoing)}</StatTile>
          <StatTile label={plural(to)}>{count(conv?.meetingsBooked)}</StatTile>
          <StatTile label="Dropped conversations">{count(conv?.dropped)}</StatTile>
          <SpentTile win={win} />
        </div>
      </section>

      <CampaignRoiChart
        brandId={brandId}
        campaignId={mission.row.campaign.id}
        featureSlug={mission.row.campaign.featureSlug ?? null}
        economics={mission.row.revenue?.economicsMaturity}
      />

      <div className="grid gap-x-3 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle>{mission.leg?.label ?? "Steps"}</SectionTitle>
          <div className="k-card p-4">
            {!settled ? (
              <Shimmer className="h-[200px] w-full rounded-[8px]" />
            ) : !conv ? (
              <EmptyNote>Could not read this campaign&apos;s conversations. Retrying.</EmptyNote>
            ) : (
              <div className="flex items-end gap-3">
                <StepBar label={plural(from)} count={conv.handed} of={conv.handed} />
                <StepBar label="Ongoing conversations" count={conv.ongoing} of={conv.handed} />
                <StepBar label={to} count={conv.meetingsBooked} of={conv.handed} />
              </div>
            )}
          </div>
        </section>
        <section>
          <SectionTitle>At a glance</SectionTitle>
          <div className="flex flex-col gap-3">
            <SummaryCard
              label="Settings"
              href={tabHref("settings")}
              loading={false}
              value={null}
              text={budgetHidden ? (mission.running ? "On" : "Off") : fmtDailyBudgetUsd(mission.row.budgetCents)}
              unit={budgetHidden ? "" : cap ? "cap / day" : "/ day"}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
