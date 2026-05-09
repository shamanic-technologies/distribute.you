export interface SyncCounts {
  inserted: number;
  updated: number;
  unchanged: number;
}

export interface ContactCounts extends SyncCounts {
  deleted: number;
}

export interface SyncSummary {
  accounts?: number;
  gmail?: SyncCounts;
  contacts?: ContactCounts;
}

export type SyncJobStatus = "running" | "succeeded" | "failed";

export interface JobStatusResponse {
  jobId: string;
  status: SyncJobStatus;
  summary: SyncSummary | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export const POLL_INTERVAL_MS = 4000;
export const MAX_POLL_MS = 10 * 60 * 1000;

export interface PollSyncJobOptions {
  jobId: string;
  fetchStatus: (jobId: string) => Promise<JobStatusResponse>;
  signal?: AbortSignal;
  intervalMs?: number;
  maxMs?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

export async function pollSyncJob(
  opts: PollSyncJobOptions
): Promise<SyncSummary> {
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const maxMs = opts.maxMs ?? MAX_POLL_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const start = now();

  while (true) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (now() - start > maxMs) {
      throw new Error(
        "Sync poll timeout exceeded — still running, refresh later"
      );
    }
    const job = await opts.fetchStatus(opts.jobId);
    if (job.status === "succeeded") {
      if (!job.summary) {
        throw new Error("Sync succeeded but summary missing from response");
      }
      return job.summary;
    }
    if (job.status === "failed") {
      throw new Error(job.error || "Sync failed without error message");
    }
    await sleep(intervalMs, opts.signal);
  }
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort);
  });
}
