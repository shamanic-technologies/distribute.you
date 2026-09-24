"use client";

/**
 * The CRM page's SECOND sidebar: it renders BESIDE the brand sidebar rather
 * than replacing it (`/crm/...` still resolves to the brand nav level), so the
 * brand nav stays while the person picks which view of their CRM to read.
 *
 * Rows are the brand sidebar's own `SidebarLink`, never a local copy, so the
 * two columns read as one product. BETA like everything under `/crm`: the
 * layout mounting this renders nothing for a non-beta reader.
 */
import { usePathname } from "next/navigation";
import { SidebarLink, type SidebarItem } from "@/components/context-sidebar";

const RawIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const MergedIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-5 w-5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7h8m-8 5h8m-8 5h5M4 4h7v16H4zM13 4h7v16h-7z"
    />
  </svg>
);

export function CrmSidebar({ basePath }: { basePath: string }) {
  const pathname = usePathname() ?? "";
  const items: SidebarItem[] = [
    { id: "crm-raw", label: "Raw", href: basePath, icon: <RawIcon />, maturity: "beta" },
    { id: "crm-merged", label: "Merged", href: `${basePath}/merged`, icon: <MergedIcon />, maturity: "beta" },
  ];
  return (
    <aside className="w-full shrink-0 border-b border-gray-200 bg-white md:w-44 md:border-b-0 md:border-r">
      <nav className="flex gap-1 p-2 md:flex-col" aria-label="CRM views">
        {items.map((item) => (
          <div key={item.id} className="min-w-0 flex-1 md:flex-none">
            <SidebarLink
              item={item}
              isActive={item.id === "crm-raw" ? pathname === basePath : pathname.startsWith(item.href)}
            />
          </div>
        ))}
      </nav>
    </aside>
  );
}
