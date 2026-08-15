"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SparklesIcon } from "@heroicons/react/20/solid";
import {
  getCrossOrgWorkflowCostPerOutcome,
  getCrossOrgWorkflowOutreach,
  listWorkflows,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { SortableTh } from "@/components/feature-stats/primitives";
import { WorkflowAiPanel } from "@/components/feature-stats/workflow-ai-panel";
import {
  FEATURE_SLUG,
  cmpValues,
  fmtCount,
  fmtUsd,
  nextSort,
  type Sort,
} from "@/lib/feature-stats-format";
import {
  WORKFLOW_PERF_SORT_KEYS,
  buildWorkflowPerfRows,
} from "@/lib/feature-stats-workflow-rows";
import {
  buildWorkflowCatalogue,
  workflowCatalogueInstructions,
} from "@/lib/feature-stats-workflow-catalogue";

const COLUMN_COUNT = 7;

/**
 * Chat thread key for the AI panel. Not a workflow UUID — the panel spans every
 * workflow of the feature, so one thread belongs to the page.
 */
const AI_SESSION_KEY = `feature-stats:${FEATURE_SLUG}`;

/**
 * Workflow — every workflow this feature runs, scored across all client brands.
 *
 * Three cross-org reads joined on the workflow dynasty slug (see
 * `buildWorkflowPerfRows`): the positive-reply rate, the website-visit rate and
 * the outreach volume. Every cell prints a served field; nothing here divides.
 */
export default function FeatureStatsWorkflowsPage() {
  // Cost + outcome counts for the reply funnel. Same queryKey as the Cost
  // details page's `positiveReply` selection, so the two share one fetch.
  const replies = useQuery({
    queryKey: ["crossOrgWorkflowCost", FEATURE_SLUG, "positiveReply"],
    queryFn: () => getCrossOrgWorkflowCostPerOutcome(FEATURE_SLUG, "positiveReply"),
    ...pollOptionsSlower,
  });

  const visits = useQuery({
    queryKey: ["crossOrgWorkflowCost", FEATURE_SLUG, "websiteVisit"],
    queryFn: () => getCrossOrgWorkflowCostPerOutcome(FEATURE_SLUG, "websiteVisit"),
    ...pollOptionsSlower,
  });

  const outreach = useQuery({
    queryKey: ["crossOrgWorkflowOutreach", FEATURE_SLUG],
    queryFn: () => getCrossOrgWorkflowOutreach(FEATURE_SLUG),
    ...pollOptionsSlower,
  });

  // The catalogue: every workflow the feature declares, whether or not it has
  // ever spent. It is what the AI panel resolves a name against, AND the fourth
  // source of the row union — the three reads above are keyed on spend, so a
  // workflow created here would otherwise be invisible until its first run.
  // Keyed under `workflows` so the chat's own post-answer invalidation of that
  // root refreshes it: a workflow the panel just forked lands in the table with
  // no extra wiring.
  const catalogueQuery = useQuery({
    queryKey: ["workflows", FEATURE_SLUG],
    queryFn: () => listWorkflows({ featureSlug: FEATURE_SLUG }),
    ...pollOptionsSlower,
  });

  const catalogue = useMemo(
    () => buildWorkflowCatalogue(catalogueQuery.data?.workflows ?? []),
    [catalogueQuery.data],
  );

  const [aiOpen, setAiOpen] = useState(false);

  // The chat context. Names and UUIDs only — a DAG is far too large to re-send
  // every turn, so the model reads one via `get_workflow_details` on demand.
  const aiContext = useMemo(
    () => ({
      type: "feature-workflow-catalogue",
      featureSlug: FEATURE_SLUG,
      workflows: catalogue,
      instructions: workflowCatalogueInstructions(FEATURE_SLUG, catalogue),
    }),
    [catalogue],
  );

  // Default: biggest spender first — the page exists to answer "where is the
  // fleet's money going, and what did it buy".
  const [sort, setSort] = useState<Sort>({ key: "invested", dir: "desc" });
  const onSort = (key: string) => setSort(nextSort(sort, key));

  const rows = buildWorkflowPerfRows(
    replies.data?.workflows ?? [],
    visits.data?.workflows ?? [],
    outreach.data ?? [],
    catalogue,
  ).sort((a, b) => cmpValues(WORKFLOW_PERF_SORT_KEYS[sort.key](a), WORKFLOW_PERF_SORT_KEYS[sort.key](b), sort.dir));

  // Reveal on SETTLE, not on success: a read that errors must fall through to
  // the empty/partial table, never hold the page in a skeleton forever.
  const pending =
    (replies.isPending && !replies.isError) ||
    (visits.isPending && !visits.isError) ||
    (outreach.isPending && !outreach.isError) ||
    (catalogueQuery.isPending && !catalogueQuery.isError);
  const allFailed = replies.isError && visits.isError && outreach.isError;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workflow</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every workflow this feature runs, scored across all client brands.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:opacity-90"
        >
          <SparklesIcon className="h-4 w-4" />
          Edit with AI
        </button>
      </header>

      <section className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <SortableTh label="Workflow" sortKey="name" sort={sort} onSort={onSort} align="left" />
                <SortableTh label="Positive replies" sortKey="positiveReplies" sort={sort} onSort={onSort} />
                <SortableTh label="CPPR" sortKey="cppr" sort={sort} onSort={onSort} />
                <SortableTh label="Website visits" sortKey="websiteVisits" sort={sort} onSort={onSort} />
                <SortableTh label="CPWV" sortKey="cpwv" sort={sort} onSort={onSort} />
                <SortableTh label="Outreach" sortKey="outreach" sort={sort} onSort={onSort} />
                <SortableTh label="$ Invested" sortKey="invested" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {pending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={COLUMN_COUNT}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : allFailed ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={COLUMN_COUNT}>
                    Couldn&apos;t load the cross-brand workflow stats (the cross-org query is slow).
                    Retry shortly.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={COLUMN_COUNT}>
                    No workflow data yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.slug} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.positiveReplies)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtUsd(row.cpprUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.websiteVisits)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtUsd(row.cpwvUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.outreach)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.investedUsd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          Cross-org, every client brand pooled. Outreach is the number of people the workflow
          contacted, not a count of workflow runs — one workflow contacting a few hundred people
          logs thousands of runs, so a run count would read as an outreach volume it is not. CPPR
          and CPWV are the lifetime pooled cost per positive reply and per website visit; $ Invested
          is the fleet spend attributed to the workflow. Every figure comes straight from
          features-service; a blank means that source has nothing for the workflow yet — a
          workflow that has never run carries no figure at all.
        </p>
      </section>

      <WorkflowAiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context={aiContext}
        sessionKey={AI_SESSION_KEY}
      />
    </div>
  );
}
