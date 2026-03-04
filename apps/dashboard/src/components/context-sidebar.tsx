"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKFLOW_DEFINITIONS, OUTCOME_LABELS } from "@distribute/content";
import type { OutcomeType } from "@distribute/content";

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

function SidebarSection({ title, backHref, backLabel, children }: {
  title?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
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

const PlusIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

function getOutcomeIcon(outcomeType: OutcomeType): React.ReactNode {
  switch (outcomeType) {
    case "interested-replies": return <EnvelopeIcon />;
    case "press-coverage": return <NewspaperIcon />;
    case "webinar-attendance": return <CalendarIcon />;
    case "welcome-engagement": return <EnvelopeIcon />;
    default: return <WorkflowIcon />;
  }
}

/** Build deduplicated outcome sidebar items from workflow definitions. */
function buildOutcomeItems(hrefPrefix: string): SidebarItem[] {
  const seen = new Set<OutcomeType>();
  const items: SidebarItem[] = [];
  for (const wf of WORKFLOW_DEFINITIONS) {
    const outcome = wf.targetOutcomes[0];
    if (!outcome || seen.has(outcome)) continue;
    seen.add(outcome);
    items.push({
      id: wf.sectionKey,
      label: OUTCOME_LABELS[outcome],
      href: `${hrefPrefix}/${wf.sectionKey}`,
      icon: getOutcomeIcon(outcome),
      comingSoon: !wf.implemented,
    });
  }
  return items;
}

interface NavigationLevel {
  type: "app" | "appOutcome" | "org" | "brand" | "outcome" | "campaign";
  orgId?: string;
  brandId?: string;
  sectionKey?: string;
  campaignId?: string;
  outcomeId?: string;
}

function getNavigationLevel(segments: string[]): NavigationLevel {
  // /orgs/[orgId]/brands/[brandId]/outcomes/[sectionKey]/campaigns/[id]
  if (segments[0] === "orgs" && segments[1]) {
    const orgId = segments[1];
    if (segments[2] === "brands" && segments[3]) {
      const brandId = segments[3];
      if (segments[4] === "outcomes" && segments[5]) {
        const sectionKey = segments[5];
        if (segments[6] === "campaigns" && segments[7]) {
          return { type: "campaign", orgId, brandId, sectionKey, campaignId: segments[7] };
        }
        return { type: "outcome", orgId, brandId, sectionKey };
      }
      return { type: "brand", orgId, brandId };
    }
    return { type: "org", orgId };
  }
  // App-level outcome: /outcomes/[outcomeId] or /outcomes/[outcomeId]/new
  if (segments[0] === "outcomes" && segments[1]) {
    return { type: "appOutcome", outcomeId: segments[1] };
  }
  return { type: "app" };
}

// App Level Sidebar
function AppLevelSidebar({ pathname }: { pathname: string }) {
  const topItems: SidebarItem[] = [
    { id: "home", label: "Home", href: "/", icon: <HomeIcon /> },
  ];

  const outcomeItems = buildOutcomeItems("/outcomes");

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
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcomes</h4>
        {outcomeItems.map((item) => (
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
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: `/orgs/${orgId}`, icon: <HomeIcon /> },
    { id: "brands", label: "Brands", href: `/orgs/${orgId}/brands`, icon: <BrandIcon /> },
  ];

  const outcomeItems = buildOutcomeItems("/outcomes");

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
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcomes</h4>
        {outcomeItems.map((item) => (
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
      </div>
    </SidebarSection>
  );
}

// Brand Level Sidebar
function BrandLevelSidebar({ orgId, brandId, pathname }: { orgId: string; brandId: string; pathname: string }) {
  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const topItems: SidebarItem[] = [
    { id: "overview", label: "Overview", href: basePath, icon: <HomeIcon /> },
    { id: "brand-info", label: "Brand Info", href: `${basePath}/brand-info`, icon: <InfoIcon /> },
    { id: "campaigns", label: "Campaigns", href: `${basePath}/campaigns`, icon: <EnvelopeIcon /> },
    { id: "create", label: "Create Campaign", href: `${basePath}/campaigns/new`, icon: <PlusIcon /> },
    { id: "workflows", label: "Workflows", href: `${basePath}/workflows`, icon: <WorkflowIcon /> },
  ];

  const outcomeItems = buildOutcomeItems(`${basePath}/outcomes`);

  return (
    <SidebarSection title="Brand" backHref={`/orgs/${orgId}/brands`} backLabel="Brands">
      {topItems.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={item.id === "overview" ? pathname === item.href : item.id === "campaigns" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      <div className="pt-2 mt-2 border-t border-gray-100">
        <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcomes</h4>
        {outcomeItems.map((item) => (
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

// Outcome Level Sidebar — shows outcome-specific sub-menus
function OutcomeLevelSidebar({ orgId, brandId, sectionKey, pathname }: {
  orgId: string;
  brandId: string;
  sectionKey: string;
  pathname: string;
}) {
  const basePath = `/orgs/${orgId}/brands/${brandId}/outcomes/${sectionKey}`;
  const wfDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === sectionKey);
  const outcome = wfDef?.targetOutcomes[0];
  const title = outcome ? OUTCOME_LABELS[outcome] : sectionKey;

  const items: SidebarItem[] = [
    { id: "campaigns", label: "Campaigns", href: basePath, icon: <WorkflowIcon /> },
  ];

  return (
    <SidebarSection title={title} backHref={`/orgs/${orgId}/brands/${brandId}`} backLabel="Brand">
      {items.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          isActive={pathname === item.href}
        />
      ))}
    </SidebarSection>
  );
}

// App-level Outcome Sidebar — shows outcome-specific sub-menus at /outcomes/[outcomeId]
function AppOutcomeLevelSidebar({ outcomeId, pathname }: {
  outcomeId: string;
  pathname: string;
}) {
  const basePath = `/outcomes/${outcomeId}`;
  const wfDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === outcomeId);
  const outcome = wfDef?.targetOutcomes[0];
  const title = outcome ? OUTCOME_LABELS[outcome] : outcomeId;

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

export function ContextSidebar() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const level = getNavigationLevel(segments);

  switch (level.type) {
    case "app":
      return <AppLevelSidebar pathname={pathname} />;
    case "appOutcome":
      return <AppOutcomeLevelSidebar outcomeId={level.outcomeId!} pathname={pathname} />;
    case "org":
      return <OrgLevelSidebar orgId={level.orgId!} pathname={pathname} />;
    case "brand":
      return <BrandLevelSidebar orgId={level.orgId!} brandId={level.brandId!} pathname={pathname} />;
    case "outcome":
      return <OutcomeLevelSidebar orgId={level.orgId!} brandId={level.brandId!} sectionKey={level.sectionKey!} pathname={pathname} />;
    case "campaign":
      // Campaign level defers to CampaignSidebar in the campaign layout
      return null;
    default:
      return <AppLevelSidebar pathname={pathname} />;
  }
}
