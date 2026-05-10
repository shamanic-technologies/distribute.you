"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listQuoteRequests,
  type QuoteRequest,
  type QuoteRequestStatus,
} from "@/lib/api";

const POLL_INTERVAL = 10_000;
const pollOptions = {
  refetchInterval: POLL_INTERVAL,
  refetchIntervalInBackground: false,
  placeholderData: keepPreviousData,
};

const STATUS_STYLES: Record<QuoteRequestStatus, string> = {
  fetched: "bg-gray-100 text-gray-700 border-gray-200",
  scored: "bg-blue-100 text-blue-700 border-blue-200",
  skipped: "bg-gray-100 text-gray-500 border-gray-200",
  pitched: "bg-purple-100 text-purple-700 border-purple-200",
  selected: "bg-yellow-100 text-yellow-700 border-yellow-200",
  published: "bg-green-100 text-green-700 border-green-200",
  not_selected: "bg-gray-100 text-gray-500 border-gray-200",
  error: "bg-red-100 text-red-600 border-red-200",
};

const STATUSES: QuoteRequestStatus[] = [
  "fetched",
  "scored",
  "skipped",
  "pitched",
  "selected",
  "published",
  "not_selected",
  "error",
];

export default function QuoteRequestsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const brandId = params.brandId as string;

  const [statusFilter, setStatusFilter] = useState<QuoteRequestStatus | "">("");

  const { data, isLoading } = useAuthQuery(
    ["quoteRequests", { brandId, campaignId, status: statusFilter }],
    () =>
      listQuoteRequests({
        brandId,
        campaignId,
        status: statusFilter || undefined,
        limit: 100,
      }),
    pollOptions,
  );

  return (
    <div className="p-4 md:p-8" data-testid="quote-requests-page">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Quote requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Journalist quote opportunities pulled for this campaign.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuoteRequestStatus | "")}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          data-testid="quote-requests-status-filter"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && !data ? (
        <ListSkeleton />
      ) : !data || data.requests.length === 0 ? (
        <EmptyState message="No quote requests yet. They'll appear here after the next run." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Question</th>
                <th className="px-4 py-2 text-left">Publication</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
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
        <div className="font-medium truncate" title={request.title}>
          {request.title}
        </div>
        {request.question && (
          <div
            className="text-xs text-gray-500 mt-0.5 line-clamp-2"
            title={request.question}
          >
            {request.question}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.publication ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600">
        {request.priorityScore !== null ? request.priorityScore.toFixed(2) : "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">
        {request.deadlineAt
          ? new Date(request.deadlineAt).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[request.status]}`}
        >
          {request.status}
        </span>
      </td>
    </tr>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
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
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500"
      data-testid="quote-requests-empty"
    >
      {message}
    </div>
  );
}
