"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface McpSidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export interface McpSidebarGroup {
  id: string;
  label: string;
  items: McpSidebarItem[];
}

interface McpSidebarProps {
  items: McpSidebarItem[];
  outcomesItems?: McpSidebarItem[];
  outcomesGroups?: McpSidebarGroup[];
  settingsItems?: McpSidebarItem[];
  settingsExtra?: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  extraButtons?: React.ReactNode;
}

function CollapsibleOutcomeGroup({ group, pathname, isActiveGroup, onItemClick }: {
  group: McpSidebarGroup;
  pathname: string;
  isActiveGroup: boolean;
  onItemClick: (groupId: string) => void;
}) {
  const hasData = group.items.some((item) => item.badge != null && Number(item.badge) > 0);
  const [open, setOpen] = useState(hasData || isActiveGroup);

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition"
      >
        <span>{group.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const isActive = isActiveGroup && pathname.startsWith(item.href);
            return (
              <Link
                key={`${group.id}-${item.id}`}
                href={item.href}
                onClick={() => onItemClick(group.id)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                  ${isActive
                    ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }
                `}
              >
                <span className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}
                  `}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleOutcomeGroupList({ groups, pathname }: { groups: McpSidebarGroup[]; pathname: string }) {
  const defaultGroupId = groups.find((g) => g.items.some((item) => pathname.startsWith(item.href)))?.id ?? null;
  const [activeGroupId, setActiveGroupId] = useState<string | null>(defaultGroupId);

  const effectiveActiveGroupId = activeGroupId && groups.some((g) =>
    g.id === activeGroupId && g.items.some((item) => pathname.startsWith(item.href))
  ) ? activeGroupId : defaultGroupId;

  return (
    <>
      {groups.map((group) => (
        <CollapsibleOutcomeGroup
          key={group.id}
          group={group}
          pathname={pathname}
          isActiveGroup={effectiveActiveGroupId === group.id}
          onItemClick={setActiveGroupId}
        />
      ))}
    </>
  );
}

export function McpSidebar({ items, outcomesItems, outcomesGroups, settingsItems, settingsExtra, title, backHref, backLabel, extraButtons }: McpSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        {title && (
          <div className="px-4 py-3 border-b border-gray-100">
            {backHref && (
              <Link 
                href={backHref}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-2 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backLabel || "Back"}
              </Link>
            )}
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {title}
            </h3>
          </div>
        )}
        <nav className="flex-1 p-2 space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                  ${isActive
                    ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }
                `}
              >
                <span className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}
                  `}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {outcomesGroups && outcomesGroups.length > 0 ? (
            <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
              <CollapsibleOutcomeGroupList groups={outcomesGroups} pathname={pathname} />
            </div>
          ) : outcomesItems && outcomesItems.length > 0 ? (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Outcomes</h4>
              {outcomesItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                      ${isActive
                        ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }
                    `}
                  >
                    <span className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded-full
                        ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : null}
          {((settingsItems && settingsItems.length > 0) || settingsExtra) && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <h4 className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Settings</h4>
              {settingsItems?.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition
                      ${isActive
                        ? "bg-brand-50 text-brand-700 font-medium border border-brand-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                      }
                    `}
                  >
                    <span className={`w-5 h-5 ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`
                        text-xs px-1.5 py-0.5 rounded-full
                        ${isActive ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"}
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
              {settingsExtra}
            </div>
          )}
          {extraButtons && (
            <div className="mt-1 border-t border-gray-100 pt-1">
              {extraButtons}
            </div>
          )}
        </nav>
      </aside>

      {/* Mobile horizontal tabs */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          {backHref ? (
            <Link href={backHref} className="text-xs text-gray-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel || "Back"}
            </Link>
          ) : <div />}
          {title && <span className="text-sm font-semibold text-gray-800">{title}</span>}
          <div className="w-8" />
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
                  ${isActive
                    ? "bg-brand-100 text-brand-700 font-medium"
                    : "bg-gray-100 text-gray-600"
                  }
                `}
              >
                <span className="w-4 h-4">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="text-[10px] bg-white/50 px-1 rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {(() => {
            const mobileOutcomeItems = outcomesGroups
              ? outcomesGroups.flatMap((g) => g.items)
              : outcomesItems ?? [];
            // Deduplicate by id (items may appear in multiple groups)
            const seen = new Set<string>();
            return mobileOutcomeItems.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            }).map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
                    ${isActive
                      ? "bg-brand-100 text-brand-700 font-medium"
                      : "bg-gray-100 text-gray-600"
                    }
                  `}
                >
                  <span className="w-4 h-4">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="text-[10px] bg-white/50 px-1 rounded">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            });
          })()}
          {settingsItems && settingsItems.length > 0 && settingsItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition
                  ${isActive
                    ? "bg-brand-100 text-brand-700 font-medium"
                    : "bg-gray-100 text-gray-600"
                  }
                `}
              >
                <span className="w-4 h-4">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="text-[10px] bg-white/50 px-1 rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {settingsExtra}
          {extraButtons}
        </nav>
      </div>
    </>
  );
}
