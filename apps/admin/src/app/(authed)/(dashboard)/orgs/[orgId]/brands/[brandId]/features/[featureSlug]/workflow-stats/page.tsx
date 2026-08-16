"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getFeatureRevenueByWorkflow } from "@/lib/api";
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
import {
  BRAND_WORKFLOW_SORT_KEYS,
  buildBrandWorkflowRows,
} from "@/lib/brand-workflow-rows";

const COLUMN_COUNT = 11;

/**
 * Workflows — every workflow THIS brand has run, and what each one returned for
 * this brand. Realized, never projected.
 *
 * Every column is brand-scoped. The cross-brand benchmark used to sit in the
 * right half of this same table under the same column names, which invited the
 * reader to compare one brand against everyone row by row — two different
 * questions under one heading. The fleet answer keeps its own page
 * (`/feature-stats/<slug>/workflows`), where every row IS the fleet, so nothing
 * is lost by taking it off a page about one brand.
 */
export default function BrandWorkflowStatsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  // THIS brand, realized — features-service owns every figure on the page.
  const brand = useAuthQuery(
    ["featureRevenueByWorkflow", brandId, featureSlug],
    () => getFeatureRevenueByWorkflow(featureSlug, brandId),
    pollOptionsSlower,
  );

  // Default: this brand's biggest return first — the page exists to answer
  // "which of my workflows paid". A workflow with no measured return sorts last.
  const [sort, setSort] = useState<Sort>({ key: "roi", dir: "desc" });
  const onSort = (key: string) => setSort(nextSort(sort, key));

  const rows = buildBrandWorkflowRows(brand.data ?? []).sort((a, b) =>
    cmpValues(BRAND_WORKFLOW_SORT_KEYS[sort.key](a), BRAND_WORKFLOW_SORT_KEYS[sort.key](b), sort.dir),
  );

  // Reveal on SETTLE, not on success — a read that errors falls through to the
  // table's stated reason, never holds the page in a skeleton forever.
  const pending = brand.isPending && !brand.isError;

  // The producer is shipping the per-workflow volume + outcome-cost fields in
  // parallel. While they are absent every row is blank on those five, which is
  // stated rather than left as five unexplained columns of dashes.
  const engagementMissing =
    !pending &&
    rows.length > 0 &&
    rows.every((r) => r.outreach === null && r.positiveReplies === null && r.websiteVisits === null);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Workflows</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every workflow this brand has run, and what it returned for this brand. Realized, not
          projected.
        </p>
      </header>

      <section className="space-y-3">
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-4 pt-3" />
                <th className="px-4 pt-3 text-right" colSpan={10}>
                  This brand · realized
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
                    {brand.isError
                      ? "Couldn't load the workflow stats. Retry shortly."
                      : "This brand has not run a workflow for this feature yet."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.slug} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.name}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtRoi(row.roiMultiple)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtPct(row.cacPct)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.cacUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.pipelineUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtCount(row.positiveReplies)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.cpprUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtCount(row.websiteVisits)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.cpwvUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.outreach)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.investedUsd)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* State the reason rather than leaving columns of dashes unexplained. */}
        {!pending && brand.isError && (
          <p className="text-xs text-amber-700">
            Couldn&apos;t load this brand&apos;s per-workflow economics — features-service serves the
            per-workflow breakdown of realized money, and it is not answering for this brand yet.
          </p>
        )}
        {engagementMissing && (
          <p className="text-xs text-amber-700">
            Positive replies, website visits and outreach are blank because features-service does not
            break them down per workflow yet — it answers them for the whole brand. They fill in on
            their own once it does.
          </p>
        )}

        <p className="text-xs text-gray-400">
          What this brand actually got back, per workflow: return on spend, cost of acquisition as a
          share of revenue and in dollars, pipeline revenue, how many people were contacted, what
          came back, and what each outcome cost. $ Invested is the billed spend the return divides
          by, so the row cannot disagree with itself. A workflow upgraded to a new version is one
          row, not two. Every figure comes straight from features-service; a blank means it could not
          be measured, never a zero. The same workflows across every client brand are on the fleet
          Workflows page.
        </p>
      </section>
    </div>
  );
}
