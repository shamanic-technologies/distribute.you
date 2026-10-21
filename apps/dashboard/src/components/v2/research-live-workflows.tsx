"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getLegWorkflowRanking } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { RecordsTabs } from "@/components/v2/records";
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
import { WorkflowStatusCells, useDynastyStatuses } from "@/components/v2/research-status";

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
  // Only the workflows ON this pipe (the producer's `assignment`): one moved to another leg of the channel
  // (Dotterel's to Killdeer) or on none is not this pipe's, so it is not listed (owner 2026-10-22).
  const rows = useMemo(() => fleetWorkflowRows((rankingQ.data?.rows ?? []).filter((r) => r.assignment === "active")), [rankingQ.data]);
  // Each workflow's own status (workflow-service), changed from the row's ⋮ (TEMPLATE-MODEL-STATUS-1019).
  const dynastyStatuses = useDynastyStatuses(featureSlug);
  // Two tabs on that status (owner 2026-10-22): Active first, in the producer's order (learning and mature
  // lead), then Deprecated. A row moves tab the moment its status is written.
  const [tab, setTab] = useState<StatusTab>("active");
  const byTab = useMemo(() => {
    const out: Record<StatusTab, LiveWorkflowRow[]> = { active: [], deprecated: [] };
    for (const r of rows) out[dynastyStatuses.statusOf(r.slug) === "deprecated" ? "deprecated" : "active"].push(r);
    return out;
  }, [rows, dynastyStatuses]);
  const shown = byTab[tab];
  // The Research catalogue's own pages: a workflow, template or model Research studied has one.
  const researchedWorkflows = useMemo(() => new Map((catalog?.[pipe].workflows ?? []).map((w) => [w.key, w])), [catalog, pipe]);
  // A workflow Research never studied still has its live page (`/workflows/:slug`, priced for this pipe).
  const brandBase = base.replace(/\/research$/, "");
  const pipeId = `${featureSlug}|${legKey}`;
  const channelName = usePipeChannelName(pipe);
  const nameOf = (r: { name: string | null; slug: string }) => shortWorkflowName(r.name ?? r.slug, channelName);

  // Rows wait for the statuses too, or every row would sit in Active and jump tab when they answer.
  const answered = (rankingQ.data !== undefined || rankingQ.isFetchedAfterMount) && dynastyStatuses.answered;
  const failed = rankingQ.data === undefined && rankingQ.isFetchedAfterMount;
  const notBuilt = rankingQ.data !== undefined && rankingQ.data.computedAt === null;

  return (
    <div className="k-card overflow-hidden">
      <RecordsTabs
        tabs={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: answered ? byTab[t.key].length : null }))}
        active={tab}
        onPick={(k) => setTab(k as StatusTab)}
      />
      <LiveRankingStrip rows={byTab.active} moneyNote="no mature workflow yet" nameOf={nameOf} />
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1180px] table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-28`}>Workflow</th>
              <th className={`${LIVE_TH} w-28`}>LLM</th>
              <th className={LIVE_TH}>Template</th>
              <th className={`${LIVE_TH} w-32`}>Why here</th>
              <LiveWorkflowHeads costLabel={`Cost ${outcomeUnit.replace("/ ", "per ")}`} compact maturityLabel="Maturity" />
              <th className={`${LIVE_TH} w-32`}>Status</th>
              <th className={`${LIVE_TH} w-10`} aria-label="Status menu" />
            </tr>
          </thead>
          <tbody>
            {!answered ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="k-row h-10">
                  <td colSpan={13} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : failed ? (
              <tr>
                <td colSpan={13}>
                  <EmptyNote>We could not read the fleet ranking just now. It retries on its own.</EmptyNote>
                </td>
              </tr>
            ) : notBuilt ? (
              <tr>
                <td colSpan={13}>
                  <EmptyNote>The fleet ranking is being computed. It appears here within a few minutes.</EmptyNote>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={13}>
                  <EmptyNote>{rows.length === 0 ? "No workflow is on this leg yet." : tab === "deprecated" ? "No deprecated workflow on this leg." : "No active workflow on this leg."}</EmptyNote>
                </td>
              </tr>
            ) : (
              shown.map((r) => {
                const studied = researchedWorkflows.get(r.slug);
                // What it writes with NOW (its runnable version); a deprecated workflow has none, so the cells
                // state what its figures were written with. Both served by features-service's catalogue.
                const now = studied?.writesWithNow ?? studied?.wroteWith ?? null;
                const workflowHref = studied
                  ? researchCatalogHref(base, pipe, "workflows", r.slug)
                  : `${brandBase}/workflows/${encodeURIComponent(r.slug)}?pipe=${encodeURIComponent(pipeId)}`;
                const model = now?.model ?? null;
                const template = now?.template ?? null;
                return (
                  <tr key={r.slug} className={`k-row h-10 ${r.cash ? "k-selected" : ""}`}>
                    <td className="max-w-0 pl-4 pr-3">
                      <Tag href={workflowHref} title={r.name ?? r.slug} muted={!r.selectable} strong>
                        {nameOf(r)}
                      </Tag>
                    </td>
                    <td className="max-w-0 px-3">
                      {model ? (
                        <Tag href={model.linked ? researchCatalogHref(base, pipe, "models", model.key) : null} title={model.label}>
                          {model.label}
                        </Tag>
                      ) : now?.modelAlias ? (
                        <Tag href={null} title={now.modelAlias}>
                          {now.modelAlias}
                        </Tag>
                      ) : (
                        <span className="k-fg4">—</span>
                      )}
                    </td>
                    <td className="max-w-0 px-3">
                      {template ? (
                        // Owner 2026-10-21: the dynasty name on line 1, its version on a discreet line 2 (a chip beside
                        // the name squeezed it to one letter). The name WRAPS, never truncated: it must read in full.
                        <div className="flex min-w-0 flex-col items-start py-1">
                          <Tag href={template.linked ? researchCatalogHref(base, pipe, "templates", template.key) : null} title={template.label} wrap>
                            {template.label}
                          </Tag>
                          {template.version && (
                            <span className="k-mono k-fg3 truncate pl-1 text-[11px] leading-4" title={`Version ${template.version.label} (${template.version.key})`}>
                              {template.version.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="k-fg4">—</span>
                      )}
                    </td>
                    <td className="max-w-0 px-3">
                      <WhyHere row={r} />
                    </td>
                    <LiveWorkflowCells row={r} />
                    <WorkflowStatusCells slug={r.slug} label={nameOf(r)} statuses={dynastyStatuses} />
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

type StatusTab = "active" | "deprecated";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
];

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
  wrap = false,
  children,
}: {
  href: string | null;
  title: string;
  muted?: boolean;
  strong?: boolean;
  /** Wraps onto more lines instead of truncating (keel's unlayered `.k-chip` pins nowrap + 20px, so inline). */
  wrap?: boolean;
  children: ReactNode;
}) {
  const cls = `k-chip inline-block max-w-full align-middle ${wrap ? "" : "truncate"} ${strong ? "font-medium" : ""} ${muted ? "k-fg3" : ""}`;
  const style = wrap ? { height: "auto", whiteSpace: "normal" as const, overflowWrap: "anywhere" as const, padding: "1px 6px", lineHeight: "18px" } : undefined;
  return href ? (
    <Link href={href} title={title} className={`${cls} hover:text-[var(--accent)]`} style={style}>
      {children}
    </Link>
  ) : (
    <span title={title} className={cls} style={style}>
      {children}
    </span>
  );
}
