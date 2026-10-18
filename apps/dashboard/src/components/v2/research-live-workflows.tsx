"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getLegWorkflowRanking, listChannelWorkflowStacks } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { PIPE_KEY, researchCatalogHref, type ResearchCatalog, type ResearchPipe } from "@/lib/research/research";
import { fleetWorkflowRows, placeWords, shortWorkflowName, type LiveWorkflowRow, type PlaceTone } from "@/lib/live-workflow-rows";
import { formatUsdAdaptive } from "@/lib/format-number";
import { useFeatures } from "@/lib/features-context";
import {
  LIVE_TH,
  LiveRankingStrip,
  LiveWorkflowCells,
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
}: {
  base: string;
  pipe: ResearchPipe;
  legKey: string;
  catalog: ResearchCatalog | null;
  outcomeUnit: string;
  /** Unused since every cell is its own link; kept so the catalogue page passes one shape. */
  nav?: (href: string) => void;
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
  // The Research catalogue's own pages: a workflow, template or model Research studied has one.
  const researchedWorkflows = useMemo(() => new Map((catalog?.[pipe].workflows ?? []).map((w) => [w.key, w])), [catalog, pipe]);
  const researchedTemplates = useMemo(() => new Set((catalog?.[pipe].templates ?? []).map((t) => t.key)), [catalog, pipe]);
  // A workflow Research never studied still has its live page (`/workflows/:slug`, priced for this pipe).
  const brandBase = base.replace(/\/research$/, "");
  const pipeId = `${featureSlug}|${legKey}`;
  const channelName = usePipeChannelName(pipe);
  const nameOf = (r: { name: string | null; slug: string }) => shortWorkflowName(r.name ?? r.slug, channelName);

  const answered = rankingQ.data !== undefined || rankingQ.isFetchedAfterMount;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;

  return (
    <div className="k-card overflow-hidden">
      <LiveRankingStrip rows={rows} moneyNote="no mature workflow yet" nameOf={nameOf} />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-10`}>#</th>
              <th className={LIVE_TH}>Workflow</th>
              <th className={`${LIVE_TH} w-24`}>LLM</th>
              <th className={`${LIVE_TH} w-28`}>Template</th>
              <th className={`${LIVE_TH} w-36`}>Why here</th>
              <LiveWorkflowHeads costLabel={`Cost ${outcomeUnit.replace("/ ", "per ")}`} compact />
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
                const st = stack.get(r.slug);
                const studied = researchedWorkflows.get(r.slug);
                const workflowHref = studied
                  ? researchCatalogHref(base, pipe, "workflows", r.slug)
                  : `${brandBase}/workflows/${encodeURIComponent(r.slug)}?pipe=${encodeURIComponent(pipeId)}`;
                const model = studied?.model ?? null;
                const template = st?.template ?? null;
                return (
                  <tr key={r.slug} className={`k-row h-10 ${r.cash ? "k-selected" : ""}`}>
                    <td className="k-mono k-fg3 pl-4 pr-3 text-[12px] tabular-nums">{r.rank ?? "—"}</td>
                    <td className="max-w-0 px-3">
                      <Tag href={workflowHref} title={r.name ?? r.slug} muted={!r.selectable} strong>
                        {nameOf(r)}
                      </Tag>
                    </td>
                    <td className="max-w-0 px-3">
                      {model ? (
                        <Tag href={model.linked ? researchCatalogHref(base, pipe, "models", model.key) : null} title={model.label}>
                          {model.label}
                        </Tag>
                      ) : st?.model ? (
                        <Tag href={null} title={st.model}>
                          {st.model}
                        </Tag>
                      ) : (
                        <span className="k-fg4">—</span>
                      )}
                    </td>
                    <td className="max-w-0 px-3">
                      {template ? (
                        <Tag href={researchedTemplates.has(template) ? researchCatalogHref(base, pipe, "templates", template) : null} title={template}>
                          {template}
                        </Tag>
                      ) : (
                        <span className="k-fg4">—</span>
                      )}
                    </td>
                    <td className="max-w-0 px-3">
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
  const price = learning && row.explorePriceUsd != null ? (row.explorePriceUsd === 0 ? "never run" : formatUsdAdaptive(row.explorePriceUsd)) : null;
  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 text-[12px]"
      style={{ color: TONE[words.tone] }}
      title={price ? `${words.label}: ${price === "never run" ? "never run yet" : `${price} per outcome so far`}` : words.label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE[words.tone] }} />
      <span className="truncate">{words.label}</span>
      {price && <span className="k-fg3 shrink-0 tabular-nums">{price === "never run" ? "$0" : price}</span>}
    </span>
  );
}

/**
 * One cell as a tag that opens its own page (workflow, template, model). A value with no page yet
 * (a template or model Research never studied) is the same tag, not clickable.
 */
function Tag({
  href,
  title,
  muted = false,
  strong = false,
  children,
}: {
  href: string | null;
  title: string;
  muted?: boolean;
  strong?: boolean;
  children: ReactNode;
}) {
  const cls = `k-chip inline-block max-w-full truncate align-middle ${strong ? "font-medium" : ""} ${muted ? "k-fg3" : ""}`;
  return href ? (
    <Link href={href} title={title} className={`${cls} hover:text-[var(--accent)]`}>
      {children}
    </Link>
  ) : (
    <span title={title} className={cls}>
      {children}
    </span>
  );
}
