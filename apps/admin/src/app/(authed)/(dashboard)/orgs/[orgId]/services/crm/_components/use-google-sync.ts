"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

/**
 * Shared Google-sync runner: POST /orgs/google/sync → poll the job → invalidate
 * the React Query CRM roots so the messages / contacts / accounts lists silently
 * revalidate from the fresh rows. Powers BOTH the manual "Sync now" button and
 * the revalidate-on-open background sync — one code path, no duplication.
 *
 * `silent` suppresses the summary/error surfacing (used for the on-open sync, so
 * a background failure doesn't flash an error banner over cached content — the
 * lists still show their last-known rows; a real fetch error surfaces via each
 * query's own error path). The manual button runs non-silent.
 */
export function useGoogleSync() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["googleMessages"] });
    void queryClient.invalidateQueries({ queryKey: ["googleContacts"] });
    void queryClient.invalidateQueries({ queryKey: ["googleAccounts"] });
  }, [queryClient]);

  const runSync = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      setLoading(true);
      if (!silent) {
        setError(null);
        setSummary(null);
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const startRes = await fetch("/api/v1/orgs/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
      }).catch((err: unknown) => {
        if ((err as Error)?.name === "AbortError") return null;
        throw err;
      });
      if (startRes === null) {
        setLoading(false);
        return;
      }
      if (!startRes.ok) {
        const body = await startRes.text();
        console.error("[admin] POST /orgs/google/sync failed", startRes.status, body);
        if (!silent) {
          const detail = extractErrorDetail(body, startRes.headers.get("Content-Type"));
          setError(
            detail
              ? `Sync failed (${startRes.status}): ${detail}`
              : `Sync failed: ${startRes.status}`,
          );
        }
        setLoading(false);
        return;
      }
      const startBody = (await startRes.json()) as StartSyncResponse;
      if (!startBody.jobId) {
        console.error("[admin] POST /orgs/google/sync missing jobId", startBody);
        if (!silent) setError("Sync start response missing jobId");
        setLoading(false);
        return;
      }

      try {
        const result = await pollSyncJob({
          jobId: startBody.jobId,
          fetchStatus: async (jobId) => {
            const res = await fetch(
              `/api/v1/orgs/google/sync/${encodeURIComponent(jobId)}`,
              { signal: ac.signal },
            );
            if (!res.ok) {
              const body = await res.text();
              const detail = extractErrorDetail(body, res.headers.get("Content-Type"));
              throw new Error(
                detail
                  ? `Sync status check failed (${res.status}): ${detail}`
                  : `Sync status check failed: ${res.status}`,
              );
            }
            return (await res.json()) as JobStatusResponse;
          },
          signal: ac.signal,
          intervalMs: POLL_INTERVAL_MS,
          maxMs: MAX_POLL_MS,
        });
        if (!silent) setSummary(result);
        invalidate();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[admin] sync poll failed", err);
        if (!silent) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
        setLoading(false);
      }
    },
    [invalidate],
  );

  return { loading, error, summary, runSync };
}
