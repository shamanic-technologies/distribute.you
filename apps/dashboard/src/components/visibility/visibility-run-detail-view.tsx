"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getVisibilityRun } from "@/lib/api";
import {
  ScoreCard,
  formatPosition,
  formatScore,
  formatSentiment,
  parseDecimal,
} from "@/components/visibility/score-card";
import { DetailTabs } from "@/components/visibility/detail-tabs";
import { METRIC_INFO, MetricLabel } from "@/components/visibility/metric-info";
import { getDetailTabs, getRunDebugFields } from "@/lib/visibility-detail";
import { DebugSection } from "@/components/visibility/prompt-detail-pane";

/**
 * Single visibility-run detail. The run is fetched by id only
 * (`getVisibilityRun`), so the view is identical at the campaign and feature
 * levels; `basePath` only steers the "back to visibility runs" link to the
 * caller's own URL tree.
 */
export function VisibilityRunDetailView({ basePath }: { basePath: string }) {
  const params = useParams();
  const runId = params.runId as string;

  const { data, isLoading } = useAuthQuery(
    ["visibilityRun", runId],
    () => getVisibilityRun(runId),
    {},
  );

  const tabs = useMemo(() => (data ? getDetailTabs(data) : []), [data]);
  const [activeKey, setActiveKey] = useState<string>("aggregate");
  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  if (isLoading || !data || !activeTab) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-100 rounded-lg" />
          <div className="h-64 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  const { run } = data;
  const { prompts, top_competitors, citation_opportunities } = activeTab;
  const judgeLabel =
    activeTab.provider && activeTab.model
      ? `${activeTab.provider}/${activeTab.model}`
      : `aggregated across ${data.by_provider.length} judge${data.by_provider.length === 1 ? "" : "s"}`;

  return (
    <div className="p-4 md:p-8" data-testid="visibility-run-detail-page">
      <div className="mb-4">
        <Link
          href={`${basePath}/visibility-runs`}
          className="text-xs text-gray-500 hover:text-brand-600"
        >
          ← Back to visibility runs
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Run · {run.brandName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {run.completedAt
            ? `Completed ${new Date(run.completedAt).toLocaleString()}`
            : `Status: ${run.status}`}{" "}
          · {judgeLabel} · {run.nPrompts} prompts
        </p>
      </div>

      <section className="mb-6">
        <DebugSection
          title="Debug — prompt-gen LLM payload"
          fields={getRunDebugFields(run)}
        />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <ScoreCard label="Visibility" tooltip={METRIC_INFO.visibility} value={formatScore(parseDecimal(run.visibilityScore))} />
        <ScoreCard label="Share of voice" tooltip={METRIC_INFO.shareOfVoice} value={formatScore(parseDecimal(run.shareOfVoice))} />
        <ScoreCard label="Brand mention rate" tooltip={METRIC_INFO.brandMentionRate} value={formatScore(parseDecimal(run.brandMentionRate))} />
        <ScoreCard label="Citation rate" tooltip={METRIC_INFO.citationRate} value={formatScore(parseDecimal(run.citationRate))} />
        <ScoreCard label="Net sentiment" tooltip={METRIC_INFO.netSentiment} value={formatSentiment(parseDecimal(run.netSentiment))} />
        <ScoreCard label="Avg position" tooltip={METRIC_INFO.avgPosition} value={formatPosition(parseDecimal(run.avgPosition))} />
      </section>

      <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Top competitors</h2>
        {top_competitors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500">
            No competitor mentions detected.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
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
                {top_competitors.map((c) => (
                  <tr key={c.name} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-800">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-brand-600 hover:underline"
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
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Prompts ({prompts.length})
        </h2>
        <div className="space-y-2">
          {prompts.map((p) => (
            <div key={`${p._provider}-${p._model}-${p.id}`} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-gray-800">{p.promptText}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeTab.key === "aggregate" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {p._provider}/{p._model}
                    </span>
                  )}
                  {p.brandFound ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                      Found
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                      Not found
                    </span>
                  )}
                  {p.brandPosition !== null && (
                    <span className="text-xs text-gray-500">pos {p.brandPosition}</span>
                  )}
                  {p.sentiment && (
                    <span className="text-xs text-gray-500">{p.sentiment}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-line">
                {p.responseText}
              </p>
              {p.citationUrls && p.citationUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.citationUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-600 hover:underline truncate max-w-xs"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {citation_opportunities.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Citation opportunities
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Domain</th>
                  <th className="px-4 py-2 text-left">Mentions</th>
                </tr>
              </thead>
              <tbody>
                {citation_opportunities.map((co) => (
                  <tr key={co.domain} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-800">{co.domain}</td>
                    <td className="px-4 py-3 text-gray-700">{co.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
