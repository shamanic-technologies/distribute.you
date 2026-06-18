"use client";

import { useMemo } from "react";
import Link from "next/link";
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
import { Skeleton } from "../skeleton";
import {
  listVisibilityRuns,
  type ListVisibilityRunsParams,
  type VisibilityRunWithDelta,
} from "@/lib/api";
import {
  ScoreCard,
  formatPosition,
  formatScore,
  formatSentiment,
  parseDecimal,
} from "@/components/visibility/score-card";
import { METRIC_INFO, MetricLabel } from "@/components/visibility/metric-info";

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

/**
 * Time-series visibility runs table + score trend chart. Shared by the
 * campaign-level (`scope={brandId, campaignId}`) and feature-level
 * (`scope={brandId}` — union across the brand's campaigns) routes. `basePath`
 * drives the run-detail row links so each level stays inside its own URL tree.
 */
export function VisibilityRunsView({
  scope,
  basePath,
}: {
  scope: ListVisibilityRunsParams;
  basePath: string;
}) {
  const { data, isPending } = useAuthQuery(
    ["visibilityRuns", scope],
    () => listVisibilityRuns({ ...scope, limit: 50 }),
    pollOptionsSlower,
  );

  const pending = isPending && !data;
  const runs = data?.runs ?? [];
  const chartData = useMemo(() => buildChartData(runs), [runs]);
  const latest = runs[0];

  if (!pending && runs.length === 0) {
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
        <EmptyState />
      </div>
    );
  }

  const rowFrames = runs.length > 0 ? runs : Array.from({ length: 5 }).map(() => null);

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

      <section
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
        data-testid="visibility-latest-scores"
      >
        <ScoreCard
          label="Visibility"
          tooltip={METRIC_INFO.visibility}
          value={formatScore(parseDecimal(latest?.visibilityScore))}
          delta={parseDecimal(latest?.visibility_score_delta)}
          deltaFormat="percent"
          pending={pending}
        />
        <ScoreCard
          label="Share of voice"
          tooltip={METRIC_INFO.shareOfVoice}
          value={formatScore(parseDecimal(latest?.shareOfVoice))}
          delta={parseDecimal(latest?.share_of_voice_delta)}
          deltaFormat="percent"
          pending={pending}
        />
        <ScoreCard
          label="Brand mention rate"
          tooltip={METRIC_INFO.brandMentionRate}
          value={formatScore(parseDecimal(latest?.brandMentionRate))}
          pending={pending}
        />
        <ScoreCard
          label="Citation rate"
          tooltip={METRIC_INFO.citationRate}
          value={formatScore(parseDecimal(latest?.citationRate))}
          pending={pending}
        />
        <ScoreCard
          label="Net sentiment"
          tooltip={METRIC_INFO.netSentiment}
          value={formatSentiment(parseDecimal(latest?.netSentiment))}
          delta={parseDecimal(latest?.net_sentiment_delta)}
          deltaFormat="absolute"
          pending={pending}
        />
        <ScoreCard
          label="Avg position"
          tooltip={METRIC_INFO.avgPosition}
          value={formatPosition(parseDecimal(latest?.avgPosition))}
          delta={parseDecimal(latest?.position_delta)}
          deltaFormat="absolute"
          deltaInverted
          pending={pending}
        />
      </section>

      <section
        className="bg-white rounded-xl border border-gray-200 p-4 mb-6"
        data-testid="visibility-chart"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Score trend
        </h2>
        {pending ? (
          <Skeleton className="h-80 w-full" />
        ) : (
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
        )}
      </section>

      <section
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        data-testid="visibility-runs-table"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left">Completed</th>
              <th className="px-4 py-2 text-left">
                <MetricLabel text="Visibility" tip={METRIC_INFO.visibility} />
              </th>
              <th className="px-4 py-2 text-left">
                <MetricLabel text="Share of voice" tip={METRIC_INFO.shareOfVoice} />
              </th>
              <th className="px-4 py-2 text-left">
                <MetricLabel text="Brand mention" tip={METRIC_INFO.brandMentionRate} />
              </th>
              <th className="px-4 py-2 text-left">
                <MetricLabel text="Citation rate" tip={METRIC_INFO.citationRate} />
              </th>
              <th className="px-4 py-2 text-left">
                <MetricLabel text="Sentiment" tip={METRIC_INFO.netSentiment} />
              </th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rowFrames.map((r, i) =>
              r ? (
                <RunRow key={r.id} run={r} basePath={basePath} />
              ) : (
                <RowSkeleton key={i} />
              ),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="border-t border-gray-100">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-16" />
        </td>
      ))}
    </tr>
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
