"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useFeatures } from "@/lib/features-context";
import { Skeleton } from "@/components/skeleton";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { formatCount } from "@/lib/format-number";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { useIsAdminUser } from "@/lib/use-admin-user";
import { MaturityBadge } from "@/components/maturity-badge";
import { FEATURE_GATES, type Maturity } from "@/lib/feature-gates";
import { explicitHierarchyHref } from "@/lib/last-brand";
import { InfoTooltip } from "@/components/visibility/metric-info";

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

const StrategyIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
  type: "app" | "org" | "brand" | "campaign";
  orgId?: string;
  brandId?: string;
  campaignId?: string;
}

function getNavigationLevel(segments: string[]): NavigationLevel {
  // /orgs/[orgId]/brands/[brandId]/<section>/...
  if (segments[0] === "orgs" && segments[1]) {
    const orgId = segments[1];
    if (segments[2] === "brands" && segments[3]) {
      const brandId = segments[3];
      // Channel LEVEL (v2 staff preview) — `.../channels/[campaignId]/...` drills
      // into ONE channel and swaps to the channel sidebar. The channels LIST
      // (`.../channels` with no id) stays brand-level so the brand "Channels" nav
      // entry highlights.
      if (segments[4] === "channels" && segments[5]) {
        return { type: "campaign", orgId, brandId, campaignId: segments[5] };
      }
      // Every brand section — root overview, entity pages, AND settings /
      // brand-info / workflows — renders the SAME brand sidebar. Settings + Info +
      // Workflows are flat links in that sidebar's footer, so the sidebar stays
      // mounted and the clicked link goes blue instead of swapping to a separate
      // Settings sidebar level.
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
          // `item.href` carries the `?view=overview` query param, but
          // usePathname() strips the query — so compare against the bare org
          // path (mirrors the brand-level Overview active check).
          isActive={item.id === "overview" ? pathname === `/orgs/${orgId}` : pathname.startsWith(item.href)}
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

// Derive a domain-shaped string from the org name (onboarding sets org name =
// brand domain). Mirrors the helper in breadcrumb-nav.tsx.
function orgDomainFromName(name?: string | null): string | null {
  if (!name) return null;
  const candidate = name.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  return /^[^\s]+\.[^\s]+$/.test(candidate) ? candidate : null;
}

const CopyIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Referral card — anchored at the very bottom of the brand sidebar. No backend:
// the invite link is just the landing URL carrying a UTM with the user's
// org-domain. Copy referral terms are hardcoded copy.
function ReferralCard() {
  const { organization } = useOrganization();
  const [copied, setCopied] = useState(false);
  const campaign = orgDomainFromName(organization?.name) ?? organization?.id ?? "referral";
  const link = `https://distribute.you?utm_source=referral&utm_medium=invite&utm_campaign=${encodeURIComponent(campaign)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-2">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2">
        <div className="flex items-start gap-1">
          <p className="text-xs font-semibold text-gray-700 leading-snug">
            Give and get $75 credits
          </p>
          <span className="shrink-0 mt-0.5">
            <InfoTooltip
              tip="We double up to $75 the budget spent by the person you invite for their first day. When they do, we do the same on your next daily amount."
              placement="bottom"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 transition"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
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
  const { organization } = useOrganization();
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  // Campaigns (v2, campaign-centered) — staff/god-mode PREVIEW while the campaign
  // concept is progressively re-introduced. Gated on the staff allowlist (isAdmin),
  // shown with a beta badge. Non-staff never see it.
  const isAdmin = useIsAdminUser();
  const campaignsOk = isRevenueFeature(featureSlug) && isAdmin;
  // Brand Info + Workflows are alpha (staff-only); default-hidden until PostHog
  // resolves. Folded flat into this footer so the brand sidebar stays mounted on
  // /brand-info + /workflows (no separate Settings sidebar level).
  const brandInfoOk = useFeatureFlag(FEATURE_GATES["brand-info"].flag);
  const workflowsOk = useFeatureFlag(FEATURE_GATES["workflows"].flag);

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
    // Leads sits directly below Overview. GA (revenue features only).
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
    // Strategy — a read-only recap of the brand's objective, conversion
    // economics, and the best-performing model with its cost per outcome
    // cross-org / per-brand / per-audience. GA (revenue features only). Sits
    // directly under Overview.
    ...(revenueOk
      ? [
          {
            id: "strategy",
            label: "Strategy",
            href: `${basePath}/strategy`,
            icon: <StrategyIcon />,
          } satisfies SidebarItem,
        ]
      : []),
    // Audiences — Apollo-style targeting cards. GA (revenue features only).
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
    // Channels — staff-only channel-centered v2 preview. Beta badge.
    ...(campaignsOk
      ? [
          {
            id: "campaigns",
            label: "Channels",
            href: `${basePath}/channels`,
            icon: <CampaignsIcon />,
            maturity: "beta",
          } satisfies SidebarItem,
        ]
      : []),
  ];

  return (
    <SidebarSection
      title="Brand"
      backHref={`/orgs/${orgId}`}
      backLabel={organization?.name || "Overview"}
      footer={
        // Anchored to the bottom (outside the scrollable nav): Brand Settings,
        // then the referral card.
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
            {brandInfoOk && (
              <SidebarLink
                item={{
                  id: "brand-info",
                  label: "Brand Info",
                  href: `${basePath}/brand-info`,
                  icon: <InfoIcon />,
                  maturity: FEATURE_GATES["brand-info"].maturity,
                }}
                isActive={pathname.startsWith(`${basePath}/brand-info`)}
              />
            )}
            {workflowsOk && (
              <SidebarLink
                item={{
                  id: "workflows",
                  label: "Workflows",
                  href: `${basePath}/workflows`,
                  icon: <WorkflowIcon />,
                  maturity: FEATURE_GATES["workflows"].maturity,
                }}
                isActive={pathname === `${basePath}/workflows` || pathname.startsWith(`${basePath}/workflows/`)}
              />
            )}
          </div>
          <ReferralCard />
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

// Campaign Level Sidebar (v2 staff/god-mode PREVIEW — #2762) — mirrors the brand
// sidebar layout but drilled into ONE campaign. Overview + Leads are scoped to the
// campaign (campaign-filtered pages, beta badge); Strategy + Audiences are the
// brand's shared config (a campaign inherits them), so they link back to the
// brand-level pages. Reachable only by staff (the routes self-gate); the sidebar
// double-gates on `isAdmin` so a non-staff URL hit shows just the back link.
function CampaignLevelSidebar({ orgId, brandId, campaignId, pathname }: {
  orgId: string;
  brandId: string;
  campaignId: string;
  pathname: string;
}) {
  const featureSlug = useSoleFeatureSlug();
  const { organization } = useOrganization();
  const isAdmin = useIsAdminUser();
  const revenueOk = isRevenueFeature(featureSlug);
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const campaignBase = `${basePath}/channels/${campaignId}`;

  const items: SidebarItem[] =
    isAdmin && revenueOk
      ? [
          {
            id: "campaign-overview",
            label: "Overview",
            href: campaignBase,
            icon: <OverviewIcon />,
            maturity: "beta",
          },
          {
            id: "campaign-leads",
            label: "Leads",
            href: `${campaignBase}/leads`,
            icon: <LeadsIcon />,
            maturity: "beta",
          },
          // Brand-config passthrough — a campaign inherits the brand's strategy +
          // audiences, so these link to the brand-level pages (they leave the
          // campaign context by design).
          {
            id: "strategy",
            label: "Strategy",
            href: `${basePath}/strategy`,
            icon: <StrategyIcon />,
          },
          {
            id: "audiences",
            label: "Audiences",
            href: `${basePath}/audiences`,
            icon: <AudiencesIcon />,
          },
        ]
      : [];

  return (
    <SidebarSection
      title="Channel"
      backHref={`${basePath}/channels`}
      backLabel="Channels"
      footer={
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
          <ReferralCard />
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
    case "campaign":
      return (
        <CampaignLevelSidebar
          orgId={level.orgId!}
          brandId={level.brandId!}
          campaignId={level.campaignId!}
          pathname={pathname}
        />
      );
    default:
      return <AppLevelSidebar />;
  }
}
