"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatures } from "@/lib/features-context";
import { Skeleton } from "@/components/skeleton";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { formatCount } from "@/lib/format-number";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { RewardsCard } from "@/components/invite/rewards-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { campaignFunnel } from "@/lib/campaign-funnel";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { type Maturity } from "@/lib/feature-gates";
import { explicitHierarchyHref } from "@/lib/last-brand";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
  badge?: number;
  maturity?: Maturity;
}

function SidebarLink({
  item,
  isActive,
  badgePending = false,
}: {
  item: SidebarItem;
  isActive: boolean;
  // When true, render a skeleton pill instead of the count so a whole group of
  // entity badges reveals its numbers together (see BrandLevelSidebar).
  badgePending?: boolean;
}) {
  return (
    <Link
      href={item.href}
      // FULL prefetch, not Next's default. Every dashboard route is DYNAMIC (Clerk
      // `dynamic` on the provider), and for a dynamic route Next's default prefetch
      // fetches only the LAYOUTS — it stops at the nearest `loading.tsx`. So a click
      // still waits on a server round-trip for the page itself, and what fills that
      // wait is the nearest loading boundary: on any funnel / leg / settings
      // sub-route the nearest one is `offers/[offerId]/loading.tsx`, so drilling in
      // blanks the WHOLE offer area to a full-page skeleton. `prefetch` pulls the
      // page's own payload too, so the click has nothing left to wait for and the
      // boundary never renders. Bounded by construction: a sidebar holds a handful
      // of links and Next only prefetches the ones actually in the viewport.
      prefetch
      className={`
        flex min-w-0 items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition
        ${item.comingSoon
          ? "text-gray-400 opacity-60 hover:opacity-80"
          : isActive
            ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
        }
      `}
    >
      <span className={`h-5 w-5 shrink-0 ${item.comingSoon ? "text-gray-300" : isActive ? "text-brand-600" : "text-gray-400"}`}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.maturity && <MaturityBadge level={item.maturity} />}
      {badgePending ? (
        <Skeleton className="h-4 w-6 rounded-full" />
      ) : item.badge !== undefined ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}`}>
          {formatCount(item.badge)}
        </span>
      ) : null}
      {item.comingSoon && (
        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          Coming soon
        </span>
      )}
    </Link>
  );
}

// A single nav-row skeleton matching SidebarLink's layout (icon + label), used to
// reveal a whole sidebar nav group at once instead of static rows first / data rows later.
function SidebarNavRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="h-4 flex-1 max-w-[7rem] rounded" />
    </div>
  );
}

function SidebarSection({ topSlot, title, children, footer }: {
  // Beta chrome: the tenant switcher, rendered flush at the very top of the
  // sidebar so it sits level with the header row (the sidebar is a full-height
  // column to the LEFT of the header in the beta shell). It owns its own bottom
  // border at the header's height — do not wrap it in padding.
  topSlot?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="h-full w-56 max-w-[85vw] flex-shrink-0 flex-col border-r border-gray-200 bg-white flex">
      {topSlot}
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            {title}
          </h3>
        </div>
      )}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {children}
      </nav>
      {footer}
    </aside>
  );
}

// Icons as reusable components
const HomeIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const KeyIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const OrgIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);


const EnvelopeIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const NewspaperIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);


const CalendarIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DocumentIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const BillingIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);


const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h5v7H4V5zm0 8h6v6H5a1 1 0 01-1-1v-5zm10-9h5a1 1 0 011 1v5h-6V4zm0 8h6v6a1 1 0 01-1 1h-5v-7z" />
  </svg>
);

const AudiencesIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const LeadsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0M18 8.25h3m-1.5-1.5v3" />
  </svg>
);

/**
 * The offers nav mark — a TAG, matching the tile the tenant switcher draws for
 * an offer. The same thing wears the same mark wherever it appears, or the
 * switcher and the sidebar read as two products. Heroicons outline here rather
 * than the switcher's Phosphor duotone, because this is a nav glyph beside
 * other nav glyphs: the repo picks its icon set by ROLE, and a control takes
 * the single-weight set.
 */
const OffersIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h.008v.008H6V6z" />
  </svg>
);

const FunnelsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
  </svg>
);

const CampaignsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
);

const SettingsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// The product ships ONE feature, so the feature level was flattened into the
// brand: no `/features/[featureSlug]` segment. Brand-level sections live directly
// under `/orgs/[orgId]/brands/[brandId]/...`.
interface NavigationLevel {
  type: "app" | "org" | "brand" | "offer" | "funnel" | "campaign";
  orgId?: string;
  brandId?: string;
  offerId?: string;
  campaignId?: string;
  funnelKey?: string;
}

/**
 * The hierarchy is Org > Brand > Offer > Campaign, and this function keys on
 * segment INDICES — so inserting the offer segment moved everything under it one
 * place deeper. `.../brands/[brandId]/offers/[offerId]/campaigns/[id]` is
 * segments 0..7, and a campaign is now read at 6/7 rather than 4/5.
 */
function getNavigationLevel(segments: string[]): NavigationLevel {
  // /orgs/[orgId]/brands/[brandId]/offers/[offerId]/<section>/...
  if (segments[0] === "orgs" && segments[1]) {
    const orgId = segments[1];
    if (segments[2] === "brands" && segments[3]) {
      const brandId = segments[3];
      if (segments[4] === "offers" && segments[5]) {
        const offerId = segments[5];
        // Campaign LEVEL — `.../campaigns/[campaignId]/...` drills into ONE
        // campaign and swaps to the campaign sidebar. The campaigns LIST
        // (`.../campaigns` with no id) stays offer-level so the offer
        // "Campaigns" nav entry highlights.
        if (segments[6] === "campaigns" && segments[7]) {
          return { type: "campaign", orgId, brandId, offerId, campaignId: segments[7] };
        }
        // Funnel LEVEL — `.../funnels/[funnelKey]` is the level between the offer and
        // a campaign: an offer sells through funnels, and a campaign buys one LEG of
        // one of them. It gets its own sidebar so the crumb names the funnel you are
        // standing in rather than leaving it to the page heading.
        if (segments[6] === "funnels" && segments[7]) {
          return { type: "funnel", orgId, brandId, offerId, funnelKey: segments[7] };
        }
        return { type: "offer", orgId, brandId, offerId };
      }
      // Every brand section — root overview AND settings / brand-info /
      // workflows — renders the SAME brand sidebar. Settings + Info + Workflows
      // are flat links in that sidebar's footer, so the sidebar stays mounted and
      // the clicked link goes blue instead of swapping to a separate Settings
      // sidebar level.
      return { type: "brand", orgId, brandId };
    }
    return { type: "org", orgId };
  }
  return { type: "app" };
}

// App Level Sidebar — the dashboard root only routes (redirects to /orgs), so
// there is no app-level nav. The old build-in-public "public metrics" section
// was removed.
function AppLevelSidebar() {
  return null;
}

// Org Settings Level Sidebar.
//
// There is no org NAV LEVEL: its only item was "Overview", which was just a
// brand picker, and the brand picker lives in the tenant switcher. What is left
// of the org granularity is a settings surface — Billing (GA) plus the two
// flag-gated org services — so it gets its own dedicated sidebar, reached from
// the switcher's Billing entry. Billing keeps its URL (`/orgs/[orgId]/billing`);
// billing-guard, credit-alerts and onboarding all deep-link to it.
//
// On the bare org landing (`/orgs/[orgId]`, the last-brand resolver / empty-org
// state) there is nothing to navigate to, so the sidebar is the switcher alone.
function OrgLevelSidebar({ orgId, pathname }: { orgId: string; pathname: string }) {
  const isSettingsPath =
    pathname.startsWith(`/orgs/${orgId}/billing`) ||
    pathname.startsWith(`/orgs/${orgId}/api-keys`) ||
    pathname.startsWith(`/orgs/${orgId}/provider-keys`);

  return (
    <SidebarSection topSlot={<TenantSwitcher />}>
      {isSettingsPath && (
        <>
          <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Organization</h4>
          <SidebarLink
            item={{ id: "billing", label: "Billing", href: `/orgs/${orgId}/billing`, icon: <BillingIcon /> }}
            isActive={pathname.startsWith(`/orgs/${orgId}/billing`)}
          />
          {/* GA. It was gated on `alpha-keys`, and `useFeatureFlag` returns
              false unconditionally in the dashboard — so this entry was hidden
              from everyone, staff included, and the page was reachable only by
              typing its URL. `/provider-keys` is a redirect kept for old links. */}
          <SidebarLink
            item={{
              id: "api-keys",
              label: "API Key",
              href: `/orgs/${orgId}/api-keys`,
              icon: <KeyIcon />,
            }}
            isActive={pathname.startsWith(`/orgs/${orgId}/api-keys`) || pathname.startsWith(`/orgs/${orgId}/provider-keys`)}
          />
        </>
      )}
    </SidebarSection>
  );
}

// Brand Level Sidebar — the product ships the primary feature at the brand level,
// so everything collapses to the brand level: Overview, the entity Database,
// and the Brand Settings entry. The sole feature's slug is
// resolved from features-context (no `/features/[featureSlug]` segment, no
// campaign level).
function BrandLevelSidebar({ orgId, brandId, pathname }: {
  orgId: string;
  brandId: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const { isLoading: featuresLoading } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  // Brand Info and Workflows were `useFeatureFlag`-gated here, which returns false
  // unconditionally in the dashboard — so both entries were hidden from everyone and
  // their pages were reachable only by typing a URL. Both surfaces live in
  // `apps/admin`, where alpha gating actually resolves; the dashboard copies were
  // deleted rather than graduated. Do not re-add a `useFeatureFlag` entry here: in
  // this app it does not stage a surface, it removes it.

  // The old "Database" section (raw entity rows: Leads/Emails/Outlets/…) stays
  // removed. Engaged leads are now surfaced under Audiences; the per-entity count
  // queries + badge-reveal plumbing that fed Database remain dropped.
  const defsReady = !featuresLoading;

  // Revenue surface (Overview) — only on revenue features (sales-cold-email
  // today). GA. Overview is the brand root.
  const revenueOk = isRevenueFeature(featureSlug);
  const topItems: SidebarItem[] = [
    ...(revenueOk
      ? [
          {
            id: "overview",
            label: "Overview",
            href: explicitHierarchyHref(basePath),
            icon: <OverviewIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    // OFFERS — the brand's own list, directly under Overview. It is to the brand
    // what Campaigns is to an offer: the Overview carries the table beneath its
    // chart, and this gives the same table a page of its own. One COMPONENT
    // serves both, so a row cannot read one way here and another there.
    ...(revenueOk
      ? [
          {
            id: "brand-offers",
            label: "Offers",
            href: `${basePath}/offers`,
            icon: <OffersIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    // Campaigns and Audiences moved DOWN a level, to the offer. A campaign sells
    // one proposition and an audience is a set of people picked for one, so at
    // brand level each of those lists would pool several offers under one heading.
    // The brand Overview lists the offers instead, and each opens its own sidebar.
    //
    // LEADS is the exception, and it is one on purpose. A lead is a PERSON, not a
    // statement about a proposition, and lead-service attributes each one to the
    // campaign that contacted them — including campaigns created before the offer
    // level existed, which name no offer at all. Those people are the brand's and
    // belong to no offer, so without a brand-level list they are reachable from
    // nowhere. It lives at `/leads` rather than under `audiences/`: audiences are
    // the offer's now, so a brand path under that segment would name a level that
    // is no longer there.
    ...(revenueOk
      ? [
          {
            id: "brand-leads",
            label: "Leads",
            href: `${basePath}/leads`,
            icon: <LeadsIcon />,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection
      // No "Brand" section title and no back-link to the org: the tenant switcher
      // above already names the brand and carries the org as a row inside it.
      topSlot={<TenantSwitcher />}
      footer={
        // Anchored to the bottom (outside the scrollable nav): Brand Settings,
        // then the rewards card.
        <div className="border-t border-gray-100">
          <div className="p-2 space-y-0.5">
            <SidebarLink
              item={{
                id: "settings",
                label: "Brand Settings",
                href: `${basePath}/settings`,
                icon: <SettingsIcon />,
              }}
              isActive={pathname === `${basePath}/settings`}
            />
          </div>
          <RewardsCard />
        </div>
      }
    >
      {/* Top nav is static (Overview + Audiences). Held behind `defsReady` only
          to avoid a flash before the sole feature resolves. */}
      {!defsReady ? (
        <>
          {[0, 1, 2].map((i) => (
            <SidebarNavRowSkeleton key={`top-${i}`} />
          ))}
        </>
      ) : (
        <>
          {topItems.map((item) => (
            <SidebarLink
              key={item.id}
              item={item}
              isActive={
                item.id === "overview"
                  ? pathname === basePath
                  : item.id === "audiences"
                    ? pathname === item.href
                  : pathname.startsWith(item.href)
              }
            />
          ))}
        </>
      )}
    </SidebarSection>
  );
}

// Campaign Level Sidebar (v2 — #2762) — mirrors the brand sidebar layout but
// drilled into ONE campaign. Overview + Leads are scoped to the campaign
// (campaign-filtered pages); Strategy + Audiences are campaign-scoped views of the
// brand's shared config (a campaign inherits what campaign-service does not store
// per campaign). GA: shown on every revenue feature, no staff gate, no beta badge.
/**
 * ONE sales funnel, the level between an offer and a campaign.
 *
 * An offer sells through funnels and a campaign buys one LEG of one of them, so this
 * is where a return exists and the campaigns beneath it are what produced it. The
 * sidebar names the funnel, so a reader standing in it knows which funnel they
 * are looking at without reading the page heading.
 */
function FunnelLevelSidebar({ orgId, brandId, offerId, funnelKey, pathname }: {
  orgId: string;
  brandId: string;
  offerId: string;
  funnelKey: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const revenueOk = isRevenueFeature(featureSlug);
  const offerPath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;
  const funnelBase = `${offerPath}/funnels/${funnelKey}`;

  // The funnel does NOT name itself here: the top bar's breadcrumb does, the way it
  // names the campaign one level down. Two places naming the same thing is how they
  // come to disagree, and a sidebar that repeats the crumb wastes the one row a
  // reader scans for where they can GO.
  const items: SidebarItem[] = revenueOk
    ? [
        { id: "funnel-overview", label: "Overview", href: funnelBase, icon: <OverviewIcon /> },
        {
          id: "funnel-campaigns",
          label: "Campaigns",
          href: `${funnelBase}/campaigns`,
          icon: <CampaignsIcon />,
        },
        { id: "funnel-leads", label: "Leads", href: `${funnelBase}/leads`, icon: <LeadsIcon /> },
        {
          id: "funnel-audiences",
          label: "Audiences",
          href: `${funnelBase}/audiences`,
          icon: <AudiencesIcon />,
        },
      ]
    : [];

  return (
    <SidebarSection
      topSlot={<TenantSwitcher />}
      // Configuration is not a place you work, so it is anchored at the bottom —
      // exactly like Campaign Settings in the campaign sidebar and Offer Settings in
      // the offer one.
      footer={
        <div className="border-t border-gray-100">
          <div className="p-2 space-y-0.5">
            <SidebarLink
              item={{
                id: "funnel-settings",
                label: "Sales Funnel Settings",
                href: `${funnelBase}/settings`,
                icon: <SettingsIcon />,
              }}
              isActive={pathname === `${funnelBase}/settings`}
            />
          </div>
          <RewardsCard />
        </div>
      }
    >
      {items.map((item) => (
        <SidebarLink key={item.id} item={item} isActive={pathname === item.href} />
      ))}
    </SidebarSection>
  );
}

function CampaignLevelSidebar({ orgId, brandId, offerId, campaignId, pathname }: {
  orgId: string;
  brandId: string;
  offerId: string;
  campaignId: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const revenueOk = isRevenueFeature(featureSlug);
  // A campaign lives under the OFFER it sells, so its base path and its back-link
  // both climb to the offer, never to the brand two levels up.
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;
  const campaignBase = `${basePath}/campaigns/${campaignId}`;

  const items: SidebarItem[] =
    revenueOk
      ? [
          {
            id: "campaign-overview",
            label: "Overview",
            href: campaignBase,
            icon: <OverviewIcon />,
          },
          {
            id: "campaign-leads",
            label: "Leads",
            href: `${campaignBase}/leads`,
            icon: <LeadsIcon />,
          },
          // Campaign-scoped view of the brand's audiences. It stays INSIDE the
          // campaign and narrows to it wherever campaign-service stores a
          // per-campaign value (the targeted audience subset, the outreach the
          // numbers count); the rest is brand config the campaign inherits.
          {
            id: "audiences",
            label: "Audiences",
            href: `${campaignBase}/audiences`,
            icon: <AudiencesIcon />,
          },
        ]
      : [];

  return (
    <SidebarSection
      topSlot={<TenantSwitcher />}
      // Brand Settings is a BRAND-level surface, so it belongs to the brand
      // sidebar the back-link leads to, not inside a campaign. What DOES belong
      // here is the campaign's own settings, anchored at the bottom exactly like
      // Offer Settings in the offer sidebar and Brand Settings in the brand one:
      // configuration is not a place you work.
      footer={
        <div className="border-t border-gray-100">
          <div className="p-2 space-y-0.5">
            <SidebarLink
              item={{
                id: "campaign-settings",
                label: "Campaign Settings",
                href: `${campaignBase}/settings`,
                icon: <SettingsIcon />,
              }}
              isActive={pathname === `${campaignBase}/settings`}
            />
          </div>
          <RewardsCard />
        </div>
      }
    >
      {items.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={
            item.id === "campaign-overview"
              ? pathname === campaignBase
              : pathname.startsWith(item.href)
          }
        />
      ))}
    </SidebarSection>
  );
}

// Offer Level Sidebar — the level between the brand and its campaigns.
//
// It carries what a PROPOSITION owns: its Overview, the campaigns that sell it,
// the audiences picked for it and the leads those audiences produced. All four
// used to sit on the brand, where they pooled every offer under one heading.
// Brand Settings is not here: identity, domain and the conversion snippet belong
// to the brand, so they live in the sidebar the back-link leads to.
function OfferLevelSidebar({ orgId, brandId, offerId, pathname }: {
  orgId: string;
  brandId: string;
  offerId: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const { isLoading: featuresLoading } = useFeatures();
  const brandPath = `/orgs/${orgId}/brands/${brandId}`;
  const basePath = `${brandPath}/offers/${offerId}`;
  const revenueOk = isRevenueFeature(featureSlug);
  const defsReady = !featuresLoading;

  const items: SidebarItem[] = [
    ...(revenueOk
      ? [
          {
            id: "overview",
            label: "Overview",
            href: basePath,
            icon: <OverviewIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    ...(revenueOk
      ? [
          {
            id: "offer-funnels",
            label: "Sales funnels",
            href: `${basePath}/funnels`,
            icon: <FunnelsIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    ...(revenueOk
      ? [
          {
            id: "audiences",
            label: "Audiences",
            href: `${basePath}/audiences`,
            icon: <AudiencesIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    ...(revenueOk
      ? [
          {
            id: "audience-leads",
            label: "Leads",
            href: `${basePath}/audiences/leads`,
            icon: <LeadsIcon />,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection
      topSlot={<TenantSwitcher />}
      footer={
        // Anchored to the bottom, outside the scrollable nav, exactly like the
        // brand sidebar's own Settings link: what the offer PROMISES and the
        // funnels it is sold through are configuration, not a place you work.
        <div className="border-t border-gray-100">
          <div className="p-2 space-y-0.5">
            <SidebarLink
              item={{
                id: "offer-settings",
                label: "Offer Settings",
                href: `${basePath}/settings`,
                icon: <SettingsIcon />,
              }}
              isActive={pathname === `${basePath}/settings`}
            />
          </div>
          <RewardsCard />
        </div>
      }
    >
      {!defsReady ? (
        <>
          {[0, 1, 2].map((i) => (
            <SidebarNavRowSkeleton key={`offer-${i}`} />
          ))}
        </>
      ) : (
        items.map((item) => (
          <SidebarLink
            key={item.id}
            item={item}
            isActive={
              item.id === "overview"
                ? pathname === basePath
                : item.id === "audiences"
                  ? pathname === item.href
                  : pathname.startsWith(item.href)
            }
          />
        ))
      )}
    </SidebarSection>
  );
}

export function ContextSidebar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const level = getNavigationLevel(segments);

  switch (level.type) {
    case "app":
      return <AppLevelSidebar />;
    case "org":
      return <OrgLevelSidebar orgId={level.orgId!} pathname={pathname} />;
    case "brand":
      return <BrandLevelSidebar orgId={level.orgId!} brandId={level.brandId!} pathname={pathname} />;
    case "offer":
      return (
        <OfferLevelSidebar
          orgId={level.orgId!}
          brandId={level.brandId!}
          offerId={level.offerId!}
          pathname={pathname}
        />
      );
    case "funnel":
      return (
        <FunnelLevelSidebar
          orgId={level.orgId!}
          brandId={level.brandId!}
          offerId={level.offerId!}
          funnelKey={level.funnelKey!}
          pathname={pathname}
        />
      );
    case "campaign":
      return (
        <CampaignLevelSidebar
          orgId={level.orgId!}
          brandId={level.brandId!}
          offerId={level.offerId!}
          campaignId={level.campaignId!}
          pathname={pathname}
        />
      );
    default:
      return <AppLevelSidebar />;
  }
}
