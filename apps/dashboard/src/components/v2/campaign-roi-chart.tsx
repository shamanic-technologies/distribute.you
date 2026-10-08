"use client";

import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getCampaignRoiHistory } from "@/lib/api";
import type { RoiHistory } from "@/lib/revenue-view";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * The campaign's return since it started, one point per day (owner 2026-10-07: "a line
 * chart that shows the ROI since inception for this campaign specifically", above the
 * outcome steps). Served whole by features-service (`roiHistory` on the campaign-scoped
 * `/revenue`): both legs cumulative, so the line reads the return to date on each day and
 * its last point is the ROI tile's figure. Nothing is divided here.
 *
 * A day whose cumulative spend is still 0 has no return (null, never 0) and is dropped.
 * Pipeline whose outcome carries no date sits on no day; the card says how much.
 */
export function CampaignRoiChart({
  brandId,
  campaignId,
  featureSlug,
}: {
  brandId: string;
  campaignId: string;
  featureSlug: string | null;
}) {
  const slug = featureSlug ?? "";
  const q = useAuthQuery(
    ["campaignRoiHistory", campaignId, slug],
    () => getCampaignRoiHistory(slug, brandId, campaignId),
    { ...pollOptions, enabled: !!slug },
  );
  // Answered once stays answered: a failed poll must not repaint a skeleton.
  const answered = q.data !== undefined;
  return (
    <RoiHistoryCard
      history={q.data ?? null}
      answered={answered}
      failed={!answered && q.isFetchedAfterMount && q.isError}
      right="Measured, since it started"
      sub="What the people it reached are worth, divided by what it cost, to date."
      failedCopy="Could not read this campaign's return. Retrying."
      emptyCopy="No return to show yet: this campaign has not spent anything."
    />
  );
}

/**
 * The return-over-time card, for any grain that serves a `roiHistory` (a campaign, the
 * offer on Today). Draws the served daily `roiMultiple` on a time axis; divides nothing.
 */
export function RoiHistoryCard({
  history,
  answered,
  failed,
  right,
  sub,
  failedCopy,
  emptyCopy,
}: {
  history: RoiHistory | null;
  answered: boolean;
  failed: boolean;
  right: string;
  sub: string;
  failedCopy: string;
  emptyCopy: string;
}) {
  const points = (history?.daily ?? [])
    .filter((d) => d.roiMultiple != null)
    // A real time axis: days with no point are absent on the wire, and a category axis
    // would squeeze a quiet month into one step.
    .map((d) => ({ t: Date.parse(`${d.date}T00:00:00Z`), date: d.date, roi: d.roiMultiple as number }));
  const last = points.length ? points[points.length - 1].roi : null;
  const undated = history?.undatedPipelineUsd ?? 0;

  return (
    <section>
      <SectionTitle right={<span>{right}</span>}>Return over time</SectionTitle>
      <div className="k-card px-4 pb-3 pt-3">
        <div className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">
          {!answered && !failed ? (
            <Shimmer className="h-7 w-20" />
          ) : last == null ? (
            <span className="k-fg4">—</span>
          ) : (
            <span className={roiIsGood(last) ? "text-[var(--run)]" : ""}>{formatRoi(last)}</span>
          )}
        </div>
        <p className="k-fg3 mt-0.5 text-[12px]">{sub}</p>
        {undated > 0 && (
          <p className="k-fg3 text-[12px]">{formatUsdAdaptive(undated)} of value has no date, so it is not on the line.</p>
        )}
        <div className="mt-3 h-[180px]">
          {!answered && !failed ? (
            <Shimmer className="h-full w-full rounded-[8px]" />
          ) : failed ? (
            <EmptyNote>{failedCopy}</EmptyNote>
          ) : points.length === 0 ? (
            <EmptyNote>{emptyCopy}</EmptyNote>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                  tickFormatter={(t: number) => new Date(t).toISOString().slice(5, 10)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--fg-3)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickCount={4}
                  tickFormatter={(v: number) => formatRoi(v)}
                />
                {/* Break-even: above it the money is coming back. */}
                <ReferenceLine
                  y={1}
                  stroke="var(--line-strong)"
                  strokeDasharray="3 3"
                  label={{ value: "Break-even", position: "insideTopLeft", fontSize: 11, fill: "var(--fg-3)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="k-popover px-2.5 py-1.5 text-[12px]">
                        <p className="k-fg3 k-mono">{new Date(Number(label)).toISOString().slice(0, 10)}</p>
                        <p className="font-medium tabular-nums">{formatRoi(Number(payload[0].value))}</p>
                      </div>
                    ) : null
                  }
                />
                <Line type="stepAfter" dataKey="roi" stroke="var(--accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
