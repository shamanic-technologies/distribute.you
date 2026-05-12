"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getVisibilityRun, listVisibilityRuns } from "@/lib/api";
import {
  formatPosition,
  formatScore,
  formatSentiment,
} from "@/components/visibility/score-card";
import { DetailTabs } from "@/components/visibility/detail-tabs";
import {
  getDetailTabs,
  mergeBrandIntoCompetitors,
  type RankedCompetitorRow,
} from "@/lib/visibility-detail";

export default function CompetitorsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const { data: runsList, isLoading: runsLoading } = useAuthQuery(
    ["visibilityRuns", { brandId, latestOnly: true }],
    () => listVisibilityRuns({ brandId, limit: 1 }),
    { placeholderData: keepPreviousData },
  );

  const latestRunId = runsList?.runs[0]?.id;

  const { data: detail, isLoading: detailLoading } = useAuthQuery(
    ["visibilityRun", latestRunId],
    () => getVisibilityRun(latestRunId as string),
    { enabled: !!latestRunId },
  );

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

  const isLoading = runsLoading || (!!latestRunId && detailLoading);

  return (
    <div className="p-4 md:p-8" data-testid="competitors-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Competitors</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your brand ranked against competing brands surfaced in the most recent visibility run.
        </p>
      </div>

      {isLoading ? (
        <Skeleton />
      ) : !latestRunId ? (
        <EmptyState message="No visibility runs yet — competitor data will appear once the first run completes." />
      ) : !detail || !activeTab ? (
        <EmptyState message="No competitor mentions detected in the latest run." />
      ) : (
        <>
          <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
          {rows.length === 0 ? (
            <EmptyState message="No competitor mentions detected in this view." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Mentions</th>
                    <th className="px-4 py-2 text-left">Share of voice</th>
                    <th className="px-4 py-2 text-left">Avg position</th>
                    <th className="px-4 py-2 text-left">Net sentiment</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
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
          )}
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 h-12 animate-pulse"
        />
      ))}
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
