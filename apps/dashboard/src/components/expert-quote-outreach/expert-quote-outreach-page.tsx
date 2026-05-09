"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  ApiError,
  listByokKeys,
  setFeaturedCreds,
  listQuoteRequests,
  listQuotePitches,
  getQuoteRequestStats,
  triggerExpertQuoteRun,
  listCampaignsByBrand,
  type QuoteRequest,
  type QuotePitch,
  type QuoteRequestStatus,
  type QuotePitchStatus,
} from "@/lib/api";

const FEATURE_SLUG = "pr-expert-quote-outreach";
const PROVIDER = "featured";
const POLL_INTERVAL = 10_000;
const pollOptions = {
  refetchInterval: POLL_INTERVAL,
  refetchIntervalInBackground: false,
  placeholderData: keepPreviousData,
};

const REQUEST_STATUS_STYLES: Record<QuoteRequestStatus, string> = {
  fetched: "bg-gray-100 text-gray-700 border-gray-200",
  scored: "bg-blue-100 text-blue-700 border-blue-200",
  skipped: "bg-gray-100 text-gray-500 border-gray-200",
  pitched: "bg-purple-100 text-purple-700 border-purple-200",
  selected: "bg-yellow-100 text-yellow-700 border-yellow-200",
  published: "bg-green-100 text-green-700 border-green-200",
  not_selected: "bg-gray-100 text-gray-500 border-gray-200",
  error: "bg-red-100 text-red-600 border-red-200",
};

const PITCH_STATUS_STYLES: Record<QuotePitchStatus, string> = {
  drafted: "bg-gray-100 text-gray-700 border-gray-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  selected: "bg-yellow-100 text-yellow-700 border-yellow-200",
  published: "bg-green-100 text-green-700 border-green-200",
  not_selected: "bg-gray-100 text-gray-500 border-gray-200",
  error: "bg-red-100 text-red-600 border-red-200",
};

export function ExpertQuoteOutreachPage({
  brandId,
  orgId,
}: {
  brandId: string;
  orgId: string;
}) {
  const queryClient = useQueryClient();

  const { data: byokData, isLoading: byokLoading } = useAuthQuery(
    ["byokKeys"],
    () => listByokKeys(),
    pollOptions,
  );
  const featuredKey = byokData?.keys.find((k) => k.provider === PROVIDER);
  const credsConfigured = !!featuredKey;

  const { data: campaignsData } = useAuthQuery(
    ["campaigns", { brandId }],
    () => listCampaignsByBrand(brandId),
    pollOptions,
  );
  const campaigns =
    campaignsData?.campaigns?.filter((c) => c.featureSlug === FEATURE_SLUG) ?? [];
  const activeCampaign = campaigns[0];

  return (
    <div className="p-4 md:p-8" data-testid="expert-quote-outreach-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Expert Quote Outreach
        </h1>
        <p className="text-gray-600">
          Pull journalist quote requests from Featured.com, score them against
          your brand, and submit pitches automatically.
        </p>
      </div>

      {byokLoading ? (
        <CredsSkeleton />
      ) : !credsConfigured ? (
        <FeaturedCredsForm
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["byokKeys"] });
          }}
        />
      ) : (
        <ActivatedView
          brandId={brandId}
          orgId={orgId}
          campaign={activeCampaign}
        />
      )}
    </div>
  );
}

function CredsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="h-10 w-full bg-gray-100 rounded animate-pulse mb-3" />
      <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
    </div>
  );
}

function FeaturedCredsForm({ onSaved }: { onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSaving(true);
    setError(null);
    try {
      await setFeaturedCreds(username.trim(), password);
      setUsername("");
      setPassword("");
      onSaved();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.message} (${err.status})`
          : err instanceof Error
            ? err.message
            : "Failed to save credentials";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl"
      data-testid="featured-creds-form"
    >
      <h2 className="text-lg font-medium text-gray-900 mb-1">
        Connect Featured account
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        We use these credentials to fetch quote requests and submit your pitches
        on Featured.com Premium.
      </p>

      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm"
          data-testid="featured-creds-error"
        >
          {error}
        </div>
      )}

      <label className="block mb-3">
        <span className="text-xs font-medium text-gray-700 mb-1 block">
          Username
        </span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </label>

      <label className="block mb-4">
        <span className="text-xs font-medium text-gray-700 mb-1 block">
          Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </label>

      <button
        type="submit"
        disabled={saving || !username.trim() || !password}
        className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Connect Featured account"}
      </button>
    </form>
  );
}

function ActivatedView({
  brandId,
  orgId,
  campaign,
}: {
  brandId: string;
  orgId: string;
  campaign?: { id: string; name: string };
}) {
  if (!campaign) {
    return (
      <div
        className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-2xl"
        data-testid="expert-quote-no-campaign"
      >
        <h3 className="font-display font-bold text-lg text-gray-800 mb-2">
          Activate the feature
        </h3>
        <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
          Create a campaign to start fetching journalist quote requests for this
          brand.
        </p>
        <Link
          href={`/orgs/${orgId}/brands/${brandId}/features/${FEATURE_SLUG}/campaigns/new`}
          className="inline-flex px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
        >
          Activate feature
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CampaignHeader campaign={campaign} brandId={brandId} />
      <StatsCard brandId={brandId} campaignId={campaign.id} />
      <QuoteRequestsList brandId={brandId} campaignId={campaign.id} />
      <QuotePitchesList brandId={brandId} campaignId={campaign.id} />
    </div>
  );
}

function CampaignHeader({
  campaign,
  brandId,
}: {
  campaign: { id: string; name: string };
  brandId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function handleTrigger() {
    setRunning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await triggerExpertQuoteRun({
        brandId,
        campaignId: campaign.id,
      });
      setSuccess(`Run started: ${result.workflowRunId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 404
            ? "Workflow `expert-quote-outreach` is not registered yet — try again once workflow-service ships the parallel update."
            : `${err.message} (${err.status})`
          : err instanceof Error
            ? err.message
            : "Failed to trigger run";
      setError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{campaign.name}</h2>
          <p className="text-xs text-gray-500">Campaign ID: {campaign.id}</p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={running}
          className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          data-testid="trigger-run-button"
        >
          {running ? "Triggering..." : "Trigger run"}
        </button>
      </div>
      {error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
          data-testid="trigger-run-error"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm"
          data-testid="trigger-run-success"
        >
          {success}
        </div>
      )}
    </div>
  );
}

function StatsCard({
  brandId,
  campaignId,
}: {
  brandId: string;
  campaignId: string;
}) {
  const { data, isLoading } = useAuthQuery(
    ["quoteRequestStats", { brandId, campaignId }],
    () => getQuoteRequestStats({ brandId, campaignId }),
    pollOptions,
  );

  if (isLoading || !data) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
        data-testid="expert-quote-stats-skeleton"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-3 h-16 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const { stats } = data;
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      data-testid="expert-quote-stats"
    >
      <Stat label="Fetched" value={stats.fetched} />
      <Stat label="Scored" value={stats.scored} />
      <Stat label="Pitched" value={stats.pitched} />
      <Stat label="Selected" value={stats.selected} />
      <Stat label="Published" value={stats.published} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-lg font-semibold text-gray-800">
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function QuoteRequestsList({
  brandId,
  campaignId,
}: {
  brandId: string;
  campaignId: string;
}) {
  const [statusFilter, setStatusFilter] = useState<QuoteRequestStatus | "">("");

  const { data, isLoading } = useAuthQuery(
    ["quoteRequests", { brandId, campaignId, status: statusFilter }],
    () =>
      listQuoteRequests({
        brandId,
        campaignId,
        status: statusFilter || undefined,
        limit: 50,
      }),
    pollOptions,
  );

  return (
    <section data-testid="quote-requests-list">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Quote requests</h2>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as QuoteRequestStatus | "")
          }
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
        >
          <option value="">All statuses</option>
          {Object.keys(REQUEST_STATUS_STYLES).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !data || data.requests.length === 0 ? (
        <EmptyState message="No quote requests yet. They'll appear here after the next run." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Publication</th>
                <th className="px-4 py-2 text-left">Score</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
                <QuoteRequestRow key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function QuoteRequestRow({ request }: { request: QuoteRequest }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-gray-800 max-w-xs truncate" title={request.title}>
        {request.title}
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
          className={`text-xs px-2 py-0.5 rounded-full border ${REQUEST_STATUS_STYLES[request.status]}`}
        >
          {request.status}
        </span>
      </td>
    </tr>
  );
}

function QuotePitchesList({
  brandId,
  campaignId,
}: {
  brandId: string;
  campaignId: string;
}) {
  const { data, isLoading } = useAuthQuery(
    ["quotePitches", { brandId, campaignId }],
    () => listQuotePitches({ brandId, campaignId, limit: 50 }),
    pollOptions,
  );

  return (
    <section data-testid="quote-pitches-list">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Pitches submitted
      </h2>
      {isLoading ? (
        <ListSkeleton />
      ) : !data || data.pitches.length === 0 ? (
        <EmptyState message="No pitches submitted yet." />
      ) : (
        <div className="space-y-2">
          {data.pitches.map((p) => (
            <QuotePitchRow key={p.id} pitch={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuotePitchRow({ pitch }: { pitch: QuotePitch }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-gray-800">
            {pitch.expertName ?? "—"}
            {pitch.expertTitle && (
              <span className="text-gray-500 font-normal">
                {" "}
                · {pitch.expertTitle}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            Quote request: {pitch.quoteRequestId}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${PITCH_STATUS_STYLES[pitch.status]}`}
        >
          {pitch.status}
        </span>
      </div>
      <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-line">
        {pitch.pitchText}
      </p>
      {pitch.publishedUrl && (
        <a
          href={pitch.publishedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-brand-600 hover:underline mt-2 inline-block"
        >
          View published article →
        </a>
      )}
      {pitch.errorMessage && (
        <p className="text-xs text-red-600 mt-2">{pitch.errorMessage}</p>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
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
      className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-500"
      data-testid="expert-quote-empty-state"
    >
      {message}
    </div>
  );
}
