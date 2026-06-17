"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "../skeleton";
import { useLatestVisibilityRunDetail } from "@/lib/use-latest-visibility-run";
import { type ListVisibilityRunsParams } from "@/lib/api";
import {
  formatPosition,
  formatScore,
  formatSentiment,
} from "@/components/visibility/score-card";
import { DetailTabs } from "@/components/visibility/detail-tabs";
import { METRIC_INFO, MetricLabel } from "@/components/visibility/metric-info";
import {
  getDetailTabs,
  mergeBrandIntoCompetitors,
  type RankedCompetitorRow,
} from "@/lib/visibility-detail";

/**
 * Brand-vs-competitor ranking from the most recent visibility run. Shared by
 * the campaign-level (`scope={brandId, campaignId}`) and feature-level
 * (`scope={brandId}` — latest run across the brand's campaigns) routes.
 */
export function VisibilityCompetitorsView({
  scope,
  pending = false,
}: {
  scope: ListVisibilityRunsParams;
  pending?: boolean;
}) {
  const { latestRunId, detail, isLoading } = useLatestVisibilityRunDetail(scope);

  const tabs = useMemo(() => (detail ? getDetailTabs(detail) : []), [detail]);
  const [activeKey, setActiveKey] = useState<string>("aggregate");
  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const rows: RankedCompetitorRow[] = useMemo(() => {
    if (!activeTab) return [];
    return mergeBrandIntoCompetitors(
      activeTab.top_competitors,
      activeTab.run,
      activeTab.prompts,
    );
  }, [activeTab]);

  const isPending = pending || isLoading;
  const placeholderRows = Array.from({ length: 5 });

  return (
    <div className="p-4 md:p-8" data-testid="competitors-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Competitors</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your brand ranked against competing brands surfaced in the most recent visibility run.
        </p>
      </div>

      {!isPending && !latestRunId ? (
        <EmptyState message="No visibility runs yet — competitor data will appear once the first run completes." />
      ) : !isPending && (!detail || !activeTab) ? (
        <EmptyState message="No competitor mentions detected in the latest run." />
      ) : !isPending && rows.length === 0 ? (
        <EmptyState message="No competitor mentions detected in this view." />
      ) : (
        <>
          {!isPending && activeTab && (
            <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">
                    <MetricLabel text="Mentions" tip={METRIC_INFO.competitorMentions} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <MetricLabel text="Share of voice" tip={METRIC_INFO.competitorShareOfVoice} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <MetricLabel text="Avg position" tip={METRIC_INFO.competitorAvgPosition} />
                  </th>
                  <th className="px-4 py-2 text-left">
                    <MetricLabel text="Net sentiment" tip={METRIC_INFO.competitorNetSentiment} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPending
                  ? placeholderRows.map((_, i) => (
                      <tr key={`placeholder-${i}`} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-10" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                      </tr>
                    ))
                  : rows.map((c) => (
                      <tr
                        key={`${c._isBrand ? "brand" : "competitor"}-${c.name}`}
                        className={`border-t border-gray-100 ${
                          c._isBrand
                            ? "bg-brand-50 border-l-4 border-l-brand-500 font-semibold"
                            : ""
                        }`}
                        data-is-brand={c._isBrand ? "true" : "false"}
                      >
                        <td
                          className={`px-4 py-3 ${
                            c._isBrand ? "text-brand-700" : "text-gray-800"
                          }`}
                        >
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {c.name}
                            </a>
                          ) : (
                            c.name
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{c.mention_count}</td>
                        <td className="px-4 py-3 text-gray-700">{formatScore(c.share_of_voice)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatPosition(c.avg_position)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatSentiment(c.net_sentiment)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500"
      data-testid="competitors-empty"
    >
      {message}
    </div>
  );
}
