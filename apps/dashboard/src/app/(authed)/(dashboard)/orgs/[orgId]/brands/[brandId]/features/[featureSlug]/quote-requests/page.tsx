"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import { listQuoteRequests, type QuoteRequest } from "@/lib/api";
import { EntitySearchBar } from "@/components/entity-search-bar";

export default function FeatureQuoteRequestsPage() {
  const params = useParams();
  const featureSlug = params.featureSlug as string;
  const [search, setSearch] = useState("");

  const { data, isPending } = useAuthQuery(
    ["featureQuoteRequests", featureSlug],
    () => listQuoteRequests({ limit: 200 }),
    pollOptionsSlow,
  );

  const requests = data?.providerQuoteRequests ?? [];

  const filtered = useMemo(() => {
    if (!search) return requests;
    const q = search.toLowerCase();
    return requests.filter(
      (r) =>
        r.opportunityText.toLowerCase().includes(q) ||
        (r.mediaOutlet?.toLowerCase().includes(q) ?? false) ||
        (r.journalistName?.toLowerCase().includes(q) ?? false) ||
        (r.category?.toLowerCase().includes(q) ?? false),
    );
  }, [requests, search]);

  return (
    <div className="p-4 md:p-8" data-testid="feature-quote-requests-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Quote requests
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({requests.length.toLocaleString("en-US")} across all campaigns)
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Journalist quote opportunities pulled for this org.
        </p>
      </div>

      <EntitySearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by opportunity, outlet, journalist, or category..."
        resultCount={filtered.length}
        totalCount={requests.length}
      />

      {isPending && !data ? (
        <ListSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState message="No quote requests yet. They'll appear here after the next run." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Opportunity</th>
                <th className="px-4 py-2 text-left">Outlet</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ request }: { request: QuoteRequest }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-gray-800 max-w-md">
        <div
          className="text-xs text-gray-700 line-clamp-3"
          title={request.opportunityText}
        >
          {request.opportunityText}
        </div>
        {request.pitchUrl && (
          <a
            href={request.pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            Open pitch link
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.mediaOutlet ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600">
        {request.deadline ? new Date(request.deadline).toLocaleDateString() : "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.provider}</td>
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
