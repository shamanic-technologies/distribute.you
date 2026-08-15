"use client";

/**
 * The SECOND sidebar: it renders to the RIGHT of the Platform sidebar rather
 * than replacing it, so a staff member keeps the fleet nav while drilling into
 * one feature's sub-pages.
 *
 * That is possible because `/feature-stats/...` resolves to nav level `app` in
 * `getNavigationLevel`, so `ContextSidebar` keeps drawing `AppLevelSidebar`;
 * this column is mounted by the route's own layout beside `{children}`. The
 * campaign layout uses the same shape, except it REPLACES (its level returns
 * null) — do not copy that half here.
 *
 * Rows are drawn with the exported `SidebarSection` / `SidebarLink` primitives,
 * never a local copy, or the two columns drift into two visual languages.
 */
import { usePathname } from "next/navigation";
import { SidebarLink, SidebarSection, type SidebarItem } from "@/components/context-sidebar";

const EconomicsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const DetailsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
    />
  </svg>
);

const WorkflowIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

export function FeatureStatsSidebar({ basePath, title }: { basePath: string; title: string }) {
  const pathname = usePathname();

  const items: SidebarItem[] = [
    { id: "economics", label: "Economics", href: basePath, icon: <EconomicsIcon /> },
    { id: "details", label: "Cost details", href: `${basePath}/details`, icon: <DetailsIcon /> },
    { id: "workflows", label: "Workflow", href: `${basePath}/workflows`, icon: <WorkflowIcon /> },
  ];

  return (
    <SidebarSection title={title} backHref="/orgs" backLabel="Platform">
      {items.map((item) => (
        <SidebarLink
          key={item.id}
          item={item}
          // Economics owns the base path exactly; the others own their own subtree.
          isActive={item.id === "economics" ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
    </SidebarSection>
  );
}
