"use client";

import type { PaymentHoldKind } from "@/lib/payment-declined";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getCampaign,
  getFreeCreditPromises,
  getInviteStatus,
  listBrandOffers,
  type BillingAccount,
  type FreeCreditPromise,
  type InviteStatus,
} from "@/lib/api";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { formatBillingCentsWhole } from "@/lib/format-number";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";
import { promiseProgressSentence, promiseProgressWidth, promiseUnlockLine } from "@/lib/free-credit-promise-view";
import { v2Base, v2Href, v2MissionHref, v2OfferHref } from "@/lib/v2/routes";
import { ArchivedOffers } from "@/components/v2/archived-offers";
import { V2NewOfferModal } from "@/components/v2/new-offer-modal";
import { OfferPlanBanner } from "@/components/v2/choose-plan";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { OfferIdentityCard } from "@/components/settings/offer-identity-card";
import { OfferArchiveCard } from "@/components/settings/offer-archive-card";
import { OfferLifetimeRevenue } from "@/components/settings/offer-campaigns-card";
import { AddMissionModal } from "@/components/v2/add-mission-modal";
import { CrewTriggerTag } from "@/components/v2/crew-trigger-tag";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { useDailyBudgetHidden } from "@/lib/use-daily-budget-hidden";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { CampaignWorkflowsPage } from "@/components/workflows/campaign-workflows-page";
import { V2CrmRawView } from "@/components/v2/integrations-crm";
import { V2CrmMergedView } from "@/components/v2/integrations-merged";
import { V2ConversationsView } from "@/components/v2/integrations-conversations";
import { V2AiIntegrationView } from "@/components/v2/integrations-ai";
import { Toast } from "@/components/toast";
import { useMissions } from "@/components/v2/use-missions";
import { crewTrigger, type CrewGlyph } from "@/lib/v2/crews";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, Shimmer, StateDot, TopBar, type Crumb } from "@/components/v2/ui";
import { MaturityBadge } from "@/components/maturity-badge";
import { StaffOnly } from "@/components/v2/staff-only";
import { useStaffMode } from "@/lib/use-staff-mode";
import type { Maturity } from "@/lib/feature-gates";

/**
 * The v2 Setup pages and the account pages behind the user menu.
 *
 * Every v1 page a v2 user used to be sent to has a twin here, in the Keel frame, so v2
 * never hands the reader back to v1. They are built from v1's OWN business components
 * (the cards, the tables, the writes), given v2 paths where a component takes one —
 * rewriting a settings form adds nothing and is how two editors of one value come to
 * disagree. Where a v1 component still links to a v1 path, `proxy.ts` rewrites it
 * to its v2 twin (`v2PathForV1`), so the link lands here too.
 */

function useIds() {
  const p = useParams<{ orgId: string; brandId: string; offerId?: string; campaignId?: string }>();
  return { orgId: p.orgId, brandId: p.brandId, offerId: p.offerId ?? null, campaignId: p.campaignId ?? null };
}

/** One tab of a v2 page. `badge` marks a gated tab (beta, staff) beside its label. */
export interface V2Tab {
  label: string;
  href: string;
  active: boolean;
  badge?: Maturity;
}

export function V2TabLink({ tab }: { tab: V2Tab }) {
  return (
    <Link href={tab.href} aria-current={tab.active ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
      {tab.label}
      {tab.badge && <MaturityBadge level={tab.badge} />}
    </Link>
  );
}

/** The page frame: Keel's top bar, a title, then the body at a reading width. */
export function V2Page({
  crumbs,
  title,
  sub,
  actions,
  tabs,
  width = "max-w-[1100px]",
  children,
}: {
  crumbs: Crumb[];
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: V2Tab[];
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className={`mx-auto ${width} px-4 pb-16 pt-6 md:px-6`}>
        {title != null && (
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{title}</h1>
              {sub != null && <p className="k-fg2 mt-1 text-[14px]">{sub}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        {tabs && tabs.length > 0 && (
          <nav className="k-line-subtle mb-5 flex gap-5 border-b" aria-label="Sections">
            {tabs.map((t) => (
              <V2TabLink key={t.href} tab={t} />
            ))}
          </nav>
        )}
        {/* `v2-embed` gives the v1 components these pages embed the Keel look
            (keel.css). Native v2 markup uses none of the classes it maps. */}
        <div className="v2-embed">{children}</div>
      </div>
    </>
  );
}

// ─── Offers ─────────────────────────────────────────────────────────────────

/**
 * There is no list of offers (owner 2026-10-03): the dashboard is about ONE offer, picked
 * in the sidebar's switcher. `/offers` (old links, the `?new=1` entry) opens the selected
 * offer's page, or says there is none yet with the way to make one.
 */
export function V2OffersPage() {
  return <SelectedOfferRedirect title="Offer" />;
}

function SelectedOfferRedirect({ title, tab }: { title: string; tab?: "targeting" }) {
  const { orgId, brandId } = useIds();
  const router = useRouter();
  const { offerId, settled } = useSelectedOffer();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (offerId) router.replace(v2OfferHref(orgId, brandId, offerId, tab));
  }, [offerId, orgId, brandId, tab, router]);
  return (
    <V2Page crumbs={[{ label: title }]} title={title}>
      {!settled || offerId ? (
        <Shimmer className="h-10 w-full" />
      ) : (
        <div className="k-card flex items-center justify-between gap-3 p-4">
          <p className="k-fg2 text-[13px]">This brand has no offer yet.</p>
          <button type="button" className="k-btn-accent" onClick={() => setCreating(true)}>
            New offer
          </button>
        </div>
      )}
      {creating && <V2NewOfferModal brandId={brandId} orgId={orgId} onClose={() => setCreating(false)} />}
    </V2Page>
  );
}

export function useOfferName(brandId: string, offerId: string | null) {
  // With archived offers: an archived offer's own page still has a title.
  const q = useAuthQuery(
    ["brandOffers", brandId, "withArchived"],
    () => listBrandOffers(brandId, undefined, { includeArchived: true }),
    { enabled: !!brandId },
  );
  return q.data?.offers.find((o) => o.offerId === offerId)?.name ?? null;
}

/** The offer's tabs, the same four for every signed-in user. */
export function offerTabs(
  orgId: string,
  brandId: string,
  offerId: string,
  active: "settings" | "targeting" | "sales-path" | "channels",
): V2Tab[] {
  return [
    { label: "Settings", href: v2OfferHref(orgId, brandId, offerId), active: active === "settings" },
    { label: "Targeting", href: v2OfferHref(orgId, brandId, offerId, "targeting"), active: active === "targeting" },
    { label: "Sales path", href: v2OfferHref(orgId, brandId, offerId, "sales-path"), active: active === "sales-path" },
    { label: "Channels", href: v2OfferHref(orgId, brandId, offerId, "channels"), active: active === "channels" },
  ];
}

/**
 * One offer, in two columns. LEFT (the wider one): what the offer IS — its name and
 * mark, what a client won through it is worth, and what it promises (the Hormozi
 * levers the emails are written around). RIGHT: the missions working for it, each a
 * crew with its budget, and the way to add one. A mission's own page is where its
 * budget and status are changed.
 */
export function V2OfferPage() {
  const { orgId, brandId, offerId } = useIds();
  const name = useOfferName(brandId, offerId);
  const { missions, crews, settled } = useMissions(orgId, brandId, { allOffers: true });
  const [adding, setAdding] = useState(false);
  const budgetHidden = useDailyBudgetHidden();
  if (!offerId) return null;
  const mine = missions.filter((m) => m.offerId === offerId);
  return (
    <V2Page
      crumbs={[{ label: name ?? " " }]}
      title={name ?? " "}
      tabs={offerTabs(orgId, brandId, offerId, "settings")}
      width="max-w-[1280px]"
    >
      <OfferPlanBanner brandId={brandId} offerId={offerId} missions={missions} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="min-w-0 space-y-8">
          <OfferIdentityCard brandId={brandId} offerId={offerId} />
          <OfferLifetimeRevenue brandId={brandId} offerId={offerId} />
          <BrandOfferCard brandId={brandId} offerId={offerId} />
          <OfferArchiveCard brandId={brandId} offerId={offerId} />
          <ArchivedOffers brandId={brandId} />
        </div>
        <aside className="min-w-0">
          <div className="k-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="k-label">Missions{settled ? `  ${mine.length}` : ""}</p>
              <button type="button" onClick={() => setAdding(true)} className="k-btn h-7">
                + Add
              </button>
            </div>
            {!settled ? (
              <div className="mt-3 space-y-2">
                <Shimmer className="h-12 rounded-[10px]" />
                <Shimmer className="h-12 rounded-[10px]" />
              </div>
            ) : mine.length === 0 ? (
              <p className="k-fg2 mt-3 text-[13px] leading-[20px]">
                No crew works for this offer yet. Add a mission to put one to work.
              </p>
            ) : (
              <ul className="mt-2 -mx-2">
                {mine.map((m) => {
                  const trigger = crewTrigger(m.leg);
                  return (
                    <li key={m.row.campaign.id}>
                      <Link href={m.href} className="k-hover flex items-center gap-2.5 rounded-[8px] px-2 py-2">
                        <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={24} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-medium">{m.crew.name}</span>
                            <StateDot running={m.running} hold={m.paymentHold} />
                          </span>
                          <span className="k-fg2 flex items-center justify-between gap-2 text-[12px]">
                            {trigger ? <CrewTriggerTag trigger={trigger} className="min-w-0" /> : <span className="truncate">{m.leg?.label ?? "—"}</span>}
                            {budgetHidden ? null : (
                              <span className="k-mono shrink-0 tabular-nums">
                                {fmtDailyBudgetUsd(m.row.budgetCents ?? 0)}
                                {trigger?.kind === "event" ? " cap" : ""}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
      {adding && (
        <AddMissionModal brandId={brandId} crews={crews} missions={missions} initialOfferId={offerId} onClose={() => setAdding(false)} />
      )}
    </V2Page>
  );
}

/** Who an offer is sold to: its audiences, the same table and writes as v1. */
export function V2TargetingPage() {
  const { orgId, brandId, offerId } = useIds();
  const name = useOfferName(brandId, offerId);
  if (!offerId) return null;
  return (
    <V2Page
      crumbs={[{ label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Targeting" }]}
      title={name ?? " "}
      tabs={offerTabs(orgId, brandId, offerId, "targeting")}
      width="max-w-[1280px]"
    >
      <V2AudiencesTable offerId={offerId} />
    </V2Page>
  );
}

/** Targeting from the sidebar or an old link: the selected offer's Targeting. */
export function V2TargetingIndexPage() {
  return <SelectedOfferRedirect title="Targeting" tab="targeting" />;
}

// ─── Mission settings and workflows ─────────────────────────────────────────

function useMissionCrumbs() {
  const { orgId, brandId, campaignId } = useIds();
  const { missionByCampaignId, settled } = useMissions(orgId, brandId, { allOffers: true });
  const mission = campaignId ? missionByCampaignId.get(campaignId) ?? null : null;
  const name = mission ? `${mission.crew.name} · ${mission.offerName ?? "Offer"}` : " ";
  return { orgId, brandId, campaignId, mission, settled, name };
}

/**
 * A mission's tabs. Workflows sits below the mission, so it is offered in staff mode only
 * (`staffMode` from `useStaffMode`); the page body gates on the same mode, so a typed URL
 * reaches nothing more than the tab would.
 */
export function missionTabs(
  orgId: string,
  brandId: string,
  campaignId: string,
  active: "overview" | "audiences" | "settings" | "workflows",
  staffMode: boolean,
): V2Tab[] {
  const base = v2MissionHref(orgId, brandId, campaignId);
  return [
    { label: "Overview", href: base, active: active === "overview" },
    { label: "Audiences", href: `${base}/audiences`, active: active === "audiences" },
    { label: "Settings", href: `${base}/settings`, active: active === "settings" },
    ...(staffMode ? [{ label: "Workflows", href: `${base}/workflows`, active: active === "workflows" }] : []),
  ];
}

/** Whether a mission runs, what it may spend, and what its emails promise. */
export function V2MissionSettingsPage() {
  const { orgId, brandId, campaignId, mission, settled, name } = useMissionCrumbs();
  const { staffMode } = useStaffMode();
  const { data, isPending, isError } = useAuthQuery(["campaign", campaignId ?? "none"], () => getCampaign(campaignId as string), {
    enabled: !!campaignId,
  });
  if (!campaignId) return null;
  const offerId = mission?.offerId ?? data?.campaign.offerId ?? null;
  const showLevers = !isPending && !isError && isColdEmailChannel(data?.campaign.featureSlug);
  return (
    <V2Page
      crumbs={[{ label: "Missions", href: staffMode ? v2Href(orgId, brandId, "missions") : undefined }, { label: name, href: v2MissionHref(orgId, brandId, campaignId) }, { label: "Settings" }]}
      title={mission ? <MissionTitle crewColor={mission.crew.color} glyph={mission.crew.glyph} name={name} running={mission.running} hold={mission.paymentHold} /> : name}
      tabs={missionTabs(orgId, brandId, campaignId, "settings", staffMode)}
    >
      {!offerId ? (
        settled && !isPending ? (
          <div className="k-card"><EmptyNote>This mission names no offer, so it has no settings here.</EmptyNote></div>
        ) : (
          <Shimmer className="h-40 w-full rounded-xl" />
        )
      ) : (
        <>
          <CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={mission?.row.campaign.id ?? campaignId} />
          {showLevers && (
            <div className="mt-8">
              <BrandOfferCard brandId={brandId} offerId={offerId} />
            </div>
          )}
        </>
      )}
    </V2Page>
  );
}

function MissionTitle({ crewColor, glyph, name, running, hold }: { crewColor: string; glyph: CrewGlyph; name: string; running: boolean; hold: PaymentHoldKind | null }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <CrewMark color={crewColor} glyph={glyph} size={32} />
      <span className="truncate">{name}</span>
      <StateDot running={running} hold={hold} />
    </span>
  );
}

/**
 * Who this mission writes to, and what each audience costs it. A READ view: the
 * audiences belong to the OFFER and a mission runs every active one of them, so a
 * change made here moves every mission of that offer. The table says so in its own
 * header, and the offer's Targeting tab stays where they are managed. The offer is
 * passed in because this route carries no offer segment, and without it the table
 * would list every audience of the brand.
 */
export function V2MissionAudiencesPage() {
  const { orgId, brandId, campaignId, mission, settled, name } = useMissionCrumbs();
  const { staffMode } = useStaffMode();
  if (!campaignId) return null;
  const offerId = mission?.offerId ?? null;
  return (
    <V2Page
      crumbs={[{ label: "Missions", href: staffMode ? v2Href(orgId, brandId, "missions") : undefined }, { label: name, href: v2MissionHref(orgId, brandId, campaignId) }, { label: "Audiences" }]}
      title={mission ? <MissionTitle crewColor={mission.crew.color} glyph={mission.crew.glyph} name={name} running={mission.running} hold={mission.paymentHold} /> : name}
      tabs={missionTabs(orgId, brandId, campaignId, "audiences", staffMode)}
      width="max-w-[1280px]"
    >
      {!offerId ? (
        settled ? (
          <div className="k-card"><EmptyNote>This mission names no offer, so it has no audiences here.</EmptyNote></div>
        ) : (
          <Shimmer className="h-40 w-full rounded-xl" />
        )
      ) : (
        <V2AudiencesTable campaignId={mission?.row.campaign.id ?? campaignId} offerId={offerId} />
      )}
    </V2Page>
  );
}

/** Every workflow the mission can run, ranked the way campaign-service picks. */
export function V2MissionWorkflowsPage() {
  const { orgId, brandId, campaignId, mission, name } = useMissionCrumbs();
  const { staffMode } = useStaffMode();
  if (!campaignId) return null;
  return (
    <V2Page
      crumbs={[{ label: "Missions", href: staffMode ? v2Href(orgId, brandId, "missions") : undefined }, { label: name, href: v2MissionHref(orgId, brandId, campaignId) }, { label: "Workflows" }]}
      title={mission ? <MissionTitle crewColor={mission.crew.color} glyph={mission.crew.glyph} name={name} running={mission.running} hold={mission.paymentHold} /> : name}
      tabs={missionTabs(orgId, brandId, campaignId, "workflows", staffMode)}
      width="max-w-none"
    >
      <StaffOnly>
        <div className="v2-embed -mx-4 md:-mx-6">
          <CampaignWorkflowsPage campaignId={mission?.row.campaign.id ?? campaignId} panel="drawer" staffGated />
        </div>
      </StaffOnly>
    </V2Page>
  );
}

// ─── Integrations and brand settings ────────────────────────────────────────

type IntegrationView = "ai" | "raw" | "merged" | "conversations";

function integrationTabs(orgId: string, brandId: string, active: IntegrationView) {
  const base = `${v2Base(orgId, brandId)}/integrations`;
  return [
    { label: "Your AI", href: `${base}/ai`, active: active === "ai" },
    { label: "Your CRM", href: base, active: active === "raw", badge: "beta" as const },
    { label: "Merged with our leads", href: `${base}/merged`, active: active === "merged", badge: "beta" as const },
    { label: "Conversations", href: `${base}/conversations`, active: active === "conversations", badge: "beta" as const },
  ];
}

export function V2IntegrationsPage({ view }: { view: IntegrationView }) {
  const { orgId, brandId } = useIds();
  return (
    <V2Page
      crumbs={[{ label: "Setup" }, { label: "Integrations" }]}
      title="Integrations"
      sub={
        view === "ai"
          ? "Run distribute.you from the AI you already use. One line sets it up."
          : view === "conversations"
            ? "Everyone you are talking to, on every channel, in one thread."
            : "The CRM this brand already runs on, read here and set beside our leads."
      }
      tabs={integrationTabs(orgId, brandId, view)}
      width="max-w-[1280px]"
    >
      {view === "ai" ? (
        <V2AiIntegrationView orgId={orgId} brandId={brandId} />
      ) : view === "raw" ? (
        <V2CrmRawView orgId={orgId} brandId={brandId} />
      ) : view === "conversations" ? (
        <V2ConversationsView brandId={brandId} />
      ) : (
        <V2CrmMergedView brandId={brandId} />
      )}
    </V2Page>
  );
}

// ─── Account pages (behind the user menu) ───────────────────────────────────

/** Frames a whole v1 account page (billing, API key, account) in the v2 shell. */
export function V2AccountFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <TopBar crumbs={[{ label: "Account" }, { label }]} />
      <div className="v2-embed">{children}</div>
    </>
  );
}

/**
 * Refer a friend: Explee's referral page, with our invite link and our promises. Every
 * value is billing's (the code, the promises, the total still to come) and the words are
 * the ones the v1 sidebar card and the Billing rows read, so they cannot disagree.
 */
export function V2ReferralPage() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const { orgId: clerkOrgId, brandId } = useIds();
  const { data: account } = useAuthQuery<BillingAccount>(["billingAccount"], () => getBillingAccount());
  const orgId = account?.org_id ?? null;
  const inviteQ = useAuthQuery<InviteStatus>(["inviteStatus", orgId ?? "none"], () => getInviteStatus(orgId!), { enabled: !!orgId });
  const promisesQ = useAuthQuery<{ paidTopupsCents: string; outstandingTotalCents: string | null; promises: FreeCreditPromise[] }>(
    ["freeCreditPromises"],
    () => getFreeCreditPromises(),
  );
  const link = inviteLinkForCode(inviteQ.data?.code);
  const promises = promisesQ.data?.promises ?? [];
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2500);
  };
  return (
    <V2Page
      crumbs={[{ label: "Account" }, { label: "Refer a friend" }]}
      title={`Give $${REFERRAL_CREDIT_USD}, get $${REFERRAL_CREDIT_USD}`}
      sub={`Whoever signs up through your link gets $${REFERRAL_CREDIT_USD} in free credits, which unlock as their payments reach that amount. The moment theirs unlock, $${REFERRAL_CREDIT_USD} opens for you too. There is no limit.`}
      width="max-w-[760px]"
    >
      <div className="k-card p-4">
        <p className="k-label">Your invite link</p>
        {link ? (
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={link} aria-label="Invite link" className="k-input min-w-0 flex-1 px-2" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copy} className="k-btn-strong shrink-0">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : inviteQ.isError ? (
          <p className="k-fg3 mt-2 text-[13px]">We could not read your invite link right now.</p>
        ) : (
          <Shimmer className="mt-2 h-7 w-full" />
        )}
      </div>

      <div className="k-card mt-4 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="k-label">Credits on the way</p>
          <Link href={`${v2Base(clerkOrgId, brandId)}/billing`} className="k-fg3 text-[12px] hover:text-[var(--fg-1)]">
            Billing →
          </Link>
        </div>
        {promisesQ.data === undefined ? (
          promisesQ.isError ? <p className="k-fg3 mt-2 text-[13px]">We could not read your credits right now.</p> : <Shimmer className="mt-2 h-10 w-full" />
        ) : promises.length === 0 ? (
          <p className="k-fg3 mt-2 text-[13px]">Nothing on the way yet. Credits appear here the moment somebody signs up through your link.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {promises.map((p) => {
              const width = promiseProgressWidth(p.progressPct);
              const remaining = p.remainingToUnlockCents ? formatBillingCentsWhole(p.remainingToUnlockCents) : null;
              return (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{promiseUnlockLine(formatBillingCentsWhole(p.amountCents), remaining)}</span>
                    <span className="font-medium tabular-nums">{formatBillingCentsWhole(p.amountCents)}</span>
                  </div>
                  {width !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
                    </div>
                  )}
                  {promiseProgressSentence(p.progressPct) && <p className="k-fg3 mt-1 text-[11px]">{promiseProgressSentence(p.progressPct)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {copied && <Toast message="Invite link copied" />}
    </V2Page>
  );
}
