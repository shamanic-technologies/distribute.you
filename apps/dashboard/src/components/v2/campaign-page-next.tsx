"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions, POLL_INTERVAL } from "@/lib/query-options";
import {
  getConversationCounts,
  getLeadBucketCounts,
  getLeadConsolidatedStatus,
  getOfferUserFields,
  leadDateForStatus,
  listAudiences,
  listFunnelCampaignCopies,
  listFunnelCampaignRows,
  getSalesFunnelCaps,
  listLeadsPage,
  type CampaignRevenueGroup,
  type Lead,
} from "@/lib/api";
import {
  capUnavailableSentence,
  capWindowWords,
  capWords,
  centsToUsd,
  formatCapUsd,
  funnelFunded,
  funnelRowSettled,
  funnelTypeOf,
  orderPipesByFunnel,
  statedBudget,
  statedVolume,
  volumeUnitWords,
  type SalesFunnelCampaign,
  type SalesFunnelCaps,
} from "@/lib/sales-funnel-campaigns";
import { formatCentsAsUsdAdaptive, formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { leadStatusLabel } from "@/lib/lead-status";
import { awaitingReason } from "@/lib/awaiting-reason";
import { shownFigure } from "@/lib/maturity";
import { costToShowCents } from "@/lib/expected-return";
import { formatRatePct } from "@/lib/pipe-stats";
import { useStatBasis } from "@/lib/use-stat-basis";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { v2CampaignHref, v2Href, v2OfferHref, type V2CampaignTab } from "@/lib/v2/routes";
import { withLayoutNext } from "@/lib/v2/campaign-layout-preview";
import { LEADS_PAGE_SIZE, type LeadBucket } from "@/lib/leads-server-page";
import { useMissions } from "@/components/v2/use-missions";
import { useNeedsYourCall } from "@/components/v2/data";
import { useCampaignWindow } from "@/components/v2/offer-channel-page";
import { giveListsFrom } from "@/components/v2/offer-channels-page";
import { useCopilotDock } from "@/components/v2/copilot-dock";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { CompanyMark, PersonAvatar, leadCompany, leadCompanyDomain, leadName, personHref } from "@/components/v2/people-bits";
import { EmptyNote, MarkLines, Meter, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";
import { RoiLabel } from "@/components/v2/roi-label";
import { FunnelCampaignModal, FunnelCampaignStatus, FunnelFace, FunnelPathLine, FunnelRoi } from "@/components/v2/funnel-campaigns";

/**
 * THE CAMPAIGN PAGE, NEXT LAYOUT (staff preview, owner 2026-10-15, after Frontrunner's project
 * page): a header with ONE chips line (status, max budget, max volume, start), then a main
 * column that leads with PEOPLE (who waits on you, then who moved last) and a narrow column of
 * small context cards (results, target, offer, limits), one funnel strip, and the Copilot.
 *
 * Rendered only behind `isCampaignLayoutPreview` (staff mode AND `?layout=next`); the current
 * page stays the default. Every figure is served (features-service's row and campaign window,
 * lead-service's counts and people, billing's caps); nothing is summed or divided here. An
 * element no producer serves is absent, not computed.
 */

const DASH = <span className="k-fg4">—</span>;

/** The tabs of the preview: Inbox and Sent are replaced by the activity filters. */
const NEXT_TABS: { key: V2CampaignTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "targeting", label: "Targeting" },
];

/** The activity filters, each one of lead-service's own buckets (Contacted = everyone emailed). */
const ACTIVITY_FILTERS: { key: string; label: string; bucket: LeadBucket }[] = [
  { key: "all", label: "All", bucket: "contacted" },
  { key: "replied", label: "Replied", bucket: "positive_reply" },
  { key: "clicked", label: "Clicked", bucket: "website_visit" },
];

const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="k-fg3">
    <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function FunnelCampaignPageNext({ campaign }: { campaign: SalesFunnelCampaign }) {
  const { orgId } = useParams<{ orgId: string }>();
  const params = useSearchParams();
  const catalogue = useLegCatalogue();
  const { missionByCampaignId } = useMissions(orgId, campaign.brandId, { allOffers: true });
  const units = orderPipesByFunnel(campaign.units, (u) => legFor(catalogue, u.legKey));
  const coldEmail = units.find((u) => isColdEmailChannel(u.featureSlug) && isProactiveFrom(legFor(catalogue, u.legKey)?.fromKey)) ?? null;
  const conversation = units.find((u) => {
    const leg = missionByCampaignId.get(u.campaignId)?.leg ?? legFor(catalogue, u.legKey);
    return leg != null && !isProactiveFrom(leg.fromKey);
  }) ?? null;
  const visible = NEXT_TABS.filter((t) => t.key === "overview" || coldEmail);
  const tab = visible.find((t) => t.key === params.get("tab"))?.key ?? "overview";

  const rowsQ = useAuthQuery(["funnelCampaignRows", campaign.brandId, campaign.offerId], () => listFunnelCampaignRows(campaign.brandId, campaign.offerId), pollOptions);
  const row = rowsQ.data?.find((r) => r.id === campaign.id) ?? null;
  const rowsSettled = funnelRowSettled(row !== null, rowsQ, campaign.createdAt);
  const copyQ = useAuthQuery(["funnelCampaignCopies", campaign.brandId, campaign.offerId], () => listFunnelCampaignCopies(campaign.brandId, campaign.offerId), pollOptions);
  const path = row?.path ?? copyQ.data?.find((r) => r.id === campaign.id)?.path ?? null;

  const caps = useAuthQuery(
    ["salesFunnelCaps", campaign.brandId, campaign.offerId, campaign.salesFunnelId],
    () => getSalesFunnelCaps(campaign.brandId, campaign.offerId, campaign.salesFunnelId),
    pollOptions,
  );
  const capsSettled = caps.data !== undefined || caps.isFetchedAfterMount;
  const c = caps.data ?? null;
  const [editing, setEditing] = useState(false);
  const notFunded = capsSettled && funnelFunded(c) === false;

  return (
    <>
      <TopBar crumbs={[{ label: "Campaigns", href: v2Href(orgId, campaign.brandId, "campaigns") }, { label: campaign.salesFunnelName }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <header className="mb-5 flex min-w-0 items-start gap-3">
          <FunnelFace name={campaign.salesFunnelName} size={40} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{campaign.salesFunnelName}</h1>
            {path && (
              <div className="mt-1">
                <FunnelPathLine items={path.items} />
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <FunnelCampaignStatus campaign={campaign} />
              <LimitChips caps={c} settled={capsSettled} failed={caps.isError && !c} onOpen={() => setEditing(true)} />
              <span className="k-chip tabular-nums">Started {startedOn(campaign.createdAt)}</span>
            </div>
          </div>
        </header>

        <nav className="k-line-subtle mb-5 flex gap-5 border-b" aria-label="Sections">
          {visible.map((t) => (
            <Link
              key={t.key}
              href={withLayoutNext(v2CampaignHref(orgId, campaign.brandId, campaign.id, t.key))}
              aria-current={t.key === tab ? "page" : undefined}
              className="k-tab text-[13px]"
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {tab === "targeting" && coldEmail ? (
          <div className="v2-embed">
            <V2AudiencesTable campaignId={coldEmail.campaignId} offerId={campaign.offerId} />
          </div>
        ) : (
          <div className="space-y-6">
            {notFunded && (
              <div className="k-card flex flex-wrap items-center gap-3 px-4 py-3" style={{ background: "color-mix(in oklab, var(--data-amber) 10%, var(--bg-raised))" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">Not funded yet</p>
                  <p className="k-fg2 text-[13px]">Set a budget or a volume so this campaign can run.</p>
                </div>
                <button type="button" className="k-btn-accent" onClick={() => setEditing(true)}>
                  Set a budget
                </button>
              </div>
            )}

            <FunnelStrip brandId={campaign.brandId} coldEmail={coldEmail} conversationCampaignId={conversation?.campaignId ?? null} missionRevenue={coldEmail ? missionByCampaignId.get(coldEmail.campaignId)?.row.revenue ?? null : null} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                <NeedsYou orgId={orgId} brandId={campaign.brandId} campaignIds={campaign.units.map((u) => u.campaignId)} />
                {coldEmail ? (
                  <LatestActivity orgId={orgId} brandId={campaign.brandId} campaignId={coldEmail.campaignId} />
                ) : (
                  <section>
                    <SectionTitle>Latest activity</SectionTitle>
                    <div className="k-card">
                      <EmptyNote>This campaign emails nobody, so it has no people to list.</EmptyNote>
                    </div>
                  </section>
                )}
                <AskCopilot name={campaign.salesFunnelName} />
              </div>

              <aside className="space-y-3">
                <ResultsCard row={row} rowsSettled={rowsSettled} revenue={coldEmail ? missionByCampaignId.get(coldEmail.campaignId)?.row.revenue ?? null : null} />
                {coldEmail && (
                  <TargetCard
                    brandId={campaign.brandId}
                    offerId={campaign.offerId}
                    href={withLayoutNext(v2CampaignHref(orgId, campaign.brandId, campaign.id, "targeting"))}
                  />
                )}
                <OfferCard brandId={campaign.brandId} offerId={campaign.offerId} href={v2OfferHref(orgId, campaign.brandId, campaign.offerId)} />
                <LimitsCard caps={c} settled={capsSettled} failed={caps.isError && !c} onSet={() => setEditing(true)} />
              </aside>
            </div>
          </div>
        )}
      </div>
      {editing && <FunnelCampaignModal campaign={campaign} caps={c} onClose={() => setEditing(false)} />}
    </>
  );
}

/** "Oct 3, 2026", read in UTC so the server and the browser print the same day. */
function startedOn(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ─── Header: the two limits as chips, each opening the campaign's one modal ────────────

function LimitChips({ caps, settled, failed, onOpen }: { caps: SalesFunnelCaps | null; settled: boolean; failed: boolean; onOpen: () => void }) {
  if (!settled) return <Shimmer className="h-7 w-40 rounded-[8px]" />;
  if (failed) return null;
  const type = funnelTypeOf(caps);
  const words = capWords(type);
  const b = caps?.maxBudget ?? null;
  const v = caps?.maxVolume ?? null;
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={onOpen} className="k-btn gap-1.5 tabular-nums">
        <span className="k-fg3">{words.budget}</span>
        <span className={b ? "" : "k-fg3"}>{b ? statedBudget(type, b) : "Not set"}</span>
        <Chevron />
      </button>
      <button type="button" aria-haspopup="dialog" onClick={onOpen} className="k-btn gap-1.5 tabular-nums">
        <span className="k-fg3">{words.volume}</span>
        <span className={v ? "" : "k-fg3"}>{v ? statedVolume(type, v) : "Not set"}</span>
        <Chevron />
      </button>
    </>
  );
}

// ─── Funnel strip: one row of served counts, each with its served rate ──────────────────

type RevenueGroup = CampaignRevenueGroup;

function FunnelStrip({
  brandId,
  coldEmail,
  conversationCampaignId,
  missionRevenue,
}: {
  brandId: string;
  coldEmail: { campaignId: string; featureSlug: string } | null;
  conversationCampaignId: string | null;
  missionRevenue: RevenueGroup | null;
}) {
  const countsQ = useAuthQuery(
    ["leadBucketCounts", `campaign:${coldEmail?.campaignId ?? ""}`, ""],
    () => getLeadBucketCounts({ campaignId: coldEmail!.campaignId }, {}),
    { ...pollOptions, enabled: !!coldEmail },
  );
  const convQ = useAuthQuery(["conversationCounts", conversationCampaignId ?? ""], () => getConversationCounts(conversationCampaignId!), {
    ...pollOptions,
    enabled: !!conversationCampaignId,
  });
  const win = useCampaignWindow(brandId, coldEmail?.campaignId ?? "", coldEmail?.featureSlug ?? null);
  if (!coldEmail && !conversationCampaignId) return null;
  const counts = countsQ.data?.counts ?? null;
  const countsSettled = countsQ.data !== undefined || countsQ.isFetchedAfterMount;
  const convSettled = convQ.data !== undefined || convQ.isFetchedAfterMount;
  const emails = win.data?.emails ?? null;

  const steps: { key: string; label: string; value: number | null | undefined; unit: [string, string]; rate?: string | null; pending: boolean }[] = [];
  if (coldEmail) {
    steps.push({ key: "contacted", label: "Contacted", value: counts?.contacted, unit: ["person", "people"], pending: !countsSettled });
    steps.push({
      key: "sent",
      label: "Emails sent",
      value: emails?.sent,
      unit: ["email", "emails"],
      rate: emails?.deliveryRatePct != null ? `${formatRatePct(emails.deliveryRatePct)} delivered` : null,
      pending: win.pending,
    });
    steps.push({ key: "clicks", label: "Website visits", value: counts?.website_visit, unit: ["person", "people"], pending: !countsSettled });
    steps.push({
      key: "replies",
      label: "Positive replies",
      value: counts?.positive_reply,
      unit: ["person", "people"],
      rate: missionRevenue?.positiveReplyRatePct != null ? `${formatRatePct(missionRevenue.positiveReplyRatePct)} of people emailed` : null,
      pending: !countsSettled,
    });
  }
  if (conversationCampaignId) {
    steps.push({ key: "meetings", label: "Meetings booked", value: convQ.data?.meetingsBooked, unit: ["person", "people"], pending: !convSettled });
  }

  return (
    <section>
      <SectionTitle right={<span>Since it started</span>}>Funnel</SectionTitle>
      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:flex md:divide-x">
        {steps.map((s, i) => (
          <div key={s.key} className="min-w-0 flex-1 px-4 pb-3.5 pt-3">
            <span className="k-label block truncate">
              {i > 0 && <span className="k-fg4 mr-1.5 hidden md:inline">→</span>}
              {s.label}
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              {s.pending ? (
                <Shimmer className="h-7 w-14" />
              ) : (
                <>
                  <span className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{s.value == null ? DASH : formatCount(s.value)}</span>
                  {s.value != null && <span className="k-fg2 text-[12px]">{s.value === 1 ? s.unit[0] : s.unit[1]}</span>}
                </>
              )}
            </div>
            <p className="k-fg3 mt-0.5 truncate text-[12px] tabular-nums">{s.rate ?? " "}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Main column ─────────────────────────────────────────────────────────────────────────

/** The amber "waiting on you" tag: a dot and the word, never a pill. */
function WaitingTag() {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--data-amber)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-amber)]" />
      Waiting on you
    </span>
  );
}

/**
 * The people of this campaign who wrote back and wait on us: lead-service's awaiting-reply
 * set (brand-wide, oldest wait first), the rows whose lead row belongs to one of this
 * campaign's parts. The read serves no campaign filter, so the list is the brand's first ten.
 */
function NeedsYou({ orgId, brandId, campaignIds }: { orgId: string; brandId: string; campaignIds: string[] }) {
  const q = useNeedsYourCall(brandId, 10);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const ids = new Set(campaignIds);
  const leads = (q.data?.leads ?? []).filter((l) => ids.has(l.campaignId));
  return (
    <section>
      <SectionTitle>Needs you</SectionTitle>
      {!settled ? (
        <div className="k-card divide-y divide-[var(--line-subtle)]">
          {[0, 1].map((i) => (
            <div key={i} className="px-4 py-3">
              <Shimmer className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : q.isError && !q.data ? (
        <div className="k-card">
          <EmptyNote>Could not read who is waiting on you. Retrying.</EmptyNote>
        </div>
      ) : leads.length === 0 ? (
        <div className="k-card">
          <EmptyNote>Nobody from this campaign is waiting on you.</EmptyNote>
        </div>
      ) : (
        <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {leads.map((lead) => {
            const waiting = q.data?.waiting[lead.id] ?? null;
            const company = leadCompany(lead);
            return (
              <Link key={lead.id} href={personHref(orgId, brandId, lead)} className="k-row flex min-w-0 items-center gap-3 px-4 py-3">
                <MarkLines className="flex-1" mark={(px) => <PersonAvatar lead={lead} size={px} />}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{leadName(lead)}</span>
                    {company && (
                      <span className="k-fg2 flex min-w-0 items-center gap-1.5 text-[12px]">
                        <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={14} />
                        <span className="truncate">{company}</span>
                      </span>
                    )}
                  </span>
                  <span className="k-fg3 block truncate text-[12px]">
                    {waiting ? awaitingReason(waiting.lastMessage.kind, waiting.waitingSince) : lead.email}
                  </span>
                </MarkLines>
                <WaitingTag />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

const ACTIVITY_SHOWN = 12;

/** One row per person of this campaign, newest move first (lead-service's activity order). */
function LatestActivity({ orgId, brandId, campaignId }: { orgId: string; brandId: string; campaignId: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState(ACTIVITY_FILTERS[0]);
  const [all, setAll] = useState(false);
  const key = `campaign:${campaignId}`;
  // People's own key and arguments (first page), so the Sent and Inbox tabs share this read.
  const pageQ = useAuthQuery(
    ["leadsPage", key, "v2-people", filter.bucket, "", 0],
    () =>
      listLeadsPage(
        { campaignId },
        { view: "basic", bucket: filter.bucket, sort: "activity", limit: String(LEADS_PAGE_SIZE), offset: "0" },
        undefined,
        { includeCampaigns: false },
      ),
    { refetchInterval: POLL_INTERVAL },
  );
  const countsQ = useAuthQuery(["leadBucketCounts", key, ""], () => getLeadBucketCounts({ campaignId }, {}), pollOptions);
  const counts = countsQ.data?.counts ?? null;
  const rows = pageQ.data?.leads ?? null;
  const total = pageQ.data?.total ?? null;
  const shown = rows ? (all ? rows : rows.slice(0, ACTIVITY_SHOWN)) : null;
  const settled = pageQ.data !== undefined || pageQ.isFetchedAfterMount;

  return (
    <section>
      <SectionTitle
        right={
          <span className="flex items-center gap-1">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter.key === f.key}
                onClick={() => {
                  setFilter(f);
                  setAll(false);
                }}
                className={`${filter.key === f.key ? "k-btn-strong" : "k-btn"} gap-1 text-[12px]`}
              >
                {f.label}
                <span className="k-fg3 tabular-nums">{counts ? formatCount(counts[f.bucket] ?? 0) : ""}</span>
              </button>
            ))}
          </span>
        }
      >
        Latest activity
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className="k-label px-3 py-2.5 pl-4 text-left font-normal">Person</th>
                <th className="k-label px-3 py-2.5 text-left font-normal">Company</th>
                <th className="k-label px-3 py-2.5 text-left font-normal">Latest step</th>
                <th className="k-label px-3 py-2.5 pr-4 text-right font-normal">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {!settled || shown === null ? (
                pageQ.isError ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyNote>Could not read these people. Retrying.</EmptyNote>
                    </td>
                  </tr>
                ) : (
                  Array.from({ length: 6 }, (_, i) => (
                    <tr key={i} className="k-row h-10">
                      <td colSpan={4} className="px-4">
                        <Shimmer className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                )
              ) : shown.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyNote>Nobody here yet.</EmptyNote>
                  </td>
                </tr>
              ) : (
                shown.map((lead) => <ActivityRow key={lead.id} lead={lead} onOpen={() => router.push(personHref(orgId, brandId, lead))} />)
              )}
            </tbody>
          </table>
        </div>
        {total != null && total > 0 && (
          <div className="k-fg3 k-line-subtle flex items-center justify-between border-t px-4 py-2.5 text-[12px] tabular-nums">
            <span>
              {formatCount(total)} {total === 1 ? "person" : "people"}
            </span>
            {!all && rows && rows.length > ACTIVITY_SHOWN && (
              <button type="button" onClick={() => setAll(true)} className="k-btn-ghost h-6">
                Show {formatCount(rows.length - ACTIVITY_SHOWN)} more
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityRow({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const status = getLeadConsolidatedStatus(lead);
  const at = leadDateForStatus(lead, status);
  const company = leadCompany(lead);
  return (
    <tr onClick={onOpen} className="k-row k-line-subtle h-10 cursor-pointer border-b last:border-b-0">
      <td className="max-w-[220px] px-3 pl-4">
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar lead={lead} size={20} />
          <span className="truncate font-medium">{leadName(lead)}</span>
        </span>
      </td>
      <td className="max-w-[200px] px-3">
        {company ? (
          <span className="flex min-w-0 items-center gap-2">
            <CompanyMark name={company} domain={leadCompanyDomain(lead)} size={18} />
            <span className="truncate">{company}</span>
          </span>
        ) : (
          DASH
        )}
      </td>
      <td className="px-3">
        <span className="k-chip">{leadStatusLabel(status)}</span>
      </td>
      <td className="k-mono k-fg2 whitespace-nowrap px-3 pr-4 text-right text-[12px]">{at ? timeAgo(at) : DASH}</td>
    </tr>
  );
}

/** The way into the Copilot from this page: a question about this campaign, sent as typed. */
function AskCopilot({ name }: { name: string }) {
  const dock = useCopilotDock();
  const [text, setText] = useState("");
  if (!dock.available) return null;
  return (
    <form
      className="k-card flex items-center gap-2 p-2 pl-3"
      onSubmit={(e) => {
        e.preventDefault();
        const q = text.trim();
        if (q) dock.ask(`About my campaign "${name}": ${q}`);
        else dock.setOpen(true);
        setText("");
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask Copilot about this campaign"
        aria-label="Ask Copilot about this campaign"
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-3)]"
      />
      <button type="submit" className="k-btn-accent">
        Ask
      </button>
    </form>
  );
}

// ─── Right column: small context cards ──────────────────────────────────────────────────

function SideCard({ title, link, children }: { title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="k-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium">{title}</h2>
        {link && (
          <Link href={link.href} className="k-fg3 text-[12px] hover:text-[var(--fg-1)]">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Line({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="k-label">{label}</dt>
      <dd className="text-right text-[13px] font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** ROI once, what went in, and what one positive reply cost: all served. */
function ResultsCard({
  row,
  rowsSettled,
  revenue,
}: {
  row: Parameters<typeof FunnelRoi>[0]["row"] | null;
  rowsSettled: boolean;
  revenue: RevenueGroup | null;
}) {
  const { basis } = useStatBasis();
  const cost = shownFigure(revenue?.outcomesMaturity, (h) => h.cpprCents, basis);
  const costShown = costToShowCents(cost, revenue?.expectedReturn, "conversation");
  const wait = <Shimmer className="ml-auto h-4 w-14" />;
  return (
    <SideCard title="Results">
      <dl>
        <Line label={<RoiLabel />}>{!rowsSettled ? wait : row ? <FunnelRoi row={row} /> : DASH}</Line>
        <Line label="$ Invested">{!rowsSettled ? wait : row?.investedUsd != null ? formatUsdAdaptive(row.investedUsd) : DASH}</Line>
        {revenue && (
          <Line label="$ / Positive reply">
            {costShown.cents != null ? (
              <>
                {formatCentsAsUsdAdaptive(costShown.cents)}
                {costShown.expected && <span className="k-fg3 ml-1 text-[12px] font-normal">expected</span>}
              </>
            ) : cost.learning ? (
              <span className="k-fg3 text-[12px] font-normal">Learning</span>
            ) : (
              DASH
            )}
          </Line>
        )}
      </dl>
    </SideCard>
  );
}

/** Who the campaign aims at: the offer's active audiences, the first one's text. */
function TargetCard({ brandId, offerId, href }: { brandId: string; offerId: string; href: string }) {
  // The Targeting table's own key, so this card costs no extra read.
  const q = useAuthQuery(["audiences", brandId, "active", offerId], () => listAudiences(brandId, { status: "active", offerId }), pollOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const list = q.data?.audiences ?? null;
  return (
    <SideCard title="Target" link={{ href, label: "Targeting →" }}>
      {!settled ? (
        <Shimmer className="h-10 w-full" />
      ) : !list ? (
        <p className="k-fg3 text-[12px]">Could not read the audiences. Retrying.</p>
      ) : list.length === 0 ? (
        <p className="k-fg3 text-[12px]">No active audience yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.slice(0, 4).map((a) => (
            <li key={a.id} className="min-w-0">
              <span className="block truncate text-[13px]">{a.name}</span>
              {(a.description ?? a.targetText) && <span className="k-fg3 line-clamp-2 text-[12px]">{a.description ?? a.targetText}</span>}
            </li>
          ))}
          {list.length > 4 && <li className="k-fg3 text-[12px]">{formatCount(list.length - 4)} more</li>}
        </ul>
      )}
    </SideCard>
  );
}

/** What the emails may give and must never give: the offer's two lists (brand-service). */
function OfferCard({ brandId, offerId, href }: { brandId: string; offerId: string; href: string }) {
  const q = useAuthQuery(["offerUserFields", brandId, offerId], () => getOfferUserFields(brandId, offerId), { ...pollOptions, enabled: !!brandId && !!offerId });
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const give = giveListsFrom(q.data?.fields);
  const list = (label: string, lines: string[]) => (
    <div>
      <span className="k-label">{label}</span>
      {lines.length === 0 ? (
        <p className="k-fg4 mt-1 text-[12px]">—</p>
      ) : (
        <ul className="k-fg2 mt-1 space-y-0.5 text-[12px]">
          {lines.slice(0, 3).map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="k-fg4" aria-hidden>
                •
              </span>
              <span className="line-clamp-2 min-w-0">{l}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  return (
    <SideCard title="Offer" link={{ href, label: "Offer →" }}>
      {!settled ? (
        <Shimmer className="h-10 w-full" />
      ) : !give ? (
        <p className="k-fg3 text-[12px]">Could not read the offer. Retrying.</p>
      ) : (
        <div className="space-y-3">
          {list("We give for free", give.giveForFree)}
          {list("We never give", give.neverGive)}
        </div>
      )}
    </SideCard>
  );
}

/** The two limits, compact: what this period used against what is allowed (billing). */
function LimitsCard({ caps, settled, failed, onSet }: { caps: SalesFunnelCaps | null; settled: boolean; failed: boolean; onSet: () => void }) {
  const type = funnelTypeOf(caps);
  const words = capWords(type);
  const b = caps?.maxBudget ?? null;
  const v = caps?.maxVolume ?? null;
  const limit = (label: string, stated: string | null, used: string | null, unavailable: string | null, value: number | null, max: number | null, reached: boolean | null) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">{label}</span>
        {stated ? (
          <span className="k-fg3 truncate text-[12px] tabular-nums">{stated}</span>
        ) : (
          <button type="button" onClick={onSet} className="k-btn-ghost h-6 text-[12px]">
            Set
          </button>
        )}
      </div>
      {stated && (
        <>
          <p className="mt-1 text-[13px] tabular-nums">{used ?? <span className="k-fg3 text-[12px]">{unavailable}</span>}</p>
          {used && <Meter value={value} max={max} className="mt-1.5" />}
          {reached && <p className="mt-1 text-[12px] text-[var(--data-rose)]">Reached for this period.</p>}
        </>
      )}
    </div>
  );
  return (
    <SideCard title="Limits">
      {!settled ? (
        <Shimmer className="h-16 w-full" />
      ) : failed ? (
        <p className="k-fg3 text-[12px]">Could not read the limits. Retrying.</p>
      ) : (
        <div className="space-y-4">
          {limit(
            words.budget,
            b ? statedBudget(type, b) : null,
            b && b.consumedCents !== null ? `${formatCapUsd(b.consumedCents)} spent ${capWindowWords(b.period)}` : null,
            b ? capUnavailableSentence(b.consumedUnavailableReason) : null,
            b ? centsToUsd(b.consumedCents) : null,
            b ? centsToUsd(b.amountCents) : null,
            b?.reached ?? null,
          )}
          {limit(
            words.volume,
            v ? statedVolume(type, v) : null,
            v && v.consumed !== null ? `${formatCount(v.consumed)} ${volumeUnitWords(v.unit, type, v.consumed)} ${capWindowWords(v.period)}` : null,
            v ? capUnavailableSentence(v.consumedUnavailableReason) : null,
            v?.consumed ?? null,
            v ? v.count : null,
            v?.reached ?? null,
          )}
        </div>
      )}
    </SideCard>
  );
}
