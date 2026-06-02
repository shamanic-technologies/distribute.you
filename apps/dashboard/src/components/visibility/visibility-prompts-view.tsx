"use client";

import { useMemo, useState } from "react";
import { useLatestVisibilityRunDetail } from "@/lib/use-latest-visibility-run";
import { type ListVisibilityRunsParams } from "@/lib/api";
import { DetailTabs } from "@/components/visibility/detail-tabs";
import { ProviderModelBadge } from "@/components/visibility/provider-label";
import { PromptDetailPane } from "@/components/visibility/prompt-detail-pane";
import { METRIC_INFO, MetricLabel } from "@/components/visibility/metric-info";
import {
  getDetailTabs,
  type PromptWithProvider,
} from "@/lib/visibility-detail";

/**
 * Prompt set tested in the most recent visibility run. Shared by the
 * campaign-level (`scope={brandId, campaignId}`) and feature-level
 * (`scope={brandId}` — latest run across the brand's campaigns) routes.
 */
export function VisibilityPromptsView({ scope }: { scope: ListVisibilityRunsParams }) {
  const { latestRunId, detail, isLoading } = useLatestVisibilityRunDetail(scope);

  const tabs = useMemo(() => (detail ? getDetailTabs(detail) : []), [detail]);
  const [activeKey, setActiveKey] = useState<string>("aggregate");
  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const [selectedPrompt, setSelectedPrompt] = useState<PromptWithProvider | null>(null);

  return (
    <div className="p-4 md:p-8" data-testid="prompts-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Prompts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Prompt set tested in the most recent visibility run.
        </p>
      </div>

      {isLoading ? (
        <Skeleton />
      ) : !latestRunId ? (
        <EmptyState message="No visibility runs yet — prompts will appear once the first run completes." />
      ) : !detail || !activeTab ? (
        <EmptyState message="No prompt data found for this run." />
      ) : (
        <>
          <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
          {activeTab.prompts.length === 0 ? (
            <EmptyState message="This run has no prompts yet." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left w-12">#</th>
                    <th className="px-4 py-2 text-left">Model</th>
                    <th className="px-4 py-2 text-left">Prompt</th>
                    <th className="px-4 py-2 text-left">
                      <MetricLabel text="Brand mention" tip={METRIC_INFO.promptBrandMention} />
                    </th>
                    <th className="px-4 py-2 text-left">
                      <MetricLabel text="URL mention" tip={METRIC_INFO.promptUrlMention} />
                    </th>
                    <th className="px-4 py-2 text-left">
                      <MetricLabel text="Position" tip={METRIC_INFO.promptPosition} />
                    </th>
                    <th className="px-4 py-2 text-left">
                      <MetricLabel text="Sentiment" tip={METRIC_INFO.promptSentiment} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab.prompts
                    .slice()
                    .sort((a, b) => a.promptIndex - b.promptIndex)
                    .map((p) => (
                      <PromptRow
                        key={`${p._provider}-${p._model}-${p.id}`}
                        prompt={p}
                        onClick={() => setSelectedPrompt(p)}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <PromptDetailPane
        prompt={selectedPrompt}
        onClose={() => setSelectedPrompt(null)}
      />
    </div>
  );
}

function PromptRow({
  prompt,
  onClick,
}: {
  prompt: PromptWithProvider;
  onClick: () => void;
}) {
  return (
    <tr
      className="border-t border-gray-100 align-top cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
      data-testid="prompt-row"
    >
      <td className="px-4 py-3 text-gray-500 text-xs">{prompt.promptIndex + 1}</td>
      <td className="px-4 py-3">
        <ProviderModelBadge provider={prompt._provider} model={prompt._model} />
      </td>
      <td className="px-4 py-3 text-gray-800 max-w-md">
        <p className="font-medium">{prompt.promptText}</p>
      </td>
      <td className="px-4 py-3 text-lg" aria-label="brand mention">
        {prompt.brandFound ? (
          <span title="Brand mentioned in answer">✅</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-lg" aria-label="url mention">
        {prompt.urlFound ? (
          <span title="Brand URL mentioned in answer">✅</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">
        {prompt.brandPosition ?? "—"}
      </td>
      <td className="px-4 py-3 text-lg" aria-label="sentiment">
        <SentimentEmoji sentiment={prompt.sentiment} />
      </td>
    </tr>
  );
}

function SentimentEmoji({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return <span className="text-gray-300 text-sm">—</span>;
  const lower = sentiment.toLowerCase();
  if (lower === "positive") return <span title="positive">👍</span>;
  if (lower === "negative") return <span title="negative">👎</span>;
  if (lower === "neutral") return <span title="neutral">😐</span>;
  return <span className="text-sm text-gray-600" title={sentiment}>{sentiment}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 h-16 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500"
      data-testid="prompts-empty"
    >
      {message}
    </div>
  );
}
