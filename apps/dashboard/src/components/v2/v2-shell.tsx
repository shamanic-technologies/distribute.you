"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { AccountMenuV2, SearchTrigger, TenantSwitcherV2 } from "@/components/v2/sidebar-menus";
import { useOngoingCampaigns } from "@/components/v2/ongoing-campaigns";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2NavContext } from "@/components/v2/nav-context";
import { useBucketCounts, useBrandRevenue, useNeedsYourCall, useStandingCounts } from "@/components/v2/data";
import { v2CatalogueHref, v2Href, v2OfferHref, v2OutcomeHref, v2SectionOf, v2WorkflowHref } from "@/lib/v2/routes";
import { CATALOGUE_OBJECTS, CATALOGUE_OBJECT_LABELS } from "@/lib/staff-catalogue";
import { useOngoingCatalogue } from "@/components/v2/staff-catalogue-data";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { formatCount } from "@/lib/format-number";
import { boardColumnTotals } from "@/lib/leads-server-page";
import { ScopePaymentDeclinedBand } from "@/components/billing/scope-payment-declined-band";
import { useStaffMode } from "@/lib/use-staff-mode";
import { SelectedOfferProvider, useSelectedOffer } from "@/components/v2/selected-offer";
import { PathAvatar } from "@/components/v2/offer-sales-paths";
import { BRAND_WHY } from "@/lib/brand-why";
import { CopilotWidget } from "@/components/v2/copilot-widget";

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
  // Staff mode on a brand: the Copilot widget floats bottom right above the page
  // (owner 2026-10-09). Customers never see it.
  const { staffMode } = useStaffMode();
  const copilot = staffMode && hasBrand && Boolean(params.orgId);

  const page = (
    <>
      {/* Every brand page states it when billing has stopped the brand's missions
          (a declined card, or no card), the same notice v1's Overviews carry. */}
      {brandId && (
        <div className="px-4 pt-3 empty:hidden md:px-6">
          <ScopePaymentDeclinedBand brandId={brandId} />
        </div>
      )}
      {children}
    </>
  );

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
        <main className="k-panel k-scroll relative my-2 ml-2 mr-2 min-w-0 flex-1 overflow-y-auto lg:ml-0">{page}</main>
        {copilot && <CopilotWidget orgId={params.orgId!} brandId={brandId!} />}
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
  // A paper plane: Outbound sends (owner 2026-10-07; the envelope is Channels).
  outbound: "M13.5 2.5 2.5 6.8l4.3 1.9 1.9 4.3Zm0 0L6.8 8.7",
  offer: "M8.5 2.5h5v5L7.5 13.5l-5-5Zm2.5 2.5h.01",
  target: "M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm0-3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  plug: "M6 2.5v3m4-3v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5",
  settings: "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5.2-1.1.9.6-1 1.8-1.1-.3a4.5 4.5 0 0 1-1.3.8l-.2 1.2H7.5l-.2-1.2a4.5 4.5 0 0 1-1.3-.8l-1.1.3-1-1.8.9-.6a4.5 4.5 0 0 1 0-1.8l-.9-.6 1-1.8 1.1.3c.4-.3.8-.6 1.3-.8l.2-1.2h2l.2 1.2c.5.2.9.5 1.3.8l1.1-.3 1 1.8-.9.6a4.5 4.5 0 0 1 0 1.8Z",
  posts: "M2.5 3.5h11v9h-11zM5 6.5h6M5 9.5h4",
  // An inbox tray: every conversation in one place.
  unibox: "M2.5 8.5 4 3.5h8l1.5 5v4h-11zM2.5 8.5h3.5l.8 1.5h2.4l.8-1.5h3.5",
  // A grid of four: the Overview of a section.
  overview: "M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5H9z",
  // A flag on its pole: a step reached.
  outcome: "M3.5 13.5v-11M3.5 3h8l-1.5 2.5 1.5 2.5h-8",
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
  const { campaigns: ongoing, outcomes } = useOngoingCampaigns(orgId, brandId, offerId);
  const buckets = useBucketCounts(brandId).data;
  const standings = useStandingCounts(brandId).data;
  // Deals badge = the people still in play on the Deals board (Leads + Sales interest +
  // Close won), read off the same column totals the page states, so the two agree.
  const boardTotals = boardColumnTotals(standings);
  const dealsInPlay = boardTotals ? boardTotals.contacted + boardTotals.sales_interest + boardTotals.won : null;
  const revenue = useBrandRevenue(brandId).data;
  const needsCall = useNeedsYourCall(brandId, 5).data?.total ?? null;
  const [recordsOpen, setRecordsOpen] = useState(true);
  // The business-object sections are staff surfaces: a customer never sees them, staff mode does.
  const { staffMode } = useStaffMode();
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
          {/* Unibox (owner 2026-10-08): every conversation in one place, right under Records; GA since 2026-10-10. */}
          <NavItem
            href={v2Href(orgId, brandId, "unibox")}
            label="Unibox"
            icon={<I d={ICONS.unibox} />}
            active={section === "unibox"}
          />
        </div>

        {/* Campaigns (owner 2026-10-10): the Overview, then EVERY campaign of the offer that
            is ON, whatever it does (finds leads, writes, answers), with its name and face.
            No category headers. Same left edge as every other entry. */}
        <Group title="Campaigns">
          <NavItem
            href={v2Href(orgId, brandId, "campaigns")}
            label="Overview"
            icon={<I d={ICONS.overview} />}
            active={section === "campaigns" && /\/campaigns\/?$/.test(pathname)}
          />
          {offerId &&
            ongoing.map(({ m, name }) => (
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

        {/* Outcomes (owner 2026-10-10): what the running campaigns produce, one entry per step. */}
        <Group title="Outcomes">
          <NavItem
            href={v2OutcomeHref(orgId, brandId)}
            label="Overview"
            icon={<I d={ICONS.overview} />}
            active={section === "outcomes" && /\/outcomes\/?$/.test(pathname)}
          />
          {offerId &&
            outcomes.map(({ outcome }) => {
              const href = v2OutcomeHref(orgId, brandId, outcome.key);
              return (
                <NavItem
                  key={outcome.key}
                  href={href}
                  label={outcome.label}
                  icon={<I d={ICONS.outcome} />}
                  active={pathname === href}
                  trailing={<Count n={outcome.items.kind === "people" ? buckets?.counts[outcome.items.bucket] : null} />}
                />
              );
            })}
        </Group>

        <Group title="Setup">
          {/* The selected offer's own page, its Targeting inside (owner 2026-10-10): there is
              no list of offers, the switcher at the top is where another one is picked. */}
          <NavItem
            href={offerId ? v2OfferHref(orgId, brandId, offerId) : v2Href(orgId, brandId, "offers")}
            label="Offer"
            icon={<I d={ICONS.offer} />}
            active={section === "offers" || section === "targeting"}
          />
          {/* The brand's settings, its Integrations inside (owner 2026-10-10). */}
          <NavItem
            href={v2Href(orgId, brandId, "settings")}
            label="Brand"
            icon={<I d={ICONS.settings} />}
            active={section === "settings" || section === "integrations"}
          />
        </Group>

        {/* Staff mode only, below the client's nav (owner 2026-10-10): one section per business
            object, each its Overview then the ONGOING ones (used by a running campaign of this
            offer), each opening its own page. Campaigns is the section above. */}
        {staffMode && <StaffObjectSections orgId={orgId} brandId={brandId} offerId={offerId} pathname={pathname} />}
      </nav>
      <BrandWhyLine />
      <AccountMenuV2 orgId={orgId} brandId={brandId} />
    </aside>
  );
}

/**
 * The staff sections (owner 2026-10-10): Steps, Sales Paths, Channels, Pipes, Sales Funnels,
 * Workflows. Each = its Overview + every ONGOING one with its served mark and name.
 * Mounted only in staff mode, so a customer makes none of these reads.
 */
function StaffObjectSections({ orgId, brandId, offerId, pathname }: { orgId: string; brandId: string; offerId: string | null; pathname: string }) {
  const ongoing = useOngoingCatalogue(orgId, brandId, offerId, true);
  return (
    <>
      {CATALOGUE_OBJECTS.map((object) => {
        const overview = v2CatalogueHref(orgId, brandId, object);
        return (
          <Group key={object} title={CATALOGUE_OBJECT_LABELS[object].title}>
            <NavItem href={overview} label="Overview" icon={<I d={ICONS.overview} />} active={pathname === overview} />
            {offerId &&
              (ongoing[object] as Array<{ id: string; name: string; icon?: string; color?: string; face?: string | { svgPath: string } }>).map((o) => {
                const href = v2CatalogueHref(orgId, brandId, object, o.id);
                const face = typeof o.face === "string" ? o.face : o.face?.svgPath;
                return (
                  <NavItem
                    key={o.id}
                    href={href}
                    label={o.name}
                    icon={<CatalogueMark icon={o.icon} color={o.color} face={face} name={o.name} size={16} />}
                    active={pathname === href}
                  />
                );
              })}
          </Group>
        );
      })}
      <Group title="Workflows">
        <NavItem
          href={v2Href(orgId, brandId, "workflows")}
          label="Overview"
          icon={<I d={ICONS.overview} />}
          active={/\/workflows\/?$/.test(pathname)}
        />
        {offerId &&
          ongoing.workflows.map((w) => {
            const href = v2WorkflowHref(orgId, brandId, w.slug, w.crew, w.campaignId);
            const name = w.detail?.name ?? w.slug;
            return (
              <NavItem
                key={`${w.campaignId}:${w.slug}`}
                href={href}
                label={name}
                icon={<CatalogueMark icon={w.detail?.icon ?? "flow-arrow"} color={w.detail?.color} name={name} size={16} />}
                active={pathname.endsWith(`/workflows/${encodeURIComponent(w.slug)}`)}
              />
            );
          })}
      </Group>
    </>
  );
}
