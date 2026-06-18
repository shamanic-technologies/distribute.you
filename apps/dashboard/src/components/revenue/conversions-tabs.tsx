"use client";

import { useState, type ReactNode } from "react";
import {
  OrgConversionsTable,
  LeadConversionsTable,
} from "@/components/revenue/conversions-table";
import {
  ConversionDetailPanel,
  type ConversionDetail,
} from "@/components/revenue/conversion-detail-panel";
import { Skeleton } from "@/components/skeleton";
import type { RevenueOverview } from "@/lib/revenue-view";

type ConversionTab = "extra" | "organizations" | "leads";
const BASE_TABS: { id: ConversionTab; label: string }[] = [
  { id: "organizations", label: "Organizations" },
  { id: "leads", label: "Leads" },
];

/** Optional row-select handler — undefined when detail is disabled (Overview). */
export type ConversionSelect = ((d: ConversionDetail) => void) | undefined;

/**
 * The Organizations / Leads conversion tabs — shared by the feature Overview
 * and the campaign page so both render the identical table set (each table
 * paginates 20/page). The tab bar is static shell (renders on the first paint);
 * only the table body skeletons while `pending` or data is absent.
 *
 * `extraFirstTab` (optional) prepends a caller-supplied tab, selected by default
 * — the Signups page uses it for an "Audiences" tab (its `content` is a render-prop
 * receiving the same row-select handler). `enableDetail` makes every row open a
 * right-hand detail panel. Overview passes neither → unchanged.
 */
export function ConversionsTabs({
  data,
  pending = false,
  extraFirstTab,
  enableDetail = false,
}: {
  data?: RevenueOverview;
  pending?: boolean;
  extraFirstTab?: { label: string; content: (onSelect: ConversionSelect) => ReactNode };
  enableDetail?: boolean;
}) {
  const tabs = extraFirstTab
    ? [{ id: "extra" as const, label: extraFirstTab.label }, ...BASE_TABS]
    : BASE_TABS;
  const [tab, setTab] = useState<ConversionTab>(tabs[0].id);
  const [selected, setSelected] = useState<ConversionDetail | null>(null);
  const onSelect: ConversionSelect = enableDetail ? setSelected : undefined;
  const loading = pending || !data;
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              tab === t.id
                ? "bg-brand-50 text-brand-700 border border-brand-200"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <>
          {tab === "extra" && extraFirstTab?.content(onSelect)}
          {tab === "organizations" && <OrgConversionsTable orgs={data.organizations} onSelect={onSelect} />}
          {tab === "leads" && <LeadConversionsTable leads={data.leads} onSelect={onSelect} />}
        </>
      )}

      {enableDetail && (
        <ConversionDetailPanel detail={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
