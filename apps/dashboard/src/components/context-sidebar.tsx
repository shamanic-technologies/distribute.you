"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useFeatures } from "@/lib/features-context";
import { useEntityRegistry } from "@/lib/entity-registry-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { Skeleton } from "@/components/skeleton";
import {
  fetchFeatureStats,
  listBrandOutlets,
  listJournalistsEnriched,
  listBrandLeads,
  listBrandEmails,
  listBrandArticles,
  listAllRankedOpportunities,
} from "@/lib/api";
import { isOpportunityOpen } from "@/lib/quote-pitch-status";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { formatCount } from "@/lib/format-number";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { MaturityBadge } from "@/components/maturity-badge";
import { FEATURE_GATES, type Maturity } from "@/lib/feature-gates";
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

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={explicitHierarchyHref(href)}
      className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-600 mb-2 transition"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </Link>
  );
}

function SidebarSection({ title, backHref, backLabel, children, footer }: {
  title?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <aside className="h-full w-56 max-w-[85vw] flex-shrink-0 flex-col border-r border-gray-200 bg-white flex">
      {(title || backHref) && (
        <div className="px-4 py-3 border-b border-gray-100">
          {backHref && backLabel && <BackLink href={backHref} label={backLabel} />}
          {title && (
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
          )}
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

const InfoIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

const WorkflowIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
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

const CrmIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h5v7H4V5zm0 8h6v6H5a1 1 0 01-1-1v-5zm10-9h5a1 1 0 011 1v5h-6V4zm0 8h6v6a1 1 0 01-1 1h-5v-7z" />
  </svg>
);

const PersonasIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const BrandProfileIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
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
  type: "app" | "org" | "brand" | "brandSettings";
  orgId?: string;
  brandId?: string;
}

function getNavigationLevel(segments: string[]): NavigationLevel {
  // /orgs/[orgId]/brands/[brandId]/<section>/...
  if (segments[0] === "orgs" && segments[1]) {
    const orgId = segments[1];
    if (segments[2] === "brands" && segments[3]) {
      const brandId = segments[3];
      const section = segments[4];
      // Brand Settings group: settings / brand-profile / brand-info / workflows(list+new).
      if (
        section === "settings" ||
        section === "brand-profile" ||
        section === "brand-info" ||
        section === "workflows"
      ) {
        return { type: "brandSettings", orgId, brandId };
      }
      // Everything else → brand sidebar: root overview and every entity page
      // (leads / emails / outlets / journalists / articles / competitors /
      // prompts / quote-pitches / quote-requests / visibility-runs).
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

// Org Level Sidebar
function OrgLevelSidebar({ orgId, pathname }: { orgId: string; pathname: string }) {
  // Features are no longer surfaced at the org granularity — they live under
  // brands and the app-level nav. CRM + Keys are alpha (staff-only); Billing is GA.
  const crmEnabled = useFeatureFlag(FEATURE_GATES["services-crm"].flag);
  const keysEnabled = useFeatureFlag(FEATURE_GATES["keys"].flag);
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: explicitHierarchyHref(`/orgs/${orgId}`), icon: <HomeIcon /> },
  ];

  return (
    <SidebarSection title="Organization">
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "overview" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      {crmEnabled && (
        <div className="pt-2 mt-2 border-t border-gray-100">
          <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Services</h4>
          <SidebarLink
            item={{
              id: "crm",
              label: "CRM (Google)",
              href: `/orgs/${orgId}/services/crm`,
              icon: <CrmIcon />,
              maturity: FEATURE_GATES["services-crm"].maturity,
            }}
            isActive={pathname.startsWith(`/orgs/${orgId}/services/crm`)}
          />
        </div>
      )}
      <div className="pt-2 mt-2 border-t border-gray-100">
        {keysEnabled && (
          <SidebarLink
            item={{
              id: "api-keys",
              label: "Keys",
              href: `/orgs/${orgId}/api-keys`,
              icon: <KeyIcon />,
              maturity: FEATURE_GATES["keys"].maturity,
            }}
            isActive={pathname.startsWith(`/orgs/${orgId}/api-keys`) || pathname.startsWith(`/orgs/${orgId}/provider-keys`)}
          />
        )}
        <SidebarLink
          item={{ id: "billing", label: "Billing", href: `/orgs/${orgId}/billing`, icon: <BillingIcon /> }}
          isActive={pathname.startsWith(`/orgs/${orgId}/billing`)}
        />
      </div>
    </SidebarSection>
  );
}

// Entity icon mapping for sidebar — maps registry icon names to SVG components
const ENTITY_ICON_MAP: Record<string, () => React.ReactNode> = {
  users: () => <OrgIcon />,
  newspaper: () => <OrgIcon />,
  "pen-tool": () => <NewspaperIcon />,
  "scroll-text": () => <DocumentIcon />,
  building: () => <OrgIcon />,
  envelope: () => <EnvelopeIcon />,
  document: () => <DocumentIcon />,
};

function getEntitySidebarIcon(iconName: string): React.ReactNode {
  const iconFn = ENTITY_ICON_MAP[iconName];
  return iconFn ? iconFn() : <WorkflowIcon />;
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
  const isBeta = useIsBetaUser();
  const { getFeature, isLoading: featuresLoading } = useFeatures();
  const { registry, isLoading: registryLoading } = useEntityRegistry();
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const feature = getFeature(featureSlug);
  const entities = feature?.entities ?? [];
  const entityNames = useMemo(() => entities.map((e) => e.name), [entities]);

  // Feature stats scoped to this brand — same pattern as campaign sidebar
  const resolvedFeatureSlug = feature?.slug;
  const statsEnabled = !!resolvedFeatureSlug;
  const { data: featureStatsData, isPending: statsPending } = useAuthQuery(
    ["featureStats", resolvedFeatureSlug, "brand", brandId],
    () => fetchFeatureStats(resolvedFeatureSlug!, { brandId }),
    { enabled: statsEnabled, refetchInterval: 5_000, placeholderData: keepPreviousData },
  );
  const fStats = featureStatsData?.stats ?? {};

  // Listing fallbacks for entities without a countKey — filtered by featureSlug
  const outletsEnabled = entityNames.includes("outlets");
  const { data: outletsData, isPending: outletsPending } = useAuthQuery(
    ["brandOutlets", brandId, featureSlug],
    () => listBrandOutlets(brandId, featureSlug),
    { enabled: outletsEnabled, refetchInterval: 5_000 },
  );
  const journalistsEnabled = entityNames.includes("journalists");
  const { data: journalistsData, isPending: journalistsPending } = useAuthQuery(
    ["enrichedJournalists", brandId, featureSlug],
    () => listJournalistsEnriched(brandId, { featureSlug }),
    { enabled: journalistsEnabled, refetchInterval: 5_000 },
  );
  const leadsEnabled = entityNames.includes("leads");
  const { data: leadsData, isPending: leadsPending } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { enabled: leadsEnabled, refetchInterval: 5_000 },
  );
  const emailsEnabled = entityNames.includes("emails");
  const { data: emailsData, isPending: emailsPending } = useAuthQuery(
    ["brandEmails", brandId],
    () => listBrandEmails(brandId),
    { enabled: emailsEnabled, refetchInterval: 5_000 },
  );
  const articlesEnabled = entityNames.includes("articles");
  const { data: articlesData, isPending: articlesPending } = useAuthQuery(
    ["brandArticles", brandId, featureSlug],
    () => listBrandArticles(brandId, featureSlug),
    { enabled: articlesEnabled, refetchInterval: 5_000 },
  );
  // Gold catalog (GET /orgs/opportunities) — same source the quote-requests page
  // renders, so the badge equals the page count.
  const rankedOppsEnabled = entityNames.includes("quote-requests");
  const { data: rankedOppsData, isPending: rankedOppsPending } = useAuthQuery(
    ["rankedOpportunities", { brandId }],
    () => listAllRankedOpportunities({ brandId }),
    { enabled: rankedOppsEnabled, refetchInterval: 5_000 },
  );

  // Reveal EVERY entity badge together (one paint), then keep the numbers
  // latched. A disabled query stays `isPending: true` forever, so each flag is
  // gated behind its own `enabled` condition. `defsReady` gates the barrier FIRST
  // (until the feature + registry load, entityNames is empty → every count query
  // disabled). See CLAUDE.md → "Coordinated reveal".
  const defsReady = !featuresLoading && !registryLoading;
  const badgesRevealed = useCoordinatedReveal([
    defsReady,
    !statsEnabled || !statsPending,
    !outletsEnabled || !outletsPending,
    !journalistsEnabled || !journalistsPending,
    !leadsEnabled || !leadsPending,
    !emailsEnabled || !emailsPending,
    !articlesEnabled || !articlesPending,
    !rankedOppsEnabled || !rankedOppsPending,
  ]);

  const listingFallback: Record<string, number | undefined> = {
    leads: leadsData?.leads?.length,
    emails: emailsData?.emails?.length,
    outlets: outletsData?.total,
    journalists: journalistsData?.total ?? journalistsData?.journalists?.length,
    articles: articlesData?.discoveries?.length,
    // Open (non-pitched) count so the badge == the queue the page renders.
    "quote-requests": rankedOppsData?.opportunities.filter((o) =>
      isOpportunityOpen(o.pitchStatus),
    ).length,
  };

  const entityCounts = useMemo(() => {
    const result: Record<string, number | undefined> = {};
    for (const entity of entities) {
      if (listingFallback[entity.name] != null) {
        result[entity.name] = listingFallback[entity.name];
      } else if (entity.countKey && fStats[entity.countKey] != null) {
        result[entity.name] = fStats[entity.countKey];
      }
    }
    return result;
  }, [entities, fStats, listingFallback]);

  const entityItems: SidebarItem[] = entities
    .filter((e) => registry[e.name])
    // No companies page yet (blocked on a brand-scoped companies API) — the
    // backend declares the entity, so the link would 404. Hide it until the page
    // exists. Campaign-level companies page is unaffected.
    .filter((e) => e.name !== "companies")
    .map((e) => {
      const config = registry[e.name];
      return {
        id: e.name,
        label: config.label,
        href: `${basePath}/${config.pathSuffix}`,
        icon: getEntitySidebarIcon(config.icon),
        badge: entityCounts[e.name],
      };
    });

  // Revenue surface (Overview) — only on revenue features (sales-cold-email
  // today). GA. Overview is the brand root. Audiences is still gated to the
  // email allowlist; Brand Profile lives under Brand Settings.
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
    // Audiences — Apollo-style targeting cards. Email-allowlist gate.
    ...(revenueOk && isBeta
      ? [
          {
            id: "personas",
            label: "Audiences",
            href: `${basePath}/personas`,
            icon: <PersonasIcon />,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection title="Brand" backHref={`/orgs/${orgId}`} backLabel="Overview">
      {/* Reveal the WHOLE nav as one group: top items are static and the Database
          items need feature + registry defs. Hold everything behind `defsReady`
          with skeleton rows, then render every item together. Badge numbers are a
          finer sub-group revealed via badgePending. */}
      {!defsReady ? (
        <>
          {[0, 1, 2].map((i) => (
            <SidebarNavRowSkeleton key={`top-${i}`} />
          ))}
          <div className="pt-2 mt-2 border-t border-gray-100">
            <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Database</h4>
            {[0, 1, 2, 3].map((i) => (
              <SidebarNavRowSkeleton key={`out-${i}`} />
            ))}
          </div>
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
                  : pathname.startsWith(item.href)
              }
            />
          ))}
          {entityItems.length > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Database</h4>
              {entityItems.map((item) => (
                <SidebarLink
                  key={item.id}
                  item={item}
                  badgePending={!badgesRevealed}
                  isActive={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          )}
          <div className="pt-2 mt-2 border-t border-gray-100">
            <SidebarLink
              item={{
                id: "settings",
                label: "Brand Settings",
                href: `${basePath}/settings`,
                icon: <SettingsIcon />,
              }}
              isActive={pathname.startsWith(`${basePath}/settings`)}
            />
          </div>
        </>
      )}
    </SidebarSection>
  );
}

// Brand Settings Level Sidebar — Brand Settings + Brand Profile + Brand Info,
// plus the Workflows list folded in from the old Feature Settings level.
function BrandSettingsLevelSidebar({ orgId, brandId, pathname }: {
  orgId: string;
  brandId: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const isBeta = useIsBetaUser();
  const brandBase = `/orgs/${orgId}/brands/${brandId}`;
  const basePath = `${brandBase}/settings`;
  const brandProfileOk = isRevenueFeature(featureSlug) && isBeta;
  // Brand Info + Workflows are alpha (staff-only); default-hidden until PostHog resolves.
  const brandInfoOk = useFeatureFlag(FEATURE_GATES["brand-info"].flag);
  const workflowsOk = useFeatureFlag(FEATURE_GATES["workflows"].flag);

  const items: SidebarItem[] = [
    { id: "settings", label: "Brand Settings", href: basePath, icon: <SettingsIcon /> },
  ];
  if (brandProfileOk) {
    items.push({
      id: "brand-profile",
      label: "Brand Profile",
      href: `${brandBase}/brand-profile`,
      icon: <BrandProfileIcon />,
    });
  }
  if (brandInfoOk) {
    items.push({
      id: "brand-info",
      label: "Brand Info",
      href: `${brandBase}/brand-info`,
      icon: <InfoIcon />,
      maturity: FEATURE_GATES["brand-info"].maturity,
    });
  }
  if (workflowsOk) {
    items.push({
      id: "workflows",
      label: "Workflows",
      href: `${brandBase}/workflows`,
      icon: <WorkflowIcon />,
      maturity: FEATURE_GATES["workflows"].maturity,
    });
  }

  return (
    <SidebarSection title="Settings" backHref={brandBase} backLabel="Brand">
      {items.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
        />
      ))}
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
    case "brandSettings":
      return <BrandSettingsLevelSidebar orgId={level.orgId!} brandId={level.brandId!} pathname={pathname} />;
    default:
      return <AppLevelSidebar />;
  }
}
