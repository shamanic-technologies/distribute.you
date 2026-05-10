"use client";

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

export default function VisibilityRunDetailPage() {
  const params = useParams();
  const runId = params.runId as string;
  const campaignId = params.id as string;
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const featureSlug = params.featureSlug as string;

  const { data, isLoading } = useAuthQuery(
    ["visibilityRun", runId],
    () => getVisibilityRun(runId),
    {},
  );

  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaignId}`;

  if (isLoading || !data) {
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

  const { run, prompts, top_competitors, citation_opportunities } = data;

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
          · {run.llmProvider}/{run.llmModel} · {run.nPrompts} prompts
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <ScoreCard label="Visibility" value={formatScore(parseDecimal(run.visibilityScore))} />
        <ScoreCard label="Share of voice" value={formatScore(parseDecimal(run.shareOfVoice))} />
        <ScoreCard label="Brand mention rate" value={formatScore(parseDecimal(run.brandMentionRate))} />
        <ScoreCard label="Citation rate" value={formatScore(parseDecimal(run.citationRate))} />
        <ScoreCard label="Net sentiment" value={formatSentiment(parseDecimal(run.netSentiment))} />
        <ScoreCard label="Avg position" value={formatPosition(parseDecimal(run.avgPosition))} />
      </section>

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
                  <th className="px-4 py-2 text-left">Mentions</th>
                  <th className="px-4 py-2 text-left">Share of voice</th>
                  <th className="px-4 py-2 text-left">Avg position</th>
                  <th className="px-4 py-2 text-left">Net sentiment</th>
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
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-gray-800">{p.promptText}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
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
