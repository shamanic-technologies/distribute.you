"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getVisibilityRun, listVisibilityRuns } from "@/lib/api";
import { DetailTabs } from "@/components/visibility/detail-tabs";
import {
  getDetailTabs,
  type PromptWithProvider,
} from "@/lib/visibility-detail";

export default function PromptsPage() {
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

  const isLoading = runsLoading || (!!latestRunId && detailLoading);

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
                    <th className="px-4 py-2 text-left">Prompt</th>
                    {activeTab.key === "aggregate" && (
                      <th className="px-4 py-2 text-left">Judge</th>
                    )}
                    <th className="px-4 py-2 text-left">Brand</th>
                    <th className="px-4 py-2 text-left">Position</th>
                    <th className="px-4 py-2 text-left">Sentiment</th>
                    <th className="px-4 py-2 text-left">Citations</th>
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
                        showJudge={activeTab.key === "aggregate"}
                      />
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

function PromptRow({
  prompt,
  showJudge,
}: {
  prompt: PromptWithProvider;
  showJudge: boolean;
}) {
  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-4 py-3 text-gray-500 text-xs">{prompt.promptIndex + 1}</td>
      <td className="px-4 py-3 text-gray-800 max-w-md">
        <p className="font-medium">{prompt.promptText}</p>
      </td>
      {showJudge && (
        <td className="px-4 py-3 text-gray-600 text-xs">
          {prompt._provider}/{prompt._model}
        </td>
      )}
      <td className="px-4 py-3">
        {prompt.brandFound ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
            Found
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            —
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">
        {prompt.brandPosition ?? "—"}
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">{prompt.sentiment ?? "—"}</td>
      <td className="px-4 py-3 text-xs">
        {prompt.citationUrls && prompt.citationUrls.length > 0 ? (
          <div className="flex flex-col gap-0.5 max-w-xs">
            {prompt.citationUrls.slice(0, 3).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline truncate"
                title={url}
              >
                {url}
              </a>
            ))}
            {prompt.citationUrls.length > 3 && (
              <span className="text-gray-400">
                +{prompt.citationUrls.length - 3} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
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
