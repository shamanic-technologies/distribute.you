"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  selectEligibleOpportunities,
  type BatchCallbacks,
  type BatchRowState,
} from "@/lib/batch-quote-reply";
import { useBatchQuoteReply } from "@/lib/use-batch-quote-reply";
import {
  BatchReplyControl,
  BatchRowPill,
} from "@/components/quote/batch-reply-control";

const PITCH_MIN = 100;
const PITCH_MAX = 2500;

// Local HTTP error carrying `.status` so the batch loop's `isOutOfCreditError`
// (duck-typed on `.status === 402`) can STOP on insufficient credit. Defined
// here, NOT imported from `@/lib/api` — the public report bundle must never
// pull the Clerk-authenticated api client (enforced by a source guard test).
class ReplyHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReplyHttpError";
  }
}

export interface PublicRankedOpportunity {
  opportunityId: string;
  provider: string;
  ingestionChannel: string;
  featuredQuestionId: number | null;
  mediaOutlet: string | null;
  journalistName: string | null;
  opportunityText: string;
  deadline: string | null;
  pitchUrl: string | null;
  pitchEmail: string | null;
  category: string | null;
  score: number;
  whyRelevant: string | null;
  // Annotated by GET /orgs/opportunities (the server passes RankedOpportunityRow
  // through). Already-pitched rows are filtered server-side; this field lets the
  // batch apply the strict `pitchStatus === null` eligibility (failure-status
  // opps stay manually retriable but are never swept into the batch). Typed
  // loosely (string) to avoid importing the QuotePitchStatus union from
  // `@/lib/api` into the public bundle.
  pitchStatus?: string | null;
}

interface PublicHitlQueueProps {
  orgId: string;
  brandId: string;
  featureSlug: string;
  initialOpportunities: PublicRankedOpportunity[];
}

interface DraftResponse {
  pitch: string;
  charCount: number;
}

interface ReplyResponse {
  status: "submitted" | "already_submitted" | "rate_limited" | "error";
  pitchId?: string;
  deliveryMethod?: "featured_api" | "email_reply";
  error?: string;
}

export function PublicHitlQueue({
  orgId,
  brandId,
  featureSlug,
  initialOpportunities,
}: PublicHitlQueueProps) {
  const draftUrl = `/api/report/${orgId}/${brandId}/${featureSlug}/draft`;
  const replyUrl = `/api/report/${orgId}/${brandId}/${featureSlug}/reply`;
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialOpportunities[0]?.opportunityId ?? null,
  );
  const selected = useMemo(
    () =>
      initialOpportunities.find((o) => o.opportunityId === selectedId) ?? null,
    [initialOpportunities, selectedId],
  );

  // ── "Reply to all with AI" — same per-opp path as the buttons (the /draft +
  // /reply Route Handlers), looped in the browser. Each iteration is its own
  // pair of fetches, so no single function spans the batch (no Vercel timeout).
  const eligibleOpps = useMemo(
    () => selectEligibleOpportunities(initialOpportunities),
    [initialOpportunities],
  );
  const batchCb = useMemo<BatchCallbacks<PublicRankedOpportunity>>(
    () => ({
      idOf: (o) => o.opportunityId,
      generate: async (o) => {
        const res = await fetch(draftUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityId: o.opportunityId,
            opportunityText: o.opportunityText,
            mediaOutlet: o.mediaOutlet,
            journalistName: o.journalistName,
            deadline: o.deadline,
            whyRelevant: o.whyRelevant,
            category: o.category,
          }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`${res.status}: ${t.slice(0, 200)}`);
        }
        return ((await res.json()) as DraftResponse).pitch;
      },
      submit: async (o, pitch) => {
        const res = await fetch(replyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opportunityId: o.opportunityId,
            pitchContent: pitch,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | (ReplyResponse & { error?: string })
          | null;
        // Throw with `.status` so the loop's `isOutOfCreditError` (.status===402)
        // can STOP the batch — the /reply route now propagates upstream 402/422.
        if (!res.ok) {
          throw new ReplyHttpError(
            data?.error ?? `${res.status}: send failed`,
            res.status,
          );
        }
        if (!data) throw new ReplyHttpError("empty reply body", res.status);
        return data.status;
      },
    }),
    [draftUrl, replyUrl],
  );
  const batch = useBatchQuoteReply(batchCb);
  const runBatch = async () => {
    await batch.run(eligibleOpps);
    // Re-pull the ISR server component so just-pitched opps drop from the queue.
    router.refresh();
  };

  if (initialOpportunities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        No ranked opportunities yet. They appear here after the next scoring run.
      </div>
    );
  }

  return (
    <>
      <BatchReplyControl
        eligibleCount={eligibleOpps.length}
        isRunning={batch.isRunning}
        index={batch.index}
        total={batch.total}
        summary={batch.summary}
        onRun={runBatch}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
        <QueueList
          opportunities={initialOpportunities}
          selectedId={selectedId}
          onSelect={setSelectedId}
          rowStates={batch.rowStates}
        />
        <DetailPanel
          opportunity={selected}
          draftUrl={draftUrl}
          replyUrl={replyUrl}
        />
      </div>
    </>
  );
}

function QueueList({
  opportunities,
  selectedId,
  onSelect,
  rowStates,
}: {
  opportunities: PublicRankedOpportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  rowStates: Map<string, BatchRowState>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
        Ranked queue ({opportunities.length})
      </div>
      <ul className="divide-y divide-gray-100 max-h-[calc(100vh-260px)] overflow-y-auto">
        {opportunities.map((o) => (
          <li key={o.opportunityId}>
            <button
              type="button"
              onClick={() => onSelect(o.opportunityId)}
              className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                selectedId === o.opportunityId
                  ? "bg-brand-50 border-l-4 border-brand-500"
                  : "border-l-4 border-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-gray-600 truncate">
                  {o.mediaOutlet ?? "Unknown outlet"}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {rowStates.get(o.opportunityId) && (
                    <BatchRowPill state={rowStates.get(o.opportunityId)!} />
                  )}
                  <ScoreBadge score={o.score} />
                </div>
              </div>
              <p className="text-sm text-gray-800 line-clamp-3">
                {o.opportunityText}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {o.journalistName && <span>{o.journalistName}</span>}
                {o.deadline && (
                  <span>
                    Deadline {new Date(o.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  // Relevance judge (DIS-79) emits a 0–100 score; render it directly as a
  // percent. Do NOT multiply by 100 — `score` is already 0–100 (e.g. 95);
  // multiplying rendered "9500" instead of "95%".
  const pct = Math.round(score);
  const color =
    pct >= 80
      ? "bg-green-100 text-green-700 border-green-200"
      : pct >= 50
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${color}`}
    >
      {pct}%
    </span>
  );
}

function DetailPanel({
  opportunity,
  draftUrl,
  replyUrl,
}: {
  opportunity: PublicRankedOpportunity | null;
  draftUrl: string;
  replyUrl: string;
}) {
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [submitIsError, setSubmitIsError] = useState(false);

  const currentId = opportunity?.opportunityId ?? null;
  useEffect(() => {
    setDraft("");
    setGenerateError(null);
    setSubmitResult(null);
    setSubmitIsError(false);
  }, [currentId]);

  if (!opportunity) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        Select an opportunity from the queue to view details, generate a draft, and send.
      </div>
    );
  }

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    setSubmitResult(null);
    setSubmitIsError(false);
    try {
      // Route Handler composes the pitch from three calls (platform-prompts
      // + brands/extract-fields + content/generate-expert-quote-pitch) and
      // needs the full opportunity context for the {{request}} +
      // {{additionalContext}} template variables.
      const res = await fetch(draftUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.opportunityId,
          opportunityText: opportunity.opportunityText,
          mediaOutlet: opportunity.mediaOutlet,
          journalistName: opportunity.journalistName,
          deadline: opportunity.deadline,
          whyRelevant: opportunity.whyRelevant,
          category: opportunity.category,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as DraftResponse;
      setDraft(data.pitch);
    } catch (err) {
      console.error("[public-hitl-queue] generate failed:", err);
      setGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const charCount = draft.length;
  const inRange = charCount >= PITCH_MIN && charCount <= PITCH_MAX;
  const canSend = inRange && !sending;

  const handleSend = async () => {
    setSending(true);
    setSubmitResult(null);
    setSubmitIsError(false);
    try {
      // Route Handler reads brandId from the URL and sets it as `x-brand-id`
      // header — body carries only opportunityId + pitchContent per v0.8.1.
      const res = await fetch(replyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId: opportunity.opportunityId,
          pitchContent: draft,
        }),
      });
      const data = (await res.json().catch(() => null)) as ReplyResponse | null;
      if (!res.ok || !data) {
        throw new Error(`${res.status}: send failed`);
      }
      if (data.status === "submitted" || data.status === "already_submitted") {
        setSubmitResult(
          `Pitch ${data.status === "already_submitted" ? "already submitted" : "submitted"} via ${data.deliveryMethod ?? "—"}.`,
        );
        setSubmitIsError(false);
      } else {
        setSubmitResult(
          `Submit returned status: ${data.status}${data.error ? ` (${data.error})` : ""}`,
        );
        setSubmitIsError(true);
      }
    } catch (err) {
      console.error("[public-hitl-queue] send failed:", err);
      setSubmitResult(`Send failed: ${err instanceof Error ? err.message : String(err)}`);
      setSubmitIsError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {opportunity.mediaOutlet ?? "Unknown outlet"}
            {opportunity.journalistName && (
              <> · {opportunity.journalistName}</>
            )}
          </span>
          <ScoreBadge score={opportunity.score} />
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-line">
          {opportunity.opportunityText}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
          {opportunity.deadline && (
            <span>
              Deadline {new Date(opportunity.deadline).toLocaleString()}
            </span>
          )}
          {opportunity.pitchUrl && (
            <a
              href={opportunity.pitchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              Original on {opportunity.provider} →
            </a>
          )}
          <span>Source: {opportunity.provider}</span>
        </div>
        {opportunity.whyRelevant && (
          <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-2 text-xs text-brand-800">
            <strong>Why relevant:</strong> {opportunity.whyRelevant}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Draft</h3>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Generating…" : draft ? "Regenerate" : "Generate Quote"}
          </button>
        </div>

        {generateError && (
          <p className="text-xs text-red-600 mb-2">
            Generation failed: {generateError}
          </p>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder="Click Generate Quote to draft a response, then edit before sending."
          className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono focus:outline-none focus:border-brand-400"
        />

        <div className="flex items-center justify-between mt-2 text-xs">
          <span
            className={
              charCount === 0
                ? "text-gray-400"
                : inRange
                  ? "text-gray-500"
                  : "text-red-600"
            }
          >
            {charCount} / {PITCH_MIN}–{PITCH_MAX} chars
            {!inRange && charCount > 0 && (
              <>
                {" "}
                — {charCount < PITCH_MIN ? "too short" : "too long"}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        {submitResult && (
          <p
            className={`text-xs mt-2 ${submitIsError ? "text-red-600" : "text-green-700"}`}
          >
            {submitResult}
          </p>
        )}
      </div>
    </div>
  );
}
