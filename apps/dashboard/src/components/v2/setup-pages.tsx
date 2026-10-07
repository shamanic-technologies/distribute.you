"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getFreeCreditPromises,
  getInviteStatus,
  listBrandOffers,
  type BillingAccount,
  type FreeCreditPromise,
  type InviteStatus,
} from "@/lib/api";
import { formatBillingCentsWhole } from "@/lib/format-number";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";
import { promiseProgressSentence, promiseProgressWidth, promiseUnlockLine } from "@/lib/free-credit-promise-view";
import { v2Base, v2Href, v2OfferHref } from "@/lib/v2/routes";
import { ArchivedOffers } from "@/components/v2/archived-offers";
import { V2NewOfferModal } from "@/components/v2/new-offer-modal";
import { OfferPlanBanner } from "@/components/v2/choose-plan";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { OfferIdentityTitle } from "@/components/v2/offer-identity-title";
import { OfferArchiveCard } from "@/components/settings/offer-archive-card";
import { OfferLifetimeRevenue } from "@/components/settings/offer-campaigns-card";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { V2AudiencesTable } from "@/components/v2/audiences-table";
import { OfferQualification } from "@/components/v2/offer-qualification";
import { OfferRevenueSteps } from "@/components/v2/offer-revenue-steps";
import { V2CrmRawView } from "@/components/v2/integrations-crm";
import { V2CrmMergedView } from "@/components/v2/integrations-merged";
import { V2ConversationsView } from "@/components/v2/integrations-conversations";
import { V2AiIntegrationView } from "@/components/v2/integrations-ai";
import { Toast } from "@/components/toast";
import { useMissions } from "@/components/v2/use-missions";
import { Shimmer, TopBar, type Crumb } from "@/components/v2/ui";
import { MaturityBadge } from "@/components/maturity-badge";
import { useUser } from "@clerk/nextjs";
import { useIsBetaUser } from "@/lib/use-beta-user";
import type { Maturity } from "@/lib/feature-gates";
import { AudienceLists } from "@/components/v2/audience-page";

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

function SelectedOfferRedirect({
  title,
  tab,
  subPath = "",
}: {
  title: string;
  tab?: "sales-path" | "sourcing" | "targeting" | "campaigns";
  /** Below the tab: `/lists` opens Targeting's Lists tab. */
  subPath?: string;
}) {
  const { orgId, brandId } = useIds();
  const router = useRouter();
  const { offerId, settled } = useSelectedOffer();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (offerId) router.replace(`${v2OfferHref(orgId, brandId, offerId, tab)}${subPath}`);
  }, [offerId, orgId, brandId, tab, subPath, router]);
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

/**
 * One offer, in two columns. LEFT (the wider one): what the offer IS — its name and
 * mark, what a client won through it is worth, and what it promises (the Hormozi
 * levers the emails are written around). RIGHT: the missions working for it, each a
 * crew with its budget, and the way to add one. A mission's own page is where its
 * budget and status are changed.
 */
/**
 * The offer page: Overview (the offer itself) and Revenue Steps (the legs and steps its
 * sales paths are built from, moved off the Outbound page, owner 2026-10-07).
 */
export function V2OfferPage({ view = "overview" }: { view?: "overview" | "revenue-steps" }) {
  const { orgId, brandId, offerId } = useIds();
  const name = useOfferName(brandId, offerId);
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  if (!offerId) return null;
  const base = v2OfferHref(orgId, brandId, offerId);
  const tabs: V2Tab[] = [
    { label: "Overview", href: base, active: view === "overview" },
    { label: "Revenue Steps", href: v2OfferHref(orgId, brandId, offerId, "revenue-steps"), active: view === "revenue-steps" },
  ];
  return (
    <V2Page
      crumbs={view === "overview" ? [{ label: name ?? " " }] : [{ label: name ?? " ", href: base }, { label: "Revenue Steps" }]}
      title={<OfferIdentityTitle brandId={brandId} offerId={offerId} />}
      tabs={tabs}
    >
      {view === "revenue-steps" ? (
        <OfferRevenueSteps brandId={brandId} offerId={offerId} />
      ) : (
        <>
          <OfferPlanBanner brandId={brandId} offerId={offerId} missions={missions} />
          <div className="space-y-8">
            <OfferLifetimeRevenue brandId={brandId} offerId={offerId} />
            <BrandOfferCard brandId={brandId} offerId={offerId} />
            <OfferArchiveCard brandId={brandId} offerId={offerId} />
            <ArchivedOffers brandId={brandId} />
          </div>
        </>
      )}
    </V2Page>
  );
}

/** Who an offer is sold to, in plain words: each audience's sentence, no channel figure. */
/**
 * The offer's Targeting: who it reaches (Audiences) and the checks every company of every
 * audience goes through before we write to it (Qualification, owner 2026-10-07).
 */
export function V2TargetingPage({ view = "audiences" }: { view?: "audiences" | "qualification" | "lists" }) {
  const { orgId, brandId, offerId } = useIds();
  const name = useOfferName(brandId, offerId);
  if (!offerId) return null;
  const base = v2OfferHref(orgId, brandId, offerId, "targeting");
  const tabs: V2Tab[] = [
    { label: "Audiences", href: base, active: view === "audiences" },
    { label: "Qualification", href: `${base}/qualification`, active: view === "qualification" },
    // The brand's source lists and who they hold (was the Audience page, owner 2026-10-07).
    { label: "Lists", href: `${base}/lists`, active: view === "lists" },
  ];
  return (
    <V2Page
      crumbs={[{ label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Targeting" }]}
      title={name ?? " "}
      tabs={tabs}
      width="max-w-[1280px]"
    >
      {view === "qualification" ? (
        <OfferQualification brandId={brandId} offerId={offerId} />
      ) : view === "lists" ? (
        <AudienceLists />
      ) : (
        <V2AudiencesTable offerId={offerId} plain />
      )}
    </V2Page>
  );
}

/** Targeting from the sidebar or an old link: the selected offer's Targeting. */
export function V2TargetingIndexPage() {
  return <SelectedOfferRedirect title="Targeting" tab="targeting" />;
}

/** Sourcing from the sidebar before an offer is picked: the selected offer's Sourcing. */
export function V2SourcingIndexPage() {
  return <SelectedOfferRedirect title="Sourcing" tab="sourcing" />;
}

/** The old brand Audience page (links, bookmarks): the selected offer's Targeting, Lists tab. */
export function V2AudienceIndexPage() {
  return <SelectedOfferRedirect title="Lists" tab="targeting" subPath="/lists" />;
}

/** Sales path from the sidebar before an offer is picked: the selected offer's Sales path. */
export function V2SalesPathIndexPage() {
  return <SelectedOfferRedirect title="Outbound" tab="sales-path" />;
}

/** Channels from the sidebar before an offer is picked: the selected offer's Channels. */
export function V2CampaignsIndexPage() {
  return <SelectedOfferRedirect title="Campaigns" tab="campaigns" />;
}

// ─── Integrations and brand settings ────────────────────────────────────────

type IntegrationView = "ai" | "raw" | "merged" | "conversations";

/**
 * A tab marked beta is RENDERED only for a beta user: a GA user never sees the badge or
 * the link to a page that would only tell them it is not open. Left with "Your AI"
 * alone, they get no tab bar at all.
 */
function integrationTabs(orgId: string, brandId: string, active: IntegrationView, isBeta: boolean): V2Tab[] | undefined {
  const base = `${v2Base(orgId, brandId)}/integrations`;
  const tabs: V2Tab[] = [
    { label: "Your AI", href: `${base}/ai`, active: active === "ai" },
    { label: "Your CRM", href: base, active: active === "raw", badge: "beta" as const },
    { label: "Merged with our leads", href: `${base}/merged`, active: active === "merged", badge: "beta" as const },
    { label: "Conversations", href: `${base}/conversations`, active: active === "conversations", badge: "beta" as const },
  ];
  const visible = tabs.filter((t) => t.badge !== "beta" || isBeta);
  return visible.length > 1 ? visible : undefined;
}

export function V2IntegrationsPage({ view }: { view: IntegrationView }) {
  const { orgId, brandId } = useIds();
  const router = useRouter();
  const { isLoaded } = useUser();
  const isBeta = useIsBetaUser();
  // A GA user on a beta tab's URL (the bare /integrations is the CRM tab) lands on the
  // AI tab. Wait for Clerk: useIsBetaUser reads false until the user has loaded.
  const gaOnBetaView = isLoaded && !isBeta && view !== "ai";
  useEffect(() => {
    if (gaOnBetaView) router.replace(`${v2Href(orgId, brandId, "integrations")}/ai`);
  }, [gaOnBetaView, router, orgId, brandId]);
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
      tabs={integrationTabs(orgId, brandId, view, isBeta)}
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
      title={`Get $${REFERRAL_CREDIT_USD} for each referral`}
      sub={`Share your link. Once someone who signs up through it has paid us $${REFERRAL_CREDIT_USD}, you get $${REFERRAL_CREDIT_USD} in free credits. There is no limit.`}
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
                    <span>{promiseUnlockLine(formatBillingCentsWhole(p.amountCents), remaining, p)}</span>
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
