"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import { listRankedOpportunities, type RankedOpportunity } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

// Reads the SAME gold catalog (GET /orgs/opportunities, scored above
// SCORE_THRESHOLD) that the sidebar badge counts and the campaign HITL queue
// renders — so the "Quote requests" badge always equals the page count.
// Brand-scoped (no campaignId) → brand-set wide "across all campaigns".
export default function FeatureQuoteRequestsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const [search, setSearch] = useState("");

  const { data, isPending } = useAuthQuery(
    ["rankedOpportunities", { brandId }],
    () => listRankedOpportunities({ brandId, limit: 50 }),
    pollOptionsSlow,
  );

  const opportunities = data?.opportunities ?? [];
  const total = data?.total ?? opportunities.length;

  const filtered = useMemo(() => {
    if (!search) return opportunities;
    const q = search.toLowerCase();
    return opportunities.filter(
      (o) =>
        o.opportunityText.toLowerCase().includes(q) ||
        (o.mediaOutlet?.toLowerCase().includes(q) ?? false) ||
        (o.journalistName?.toLowerCase().includes(q) ?? false) ||
        (o.category?.toLowerCase().includes(q) ?? false),
    );
  }, [opportunities, search]);

  return (
    <div className="p-4 md:p-8" data-testid="feature-quote-requests-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Quote requests
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({total.toLocaleString("en-US")} ranked across all campaigns)
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ranked journalist quote opportunities scored for this brand.
        </p>
      </div>

      <EntitySearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by opportunity, outlet, journalist, or category..."
        resultCount={filtered.length}
        totalCount={opportunities.length}
      />

      {isPending && !data ? (
        <ListSkeleton />
      ) : opportunities.length === 0 ? (
        <EmptyState message="No ranked opportunities yet. They appear here after the next scoring run." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Opportunity</th>
                <th className="px-4 py-2 text-left">Outlet</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <Row key={o.opportunityId} opportunity={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ opportunity }: { opportunity: RankedOpportunity }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-gray-800 max-w-md">
        <div
          className="text-xs text-gray-700 line-clamp-3"
          title={opportunity.opportunityText}
        >
          {opportunity.opportunityText}
        </div>
        {opportunity.pitchUrl && (
          <a
            href={opportunity.pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            Open pitch link
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{opportunity.mediaOutlet ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600">
        {/* Relevance judge (DIS-79) emits 0–100; render directly. NOT *100. */}
        {Math.round(opportunity.score)}%
      </td>
      <td className="px-4 py-3 text-gray-600">
        {opportunity.deadline
          ? new Date(opportunity.deadline).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">{opportunity.provider}</td>
    </tr>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 mt-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 h-16 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500 mt-4"
      data-testid="feature-quote-requests-empty"
    >
      {message}
    </div>
  );
}
