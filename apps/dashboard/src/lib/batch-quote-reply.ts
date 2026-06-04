// ── "Reply to all with AI" — batch generate→reply over the eligible queue ──
//
// The loop runs in the BROWSER (client component): each opportunity is one
// independent generate call + one independent reply call, exactly as the
// per-opp Generate/Send buttons already do. NOTHING here wraps the whole
// N-opp loop in a single Route Handler / Server Action — that would execute
// as one Vercel serverless function and hit `maxDuration` for any non-trivial
// N. `runBatchReplies` is framework-agnostic (no React) so the policy is
// unit-testable; the React hook (`use-batch-quote-reply.ts`) only wraps it
// with state.

/** Relevance floor for auto-firing a pitch. Mirrors journalists-quotes-service
 *  `/next` auto-submit gate (DIS-178: "/next auto-submit stays gated at 30").
 *  Strictly greater-than — a score of exactly 30 is NOT eligible. */
export const BATCH_SCORE_THRESHOLD = 30;

export interface BatchEligibleInput {
  score: number;
  // Only null-ness matters for eligibility, so this is a loose `string | null`
  // (not the QuotePitchStatus union) — that keeps this module free of any
  // `@/lib/api` dependency, which the public report bundle is forbidden to pull.
  // Optional + absent is treated as `null` (un-pitched).
  pitchStatus?: string | null;
}

/**
 * Eligible ⟺ above the relevance floor AND not yet pitched.
 *
 * No `submittable` check: GET /orgs/opportunities already "restricts to
 * submittable (premium) clusters" backend-side (DIS-83), and the wire carries
 * no `submittable` field — inventing one client-side would be a fail-loud
 * violation. `pitchStatus === null` strictly: a failure-status opp (error,
 * insufficient_credits, …) stays MANUALLY retriable in the queue but is never
 * swept into an automatic batch.
 */
export function isEligibleForBatch(o: BatchEligibleInput): boolean {
  return o.score > BATCH_SCORE_THRESHOLD && (o.pitchStatus ?? null) === null;
}

export function selectEligibleOpportunities<T extends BatchEligibleInput>(
  opps: readonly T[],
): T[] {
  return opps.filter(isEligibleForBatch);
}

// ── Per-opp outcome classification ──────────────────────────────────────────

/** Maps a /reply 200-body `status` to a batch outcome. `already_submitted`
 *  (idempotent re-run) counts as skipped, not failed; anything that isn't a
 *  clean submit (rate_limited / error / unknown) is a failure. */
export function classifyReplyStatus(
  status: string,
): "submitted" | "skipped" | "failed" {
  if (status === "submitted") return "submitted";
  if (status === "already_submitted") return "skipped";
  return "failed";
}

/** Duck-typed on `.status` so it matches BOTH the authed `ApiError` (thrown by
 *  `apiCall`) and the public `ApiError` the report `submit` re-throws — without
 *  importing the class (keeps this module React/api-free for unit tests). A
 *  402 from the /reply step means org credit is exhausted → every remaining
 *  submit would also 402, so the batch STOPS. */
export function isOutOfCreditError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null | undefined)?.status;
  return typeof status === "number" && status === 402;
}

// ── The loop ────────────────────────────────────────────────────────────────

export type BatchRowState =
  | "pending"
  | "generating"
  | "submitting"
  | "submitted"
  | "skipped"
  | "failed";

export interface BatchSummary {
  /** Eligible count the run started with. */
  total: number;
  submitted: number;
  /** `already_submitted` (idempotent skip). */
  skipped: number;
  /** Per-opp generate/submit errors (NOT the credit stop). */
  failed: number;
  /** True when a /reply 402 stopped the batch early. */
  outOfCredit: boolean;
  /** Opps never reached because the batch stopped (out of credit). */
  unprocessed: number;
}

export interface BatchCallbacks<T> {
  /** Generate the pitch for one opp. Rejects on generate failure. */
  generate: (opp: T) => Promise<string>;
  /** Submit the pitch; resolves to the /reply status string. Rejects with an
   *  error carrying `.status` (e.g. `ApiError`) on HTTP failure. */
  submit: (opp: T, pitch: string) => Promise<string>;
  /** Stable id for row keying. */
  idOf: (opp: T) => string;
}

export interface BatchProgressSink {
  onRow?: (id: string, state: BatchRowState) => void;
  /** 0-based index of the opp currently being processed. */
  onIndex?: (index: number) => void;
}

/**
 * Sequentially generate→reply each eligible opp. Partial-failure policy
 * (LOCKED by product owner):
 *  - first /reply 402 → STOP immediately (credit exhausted), `outOfCredit`.
 *  - any other per-opp generate/submit error (422, 4xx, 5xx, 200-body
 *    error/rate_limited) → skip that opp, CONTINUE.
 *  - `already_submitted` → skipped, not failed.
 *
 * Fail-loud: every skipped/failed opp is `console.error`'d with context; none
 * are silently dropped.
 */
export async function runBatchReplies<T>(
  eligible: readonly T[],
  cb: BatchCallbacks<T>,
  sink?: BatchProgressSink,
): Promise<BatchSummary> {
  let submitted = 0;
  let skipped = 0;
  let failed = 0;
  let outOfCredit = false;
  let processed = 0;

  for (let i = 0; i < eligible.length; i++) {
    const opp = eligible[i];
    const id = cb.idOf(opp);
    sink?.onIndex?.(i);

    sink?.onRow?.(id, "generating");
    let pitch: string;
    try {
      pitch = await cb.generate(opp);
    } catch (err) {
      console.error("[batch-quote-reply] generate failed — skipping opp", {
        id,
        err,
      });
      failed++;
      processed++;
      sink?.onRow?.(id, "failed");
      continue;
    }

    sink?.onRow?.(id, "submitting");
    try {
      const status = await cb.submit(opp, pitch);
      const outcome = classifyReplyStatus(status);
      if (outcome === "submitted") {
        submitted++;
        sink?.onRow?.(id, "submitted");
      } else if (outcome === "skipped") {
        skipped++;
        sink?.onRow?.(id, "skipped");
      } else {
        console.error("[batch-quote-reply] submit returned non-ok status", {
          id,
          status,
        });
        failed++;
        sink?.onRow?.(id, "failed");
      }
      processed++;
    } catch (err) {
      if (isOutOfCreditError(err)) {
        // Credit exhausted — stop the whole batch. This opp did NOT submit and
        // is left `pending` (retriable once credit is restored), not counted as
        // a failure.
        console.error("[batch-quote-reply] out of credit — stopping batch", {
          id,
        });
        outOfCredit = true;
        sink?.onRow?.(id, "pending");
        break;
      }
      console.error("[batch-quote-reply] submit failed — skipping opp", {
        id,
        err,
      });
      failed++;
      processed++;
      sink?.onRow?.(id, "failed");
    }
  }

  return {
    total: eligible.length,
    submitted,
    skipped,
    failed,
    outOfCredit,
    unprocessed: eligible.length - processed,
  };
}
