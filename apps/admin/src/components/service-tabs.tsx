"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ServiceTabs({ service }: { service: string }) {
  const pathname = usePathname();
  const isLogs =
    pathname === `/${service}/logs` ||
    pathname.startsWith(`/${service}/logs/`) ||
    pathname.startsWith(`/${service}/runs/`);

  const tabs = [
    { label: "Tables", href: `/${service}`, active: !isLogs },
    { label: "Logs", href: `/${service}/logs`, active: isLogs },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab.active
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
          data-testid={`tab-${tab.label.toLowerCase()}`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
