"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlower } from "@/lib/query-options";
import { listVisibilityRuns, type VisibilityRunWithDelta } from "@/lib/api";
import {
  ScoreCard,
  formatPosition,
  formatScore,
  formatSentiment,
  parseDecimal,
} from "@/components/visibility/score-card";

interface ChartPoint {
  ts: number;
  label: string;
  visibilityScore: number | null;
  shareOfVoice: number | null;
  brandMentionRate: number | null;
  citationRate: number | null;
}

function buildChartData(runs: VisibilityRunWithDelta[]): ChartPoint[] {
  return [...runs]
    .filter((r) => r.completedAt)
    .sort(
      (a, b) =>
        new Date(a.completedAt as string).getTime() -
        new Date(b.completedAt as string).getTime(),
    )
    .map((r) => {
      const ts = new Date(r.completedAt as string).getTime();
      return {
        ts,
        label: new Date(ts).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        visibilityScore: parseDecimal(r.visibilityScore),
        shareOfVoice: parseDecimal(r.shareOfVoice),
        brandMentionRate: parseDecimal(r.brandMentionRate),
        citationRate: parseDecimal(r.citationRate),
      };
    });
}

export default function VisibilityRunsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const featureSlug = params.featureSlug as string;

  const { data, isLoading } = useAuthQuery(
    ["visibilityRuns", { brandId, campaignId }],
    () => listVisibilityRuns({ brandId, campaignId, limit: 50 }),
    pollOptionsSlower,
  );

  const runs = data?.runs ?? [];
  const chartData = useMemo(() => buildChartData(runs), [runs]);
  const latest = runs[0];

  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaignId}`;

  return (
    <div className="p-4 md:p-8" data-testid="visibility-runs-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Visibility runs
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Time-series brand visibility audit across LLM responses.
        </p>
      </div>

      {isLoading && !data ? (
        <Skeleton />
      ) : runs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {latest && (
            <section
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
              data-testid="visibility-latest-scores"
            >
              <ScoreCard
                label="Visibility"
                value={formatScore(parseDecimal(latest.visibilityScore))}
                delta={parseDecimal(latest.visibility_score_delta)}
                deltaFormat="percent"
              />
              <ScoreCard
                label="Share of voice"
                value={formatScore(parseDecimal(latest.shareOfVoice))}
                delta={parseDecimal(latest.share_of_voice_delta)}
                deltaFormat="percent"
              />
              <ScoreCard
                label="Brand mention rate"
                value={formatScore(parseDecimal(latest.brandMentionRate))}
              />
              <ScoreCard
                label="Citation rate"
                value={formatScore(parseDecimal(latest.citationRate))}
              />
              <ScoreCard
                label="Net sentiment"
                value={formatSentiment(parseDecimal(latest.netSentiment))}
                delta={parseDecimal(latest.net_sentiment_delta)}
                deltaFormat="absolute"
              />
              <ScoreCard
                label="Avg position"
                value={formatPosition(parseDecimal(latest.avgPosition))}
                delta={parseDecimal(latest.position_delta)}
                deltaFormat="absolute"
                deltaInverted
              />
            </section>
          )}

          {chartData.length > 0 && (
            <section
              className="bg-white rounded-xl border border-gray-200 p-4 mb-6"
              data-testid="visibility-chart"
            >
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Score trend
              </h2>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v) => `${Math.round(v * 100)}%`}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v) => {
                        if (typeof v !== "number") return "—";
                        return `${(v * 100).toFixed(1)}%`;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="visibilityScore"
                      name="Visibility"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="shareOfVoice"
                      name="Share of voice"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="brandMentionRate"
                      name="Brand mention rate"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="citationRate"
                      name="Citation rate"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            data-testid="visibility-runs-table"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Completed</th>
                  <th className="px-4 py-2 text-left">Visibility</th>
                  <th className="px-4 py-2 text-left">Share of voice</th>
                  <th className="px-4 py-2 text-left">Brand mention</th>
                  <th className="px-4 py-2 text-left">Citation rate</th>
                  <th className="px-4 py-2 text-left">Sentiment</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <RunRow key={r.id} run={r} basePath={basePath} />
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function RunRow({
  run,
  basePath,
}: {
  run: VisibilityRunWithDelta;
  basePath: string;
}) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-800">
        <Link
          href={`${basePath}/visibility-runs/${run.id}`}
          className="hover:text-brand-600 hover:underline"
        >
          {run.completedAt
            ? new Date(run.completedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Pending"}
        </Link>
      </td>
      <td className="px-4 py-3 text-gray-700">
        {formatScore(parseDecimal(run.visibilityScore))}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {formatScore(parseDecimal(run.shareOfVoice))}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {formatScore(parseDecimal(run.brandMentionRate))}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {formatScore(parseDecimal(run.citationRate))}
      </td>
      <td className="px-4 py-3 text-gray-700">
        {formatSentiment(parseDecimal(run.netSentiment))}
      </td>
      <td className="px-4 py-3 text-gray-600">
        <span className="text-xs">{run.status}</span>
      </td>
    </tr>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 h-80 animate-pulse" />
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-8 text-center"
      data-testid="visibility-runs-empty"
    >
      <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
        No visibility runs yet
      </h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Visibility audits will appear here once the first run completes.
      </p>
    </div>
  );
}
