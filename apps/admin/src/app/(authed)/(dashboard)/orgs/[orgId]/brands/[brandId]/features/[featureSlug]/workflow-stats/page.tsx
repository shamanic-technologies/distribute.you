"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getCrossOrgWorkflowCostPerOutcome,
  getCrossOrgWorkflowOutreach,
  getFeatureRevenueByWorkflow,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { SortableTh } from "@/components/feature-stats/primitives";
import {
  cmpValues,
  fmtCount,
  fmtPct,
  fmtRoi,
  fmtUsd,
  nextSort,
  type Sort,
} from "@/lib/feature-stats-format";
import { buildWorkflowPerfRows } from "@/lib/feature-stats-workflow-rows";
import {
  BRAND_WORKFLOW_SORT_KEYS,
  buildBrandWorkflowRows,
} from "@/lib/brand-workflow-rows";

const COLUMN_COUNT = 11;

/**
 * Workflows — every workflow THIS brand has run, its realized money on the left
 * and the cross-brand benchmark for the same workflow on the right.
 *
 * The two halves answer different questions and are labelled apart: "what did
 * this workflow return for me" is not "what does it return across the fleet",
 * and printing them under one heading would read as one number contradicting
 * itself. The right half is the same three cross-org reads (and the same query
 * keys) as `/feature-stats/<slug>/workflows`, so the two pages cannot disagree
 * about a workflow and the shared entries cost no extra network.
 */
export default function BrandWorkflowStatsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  // THIS brand, realized — features-service owns every figure. The producer is
  // shipping the per-workflow grouping in parallel, so this read legitimately
  // fails until it lands: the page then states that rather than skeletoning.
  const brand = useAuthQuery(
    ["featureRevenueByWorkflow", brandId, featureSlug],
    () => getFeatureRevenueByWorkflow(featureSlug, brandId),
    pollOptionsSlower,
  );

  // Cross-brand benchmark — byte-equal query keys with the root Workflow page.
  const replies = useAuthQuery(
    ["crossOrgWorkflowCost", featureSlug, "positiveReply"],
    () => getCrossOrgWorkflowCostPerOutcome(featureSlug, "positiveReply"),
    pollOptionsSlower,
  );
  const visits = useAuthQuery(
    ["crossOrgWorkflowCost", featureSlug, "websiteVisit"],
    () => getCrossOrgWorkflowCostPerOutcome(featureSlug, "websiteVisit"),
    pollOptionsSlower,
  );
  const outreach = useAuthQuery(
    ["crossOrgWorkflowOutreach", featureSlug],
    () => getCrossOrgWorkflowOutreach(featureSlug),
    pollOptionsSlower,
  );

  // Default: this brand's biggest return first — the page exists to answer
  // "which of my workflows paid". A workflow with no measured return sorts last.
  const [sort, setSort] = useState<Sort>({ key: "roi", dir: "desc" });
  const onSort = (key: string) => setSort(nextSort(sort, key));

  const rows = buildBrandWorkflowRows(
    brand.data ?? [],
    buildWorkflowPerfRows(
      replies.data?.workflows ?? [],
      visits.data?.workflows ?? [],
      outreach.data ?? [],
    ),
  ).sort((a, b) =>
    cmpValues(BRAND_WORKFLOW_SORT_KEYS[sort.key](a), BRAND_WORKFLOW_SORT_KEYS[sort.key](b), sort.dir),
  );

  // Reveal on SETTLE, not on success — a read that errors falls through to the
  // table with its half empty, never holds the page in a skeleton forever.
  const settled = (q: { isPending: boolean; isError: boolean }) => !q.isPending || q.isError;
  const pending = ![brand, replies, visits, outreach].every(settled);
  const fleetFailed = replies.isError && visits.isError && outreach.isError;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Workflows</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every workflow this brand has run. The left block is what it returned for THIS brand,
          realized; the right block is the same workflow across every client brand.
        </p>
      </header>

      <section className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              {/* Two grouped headings: the same figure means different things on
                  each side, so the reader is told which brand it is about. */}
              <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-4 pt-3" />
                <th className="px-4 pt-3 text-right" colSpan={4}>
                  This brand · realized
                </th>
                <th className="px-4 pt-3 text-right" colSpan={6}>
                  All client brands
                </th>
              </tr>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <SortableTh label="Workflow" sortKey="name" sort={sort} onSort={onSort} align="left" />
                <SortableTh label="ROI" sortKey="roi" sort={sort} onSort={onSort} />
                <SortableTh label="% CAC" sortKey="cacPct" sort={sort} onSort={onSort} />
                <SortableTh label="$ CAC" sortKey="cacUsd" sort={sort} onSort={onSort} />
                <SortableTh label="Revenue" sortKey="revenue" sort={sort} onSort={onSort} />
                <SortableTh
                  label="Positive replies"
                  sortKey="positiveReplies"
                  sort={sort}
                  onSort={onSort}
                  className="border-l border-gray-100"
                />
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
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={COLUMN_COUNT}>
                    {fleetFailed && brand.isError
                      ? "Couldn't load the workflow stats. Retry shortly."
                      : "This brand has not run a workflow for this feature yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.slug} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtRoi(row.brand.roiMultiple)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtPct(row.brand.cacPct)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.brand.cacUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.brand.pipelineUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 border-l border-gray-100">
                      {fmtCount(row.fleet?.positiveReplies ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.fleet?.cpprUsd ?? null)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtCount(row.fleet?.websiteVisits ?? null)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.fleet?.cpwvUsd ?? null)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.fleet?.outreach ?? null)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtUsd(row.fleet?.investedUsd ?? null)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* State the reason rather than leaving four columns of dashes unexplained. */}
        {!pending && brand.isError && (
          <p className="text-xs text-amber-700">
            Couldn&apos;t load this brand&apos;s per-workflow economics — features-service serves the
            per-workflow breakdown of realized money, and it is not answering for this brand yet. The
            cross-brand columns are unaffected.
          </p>
        )}

        <p className="text-xs text-gray-400">
          Left block: what this brand actually got back — ROI, cost of acquisition as a share of
          revenue, the dollar cost of one acquisition, and pipeline revenue. Realized, not projected.
          Right block: the same workflow pooled across every client brand, identical to the fleet
          Workflow page. The two are deliberately not comparable line for line — one is this brand,
          the other is everyone — and neither is summed into the other. Every figure comes straight
          from features-service; a blank means it could not be measured, never a zero.
        </p>
      </section>
    </div>
  );
}
