"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import {
  listQuoteRequests,
  listAllRankedOpportunities,
  generateExpertQuotePitch,
  submitQuoteOpportunityReply,
  type QuoteRequest,
  type RankedOpportunity,
} from "@/lib/api";
import { isOpportunityOpen } from "@/lib/quote-pitch-status";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";
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
import { useCampaign } from "@/lib/campaign-context";
import {
  useGenerateQuoteDraft,
  useSubmitQuotePitch,
} from "@/lib/use-quote-opportunities";

const PITCH_MIN = 100;
const PITCH_MAX = 2500;

// Expert attribution carried by the campaign `featureInputs` (DIS-136). These
// drive the single-expert fields of the expert-quote-pitch contract; brand
// identity + description/HQ + expertBio are fetched/extracted inside
// `generateExpertQuotePitch`. Generate is gated on all four being present.
const HITL_INPUT_KEYS = [
  "expertName",
  "expertTitle",
  "expertPhotoUrl",
  "expertLinkedIn",
] as const;
type HitlInputKey = (typeof HITL_INPUT_KEYS)[number];

export default function QuoteRequestsPage() {
  const params = useParams();
  const featureSlug = params.featureSlug as string;
  if (isExpertQuoteFeature(featureSlug)) return <HitlQueuePage />;
  return <FlatQuoteRequestsPage />;
}

// ───────── HITL queue page (pr-expert-quote-* family) ───────────────────────

function HitlQueuePage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string;
  const featureSlug = params.featureSlug as string;
  const { campaign } = useCampaign();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isPending } = useAuthQuery(
    ["rankedOpportunities", { brandId }],
    () => listAllRankedOpportunities({ brandId }),
    pollOptionsSlow,
  );

  // Hide opportunities already pitched for the brand-set (pitchStatus in the
  // block set) — they live on the Pitches page now. null + failure statuses
  // stay (re-reply still allowed). See lib/quote-pitch-status.ts.
  const opportunities = (data?.opportunities ?? []).filter((o) =>
    isOpportunityOpen(o.pitchStatus),
  );
  const selected = useMemo(
    () => opportunities.find((o) => o.opportunityId === selectedId) ?? null,
    [opportunities, selectedId],
  );

  const featureInputs = campaign?.featureInputs ?? null;
  const missingInputs = HITL_INPUT_KEYS.filter(
    (k) => !featureInputs?.[k]?.trim(),
  );

  // ── "Reply to all with AI" — batch over the eligible (score>10, un-pitched)
  // opportunities, reusing the SAME per-opp generate→reply path the buttons run.
  // The loop lives in the browser (each generate + each reply is its own fetch);
  // see lib/batch-quote-reply.ts. Eligibility is computed off the raw catalog
  // (data.opportunities), not the isOpportunityOpen-filtered queue — every
  // eligible opp is a strict subset of the visible queue, so its row pill lands.
  const queryClient = useQueryClient();
  const eligibleOpps = useMemo(
    () => selectEligibleOpportunities(data?.opportunities ?? []),
    [data],
  );
  const batchCb = useMemo<BatchCallbacks<RankedOpportunity>>(
    () => ({
      idOf: (o) => o.opportunityId,
      generate: async (o) => {
        if (!featureInputs) throw new Error("missing campaign inputs");
        const res = await generateExpertQuotePitch({
          brandId,
          expert: {
            expertName: featureInputs.expertName,
            expertTitle: featureInputs.expertTitle,
            expertPhotoUrl: featureInputs.expertPhotoUrl,
            expertLinkedIn: featureInputs.expertLinkedIn,
          },
          opportunity: o,
          revisionInstructions: null,
          featureSlug,
        });
        return res.pitch;
      },
      submit: async (o, pitch) => {
        const res = await submitQuoteOpportunityReply(
          o.opportunityId,
          { pitchContent: pitch, campaignId },
          brandId,
        );
        return res.status;
      },
    }),
    [brandId, campaignId, featureSlug, featureInputs],
  );
  const batch = useBatchQuoteReply(batchCb);
  const runBatch = async () => {
    await batch.run(eligibleOpps);
    // Single refresh after the whole batch (not per-opp) — drops every now-
    // pitched row from the queue + refreshes the pitches page / sidebar badge.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rankedOpportunities"] }),
      queryClient.invalidateQueries({ queryKey: ["quotePitches"] }),
      queryClient.invalidateQueries({ queryKey: ["featureQuotePitches"] }),
      queryClient.invalidateQueries({ queryKey: ["featureStats"] }),
    ]);
  };

  return (
    <div className="p-4 md:p-8" data-testid="quote-opportunities-hitl-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">
          Quote Opportunities
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ranked queue of Featured.com journalist quote requests for this campaign.
          Click an opportunity to generate, edit, and send a quote.
        </p>
      </div>

      {missingInputs.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Campaign is missing required inputs: <strong>{missingInputs.join(", ")}</strong>.
          AI draft generation is disabled until these are set.
        </div>
      )}

      {isPending && !data ? (
        <QueueSkeleton />
      ) : opportunities.length === 0 ? (
        <EmptyState message="No ranked opportunities yet. They appear here after the next scoring run." />
      ) : (
        <>
          <BatchReplyControl
            eligibleCount={eligibleOpps.length}
            isRunning={batch.isRunning}
            index={batch.index}
            total={batch.total}
            summary={batch.summary}
            disabled={missingInputs.length > 0}
            disabledReason={
              missingInputs.length > 0
                ? "Set the missing campaign inputs above to enable batch sending."
                : null
            }
            onRun={runBatch}
          />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
            <QueueList
              opportunities={opportunities}
              selectedId={selectedId}
              onSelect={setSelectedId}
              rowStates={batch.rowStates}
            />
            <DetailPanel
              opportunity={selected}
              brandId={brandId}
              campaignId={campaignId}
              featureSlug={featureSlug}
              featureInputs={featureInputs}
              missingInputs={missingInputs}
            />
          </div>
        </>
      )}
    </div>
  );
}

function QueueList({
  opportunities,
  selectedId,
  onSelect,
  rowStates,
}: {
  opportunities: RankedOpportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  rowStates: Map<string, BatchRowState>;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
        Ranked queue ({opportunities.length})
      </div>
      <ul className="divide-y divide-gray-100 max-h-[calc(100vh-280px)] overflow-y-auto">
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
              data-testid={`opportunity-row-${o.opportunityId}`}
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
  brandId,
  campaignId,
  featureSlug,
  featureInputs,
  missingInputs,
}: {
  opportunity: RankedOpportunity | null;
  brandId: string;
  campaignId: string;
  featureSlug: string;
  featureInputs: Record<string, string> | null;
  missingInputs: HitlInputKey[];
}) {
  const [draft, setDraft] = useState("");
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const generateMutation = useGenerateQuoteDraft();
  const submitMutation = useSubmitQuotePitch(brandId);

  const currentId = opportunity?.opportunityId ?? null;
  useEffect(() => {
    setDraft("");
    setSubmitResult(null);
    setEditModalOpen(false);
  }, [currentId]);

  if (!opportunity) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
        Select an opportunity from the queue to view details, generate a draft, and send.
      </div>
    );
  }

  const canGenerate =
    missingInputs.length === 0 && !generateMutation.isPending;

  // `revisionInstructions` is the free-text from the "Edit with AI" modal (null
  // on a first/plain generation). It rides into `expertAnswerContext` so the
  // model applies the operator's edits on the next generation.
  const handleGenerate = (revisionInstructions: string | null) => {
    if (!featureInputs) return;
    setSubmitResult(null);
    // All-required expert-quote-pitch contract (content-gen PR #124 / v0.21.0):
    // brands[] + single expert attribution + journalistRequest + expertAnswerContext.
    // Expert name/title/photo/LinkedIn come from the operator's campaign
    // `featureInputs` (DIS-136); brand identity + description/HQ + expertBio are
    // fetched/extracted inside generateExpertQuotePitch, which fails loud if any
    // required field is empty (never sends a partial body / legacy fallback).
    generateMutation.mutate(
      {
        brandId,
        expert: {
          expertName: featureInputs.expertName,
          expertTitle: featureInputs.expertTitle,
          expertPhotoUrl: featureInputs.expertPhotoUrl,
          expertLinkedIn: featureInputs.expertLinkedIn,
        },
        opportunity,
        revisionInstructions,
        featureSlug,
      },
      {
        onSuccess: (res) => {
          setDraft(res.pitch);
          setEditModalOpen(false);
        },
      },
    );
  };

  const charCount = draft.length;
  const inRange = charCount >= PITCH_MIN && charCount <= PITCH_MAX;
  const canSend = inRange && !submitMutation.isPending;

  const handleSend = () => {
    submitMutation.mutate(
      {
        opportunityId: opportunity.opportunityId,
        body: {
          pitchContent: draft,
          // Associate the pitch with this campaign so it shows on the
          // campaign-scoped Pitches page (filters by campaign_id).
          campaignId,
        },
      },
      {
        onSuccess: (res) => {
          setSubmitResult(
            res.status === "submitted" || res.status === "already_submitted"
              ? `Pitch ${res.status === "already_submitted" ? "already submitted" : "submitted"} via ${res.deliveryMethod ?? "—"}.`
              : `Submit returned status: ${res.status}${res.error ? ` (${res.error})` : ""}`,
          );
        },
        onError: (err) => {
          setSubmitResult(`Send failed: ${err.message}`);
        },
      },
    );
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
              Original on Featured →
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
            onClick={() =>
              draft ? setEditModalOpen(true) : handleGenerate(null)
            }
            disabled={!canGenerate}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="generate-quote-btn"
          >
            {generateMutation.isPending
              ? "Generating…"
              : draft
                ? "Edit with AI"
                : "Generate Quote"}
          </button>
        </div>

        {generateMutation.isError && (
          <p className="text-xs text-red-600 mb-2">
            Generation failed: {(generateMutation.error as Error).message}
          </p>
        )}

        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder={
            missingInputs.length > 0
              ? "Set missing campaign inputs to enable draft generation."
              : "Click Generate Quote to draft a response, then edit before sending."
          }
          className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono focus:outline-none focus:border-brand-400"
          data-testid="quote-draft-textarea"
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
            data-testid="send-quote-btn"
          >
            {submitMutation.isPending ? "Sending…" : "Send"}
          </button>
        </div>

        {submitResult && (
          <p
            className={`text-xs mt-2 ${
              submitMutation.isError ||
              submitResult.startsWith("Send failed") ||
              submitResult.startsWith("Submit returned")
                ? "text-red-600"
                : "text-green-700"
            }`}
            data-testid="submit-result"
          >
            {submitResult}
          </p>
        )}
      </div>

      <QuoteRevisionModal
        open={editModalOpen}
        isPending={generateMutation.isPending}
        onClose={() => setEditModalOpen(false)}
        onSubmit={(instructions) => handleGenerate(instructions || null)}
      />
    </div>
  );
}

// ───────── Edit-with-AI modal (revision instructions for the next generation) ─

function QuoteRevisionModal({
  open,
  isPending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (instructions: string) => void;
}) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isPending, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={() => {
        if (!isPending) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="quote-revision-modal"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-gray-800">
            Edit with AI
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-gray-600">
            Tell the AI how to revise the draft. Your instructions are applied
            on the next regeneration — leave blank to simply regenerate.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="e.g. Make it punchier, lead with our Series B, drop the corporate tone, and mention the 40% retention lift."
            disabled={isPending}
            className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
            data-testid="quote-revision-textarea"
          />
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(text.trim())}
            disabled={isPending}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="quote-revision-submit"
          >
            {isPending ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 h-20 animate-pulse"
          />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 h-96 animate-pulse" />
    </div>
  );
}

// ───────── Flat list page (existing — used by every non-HITL slug) ──────────

function FlatQuoteRequestsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data, isPending } = useAuthQuery(
    ["quoteRequests", { campaign_id: campaignId }],
    () =>
      listQuoteRequests({
        campaign_id: campaignId,
        limit: 100,
      }),
    pollOptionsSlow,
  );

  const requests = data?.providerQuoteRequests ?? [];

  return (
    <div className="p-4 md:p-8" data-testid="quote-requests-page">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Quote requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Journalist quote opportunities pulled for this org.
        </p>
      </div>

      {isPending && !data ? (
        <ListSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState message="No quote requests yet. They'll appear here after the next run." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Opportunity</th>
                <th className="px-4 py-2 text-left">Outlet</th>
                <th className="px-4 py-2 text-left">Deadline</th>
                <th className="px-4 py-2 text-left">Source</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <Row key={r.id} request={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ request }: { request: QuoteRequest }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3 text-gray-800 max-w-md">
        <div
          className="text-xs text-gray-700 line-clamp-3"
          title={request.opportunityText}
        >
          {request.opportunityText}
        </div>
        {request.pitchUrl && (
          <a
            href={request.pitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            Open pitch link
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.mediaOutlet ?? "—"}</td>
      <td className="px-4 py-3 text-gray-600">
        {request.deadline
          ? new Date(request.deadline).toLocaleDateString()
          : "—"}
      </td>
      <td className="px-4 py-3 text-gray-600">{request.provider}</td>
    </tr>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
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
      className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500"
      data-testid="quote-requests-empty"
    >
      {message}
    </div>
  );
}
