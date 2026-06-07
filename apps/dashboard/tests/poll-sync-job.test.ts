import { describe, it, expect } from "vitest";
import {
  pollSyncJob,
  type JobStatusResponse,
  type SyncSummary,
} from "../src/app/(authed)/(dashboard)/orgs/[orgId]/services/crm/_components/poll-sync-job";

const summary: SyncSummary = {
  accounts: 1,
  gmail: { inserted: 5, updated: 2, unchanged: 0 },
  contacts: { inserted: 3, updated: 1, unchanged: 0, deleted: 0 },
};

function jobResponse(partial: Partial<JobStatusResponse>): JobStatusResponse {
  return {
    jobId: "job-1",
    status: "running",
    summary: null,
    error: null,
    startedAt: "2026-05-09T00:00:00.000Z",
    finishedAt: null,
    ...partial,
  };
}

describe("pollSyncJob", () => {
  it("resolves with summary when status transitions running → succeeded", async () => {
    const sequence: JobStatusResponse[] = [
      jobResponse({ status: "running" }),
      jobResponse({ status: "running" }),
      jobResponse({ status: "succeeded", summary, finishedAt: "2026-05-09T00:00:10.000Z" }),
    ];
    const calls: string[] = [];
    const result = await pollSyncJob({
      jobId: "job-1",
      fetchStatus: async (jobId) => {
        calls.push(jobId);
        return sequence.shift()!;
      },
      sleep: async () => {},
      intervalMs: 100,
      maxMs: 60_000,
    });
    expect(result).toEqual(summary);
    expect(calls).toEqual(["job-1", "job-1", "job-1"]);
  });

  it("rejects with error message when status transitions running → failed", async () => {
    const sequence: JobStatusResponse[] = [
      jobResponse({ status: "running" }),
      jobResponse({ status: "failed", error: "token revoked", finishedAt: "2026-05-09T00:00:05.000Z" }),
    ];
    await expect(
      pollSyncJob({
        jobId: "job-1",
        fetchStatus: async () => sequence.shift()!,
        sleep: async () => {},
        intervalMs: 100,
        maxMs: 60_000,
      })
    ).rejects.toThrow("token revoked");
  });

  it("rejects with timeout error when poll cap exceeded", async () => {
    let t = 0;
    await expect(
      pollSyncJob({
        jobId: "job-1",
        fetchStatus: async () => jobResponse({ status: "running" }),
        sleep: async () => {
          t += 1000;
        },
        now: () => t,
        intervalMs: 1000,
        maxMs: 5_000,
      })
    ).rejects.toThrow(/timeout|still running/i);
  });

  it("stops polling when AbortSignal triggers", async () => {
    const ac = new AbortController();
    let calls = 0;
    const promise = pollSyncJob({
      jobId: "job-1",
      fetchStatus: async () => {
        calls += 1;
        if (calls === 1) ac.abort();
        return jobResponse({ status: "running" });
      },
      sleep: async (_ms, signal) => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      },
      signal: ac.signal,
      intervalMs: 100,
      maxMs: 60_000,
    });
    await expect(promise).rejects.toThrow(/abort/i);
    expect(calls).toBe(1);
  });

  it("rejects when succeeded but summary missing", async () => {
    await expect(
      pollSyncJob({
        jobId: "job-1",
        fetchStatus: async () => jobResponse({ status: "succeeded", summary: null }),
        sleep: async () => {},
        intervalMs: 100,
        maxMs: 60_000,
      })
    ).rejects.toThrow(/summary/i);
  });
});
