"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeatures } from "@/lib/features-context";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

function SidebarLink({ item, isActive }: { item: SidebarItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
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
      {item.comingSoon && (
        <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
          Coming soon
        </span>
      )}
    </Link>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2 transition"
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
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

const PlusIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

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
  type: "app" | "appFeature" | "org" | "brand" | "feature" | "featureSettings" | "workflow" | "campaign";
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
        if (segments[6] === "settings") {
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
  const { features } = useFeatures();
  const topItems: SidebarItem[] = [
    { id: "home", label: "Home", href: "/", icon: <HomeIcon /> },
  ];

  const featureItems: SidebarItem[] = features.map((f) => ({
    id: f.dynastySlug ?? f.slug,
    label: f.dynastyName ?? f.name,
    href: `/features/${f.dynastySlug ?? f.slug}`,
    icon: getFeatureIcon(f.dynastySlug ?? f.slug, f.icon),
    comingSoon: !f.implemented,
  }));

  return (
    <SidebarSection title="Dashboard">
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "home" ? pathname === "/" : pathname.startsWith(item.href)}
        />
      ))}
      <div className="pt-2 mt-2 border-t border-gray-100">
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Features</h4>
        {featureItems.map((item) => (
          <SidebarLink
            key={item.id}
            item={item}
            isActive={pathname.startsWith(item.href)}
          />
        ))}
      </div>
    </SidebarSection>
  );
}

// Org Level Sidebar
function OrgLevelSidebar({ orgId, pathname }: { orgId: string; pathname: string }) {
  const { features } = useFeatures();
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: `/orgs/${orgId}`, icon: <HomeIcon /> },
    { id: "brands", label: "Brands", href: `/orgs/${orgId}/brands`, icon: <BrandIcon /> },
  ];

  const featureItems: SidebarItem[] = features.map((f) => ({
    id: f.dynastySlug ?? f.slug,
    label: f.dynastyName ?? f.name,
    href: `/features/${f.dynastySlug ?? f.slug}`,
    icon: getFeatureIcon(f.dynastySlug ?? f.slug, f.icon),
    comingSoon: !f.implemented,
  }));

  return (
    <SidebarSection title="Organization">
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "overview" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      <div className="pt-2 mt-2 border-t border-gray-100">
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Features</h4>
        {featureItems.map((item) => (
          <SidebarLink
            key={item.id}
            item={item}
            isActive={pathname.startsWith(item.href)}
          />
        ))}
      </div>
      <div className="pt-2 mt-2 border-t border-gray-100">
        <SidebarLink
          item={{ id: "api-keys", label: "Keys", href: `/orgs/${orgId}/api-keys`, icon: <KeyIcon /> }}
          isActive={pathname.startsWith(`/orgs/${orgId}/api-keys`) || pathname.startsWith(`/orgs/${orgId}/provider-keys`)}
        />
        <SidebarLink
          item={{ id: "billing", label: "Billing", href: `/orgs/${orgId}/billing`, icon: <BillingIcon /> }}
          isActive={pathname.startsWith(`/orgs/${orgId}/billing`)}
        />
      </div>
    </SidebarSection>
  );
}

// Brand Level Sidebar
function BrandLevelSidebar({ orgId, brandId, pathname }: { orgId: string; brandId: string; pathname: string }) {
  const { features } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: basePath, icon: <HomeIcon /> },
    { id: "brand-info", label: "Brand Info", href: `${basePath}/brand-info`, icon: <InfoIcon /> },
  ];

  const featureItems: SidebarItem[] = features.map((f) => ({
    id: f.dynastySlug ?? f.slug,
    label: f.dynastyName ?? f.name,
    href: `${basePath}/features/${f.dynastySlug ?? f.slug}`,
    icon: getFeatureIcon(f.dynastySlug ?? f.slug, f.icon),
    comingSoon: !f.implemented,
  }));

  return (
    <SidebarSection title="Brand" backHref={`/orgs/${orgId}/brands`} backLabel="Brands">
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "overview" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      <div className="pt-2 mt-2 border-t border-gray-100">
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Features</h4>
        {featureItems.map((item) => (
          <SidebarLink
            key={item.id}
            item={item}
            isActive={pathname.startsWith(item.href)}
          />
        ))}
      </div>
    </SidebarSection>
  );
}

const SettingsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Feature Level Sidebar — shows feature-specific sub-menus
function FeatureLevelSidebar({ orgId, brandId, featureSlug, pathname }: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;
  const feature = getFeature(featureSlug);
  const title = feature?.dynastyName ?? feature?.name ?? featureSlug;

  const items: SidebarItem[] = [
    { id: "campaigns", label: "Campaigns", href: basePath, icon: <EnvelopeIcon /> },
    { id: "create", label: "Create Campaign", href: `${basePath}/campaigns/new`, icon: <PlusIcon /> },
    { id: "workflows", label: "Workflows", href: `${basePath}/workflows`, icon: <WorkflowIcon /> },
    { id: "settings", label: "Settings", href: `${basePath}/settings`, icon: <SettingsIcon /> },
  ];

  return (
    <SidebarSection
      title={title}
      backHref={`/orgs/${orgId}/brands/${brandId}`}
      backLabel="Brand"
    >
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

// App-level Feature Sidebar — shows feature-specific sub-menus at /features/[featureId]
function AppFeatureLevelSidebar({ featureId, pathname }: {
  featureId: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/features/${featureId}`;
  const feature = getFeature(featureId);
  const title = feature?.name ?? featureId;

  const items: SidebarItem[] = [
    { id: "campaigns", label: "Campaigns", href: basePath, icon: <EnvelopeIcon /> },
    { id: "create", label: "Create Campaign", href: `${basePath}/new`, icon: <PlusIcon /> },
    { id: "workflows", label: "Workflows", href: `${basePath}/workflows`, icon: <WorkflowIcon /> },
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

// Feature Settings Level Sidebar
function FeatureSettingsLevelSidebar({ orgId, brandId, featureSlug, pathname }: {
  orgId: string;
  brandId: string;
  featureSlug: string;
  pathname: string;
}) {
  const { getFeature } = useFeatures();
  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/settings`;
  const feature = getFeature(featureSlug);
  const title = feature?.name ?? featureSlug;

  const items: SidebarItem[] = [
    { id: "settings", label: "Feature Settings", href: basePath, icon: <SettingsIcon /> },
  ];

  return (
    <SidebarSection title={title} backHref={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`} backLabel="Feature">
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
