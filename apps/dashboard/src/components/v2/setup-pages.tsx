"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getCampaign,
  getFreeCreditPromises,
  getInviteStatus,
  listBrandOffers,
  listCampaignsByBrand,
  type BillingAccount,
  type FreeCreditPromise,
  type InviteStatus,
} from "@/lib/api";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { coldEmailCampaignForOffer, isColdEmailChannel } from "@/lib/offer-levers-home";
import { formatBillingCentsWhole } from "@/lib/format-number";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";
import { promiseProgressSentence, promiseProgressWidth, promiseUnlockLine } from "@/lib/free-credit-promise-view";
import { v2Base, v2Href, v2MissionHref, v2OfferHref } from "@/lib/v2/routes";
import { OffersTable } from "@/components/offers/offers-table";
import { NewOfferModal } from "@/components/offers/new-offer-modal";
import { OfferIdentityCard } from "@/components/settings/offer-identity-card";
import { OfferCampaignsCard } from "@/components/settings/offer-campaigns-card";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";
import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";
import { CampaignWorkflowsPage } from "@/components/workflows/campaign-workflows-page";
import { BrandCrmPage } from "@/components/crm/brand-crm-page";
import { CrmMergedPage } from "@/components/crm/crm-merged-page";
import { BrandDomainCard } from "@/components/settings/brand-domain-card";
import { BrandIdentityCard } from "@/components/settings/brand-identity-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";
import { BrandSalesRepCard } from "@/components/settings/brand-sales-rep-card";
import { BrandIntegrationsCard } from "@/components/settings/brand-integrations-card";
import { BrandConversionRatesCard } from "@/components/settings/brand-conversion-rates-card";
import { LearningToneProvider } from "@/components/learning-tag";
import { Toast } from "@/components/toast";
import { useMissions } from "@/components/v2/use-missions";
import type { CrewGlyph } from "@/lib/v2/crews";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, Shimmer, StateDot, TopBar, type Crumb } from "@/components/v2/ui";

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
  tabs?: { label: string; href: string; active: boolean }[];
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
              <Link key={t.href} href={t.href} aria-current={t.active ? "page" : undefined} className="k-tab text-[13px]">
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </div>
    </>
  );
}

// ─── Offers ─────────────────────────────────────────────────────────────────

export function V2OffersPage() {
  const { orgId, brandId } = useIds();
  const featureSlug = useSoleFeatureSlug();
  const base = v2Base(orgId, brandId);
  const search = useSearchParams();
  const [creating, setCreating] = useState(search.get("new") === "1");
  return (
    <V2Page
      crumbs={[{ label: "Setup" }, { label: "Offers" }]}
      title="Offers"
      sub="Everything this brand sells. Each offer has its own missions, targeting and return."
      actions={
        <button type="button" onClick={() => setCreating(true)} className="k-btn-strong">
          New offer
        </button>
      }
    >
      <OffersTable brandId={brandId} featureSlug={featureSlug} basePath={base} />
      {creating && <NewOfferModal brandId={brandId} offerBasePath={`${base}/offers`} onClose={() => setCreating(false)} />}
    </V2Page>
  );
}

function useOfferName(brandId: string, offerId: string | null) {
  const q = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), { enabled: !!brandId });
  return q.data?.offers.find((o) => o.offerId === offerId)?.name ?? null;
}

function offerTabs(orgId: string, brandId: string, offerId: string, active: "settings" | "targeting") {
  return [
    { label: "Settings", href: v2OfferHref(orgId, brandId, offerId), active: active === "settings" },
    { label: "Targeting", href: v2OfferHref(orgId, brandId, offerId, "targeting"), active: active === "targeting" },
  ];
}

/** One offer: its identity, how it is sold (missions and budgets), what it promises. */
export function V2OfferPage() {
  const { orgId, brandId, offerId } = useIds();
  const name = useOfferName(brandId, offerId);
  const { data, isPending } = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    refetchInterval: POLL_INTERVAL,
  });
  if (!offerId) return null;
  const leversHome = coldEmailCampaignForOffer(data?.campaigns ?? [], offerId);
  return (
    <V2Page
      crumbs={[{ label: "Offers", href: v2Href(orgId, brandId, "offers") }, { label: name ?? " " }]}
      title={name ?? " "}
      tabs={offerTabs(orgId, brandId, offerId, "settings")}
    >
      <OfferIdentityCard brandId={brandId} offerId={offerId} />
      <div className="mt-8">
        <OfferCampaignsCard brandId={brandId} offerId={offerId} />
      </div>
      {!isPending && (
        <div className="mt-8">
          {leversHome ? (
            <section className="k-card p-5">
              <h2 className="text-[14px] font-medium">What we use to optimize your conversion</h2>
              <p className="k-fg2 mt-1 text-[13px]">
                Your offer through the Alex Hormozi value equation. We write the emails around these, so you state them where that mission is set up.
              </p>
              <Link href={`${v2MissionHref(orgId, brandId, leversHome.id)}/settings`} className="k-btn mt-3">
                Open mission settings
              </Link>
            </section>
          ) : (
            <BrandOfferCard brandId={brandId} offerId={offerId} />
          )}
        </div>
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
      crumbs={[{ label: "Offers", href: v2Href(orgId, brandId, "offers") }, { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Targeting" }]}
      title={name ?? " "}
      tabs={offerTabs(orgId, brandId, offerId, "targeting")}
      width="max-w-[1280px]"
    >
      <div className="v2-embed -mx-4 md:-mx-8">
        <LearningToneProvider tone="primary">
          <CustomerAudiencesPage />
        </LearningToneProvider>
      </div>
    </V2Page>
  );
}

/**
 * Targeting from the sidebar: it belongs to an offer, so with one offer it IS that
 * offer's Targeting, and with several the reader picks the offer first.
 */
export function V2TargetingIndexPage() {
  const { orgId, brandId } = useIds();
  const router = useRouter();
  const q = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), { enabled: !!brandId });
  const offers = q.data?.offers ?? null;
  const sole = offers && offers.length === 1 ? offers[0].offerId : null;
  useEffect(() => {
    if (sole) router.replace(v2OfferHref(orgId, brandId, sole, "targeting"));
  }, [sole, orgId, brandId, router]);
  return (
    <V2Page crumbs={[{ label: "Setup" }, { label: "Targeting" }]} title="Targeting" sub="Who each offer is sold to. Pick an offer.">
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        {offers === null ? (
          <div className="p-4">{q.isError ? <p className="k-fg3 text-[13px]">We could not read your offers.</p> : <Shimmer className="h-10 w-full" />}</div>
        ) : offers.length === 0 ? (
          <EmptyNote>No offer yet.</EmptyNote>
        ) : (
          offers.map((o) => (
            <Link key={o.offerId} href={v2OfferHref(orgId, brandId, o.offerId, "targeting")} className="k-hover flex items-center justify-between px-4 py-3 text-[13px]">
              <span className="font-medium">{o.name ?? "Offer"}</span>
              <span className="k-fg3">Targeting →</span>
            </Link>
          ))
        )}
      </div>
    </V2Page>
  );
}

// ─── Mission settings and workflows ─────────────────────────────────────────

function useMissionCrumbs() {
  const { orgId, brandId, campaignId } = useIds();
  const { missionByCampaignId, settled } = useMissions(orgId, brandId);
  const mission = campaignId ? missionByCampaignId.get(campaignId) ?? null : null;
  const name = mission ? `${mission.crew.name} · ${mission.offerName ?? "Offer"}` : " ";
  return { orgId, brandId, campaignId, mission, settled, name };
}

export function missionTabs(orgId: string, brandId: string, campaignId: string, active: "overview" | "settings" | "workflows") {
  const base = v2MissionHref(orgId, brandId, campaignId);
  return [
    { label: "Overview", href: base, active: active === "overview" },
    { label: "Settings", href: `${base}/settings`, active: active === "settings" },
    { label: "Workflows", href: `${base}/workflows`, active: active === "workflows" },
  ];
}

/** Whether a mission runs, what it may spend, and what its emails promise. */
export function V2MissionSettingsPage() {
  const { orgId, brandId, campaignId, mission, settled, name } = useMissionCrumbs();
  const { data, isPending, isError } = useAuthQuery(["campaign", campaignId ?? "none"], () => getCampaign(campaignId as string), {
    enabled: !!campaignId,
  });
  if (!campaignId) return null;
  const offerId = mission?.offerId ?? data?.campaign.offerId ?? null;
  const showLevers = !isPending && !isError && isColdEmailChannel(data?.campaign.featureSlug);
  return (
    <V2Page
      crumbs={[{ label: "Missions", href: v2Href(orgId, brandId, "missions") }, { label: name, href: v2MissionHref(orgId, brandId, campaignId) }, { label: "Settings" }]}
      title={mission ? <MissionTitle crewColor={mission.crew.color} glyph={mission.crew.glyph} name={name} running={mission.running} /> : name}
      tabs={missionTabs(orgId, brandId, campaignId, "settings")}
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

function MissionTitle({ crewColor, glyph, name, running }: { crewColor: string; glyph: CrewGlyph; name: string; running: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <CrewMark color={crewColor} glyph={glyph} size={32} />
      <span className="truncate">{name}</span>
      <StateDot running={running} />
    </span>
  );
}

/** Every workflow the mission can run, ranked the way campaign-service picks. */
export function V2MissionWorkflowsPage() {
  const { orgId, brandId, campaignId, mission, name } = useMissionCrumbs();
  if (!campaignId) return null;
  return (
    <V2Page
      crumbs={[{ label: "Missions", href: v2Href(orgId, brandId, "missions") }, { label: name, href: v2MissionHref(orgId, brandId, campaignId) }, { label: "Workflows" }]}
      title={mission ? <MissionTitle crewColor={mission.crew.color} glyph={mission.crew.glyph} name={name} running={mission.running} /> : name}
      tabs={missionTabs(orgId, brandId, campaignId, "workflows")}
      width="max-w-none"
    >
      <div className="v2-embed -mx-4 md:-mx-6">
        <CampaignWorkflowsPage campaignId={mission?.row.campaign.id ?? campaignId} />
      </div>
    </V2Page>
  );
}

// ─── Integrations and brand settings ────────────────────────────────────────

function integrationTabs(orgId: string, brandId: string, active: "raw" | "merged") {
  const base = `${v2Base(orgId, brandId)}/integrations`;
  return [
    { label: "Your CRM", href: base, active: active === "raw" },
    { label: "Merged with our leads", href: `${base}/merged`, active: active === "merged" },
  ];
}

export function V2IntegrationsPage({ view }: { view: "raw" | "merged" }) {
  const { orgId, brandId } = useIds();
  return (
    <V2Page
      crumbs={[{ label: "Setup" }, { label: "Integrations" }]}
      title="Integrations"
      sub="The CRM this brand already runs on, read here and set beside our leads."
      tabs={integrationTabs(orgId, brandId, view)}
      width="max-w-[1280px]"
    >
      <div className="v2-embed -mx-4 md:-mx-8">{view === "raw" ? <BrandCrmPage brandId={brandId} /> : <CrmMergedPage brandId={brandId} />}</div>
    </V2Page>
  );
}

export function V2BrandSettingsPage() {
  const { brandId } = useIds();
  return (
    <V2Page crumbs={[{ label: "Setup" }, { label: "Brand settings" }]} title="Brand settings">
      <section id="identity" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-[14px] font-medium">Identity</h2>
        <div className="k-card">
          <BrandIdentityCard brandId={brandId} />
        </div>
      </section>
      <BrandDomainCard brandId={brandId} />
      <section id="sales-rep" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-[14px] font-medium">Sales rep</h2>
        <div className="k-card">
          <BrandSalesRepCard brandId={brandId} />
        </div>
      </section>
      <BrandIntegrationsCard brandId={brandId} />
      <section id="conversion-rates" className="mb-8 scroll-mt-24">
        <h2 className="mb-1 text-[14px] font-medium">Conversion rates</h2>
        <p className="k-fg2 mb-3 text-[13px]">
          We use what we measure on your own leads once enough have reached a step, your value until then, and the median of our clients when you have not given one.
        </p>
        <div className="k-card">
          <BrandConversionRatesCard brandId={brandId} />
        </div>
      </section>
      <section id="conversion-tracking" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-[14px] font-medium">Conversion tracking</h2>
        <div className="k-card">
          <BrandConversionTrackingCard brandId={brandId} />
        </div>
      </section>
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
