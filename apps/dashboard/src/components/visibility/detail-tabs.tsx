"use client";

import type { VisibilityDetailTab } from "@/lib/visibility-detail";

interface DetailTabsProps {
  tabs: VisibilityDetailTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function DetailTabs({ tabs, activeKey, onChange }: DetailTabsProps) {
  if (tabs.length <= 1) return null;
  return (
    <div
      className="mb-4 border-b border-gray-200 flex items-center gap-1 overflow-x-auto"
      data-testid="visibility-detail-tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            type="button"
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            data-tab-key={tab.key}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
