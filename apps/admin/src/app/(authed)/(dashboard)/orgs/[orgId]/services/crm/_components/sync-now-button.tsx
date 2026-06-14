"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractErrorDetail } from "./error-detail";
import {
  MAX_POLL_MS,
  POLL_INTERVAL_MS,
  pollSyncJob,
  type JobStatusResponse,
  type SyncSummary,
} from "./poll-sync-job";

interface StartSyncResponse {
  jobId: string;
  status: "running";
}

export function SyncNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSummary(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const startRes = await fetch("/api/v1/orgs/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
    });
    if (!startRes.ok) {
      const body = await startRes.text();
      console.error(
        "[dashboard] POST /orgs/google/sync failed",
        startRes.status,
        body
      );
      const detail = extractErrorDetail(
        body,
        startRes.headers.get("Content-Type")
      );
      setError(
        detail
          ? `Sync failed (${startRes.status}): ${detail}`
          : `Sync failed: ${startRes.status}`
      );
      setLoading(false);
      return;
    }
    const startBody = (await startRes.json()) as StartSyncResponse;
    if (!startBody.jobId) {
      console.error(
        "[dashboard] POST /orgs/google/sync missing jobId in 202 response",
        startBody
      );
      setError("Sync start response missing jobId");
      setLoading(false);
      return;
    }

    try {
      const result = await pollSyncJob({
        jobId: startBody.jobId,
        fetchStatus: async (jobId) => {
          const res = await fetch(
            `/api/v1/orgs/google/sync/${encodeURIComponent(jobId)}`,
            { signal: ac.signal }
          );
          if (!res.ok) {
            const body = await res.text();
            const detail = extractErrorDetail(
              body,
              res.headers.get("Content-Type")
            );
            throw new Error(
              detail
                ? `Sync status check failed (${res.status}): ${detail}`
                : `Sync status check failed: ${res.status}`
            );
          }
          return (await res.json()) as JobStatusResponse;
        },
        signal: ac.signal,
        intervalMs: POLL_INTERVAL_MS,
        maxMs: MAX_POLL_MS,
      });
      setSummary(result);
      router.refresh();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      console.error("[dashboard] sync poll failed", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ac) {
        abortRef.current = null;
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium inline-flex items-center gap-2"
      >
        {loading && (
          <span
            className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {loading ? "Syncing..." : "Sync now"}
      </button>
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {summary && (
        <div className="mt-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm space-y-1">
          {typeof summary.accounts === "number" && (
            <div>
              <strong>Accounts:</strong> {summary.accounts}
            </div>
          )}
          {summary.gmail && (
            <div>
              <strong>Gmail:</strong> {summary.gmail.inserted} inserted ·{" "}
              {summary.gmail.updated} updated · {summary.gmail.unchanged} unchanged
            </div>
          )}
          {summary.contacts && (
            <div>
              <strong>Contacts:</strong> {summary.contacts.inserted} inserted ·{" "}
              {summary.contacts.updated} updated · {summary.contacts.unchanged}{" "}
              unchanged · {summary.contacts.deleted} deleted
            </div>
          )}
        </div>
      )}
    </div>
  );
}
