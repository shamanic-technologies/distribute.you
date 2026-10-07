"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { AccountMenuV2, SearchTrigger, TenantSwitcherV2 } from "@/components/v2/sidebar-menus";
import { useOngoingCampaigns } from "@/components/v2/ongoing-campaigns";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2NavContext } from "@/components/v2/nav-context";
import { useBucketCounts, useBrandRevenue, useNeedsYourCall, useStandingCounts } from "@/components/v2/data";
import { v2Href, v2CampaignHref, v2OfferHref, v2SectionOf } from "@/lib/v2/routes";
import { formatCount } from "@/lib/format-number";
import { boardColumnTotals } from "@/lib/leads-server-page";
import { CompanyMark } from "@/components/v2/people-bits";
import { companyHref } from "@/components/v2/companies-page";
import { ScopePaymentDeclinedBand } from "@/components/billing/scope-payment-declined-band";
import { useStaffMode } from "@/lib/use-staff-mode";
import { SelectedOfferProvider, useSelectedOffer } from "@/components/v2/selected-offer";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { BRAND_WHY } from "@/lib/brand-why";

/**
 * Keel's frame: a grey canvas, a one-level sidebar sitting ON it, and every page in one
 * inset panel. Below `lg` the sidebar is a drawer opened from the panel's top bar.
 */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  // No brand in the URL (the org's brand picker): no brand sidebar to draw.
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const brandId = params.brandId;
  const hasBrand = Boolean(brandId);
  // A navigation closes the drawer, wherever it was started from.
  useEffect(() => setOpen(false), [pathname, search]);

  const shell = (
    <V2NavContext.Provider value={() => setOpen(true)}>
      <div className="v2-root flex h-[100dvh] w-full overflow-hidden">
        {open && <div className="fixed inset-0 z-40 bg-[#10101247] lg:hidden" onClick={() => setOpen(false)} />}
        <div
          className={`fixed inset-y-0 left-0 z-50 flex bg-[var(--bg-canvas)] transition-transform duration-200 ease-[cubic-bezier(.23,1,.32,1)] lg:static lg:z-auto lg:translate-x-0 ${
            open ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
        >
          {hasBrand ? <V2Sidebar /> : params.orgId ? <V2OrgSidebar orgId={params.orgId} /> : null}
        </div>
        <main className="k-panel k-scroll relative my-2 ml-2 mr-2 min-w-0 flex-1 overflow-y-auto lg:ml-0">
          {/* Every brand page states it when billing has stopped the brand's missions
              (a declined card, or no card), the same notice v1's Overviews carry. */}
          {brandId && (
            <div className="px-4 pt-3 empty:hidden md:px-6">
              <ScopePaymentDeclinedBand brandId={brandId} />
            </div>
          )}
          {children}
        </main>
        {/* Overlays the sidebar opens (the ⌘K palette) render here, outside the drawer,
            whose transform would otherwise trap their fixed positioning. */}
        <div id="v2-portal" />
      </div>
    </V2NavContext.Provider>
  );
  // Every brand page reads ONE offer, the one the sidebar's switcher picked.
  return brandId ? <SelectedOfferProvider brandId={brandId}>{shell}</SelectedOfferProvider> : shell;
}

function Count({ n }: { n: number | null | undefined }) {
  if (n == null) return null;
  return <span className="k-fg3 ml-auto shrink-0 pr-1 text-[12px] tabular-nums">{formatCount(n)}</span>;
}

function NavItem({
  href,
  label,
  icon,
  active,
  trailing,
  indent = false,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  trailing?: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={`group flex h-7 min-w-0 items-center gap-2 rounded-[8px] pr-1.5 text-[13px] outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        indent ? "pl-[30px]" : "pl-2"
      } ${active ? "bg-[var(--bg-selected)] text-[var(--fg-1)]" : "text-[var(--fg-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-1)]"}`}
    >
      {icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--fg-3)]">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="k-fg3 mb-1 px-2 text-[12px]">{title}</p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

const I = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  today: "M2.5 12.5h11M4 12.5V9m3 3.5V6.5m3 6V8m3 4.5v-6M8 2.5l.7 1.4 1.5.2-1.1 1 .3 1.5L8 5.9l-1.4.7.3-1.5-1.1-1 1.5-.2Z",
  records: "M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6",
  channels: "M2.5 4.5h11v7h-11zM2.5 4.5 8 8.5l5.5-4",
  audience: "M2.5 4h11M2.5 8h11M2.5 12h7",
  path: "M3.5 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9-6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 11h3.5a2 2 0 0 0 2-2V6.5",
  offer: "M8.5 2.5h5v5L7.5 13.5l-5-5Zm2.5 2.5h.01",
  target: "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm0-3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  plug: "M6 2.5v3m4-3v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1.1.9.6-1 1.8-1.1-.3a4.5 4.5 0 0 1-1.3.8l-.2 1.2H7.5l-.2-1.2a4.5 4.5 0 0 1-1.3-.8l-1.1.3-1-1.8.9-.6a4.5 4.5 0 0 1 0-1.8l-.9-.6 1-1.8 1.1.3c.4-.3.8-.6 1.3-.8l.2-1.2h2l.2 1.2c.5.2.9.5 1.3.8l1.1-.3 1 1.8-.9.6a4.5 4.5 0 0 1 0 1.8Z",
  posts: "M2.5 3.5h11v9h-11zM5 6.5h6M5 9.5h4",
  workflows: "M4 3.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm8 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM4 6.5v2a2 2 0 0 0 2 2h4.5",
};

/** The why, quiet, above the account menu on every v2 page (owner 2026-10-03). */
function BrandWhyLine() {
  return <p className="k-fg3 px-4 pb-1 pt-2 text-[12px]">{BRAND_WHY}</p>;
}

/**
 * The org's page before it has a brand (or while none is picked): no brand nav to draw,
 * but the frame still says where you are and who is signed in, so the person can switch
 * org, add a brand from the switcher, or sign out.
 */
function V2OrgSidebar({ orgId }: { orgId: string }) {
  return (
    <aside className="flex h-full w-[240px] max-w-[85vw] shrink-0 flex-col">
      <div className="px-2 pt-2">
        <TenantSwitcherV2 />
      </div>
      <div className="min-h-0 flex-1" />
      <BrandWhyLine />
      <AccountMenuV2 orgId={orgId} brandId="" />
    </aside>
  );
}

function V2Sidebar() {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const pathname = usePathname() ?? "";
  const orgId = params.orgId ?? "";
  const brandId = params.brandId ?? "";
  const section = v2SectionOf(pathname);
  const { offerId } = useSelectedOffer();
  // The same read and the same order as the Sales path page's Campaigns section
  // (proactive first, ROI high to low), so the two lists never disagree. Today reads it too.
  const { campaigns: activeMissions } = useOngoingCampaigns(orgId, brandId, offerId);
  const buckets = useBucketCounts(brandId).data;
  const standings = useStandingCounts(brandId).data;
  // Deals badge = the people still in play on the Deals board (Leads + Sales interest +
  // Close won), read off the same column totals the page states, so the two agree.
  const boardTotals = boardColumnTotals(standings);
  const dealsInPlay = boardTotals ? boardTotals.contacted + boardTotals.sales_interest + boardTotals.won : null;
  const revenue = useBrandRevenue(brandId).data;
  const needsCall = useNeedsYourCall(brandId, 5).data?.total ?? null;
  const [recordsOpen, setRecordsOpen] = useState(true);
  // Work, Crew, Missions and Workflows are staff surfaces: a customer never sees them, staff mode does.
  const { staffMode } = useStaffMode();
  // Keel's Favorites: the three companies worth most, on features-service's own figure.
  const topCompanies = useMemo(
    () => [...(revenue?.organizations ?? [])].sort((a, b) => b.expectedRevenueUsd - a.expectedRevenueUsd).slice(0, 3),
    [revenue],
  );
  return (
    <aside className="flex h-full w-[240px] max-w-[85vw] shrink-0 flex-col">
      <div className="space-y-2 px-2 pt-2">
        <TenantSwitcherV2 />
        <SearchTrigger orgId={orgId} brandId={brandId} />
      </div>
      <nav className="k-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        <div className="space-y-px">
          <NavItem
            href={v2Href(orgId, brandId, "today")}
            label="Today"
            icon={<I d={ICONS.today} />}
            active={section === "today"}
            trailing={
              needsCall != null && needsCall > 0 ? (
                <span
                  title="Replied with interest, not yet closed"
                  className="ml-auto rounded-[5px] bg-[var(--bg-selected)] px-1.5 text-[11px] font-medium tabular-nums text-[var(--fg-2)]"
                >
                  {formatCount(needsCall)}
                </span>
              ) : undefined
            }
          />
          <button
            type="button"
            onClick={() => setRecordsOpen((v) => !v)}
            className="flex h-7 w-full items-center gap-2 rounded-[8px] pl-2 pr-1.5 text-[13px] text-[var(--fg-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-1)]"
            aria-expanded={recordsOpen}
          >
            <span className="flex h-4 w-4 items-center justify-center text-[var(--fg-3)]">
              <I d={ICONS.records} />
            </span>
            <span className="flex-1 text-left">Records</span>
            <svg width="12" height="12" viewBox="0 0 12 12" className={`k-fg3 transition-transform ${recordsOpen ? "" : "-rotate-90"}`} aria-hidden="true">
              <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          {recordsOpen && (
            <>
              <NavItem
                indent
                href={v2Href(orgId, brandId, "companies")}
                label="Companies"
                active={section === "companies"}
                trailing={<Count n={revenue?.organizations.length} />}
              />
              <NavItem
                indent
                href={v2Href(orgId, brandId, "people")}
                label="People"
                active={section === "people"}
                trailing={<Count n={buckets?.counts.contacted} />}
              />
              <NavItem
                indent
                href={v2Href(orgId, brandId, "deals")}
                label="Deals"
                active={section === "deals"}
                trailing={<Count n={dealsInPlay} />}
              />
            </>
          )}
          {staffMode && (
            <NavItem
              href={v2Href(orgId, brandId, "workflows")}
              label="Workflows"
              icon={<I d={ICONS.workflows} />}
              active={section === "workflows"}
            />
          )}
        </div>

        {/* Sourcing (owner 2026-10-07): the button opens the offer's Sourcing page, its source
            campaigns that are ON sit under it with a live dot, as Outbound does for its own. */}
        <div className="mt-5 space-y-px">
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId, "sourcing") : v2Href(orgId, brandId, "sourcing")}
            label="Sourcing"
            icon={<I d={ICONS.audience} />}
            active={section === "sourcing"}
          />
          {offerId &&
            activeMissions
              .filter(({ campaign }) => campaign?.kind === "source")
              .map(({ m, name }) => (
                <NavItem
                  key={m.row.campaign.id}
                  href={m.href}
                  label={name ?? m.crew.name}
                  icon={name ? <PathAvatar name={name} size={16} /> : <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} />}
                  active={pathname.startsWith(m.href)}
                  trailing={
                    <span className="k-dot-pulse ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" aria-label="On" />
                  }
                />
              ))}
        </div>

        {/* Outbound (owner 2026-10-07): a section like Setup, its page (the Sales path page, named Outbound) first, then the
            selected offer's campaigns that are ON with a live dot, named as that page's
            Campaigns section names them. Same left edge as every other entry. */}
        <Group title="Outbound">
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId, "sales-path") : v2Href(orgId, brandId, "sales-path")}
            label="Outbound"
            icon={<I d={ICONS.path} />}
            active={section === "sales-path"}
          />
          {offerId &&
            activeMissions
              .filter(({ campaign }) => campaign?.kind !== "source")
              .map(({ m, name }) => (
              <NavItem
                key={m.row.campaign.id}
                href={m.href}
                label={name ?? m.crew.name}
                icon={name ? <PathAvatar name={name} size={16} /> : <CrewMark color={m.crew.color} glyph={m.crew.glyph} size={16} />}
                active={pathname.startsWith(m.href)}
                trailing={
                  <span className="k-dot-pulse ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" aria-label="On" />
                }
              />
            ))}
        </Group>

        <Group title="Setup">
          {/* The selected offer's own page: there is no list of offers (owner 2026-10-03),
              the switcher at the top is where another one is picked. */}
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId) : v2Href(orgId, brandId, "offers")}
            label="Offer"
            icon={<I d={ICONS.offer} />}
            active={section === "offers"}
          />
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId, "targeting") : v2Href(orgId, brandId, "targeting")}
            label="Targeting"
            icon={<I d={ICONS.target} />}
            active={section === "targeting"}
          />
          {/* Every campaign this offer has run, read only (owner 2026-10-05). */}
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId, "campaigns") : v2Href(orgId, brandId, "campaigns")}
            label="Campaigns"
            icon={<I d={ICONS.channels} />}
            active={section === "campaigns"}
          />
          <NavItem href={`${v2Href(orgId, brandId, "integrations")}/ai`} label="Integrations" icon={<I d={ICONS.plug} />} active={section === "integrations"} />
          <NavItem href={v2Href(orgId, brandId, "settings")} label="Brand settings" icon={<I d={ICONS.settings} />} active={section === "settings"} />
        </Group>

        {/* What the brand publishes on LinkedIn, the first page of Posting: staff mode only. */}
        {staffMode && (
          <Group title="Posting">
            <NavItem href={v2Href(orgId, brandId, "posts")} label="Posts" icon={<I d={ICONS.posts} />} active={section === "posts"} />
          </Group>
        )}

        {topCompanies.length > 0 && (
          <Group title="Top companies">
            {topCompanies.map((o) => {
              const href = companyHref(orgId, brandId, o);
              const name = o.orgName ?? o.orgDomain ?? "Company";
              return href ? (
                <NavItem
                  key={href}
                  href={href}
                  label={name}
                  active={decodeURIComponent(pathname).endsWith(`/companies/${o.orgDomain ?? o.orgId}`)}
                  icon={<CompanyMark name={name} domain={o.orgDomain ?? null} size={16} />}
                />
              ) : null;
            })}
          </Group>
        )}

      </nav>
      <BrandWhyLine />
      <AccountMenuV2 orgId={orgId} brandId={brandId} />
    </aside>
  );
}
