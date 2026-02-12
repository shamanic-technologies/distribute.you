"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

export default function BrandMcpSalesOutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const brandId = params.brandId as string;

  const basePath = `/brands/${brandId}/mcp/sales-outreach`;

  const SIDEBAR_ITEMS = [
    {
      id: "campaigns",
      label: "Campaigns",
      href: basePath,
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  // Don't show this sidebar when viewing a specific campaign
  const isInCampaign = pathname.includes("/campaigns/") && pathname.split("/campaigns/")[1]?.length > 0;
  
  if (isInCampaign) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-100">
          <Link 
            href={`/brands/${brandId}`} 
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Brand
          </Link>
          <h3 className="text-sm font-semibold text-gray-800">
            Sales Cold Emails
          </h3>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === "campaigns" 
              ? pathname === item.href 
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                  ${isActive 
                    ? "bg-primary-50 text-primary-700 font-medium border border-primary-200" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }
                `}
              >
                <span className={`${isActive ? "text-primary-600" : "text-gray-400"}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <Link href={`/brands/${brandId}`} className="text-xs text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Brand
          </Link>
          <span className="text-sm font-semibold text-gray-800">Sales Cold Emails</span>
          <div className="w-8" />
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === "campaigns" 
              ? pathname === item.href 
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
                  ${isActive 
                    ? "bg-primary-100 text-primary-700 font-medium" 
                    : "bg-gray-100 text-gray-600"
                  }
                `}
              >
                <span className="w-4 h-4">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
