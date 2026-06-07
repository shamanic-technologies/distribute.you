"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import {
  listAllQuotePitches,
  type QuotePitch,
  type QuotePitchStatus,
} from "@/lib/api";

const STATUS_STYLES: Record<QuotePitchStatus, string> = {
  drafted: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  selected: "bg-yellow-100 text-yellow-700 border-yellow-200",
  published: "bg-green-100 text-green-700 border-green-200",
  not_selected: "bg-gray-100 text-gray-500 border-gray-200",
  error: "bg-red-100 text-red-600 border-red-200",
  length_violation: "bg-red-100 text-red-600 border-red-200",
  template_missing: "bg-red-100 text-red-600 border-red-200",
  brand_missing_fields: "bg-red-100 text-red-600 border-red-200",
  insufficient_credits: "bg-red-100 text-red-600 border-red-200",
};

const STATUSES: QuotePitchStatus[] = [
  "drafted",
  "submitted",
  "selected",
  "published",
  "not_selected",
  "error",
  "length_violation",
  "template_missing",
  "brand_missing_fields",
  "insufficient_credits",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QuotePitchesPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [statusFilter, setStatusFilter] = useState<QuotePitchStatus | "">("");

  const { data, isLoading } = useAuthQuery(
    ["quotePitches", { campaignId, status: statusFilter }],
    () =>
      listAllQuotePitches({
        campaign_id: campaignId,
        status: statusFilter || undefined,
      }),
    pollOptionsSlow,
  );

  const pitches = data?.quotePitches ?? [];

  return (
    <div className="p-4 md:p-8" data-testid="quote-pitches-page">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Pitches</h1>
          <p className="text-sm text-gray-500 mt-1">
            Drafted and submitted pitches for journalist quote requests.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as QuotePitchStatus | "")}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
          data-testid="quote-pitches-status-filter"
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
      ) : pitches.length === 0 ? (
        <EmptyState message="No pitches yet." />
      ) : (
        <div className="space-y-2">
          {pitches.map((p) => (
            <Row key={p.id} pitch={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ pitch }: { pitch: QuotePitch }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mt-0.5">
            Quote request: <span className="font-mono">{pitch.quoteRequestId}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Delivery: {pitch.deliveryMethod}
            {pitch.pitchCharCount != null && <> · {pitch.pitchCharCount} chars</>}
            {pitch.pitchAttempts != null && pitch.pitchAttempts > 1 && (
              <> · {pitch.pitchAttempts} attempts</>
            )}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_STYLES[pitch.status]}`}
        >
          {pitch.status}
        </span>
      </div>
      {pitch.draft && (
        <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-line">
          {pitch.draft}
        </p>
      )}
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        {pitch.submittedAt && <span>Submitted {formatDate(pitch.submittedAt)}</span>}
        {pitch.featuredArticleUrl && (
          <a
            href={pitch.featuredArticleUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            View published article →
          </a>
        )}
      </div>
      {pitch.error && (
        <p className="text-xs text-red-600 mt-2">{pitch.error}</p>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 h-24 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500"
      data-testid="quote-pitches-empty"
    >
      {message}
    </div>
  );
}
