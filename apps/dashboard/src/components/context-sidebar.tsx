"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { formatCount } from "@/lib/format-number";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { MaturityBadge } from "@/components/maturity-badge";
import { FEATURE_GATES, GA_BRAND_FEATURES, type Maturity } from "@/lib/feature-gates";
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
  // entity badges reveals its numbers together (see FeatureLevelSidebar).
  badgePending?: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition
        ${item.comingSoon
          ? "text-gray-400 opacity-60 hover:opacity-80"
          : isActive
            ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
        }
      `}
    >
      <span className={`w-5 h-5 ${item.comingSoon ? "text-gray-300" : isActive ? "text-brand-600" : "text-gray-400"}`}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
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
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full">
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

const ProviderKeyIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const OrgIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const BrandIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
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

const PlusIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ReportIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ConversionsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l6-6 4 4 7-8m0 0h-4m4 0v4" />
  </svg>
);

const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h5v7H4V5zm0 8h6v6H5a1 1 0 01-1-1v-5zm10-9h5a1 1 0 011 1v5h-6V4zm0 8h6v6a1 1 0 01-1 1h-5v-7z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

// Features that expose the public client report. Generic across features
// once a backend public-proxy lands; gated for now. The pr-expert-quote-*
// family is matched via isExpertQuoteFeature (not listed here) so a workflow
// re-version doesn't drop the report link.
const REPORT_ENABLED_FEATURES = new Set([
  "sales-cold-email-outreach",
]);

const ICON_NAME_MAP: Record<string, () => React.ReactNode> = {
  globe: () => <BrandIcon />,
  megaphone: () => <NewspaperIcon />,
  envelope: () => <EnvelopeIcon />,
  document: () => <DocumentIcon />,
  calendar: () => <CalendarIcon />,
  building: () => <OrgIcon />,
};

function getFeatureIcon(featureSlug: string, icon?: string): React.ReactNode {
  // Map icon name strings to actual icon components
  if (icon && ICON_NAME_MAP[icon]) return ICON_NAME_MAP[icon]();
  // Fallback to slug-based icons
  if (featureSlug.startsWith("sales")) return <EnvelopeIcon />;
  if (featureSlug.startsWith("outlets")) return <OrgIcon />;
  if (featureSlug.startsWith("journalists")) return <NewspaperIcon />;
  if (featureSlug.startsWith("press-kit")) return <DocumentIcon />;
  if (featureSlug.startsWith("webinar")) return <CalendarIcon />;
  if (featureSlug.startsWith("welcome")) return <EnvelopeIcon />;
  return <WorkflowIcon />;
}

interface NavigationLevel {
  type: "app" | "appFeature" | "org" | "brand" | "brandSettings" | "feature" | "featureSettings" | "workflow" | "campaign";
  orgId?: string;
  brandId?: string;
  featureSlug?: string;
  campaignId?: string;
  workflowId?: string;
  featureId?: string;
}

function getNavigationLevel(segments: string[]): NavigationLevel {
  // /orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]
  if (segments[0] === "orgs" && segments[1]) {
    const orgId = segments[1];
    if (segments[2] === "brands" && segments[3]) {
      const brandId = segments[3];
      if (segments[4] === "settings" || segments[4] === "brand-info" || segments[4] === "usage") {
          return { type: "brandSettings", orgId, brandId };
        }
        if (segments[4] === "features" && segments[5]) {
        const featureSlug = segments[5];
        if (segments[6] === "campaigns" && segments[7]) {
          if (segments[7] === "new") {
            return { type: "feature", orgId, brandId, featureSlug };
          }
          return { type: "campaign", orgId, brandId, featureSlug, campaignId: segments[7] };
        }
        if (segments[6] === "workflows" && segments[7]) {
          return { type: "workflow", orgId, brandId, featureSlug, workflowId: segments[7] };
        }
        // Feature Settings sub-level — its landing (/settings, the Sales
        // Economics page, GA) and the Workflows list (staff-only) both render the
        // FeatureSettingsLevelSidebar. Mirrors how /settings routes to brandSettings.
        if (segments[6] === "settings" || segments[6] === "workflows") {
          return { type: "featureSettings", orgId, brandId, featureSlug };
        }
        return { type: "feature", orgId, brandId, featureSlug };
      }
      return { type: "brand", orgId, brandId };
    }
    return { type: "org", orgId };
  }
  // App-level feature: /features/[featureId] or /features/[featureId]/new
  if (segments[0] === "features" && segments[1]) {
    return { type: "appFeature", featureId: segments[1] };
  }
  return { type: "app" };
}

// App Level Sidebar
function AppLevelSidebar({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const analyticsItems: SidebarItem[] = [
    { id: "landing", label: "Unique visitors", href: "/?view=landing", icon: <OverviewIcon /> },
    { id: "signups", label: "Signup conversions", href: "/?view=signups", icon: <ConversionsIcon /> },
    { id: "cards", label: "Cards added", href: "/?view=cards", icon: <BillingIcon /> },
  ];

  const activeView = searchParams.get("view");
  const normalizedView = activeView === "signups" || activeView === "cards" ? activeView : "landing";

  return (
    <SidebarSection title="Dashboard">
      {analyticsItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={pathname === "/" && normalizedView === item.id}
        />
      ))}
    </SidebarSection>
  );
}

// Org Level Sidebar
function OrgLevelSidebar({ orgId, pathname }: { orgId: string; pathname: string }) {
  // Features are no longer surfaced at the org granularity — they live under
  // brands and the app-level nav. CRM + Keys are alpha (staff-only); Billing is GA.
  const crmEnabled = useFeatureFlag(FEATURE_GATES["services-crm"].flag);
  const keysEnabled = useFeatureFlag(FEATURE_GATES["keys"].flag);
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: explicitHierarchyHref(`/orgs/${orgId}`), icon: <HomeIcon /> },
    { id: "brands", label: "Brands", href: `/orgs/${orgId}/brands`, icon: <BrandIcon /> },
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

// Icons for outcomes section
const OutcomeOutletIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const OutcomeArticleIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
  </svg>
);

const OutcomeLeadIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Ordered feature groups for the brand sidebar. Each feature slug belongs to one
// group, rendered top-to-bottom in this order. Any feature the backend returns
// that isn't listed here lands in a trailing "Other" group, so a newly-shipped
// feature is never silently hidden from the nav (fail-visible).
const BRAND_FEATURE_GROUPS: { title: string; slugs: string[] }[] = [
  { title: "Sales Outreach", slugs: ["sales-cold-email-outreach"] },
  { title: "Press Outreach", slugs: ["pr-cold-email-outreach", "pr-expert-quote-outreach"] },
  { title: "Investors Outreach", slugs: ["vc-cold-email-outreach", "accelerators-cold-email-outreach"] },
  { title: "Hiring Outreach", slugs: ["hiring-cold-email-outreach"] },
  { title: "Tools", slugs: ["press-kit-page-generation", "outlet-database-discovery", "ai-visibility-scoring", "pr-expert-quote-opportunities"] },
];

// Brand Level Sidebar
function BrandLevelSidebar({ orgId, brandId, pathname }: { orgId: string; brandId: string; pathname: string }) {
  const { features, isLoading: featuresLoading } = useFeatures();
  // Immature features are alpha (staff-only). Default-hidden until PostHog
  // resolves the flag, so they never flash for a non-staff viewer. Brand Info
  // moved under Brand Settings — see BrandSettingsLevelSidebar.
  const featuresAlphaOk = useFeatureFlag(FEATURE_GATES["brand-features"].flag);
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: explicitHierarchyHref(basePath), icon: <HomeIcon /> },
  ];

  // Every feature except the GA exceptions renders under the brand-features
  // alpha gate; the exceptions stay GA (no flag, no badge).
  const featureItems: SidebarItem[] = features
    .filter((f) => GA_BRAND_FEATURES.has(f.slug) || featuresAlphaOk)
    .map((f) => ({
      id: f.slug,
      label: f.name,
      href: `${basePath}/features/${f.slug}`,
      icon: getFeatureIcon(f.slug, f.icon),
      comingSoon: !f.implemented,
      maturity: GA_BRAND_FEATURES.has(f.slug) ? undefined : FEATURE_GATES["brand-features"].maturity,
    }));

  // Group the gated feature items by BRAND_FEATURE_GROUPS order. Empty groups are
  // dropped; any feature not in a declared group falls into a trailing "Other"
  // group so a newly-shipped feature never disappears from the nav.
  const featureItemBySlug = new Map(featureItems.map((i) => [i.id, i]));
  const groupedSlugs = new Set(BRAND_FEATURE_GROUPS.flatMap((g) => g.slugs));
  const featureSections: { title: string; items: SidebarItem[] }[] = BRAND_FEATURE_GROUPS
    .map((g) => ({
      title: g.title,
      items: g.slugs.map((s) => featureItemBySlug.get(s)).filter((i): i is SidebarItem => !!i),
    }))
    .filter((g) => g.items.length > 0);
  const ungroupedItems = featureItems.filter((i) => !groupedSlugs.has(i.id));
  if (ungroupedItems.length > 0) {
    featureSections.push({ title: "Other", items: ungroupedItems });
  }

  // Brand-level outcome counts
  const { data: outletsData, isPending: outletsPending } = useAuthQuery(
    ["brandOutlets", brandId],
    () => listBrandOutlets(brandId),
    { refetchInterval: 5_000 },
  );
  const { data: journalistsData, isPending: journalistsPending } = useAuthQuery(
    ["enrichedJournalists", brandId],
    () => listJournalistsEnriched(brandId),
    { refetchInterval: 5_000 },
  );
  const { data: leadsData, isPending: leadsPending } = useAuthQuery(
    ["brandLeads", brandId],
    () => listBrandLeads(brandId),
    { refetchInterval: 5_000 },
  );
  const { data: emailsData, isPending: emailsPending } = useAuthQuery(
    ["brandEmails", brandId],
    () => listBrandEmails(brandId),
    { refetchInterval: 5_000 },
  );
  const { data: articlesData, isPending: articlesPending } = useAuthQuery(
    ["brandArticles", brandId],
    () => listBrandArticles(brandId),
    { refetchInterval: 5_000 },
  );

  // Nav items reveal as one group once the feature list (which the Features
  // section needs) loads; the 5 outcome badges are a finer sub-group revealed
  // when their counts settle. See CLAUDE.md → "Coordinated reveal".
  const defsReady = !featuresLoading;
  const badgesRevealed = useCoordinatedReveal([
    !outletsPending,
    !journalistsPending,
    !leadsPending,
    !emailsPending,
    !articlesPending,
  ]);

  // Outlets/Journalists/Articles belong to the not-yet-launched PR/press
  // features → alpha (staff-only) behind the dedicated brand-database flag.
  // Leads/Emails belong to sales-cold-email (GA) → always shown. Default-hidden
  // until PostHog resolves the flag (no flash). See CLAUDE.md → feature gating.
  const dbAlphaOk = useFeatureFlag(FEATURE_GATES["brand-database"].flag);
  const dbMaturity = FEATURE_GATES["brand-database"].maturity;
  const outcomeItems: SidebarItem[] = [
    { id: "outlets", label: "Outlets", href: `${basePath}/outlets`, icon: <OutcomeOutletIcon />, badge: outletsData?.total, maturity: dbMaturity },
    { id: "journalists", label: "Journalists", href: `${basePath}/journalists`, icon: <NewspaperIcon />, badge: journalistsData?.total ?? journalistsData?.journalists?.length, maturity: dbMaturity },
    { id: "articles", label: "Articles", href: `${basePath}/articles`, icon: <OutcomeArticleIcon />, badge: articlesData?.discoveries?.length, maturity: dbMaturity },
    { id: "leads", label: "Leads", href: `${basePath}/leads`, icon: <OutcomeLeadIcon />, badge: leadsData?.leads?.length },
    { id: "emails", label: "Emails", href: `${basePath}/emails`, icon: <EnvelopeIcon />, badge: emailsData?.emails?.length },
  ].filter((item) => dbAlphaOk || item.id === "leads" || item.id === "emails");

  return (
    <SidebarSection title="Brand" backHref={`/orgs/${orgId}/brands`} backLabel="Brands">
      {/* Whole nav reveals as one group once the feature list loads (the grouped
          feature sections + Database both need it); skeleton rows until then so
          static and data-dependent items don't paint in two waves. Database badge
          numbers are a finer sub-group via badgePending. */}
      {!defsReady ? (
        <>
          {[0].map((i) => <SidebarNavRowSkeleton key={`top-${i}`} />)}
          <div className="pt-2 mt-2 border-t border-gray-100">
            {[0, 1, 2, 3, 4, 5].map((i) => <SidebarNavRowSkeleton key={`feat-${i}`} />)}
          </div>
          <div className="pt-2 mt-2 border-t border-gray-100">
            <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Database</h4>
            {[0, 1, 2, 3, 4].map((i) => <SidebarNavRowSkeleton key={`db-${i}`} />)}
          </div>
        </>
      ) : (
        <>
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "overview" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      {featureSections.map((section) => (
        <div key={section.title} className="pt-2 mt-2 border-t border-gray-100">
          <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{section.title}</h4>
          {section.items.map((item) => (
            <SidebarLink
              key={item.id}
              item={item}
              isActive={pathname.startsWith(item.href)}
            />
          ))}
        </div>
      ))}
      {outcomeItems.length > 0 && (
        <div className="pt-2 mt-2 border-t border-gray-100">
          <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Database</h4>
          {outcomeItems.map((item) => (
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
          item={{ id: "settings", label: "Brand Settings", href: `${basePath}/settings`, icon: <SettingsIcon /> }}
          isActive={pathname.startsWith(`${basePath}/settings`)}
        />
      </div>
        </>
      )}
    </SidebarSection>
  );
}

// Brand Settings Level Sidebar
function BrandSettingsLevelSidebar({ orgId, brandId, pathname }: {
  orgId: string;
  brandId: string;
  pathname: string;
}) {
  const brandBase = `/orgs/${orgId}/brands/${brandId}`;
  const basePath = `${brandBase}/settings`;
  // Brand Info is alpha (staff-only); default-hidden until PostHog resolves.
  const brandInfoOk = useFeatureFlag(FEATURE_GATES["brand-info"].flag);

  const items: SidebarItem[] = [
    { id: "settings", label: "Brand Settings", href: basePath, icon: <SettingsIcon /> },
    {
      id: "usage",
      label: "Usage",
      href: `${brandBase}/usage`,
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
  ];
  if (brandInfoOk) {
    items.push({
      id: "brand-info",
      label: "Brand Info",
      href: `${brandBase}/brand-info`,
      icon: <InfoIcon />,
      maturity: FEATURE_GATES["brand-info"].maturity,
    });
  }

  return (
    <SidebarSection title="Settings" backHref={`/orgs/${orgId}/brands/${brandId}`} backLabel="Brand">
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

// Feature Level Sidebar — shows feature-specific sub-menus
function FeatureLevelSidebar({ orgId, brandId, featureSlug, pathname }: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  pathname: string;
}) {
  const { getFeature, isLoading: featuresLoading } = useFeatures();
  const { registry, isLoading: registryLoading } = useEntityRegistry();
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;
  const feature = getFeature(featureSlug);
  const title = feature?.name ?? featureSlug;
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
  // Gold catalog (GET /orgs/opportunities) — same source the feature
  // quote-requests page renders, so the badge equals the page count.
  const rankedOppsEnabled = entityNames.includes("quote-requests");
  const { data: rankedOppsData, isPending: rankedOppsPending } = useAuthQuery(
    ["rankedOpportunities", { brandId }],
    () => listAllRankedOpportunities({ brandId }),
    { enabled: rankedOppsEnabled, refetchInterval: 5_000 },
  );

  // Reveal EVERY entity badge together (one paint), then keep the numbers
  // latched on screen. A disabled query stays `isPending: true` forever, so each
  // flag is gated behind its own `enabled` condition. See CLAUDE.md → "Coordinated reveal".
  //
  // `defsReady` MUST gate the barrier FIRST: until the feature (its entity list)
  // and the entity registry load, `entityNames` is empty, so every count query is
  // disabled and every `!enabled || !isPending` flag is true — the barrier would
  // otherwise pass instantly and latch an EMPTY group (no skeleton, counts then
  // trickle in one-by-one). With the gate, we wait for the defs, THEN for each
  // now-enabled count query to settle, THEN reveal all numbers at once.
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
    // Open (non-pitched) count so the badge == the queue the page renders — the
    // page hides already-pitched opportunities (DIS-107 badge↔page coherence).
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
    // No feature-level companies page yet (blocked on a brand-scoped companies
    // API) — the backend declares the entity, so the link would 404. Hide it
    // until the page exists. Campaign-level companies page is unaffected. (DIS)
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

  // Revenue surface (Overview + Conversions) — only on revenue features
  // (sales-cold-email today). GA.
  const revenueOk = isRevenueFeature(featureSlug);
  const topItems: SidebarItem[] = [
    ...(revenueOk
      ? [
          {
            id: "overview",
            label: "Overview",
            href: `${basePath}/overview`,
            icon: <OverviewIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    { id: "campaigns", label: "Campaigns", href: `${basePath}/campaigns`, icon: <EnvelopeIcon /> },
    { id: "create", label: "Create Campaign", href: `${basePath}/campaigns/new`, icon: <PlusIcon /> },
    ...(revenueOk
      ? [
          {
            id: "conversions",
            label: "Conversions",
            href: `${basePath}/conversions`,
            icon: <ConversionsIcon />,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  const reportEnabled =
    REPORT_ENABLED_FEATURES.has(featureSlug) || isExpertQuoteFeature(featureSlug);
  const reportHref = `/report/${orgId}/${brandId}/${featureSlug}`;

  return (
    <SidebarSection
      title={title}
      backHref={`/orgs/${orgId}/brands/${brandId}`}
      backLabel="Brand"
    >
      {/* Reveal the WHOLE nav as one group: the top items are static and the
          Database items need feature + registry defs, so painting them as they
          resolve makes the static rows appear first and the Database block pop in
          a beat later. Hold everything behind `defsReady` with skeleton rows, then
          render every item together. (Warm nav → defsReady is true immediately →
          no skeleton.) Badge numbers are a finer sub-group revealed via badgePending. */}
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
          isActive={item.id === "campaigns" ? pathname === item.href : pathname.startsWith(item.href)}
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
      {reportEnabled && (
        <div className="pt-2 mt-2 border-t border-gray-100">
          <h4 className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Report</h4>
          <a
            href={reportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition text-gray-600 hover:bg-gray-50 hover:text-gray-800"
          >
            <span className="w-5 h-5 text-gray-400"><ReportIcon /></span>
            <span className="flex-1">Report</span>
            <span className="text-gray-300"><ExternalLinkIcon /></span>
          </a>
        </div>
      )}
      <div className="pt-2 mt-2 border-t border-gray-100">
        <SidebarLink
          item={{
            id: "feature-settings",
            label: "Feature Settings",
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

// Feature Settings Level Sidebar — mirrors Brand Settings. Reached from the
// "Feature Settings" entry at the bottom of FeatureLevelSidebar. The landing
// (/settings, Sales Economics) is GA; Workflows is a staff-only (alpha) sub-page.
function FeatureSettingsLevelSidebar({ orgId, brandId, featureSlug, pathname }: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;
  const feature = getFeature(featureSlug);
  const title = feature?.name ?? featureSlug;
  // Workflows is alpha (staff-only); default-hidden until PostHog resolves so it
  // never flashes for a non-staff viewer. The Feature Settings landing is GA.
  const workflowsOk = useFeatureFlag(FEATURE_GATES["workflows"].flag);

  const items: SidebarItem[] = [
    {
      id: "feature-settings",
      label: "Feature Settings",
      href: `${basePath}/settings`,
      icon: <SettingsIcon />,
    },
    ...(workflowsOk
      ? [
          {
            id: "workflows",
            label: "Workflows",
            href: `${basePath}/workflows`,
            icon: <WorkflowIcon />,
            maturity: FEATURE_GATES["workflows"].maturity,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection title="Feature Settings" backHref={basePath} backLabel={title}>
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

// App-level Feature Sidebar — shows feature-specific sub-menus at /features/[featureId]
function AppFeatureLevelSidebar({ featureId, pathname }: {
  featureId: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/features/${featureId}`;
  const feature = getFeature(featureId);
  const title = feature?.name ?? featureId;
  // Workflows is alpha (staff-only) everywhere. Default-hidden until PostHog resolves.
  const workflowsOk = useFeatureFlag(FEATURE_GATES["workflows"].flag);

  const items: SidebarItem[] = [
    { id: "campaigns", label: "Campaigns", href: basePath, icon: <EnvelopeIcon /> },
    { id: "create", label: "Create Campaign", href: `${basePath}/new`, icon: <PlusIcon /> },
    ...(workflowsOk
      ? [
          {
            id: "workflows",
            label: "Workflows",
            href: `${basePath}/workflows`,
            icon: <WorkflowIcon />,
            maturity: FEATURE_GATES["workflows"].maturity,
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection title={title} backHref="/" backLabel="Dashboard">
      {items.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "campaigns" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
    </SidebarSection>
  );
}

// Workflow Detail Level Sidebar
function WorkflowLevelSidebar({ orgId, brandId, featureSlug, workflowId, pathname }: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  workflowId: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${workflowId}`;
  const feature = getFeature(featureSlug);
  const title = feature?.name ?? featureSlug;

  const items: SidebarItem[] = [
    { id: "viewer", label: "Workflow Viewer", href: basePath, icon: <WorkflowIcon /> },
  ];

  return (
    <SidebarSection title={title} backHref={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows`} backLabel="Workflows">
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
      return <AppLevelSidebar pathname={pathname} />;
    case "appFeature":
      return <AppFeatureLevelSidebar featureId={level.featureId!} pathname={pathname} />;
    case "org":
      return <OrgLevelSidebar orgId={level.orgId!} pathname={pathname} />;
    case "brand":
      return <BrandLevelSidebar orgId={level.orgId!} brandId={level.brandId!} pathname={pathname} />;
    case "brandSettings":
      return <BrandSettingsLevelSidebar orgId={level.orgId!} brandId={level.brandId!} pathname={pathname} />;
    case "feature":
      return <FeatureLevelSidebar orgId={level.orgId!} brandId={level.brandId!} featureSlug={level.featureSlug!} pathname={pathname} />;
    case "featureSettings":
      return <FeatureSettingsLevelSidebar orgId={level.orgId!} brandId={level.brandId!} featureSlug={level.featureSlug!} pathname={pathname} />;
    case "workflow":
      return <WorkflowLevelSidebar orgId={level.orgId!} brandId={level.brandId!} featureSlug={level.featureSlug!} workflowId={level.workflowId!} pathname={pathname} />;
    case "campaign":
      // Campaign level defers to CampaignSidebar in the campaign layout
      return null;
    default:
      return <AppLevelSidebar pathname={pathname} />;
  }
}
