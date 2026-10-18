"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getLegWorkflowRanking, listChannelWorkflowStacks } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { PIPE_KEY, researchCatalogHref, type ResearchCatalog, type ResearchPipe } from "@/lib/research/research";
import { cannotRunReason, fleetWorkflowRows, placeWords, shortWorkflowName, type LiveWorkflowRow, type PlaceTone } from "@/lib/live-workflow-rows";
import { formatUsdAdaptive } from "@/lib/format-number";
import { useFeatures } from "@/lib/features-context";
import {
  LIVE_TH,
  LiveRankingStrip,
  LiveWorkflowCells,
  LiveWorkflowChips,
  LiveWorkflowHeads,
} from "@/components/v2/live-workflow-cells";

/**
 * A pipe's workflows as the FLEET ranks them right now, at the pipe's leg: every client we run
 * a workflow for, pooled. Research names no org, brand, offer, campaign or audience (owner rule
 * 2026-09-30), so this reads features-service's fleet ranking and nothing scoped to the viewer.
 * The order, both flags and each row's `place` (why it stands there) are the producer's, the same
 * order campaign-service runs (WF-ORDER-EXPLORE-1018). Nothing is ranked or divided here.
 *
 * The brand's own version of this table (one per campaign) lives on the brand Workflows page.
 */

/** The pipe's channel name, the prefix every one of its workflow names repeats. */
export function usePipeChannelName(pipe: ResearchPipe): string | null {
  const { getFeature } = useFeatures();
  return getFeature(PIPE_KEY[pipe].channel)?.name ?? null;
}

/**
 * The pipe's leg in the fleet's own key, or null when it is not a proactive leg (the fleet ranks
 * those only) or the catalogue has not answered. Read by the pipe's leg key and judged with
 * `isProactiveFrom`: the renamed outbound legs start on Lead found, so a `fromKey === null` test
 * found none of them and the live table never showed.
 */
export function useResearchPipeLeg(pipe: ResearchPipe): string | null {
  const leg = legFor(useLegCatalogue(), PIPE_KEY[pipe].leg);
  return leg && isProactiveFrom(leg.fromKey) ? leg.legKey : null;
}

export function ResearchLiveWorkflows({
  base,
  pipe,
  legKey,
  catalog,
  outcomeUnit,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  legKey: string;
  catalog: ResearchCatalog | null;
  outcomeUnit: string;
  nav: (href: string) => void;
}) {
  const featureSlug = PIPE_KEY[pipe].channel;

  const rankingQ = useAuthQuery(["legWorkflowRanking", featureSlug, legKey], () => getLegWorkflowRanking(featureSlug, legKey), {
    ...pollOptions,
    retry: false,
  });
  // Every version, retired ones included: a retired dynasty still states what it wrote with.
  const catalogueQ = useAuthQuery(["workflows", featureSlug, "stacks-all"], () => listChannelWorkflowStacks(featureSlug), pollOptions);

  const rows = useMemo(() => fleetWorkflowRows(rankingQ.data?.rows ?? []), [rankingQ.data]);
  // The model and template each workflow writes with: its newest version's, retired or not.
  const stack = useMemo(() => {
    const m = new Map<string, { version: number; model: string | null; template: string | null }>();
    for (const w of catalogueQ.data ?? []) {
      const prev = m.get(w.workflowDynastySlug);
      if (!prev || w.version > prev.version) {
        m.set(w.workflowDynastySlug, { version: w.version, model: w.contentModel ?? null, template: w.contentPromptType ?? null });
      }
    }
    return m;
  }, [catalogueQ.data]);
  const researched = useMemo(() => new Set((catalog?.[pipe].workflows ?? []).map((w) => w.key)), [catalog, pipe]);
  const channelName = usePipeChannelName(pipe);
  const nameOf = (r: { name: string | null; slug: string }) => shortWorkflowName(r.name ?? r.slug, channelName);

  const answered = rankingQ.data !== undefined || rankingQ.isFetchedAfterMount;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;

  return (
    <div className="k-card overflow-hidden">
      <LiveRankingStrip rows={rows} moneyNote="no mature workflow yet" nameOf={nameOf} />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1360px] text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-12`}>#</th>
              <th className={LIVE_TH}>Workflow</th>
              <th className={`${LIVE_TH} w-40`}>LLM</th>
              <th className={`${LIVE_TH} w-44`}>Template</th>
              <th className={`${LIVE_TH} w-48`}>Why here</th>
              <LiveWorkflowHeads costLabel={`Cost ${outcomeUnit.replace("/ ", "per ")}`} />
            </tr>
          </thead>
          <tbody>
            {!answered ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="k-row h-10">
                  <td colSpan={11} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : failed ? (
              <tr>
                <td colSpan={11}>
                  <EmptyNote>We could not read the fleet ranking just now. It retries on its own.</EmptyNote>
                </td>
              </tr>
            ) : notBuilt ? (
              <tr>
                <td colSpan={11}>
                  <EmptyNote>The fleet ranking is being computed. It appears here within a few minutes.</EmptyNote>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <EmptyNote>No workflow is on this leg yet.</EmptyNote>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const s = stack.get(r.slug);
                const href = researched.has(r.slug) ? researchCatalogHref(base, pipe, "workflows", r.slug) : null;
                return (
                  <tr
                    key={r.slug}
                    onClick={href ? () => nav(href) : undefined}
                    className={`k-row h-10 ${href ? "cursor-pointer" : ""} ${r.cash ? "k-selected" : ""}`}
                  >
                    <td className="k-mono k-fg3 pl-4 pr-3 text-[12px] tabular-nums">{r.rank ?? "—"}</td>
                    <td className="max-w-0 px-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {href ? (
                          <Link href={href} className={`min-w-0 truncate font-medium ${r.selectable ? "" : "k-fg3"}`} title={r.name ?? r.slug}>
                            {nameOf(r)}
                          </Link>
                        ) : (
                          <span className={`min-w-0 truncate font-medium ${r.selectable ? "" : "k-fg3"}`} title={r.name ?? r.slug}>
                            {nameOf(r)}
                          </span>
                        )}
                        <LiveWorkflowChips row={r} />
                        {!r.selectable && <span className="k-chip k-fg3 shrink-0">{cannotRunReason(r)}</span>}
                      </div>
                    </td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.model ?? <span className="k-fg4">—</span>}</td>
                    <td className="k-fg2 max-w-0 truncate px-3">{s?.template ?? <span className="k-fg4">—</span>}</td>
                    <td className="px-3">
                      <WhyHere row={r} />
                    </td>
                    <LiveWorkflowCells row={r} />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Every client we run a workflow for, pooled: the same order every campaign runs. A learning workflow goes first while its spend per
        outcome so far ($0 if never run) is below the best mature price; then the best mature one, which gets the money. A workflow that
        cannot run sits last.
      </div>
    </div>
  );
}

const TONE: Record<PlaceTone, string> = {
  explore: "var(--data-amber)",
  money: "var(--run)",
  mature: "var(--data-teal)",
  worse: "var(--fg-3)",
  off: "var(--fg-4)",
};

/** Why the producer's order puts this row here, and for a learning row the price it compared. */
function WhyHere({ row }: { row: LiveWorkflowRow }) {
  const words = placeWords(row);
  if (!words) return <span className="k-fg4">—</span>;
  const learning = words.tone === "explore" || words.tone === "worse";
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px]" style={{ color: TONE[words.tone] }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE[words.tone] }} />
      <span className="truncate">{words.label}</span>
      {learning && row.explorePriceUsd != null && (
        <span className="k-fg3 shrink-0 tabular-nums">
          {row.explorePriceUsd === 0 ? "never run" : `${formatUsdAdaptive(row.explorePriceUsd)} so far`}
        </span>
      )}
    </span>
  );
}
