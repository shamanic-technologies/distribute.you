import { describe, it, expect, vi } from "vitest";
import {
  isEligibleForBatch,
  selectEligibleOpportunities,
  classifyReplyStatus,
  isOutOfCreditError,
  runBatchReplies,
  type BatchCallbacks,
} from "../src/lib/batch-quote-reply";

// A 402-carrying error shaped like `ApiError` (authed) or the report `submit`'s
// re-thrown ApiError, without importing the class.
class FakeApiError extends Error {
  constructor(
    readonly status: number,
    message = "fake",
  ) {
    super(message);
  }
}

describe("isEligibleForBatch — score>30 && pitchStatus===null", () => {
  it("eligible: high score, no pitch yet", () => {
    expect(isEligibleForBatch({ score: 95, pitchStatus: null })).toBe(true);
  });
  it("excludes a score of exactly 30 (strict greater-than)", () => {
    expect(isEligibleForBatch({ score: 30, pitchStatus: null })).toBe(false);
  });
  it("excludes an already-pitched opp", () => {
    expect(isEligibleForBatch({ score: 95, pitchStatus: "submitted" })).toBe(
      false,
    );
  });
  it("excludes a failure-status opp (strict null, not isOpportunityOpen)", () => {
    expect(isEligibleForBatch({ score: 95, pitchStatus: "error" })).toBe(false);
    expect(
      isEligibleForBatch({ score: 95, pitchStatus: "insufficient_credits" }),
    ).toBe(false);
  });
  it("treats undefined pitchStatus as null", () => {
    expect(isEligibleForBatch({ score: 95, pitchStatus: undefined })).toBe(true);
  });
});

describe("selectEligibleOpportunities", () => {
  it("keeps only score>30 && null rows, preserving order", () => {
    const opps = [
      { id: "a", score: 90, pitchStatus: null },
      { id: "b", score: 10, pitchStatus: null }, // low score
      { id: "c", score: 80, pitchStatus: "submitted" as const }, // pitched
      { id: "d", score: 31, pitchStatus: null },
    ];
    const eligible = selectEligibleOpportunities(opps);
    expect(eligible.map((o) => o.id)).toEqual(["a", "d"]);
  });
});

describe("classifyReplyStatus", () => {
  it("submitted → submitted", () => {
    expect(classifyReplyStatus("submitted")).toBe("submitted");
  });
  it("already_submitted → skipped (idempotent re-run)", () => {
    expect(classifyReplyStatus("already_submitted")).toBe("skipped");
  });
  it("rate_limited / error / unknown → failed", () => {
    expect(classifyReplyStatus("rate_limited")).toBe("failed");
    expect(classifyReplyStatus("error")).toBe("failed");
    expect(classifyReplyStatus("whatever")).toBe("failed");
  });
});

describe("isOutOfCreditError", () => {
  it("true for a 402-carrying error", () => {
    expect(isOutOfCreditError(new FakeApiError(402))).toBe(true);
    expect(isOutOfCreditError({ status: 402 })).toBe(true);
  });
  it("false for other statuses / plain errors", () => {
    expect(isOutOfCreditError(new FakeApiError(422))).toBe(false);
    expect(isOutOfCreditError(new FakeApiError(500))).toBe(false);
    expect(isOutOfCreditError(new Error("nope"))).toBe(false);
    expect(isOutOfCreditError(null)).toBe(false);
    expect(isOutOfCreditError(undefined)).toBe(false);
  });
});

type Opp = { id: string };
const idOf = (o: Opp) => o.id;

describe("runBatchReplies", () => {
  it("submits every opp on the happy path", async () => {
    const opps: Opp[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const cb: BatchCallbacks<Opp> = {
      generate: vi.fn(async () => "a valid pitch"),
      submit: vi.fn(async () => "submitted"),
      idOf,
    };
    const summary = await runBatchReplies(opps, cb);
    expect(summary).toEqual({
      total: 3,
      submitted: 3,
      skipped: 0,
      failed: 0,
      outOfCredit: false,
      unprocessed: 0,
    });
    expect(cb.submit).toHaveBeenCalledTimes(3);
  });

  it("stops immediately on the first 402 from submit", async () => {
    const opps: Opp[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const submit = vi
      .fn<(o: Opp, p: string) => Promise<string>>()
      .mockResolvedValueOnce("submitted")
      .mockRejectedValueOnce(new FakeApiError(402))
      .mockResolvedValue("submitted");
    const generate = vi.fn(async () => "a valid pitch");
    const summary = await runBatchReplies(opps, { generate, submit, idOf });
    expect(summary.submitted).toBe(1);
    expect(summary.outOfCredit).toBe(true);
    expect(summary.unprocessed).toBe(2); // b (stopped) + c (never reached)
    // c's generate is never called — the loop broke at b.
    expect(generate).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("skips a generate failure and continues", async () => {
    const opps: Opp[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const generate = vi
      .fn<(o: Opp) => Promise<string>>()
      .mockResolvedValueOnce("pitch a")
      .mockRejectedValueOnce(new Error("gen boom"))
      .mockResolvedValueOnce("pitch c");
    const submit = vi.fn(async () => "submitted");
    const summary = await runBatchReplies(opps, { generate, submit, idOf });
    expect(summary.submitted).toBe(2); // a + c
    expect(summary.failed).toBe(1); // b
    expect(summary.outOfCredit).toBe(false);
    expect(submit).toHaveBeenCalledTimes(2); // b never reached submit
  });

  it("counts already_submitted as skipped, not failed", async () => {
    const opps: Opp[] = [{ id: "a" }, { id: "b" }];
    const submit = vi
      .fn<(o: Opp, p: string) => Promise<string>>()
      .mockResolvedValueOnce("already_submitted")
      .mockResolvedValueOnce("submitted");
    const summary = await runBatchReplies(opps, {
      generate: vi.fn(async () => "pitch"),
      submit,
      idOf,
    });
    expect(summary).toMatchObject({ submitted: 1, skipped: 1, failed: 0 });
  });

  it("skips a non-402 submit error (422 not_submittable) and continues", async () => {
    const opps: Opp[] = [{ id: "a" }, { id: "b" }];
    const submit = vi
      .fn<(o: Opp, p: string) => Promise<string>>()
      .mockRejectedValueOnce(new FakeApiError(422))
      .mockResolvedValueOnce("submitted");
    const summary = await runBatchReplies(opps, {
      generate: vi.fn(async () => "pitch"),
      submit,
      idOf,
    });
    expect(summary).toMatchObject({
      submitted: 1,
      failed: 1,
      outOfCredit: false,
    });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("reports per-row states + index through the sink", async () => {
    const opps: Opp[] = [{ id: "a" }];
    const rows: Array<[string, string]> = [];
    await runBatchReplies(
      opps,
      { generate: vi.fn(async () => "pitch"), submit: vi.fn(async () => "submitted"), idOf },
      { onRow: (id, s) => rows.push([id, s]), onIndex: () => {} },
    );
    expect(rows).toEqual([
      ["a", "generating"],
      ["a", "submitting"],
      ["a", "submitted"],
    ]);
  });
});
