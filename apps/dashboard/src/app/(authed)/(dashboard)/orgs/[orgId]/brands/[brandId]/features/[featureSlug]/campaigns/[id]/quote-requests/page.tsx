"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import { listQuoteRequests, type QuoteRequest } from "@/lib/api";

export default function QuoteRequestsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data, isLoading } = useAuthQuery(
    ["quoteRequests", { campaign_id: campaignId }],
    () =>
      listQuoteRequests({
        campaign_id: campaignId,
        limit: 100,
      }),
    pollOptionsSlow,
  );

  const requests = data?.providerQuoteRequests ?? [];

  return (
    <div className="p-4 md:p-8" data-testid="quote-requests-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Quote requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Journalist quote opportunities pulled for this org.
        </p>
      </div>

      {isLoading && !data ? (
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
              {requests.map((r) => (
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
        {request.deadline
          ? new Date(request.deadline).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.provider}</td>
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
