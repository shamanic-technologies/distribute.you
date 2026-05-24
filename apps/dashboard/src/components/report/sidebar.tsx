"use client";

import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
}

const OverviewIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const LeadsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const EmailsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WorkflowsIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

interface ReportSidebarProps {
  basePath: string;
}

export function ReportSidebar({ basePath }: ReportSidebarProps) {
  const pathname = usePathname();
  const items: SidebarItem[] = [
    { id: "overview", label: "Overview", href: basePath, icon: <OverviewIcon /> },
    { id: "leads", label: "Leads", href: `${basePath}/leads`, icon: <LeadsIcon /> },
    { id: "emails", label: "Emails", href: `${basePath}/emails`, icon: <EmailsIcon /> },
    { id: "workflows", label: "Workflows", href: `${basePath}/workflows`, icon: <WorkflowsIcon /> },
  ];

  return (
    <aside className="w-44 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Report</h3>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = item.id === "overview" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                isActive
                  ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <LinkBody item={item} isActive={isActive} />
            </Link>
          );
        })}
      </nav>
      <a
        href="https://distribute.you"
        target="_blank"
        rel="noopener noreferrer"
        className="group block border-t border-gray-100 px-4 py-4 transition hover:bg-gradient-to-br hover:from-brand-50 hover:to-purple-50"
      >
        <div className="text-[10px] text-gray-500 leading-snug mb-2">
          Distributed with{" "}
          <span aria-label="love" role="img" className="inline-block group-hover:scale-110 transition-transform">
            ❤️
          </span>{" "}
          by
        </div>
        <div className="flex items-center gap-2">
          <Image
            src="/logo-head.jpg"
            alt="distribute.you"
            width={22}
            height={22}
            className="rounded-md shadow-sm flex-shrink-0"
          />
          <span className="font-display text-sm font-semibold bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
            distribute.you
          </span>
        </div>
      </a>
    </aside>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin text-current" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LinkBody({ item, isActive }: { item: SidebarItem; isActive: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
        {pending ? <Spinner /> : item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
    </>
  );
}
