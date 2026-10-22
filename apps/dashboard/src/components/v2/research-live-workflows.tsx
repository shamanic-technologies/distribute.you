"use client";

import { useMemo, useState } from "react";
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
import { fleetWorkflowRows, shortWorkflowName, type LiveWorkflowRow } from "@/lib/live-workflow-rows";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import { useFeatures } from "@/lib/features-context";
import { LIVE_TH } from "@/components/v2/live-workflow-cells";
import { CostValue, RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { TopicMark } from "@/components/v2/research-bits";
import { WorkflowStatusCells, useDynastyStatuses, useWorkflowDeprecation } from "@/components/v2/research-status";
import type { RoiToShow } from "@/lib/expected-return";
import type { ResearchWorkflow } from "@/lib/research/research";

/**
 * A pipe's workflows as the FLEET ranks them right now, at the pipe's leg: every client we run
 * a workflow for, pooled. Research names no org, brand, offer, campaign or audience (owner rule
 * 2026-09-30), so this reads features-service's fleet ranking and nothing scoped to the viewer.
 * The order is the producer's, the same order campaign-service runs (WF-ORDER-EXPLORE-1018).
 * Nothing is ranked or divided here.
 *
 * Columns (owner 2026-10-22): mark, name, description, ROI, cost per outcome, conversion, spent,
 * status. No LLM / Template column: since BEST-TPL-LLM-1022 a workflow fixes neither, each send
 * writes with the leg's best template and LLM. No summary banner above the table: the owner does
 * not want to read which workflow writes the next email.
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
  // The Research catalogue's own pages: a workflow Research studied has one, and its served return
  // (`roiDetail`) carries the EXPECTED figure where the ranking measures none yet.
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
      <div className="k-scroll relative overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line-subtle)]">
              <th className={`${LIVE_TH} w-44`}>Workflow</th>
              <th className={LIVE_TH}>Description</th>
              <th className={`${LIVE_TH} w-24 text-right`}>
                <RoiLabel />
              </th>
              <th className={`${LIVE_TH} w-28 text-right`}>{`$ ${outcomeUnit}`}</th>
              <th className={`${LIVE_TH} w-32 text-right`}>% Conversion</th>
              <th className={`${LIVE_TH} w-24 text-right`}>$ Spent</th>
              <th className={`${LIVE_TH} w-28`}>Status</th>
              <th className={`${LIVE_TH} w-10`} aria-label="Status menu" />
            </tr>
          </thead>
          <tbody>
            {!answered ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="k-row h-10">
                  <td colSpan={COLS} className="px-4">
                    <Shimmer className="h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : failed ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>We could not read the fleet ranking just now. It retries on its own.</EmptyNote>
                </td>
              </tr>
            ) : notBuilt ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>The fleet ranking is being computed. It appears here within a few minutes.</EmptyNote>
                </td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={COLS}>
                  <EmptyNote>{rows.length === 0 ? "No workflow is on this leg yet." : tab === "deprecated" ? "No deprecated workflow on this leg." : "No active workflow on this leg."}</EmptyNote>
                </td>
              </tr>
            ) : (
              shown.map((r) => {
                const studied = researchedWorkflows.get(r.slug);
                const workflowHref = studied
                  ? researchCatalogHref(base, pipe, "workflows", r.slug)
                  : `${brandBase}/workflows/${encodeURIComponent(r.slug)}?pipe=${encodeURIComponent(pipeId)}`;
                return (
                  <WorkflowRow
                    key={r.slug}
                    row={r}
                    studied={studied ?? null}
                    href={workflowHref}
                    name={nameOf(r)}
                    statuses={dynastyStatuses}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Every client we run a workflow for, pooled, in the order every campaign runs. Each send writes with the pipe&apos;s best template and
        LLM. Open a workflow for its runs.
      </div>
    </div>
  );
}

/** The table's column count (empty and loading rows span it). */
const COLS = 8;

type StatusTab = "active" | "deprecated";
const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
];

/**
 * The return a row prints, never blank (owner 2026-10-11): the ranking's measured multiple; none
 * measured, the EXPECTED one features-service serves on the Research catalogue row (`roiDetail`,
 * basis `expected`); neither, a dash.
 */
export function workflowRoiToShow(row: Pick<LiveWorkflowRow, "roiMultiple">, studied: Pick<ResearchWorkflow, "roiDetail"> | null): RoiToShow {
  if (row.roiMultiple != null) return { value: row.roiMultiple, expected: false, reason: null };
  const d = studied?.roiDetail ?? null;
  if (d?.value != null) return { value: d.value, expected: d.basis === "expected", reason: null };
  return { value: null, expected: false, reason: null };
}

const DASH = <span className="k-fg4">—</span>;

function WorkflowRow({
  row: r,
  studied,
  href,
  name,
  statuses,
}: {
  row: LiveWorkflowRow;
  studied: ResearchWorkflow | null;
  href: string;
  name: string;
  statuses: ReturnType<typeof useDynastyStatuses>;
}) {
  const deprecated = statuses.statusOf(r.slug) === "deprecated";
  // A runnable workflow's description rides the status listing; a deprecated one's is its newest
  // version's (the same per-workflow read its Status cell makes for why it was deprecated).
  const newest = useWorkflowDeprecation(r.slug, deprecated);
  const description = deprecated ? newest.description : statuses.descriptionOf(r.slug);
  const cents = r.costPerOutcomeUsd == null ? null : Math.round(r.costPerOutcomeUsd * 100);
  return (
    <tr className="k-row">
      <td className="max-w-0 py-2 pl-4 pr-3">
        <Link href={href} title={r.name ?? r.slug} className={`flex min-w-0 items-center gap-2 hover:text-[var(--accent)] ${r.selectable ? "" : "k-fg3"}`}>
          <TopicMark topic="workflow" size={22} />
          <span className="truncate font-medium">{name}</span>
        </Link>
      </td>
      <td className="max-w-0 px-3 py-2">
        {description ? (
          <p className="k-fg2 line-clamp-2 text-[12px] leading-[18px]" title={description}>
            {description}
          </p>
        ) : (
          DASH
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <RoiValue roi={workflowRoiToShow(r, studied)} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {/* At zero outcomes the producer states no price: Learning, never the spend as a floor. */}
        <CostValue cost={{ cents, expected: false, learning: cents != null && r.mature === false, expectedCents: null }} learning />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{r.conversionRatePct == null ? DASH : formatRatePct(r.conversionRatePct)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{r.spentUsd == null ? DASH : formatUsdAdaptive(r.spentUsd)}</td>
      <WorkflowStatusCells slug={r.slug} label={name} statuses={statuses} />
    </tr>
  );
}
