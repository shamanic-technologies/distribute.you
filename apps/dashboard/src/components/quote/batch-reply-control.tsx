"use client";

import type { BatchRowState, BatchSummary } from "@/lib/batch-quote-reply";

interface BatchReplyControlProps {
  /** Number of opportunities that pass the eligibility filter right now. */
  eligibleCount: number;
  isRunning: boolean;
  /** 0-based index of the opp currently processing. */
  index: number;
  /** Eligible count the active run started with. */
  total: number;
  summary: BatchSummary | null;
  /** Disable the trigger (e.g. campaign missing required inputs). */
  disabled?: boolean;
  disabledReason?: string | null;
  onRun: () => void;
}

/**
 * "Reply to all with AI" trigger + progress + summary. Shared by the authed
 * campaign HITL queue and the public report queue — each supplies its own
 * per-opp generate/submit path; this only renders the control surface.
 */
export function BatchReplyControl({
  eligibleCount,
  isRunning,
  index,
  total,
  summary,
  disabled,
  disabledReason,
  onRun,
}: BatchReplyControlProps) {
  const nothingEligible = eligibleCount === 0;
  const btnDisabled = Boolean(disabled) || isRunning || nothingEligible;
  // While running, show progress against the started count; otherwise the live
  // eligible count.
  const processed = Math.min(index + 1, total);

  return (
    <div
      className="mb-4 bg-white rounded-xl border border-gray-200 p-3 md:p-4"
      data-testid="batch-reply-control"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-brand-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
            Reply to all with AI
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Generates and sends a pitch for every eligible opportunity
            (relevance &gt; 30, not yet pitched) — one at a time.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={btnDisabled}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          data-testid="batch-reply-run-btn"
        >
          {isRunning
            ? `Processing ${processed}/${total}…`
            : nothingEligible
              ? "Nothing to send"
              : `Reply to all (${eligibleCount})`}
        </button>
      </div>

      {disabled && disabledReason && !isRunning && (
        <p className="text-xs text-amber-700 mt-2">{disabledReason}</p>
      )}

      {isRunning && total > 0 && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${Math.round((processed / total) * 100)}%` }}
          />
        </div>
      )}

      {summary && !isRunning && (
        <div
          className="mt-3 text-xs rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-gray-700"
          data-testid="batch-reply-summary"
        >
          {summary.outOfCredit ? (
            <p className="text-red-600 font-medium mb-1">
              Out of credit — submitted {summary.submitted} of {summary.total}.
              Top up to send the remaining {summary.unprocessed}.
            </p>
          ) : (
            <p className="text-green-700 font-medium mb-1">
              Done — submitted {summary.submitted} of {summary.total}.
            </p>
          )}
          <span className="text-gray-600">
            {summary.submitted} submitted · {summary.skipped} skipped
            {summary.skipped > 0 ? " (already sent)" : ""} · {summary.failed}{" "}
            failed
            {summary.unprocessed > 0 ? ` · ${summary.unprocessed} not sent` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

const ROW_LABEL: Record<BatchRowState, string> = {
  pending: "Queued",
  generating: "Generating…",
  submitting: "Sending…",
  submitted: "✓ Sent",
  skipped: "Already sent",
  failed: "Failed",
};

const ROW_CLASS: Record<BatchRowState, string> = {
  pending: "bg-gray-100 text-gray-500 border-gray-200",
  generating: "bg-blue-50 text-blue-700 border-blue-200",
  submitting: "bg-blue-50 text-blue-700 border-blue-200",
  submitted: "bg-green-100 text-green-700 border-green-200",
  skipped: "bg-gray-100 text-gray-600 border-gray-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

/** Per-row status pill shown on a queue row while/after a batch runs. */
export function BatchRowPill({ state }: { state: BatchRowState }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ROW_CLASS[state]}`}
      data-testid="batch-row-pill"
    >
      {ROW_LABEL[state]}
    </span>
  );
}
