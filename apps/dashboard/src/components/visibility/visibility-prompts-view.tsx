"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "../skeleton";
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
export function VisibilityPromptsView({
  scope,
  pending = false,
}: {
  scope: ListVisibilityRunsParams;
  pending?: boolean;
}) {
  const { latestRunId, detail, isLoading } = useLatestVisibilityRunDetail(scope);
  const isPending = pending || isLoading;

  const tabs = useMemo(() => (detail ? getDetailTabs(detail) : []), [detail]);
  const [activeKey, setActiveKey] = useState<string>("aggregate");
  const activeTab = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  const [selectedPrompt, setSelectedPrompt] = useState<PromptWithProvider | null>(null);

  const sortedPrompts = activeTab
    ? activeTab.prompts.slice().sort((a, b) => a.promptIndex - b.promptIndex)
    : [];
  const placeholderCount = 5;

  return (
    <div className="p-4 md:p-8" data-testid="prompts-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Prompts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Prompt set tested in the most recent visibility run.
        </p>
      </div>

      {!isPending && !latestRunId ? (
        <EmptyState message="No visibility runs yet — prompts will appear once the first run completes." />
      ) : !isPending && (!detail || !activeTab) ? (
        <EmptyState message="No prompt data found for this run." />
      ) : !isPending && sortedPrompts.length === 0 ? (
        <>
          {activeTab ? (
            <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
          ) : null}
          <EmptyState message="This run has no prompts yet." />
        </>
      ) : (
        <>
          {!isPending && activeTab ? (
            <DetailTabs tabs={tabs} activeKey={activeTab.key} onChange={setActiveKey} />
          ) : null}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
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
                {isPending && sortedPrompts.length === 0
                  ? Array.from({ length: placeholderCount }).map((_, i) => (
                      <PromptRow key={`placeholder-${i}`} pending />
                    ))
                  : sortedPrompts.map((p) => (
                      <PromptRow
                        key={`${p._provider}-${p._model}-${p.id}`}
                        prompt={p}
                        pending={isPending}
                        onClick={() => setSelectedPrompt(p)}
                      />
                    ))}
              </tbody>
            </table>
          </div>
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
  pending = false,
  onClick,
}: {
  prompt?: PromptWithProvider;
  pending?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`border-t border-gray-100 align-top transition-colors ${
        pending ? "" : "cursor-pointer hover:bg-gray-50"
      }`}
      onClick={pending ? undefined : onClick}
      data-testid="prompt-row"
    >
      <td className="px-4 py-3 text-gray-500 text-xs">
        {pending || !prompt ? <Skeleton className="h-4 w-4" /> : prompt.promptIndex + 1}
      </td>
      <td className="px-4 py-3">
        {pending || !prompt ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <ProviderModelBadge provider={prompt._provider} model={prompt._model} />
        )}
      </td>
      <td className="px-4 py-3 text-gray-800 max-w-md">
        {pending || !prompt ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <p className="font-medium">{prompt.promptText}</p>
        )}
      </td>
      <td className="px-4 py-3 text-lg" aria-label="brand mention">
        {pending || !prompt ? (
          <Skeleton className="h-5 w-5" />
        ) : prompt.brandFound ? (
          <span title="Brand mentioned in answer">✅</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-lg" aria-label="url mention">
        {pending || !prompt ? (
          <Skeleton className="h-5 w-5" />
        ) : prompt.urlFound ? (
          <span title="Brand URL mentioned in answer">✅</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">
        {pending || !prompt ? <Skeleton className="h-4 w-8" /> : prompt.brandPosition ?? "—"}
      </td>
      <td className="px-4 py-3 text-lg" aria-label="sentiment">
        {pending || !prompt ? (
          <Skeleton className="h-5 w-5" />
        ) : (
          <SentimentEmoji sentiment={prompt.sentiment} brandFound={prompt.brandFound} />
        )}
      </td>
    </tr>
  );
}

function SentimentEmoji({
  sentiment,
  brandFound,
}: {
  sentiment: string | null;
  brandFound: boolean | null;
}) {
  // No brand mention → no brand sentiment to show (backend defaults to "neutral"); render a dash, not a misleading neutral face.
  if (!brandFound || !sentiment) return <span className="text-gray-300 text-sm">—</span>;
  const lower = sentiment.toLowerCase();
  if (lower === "positive") return <span title="positive">👍</span>;
  if (lower === "negative") return <span title="negative">👎</span>;
  if (lower === "neutral") return <span title="neutral">😐</span>;
  return <span className="text-sm text-gray-600" title={sentiment}>{sentiment}</span>;
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
