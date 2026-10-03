"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import posthog from "posthog-js";
import { useBucketCounts } from "@/components/v2/data";
import { monthlyUsd } from "@/lib/subscription-plan";
import {
  CANCEL_REASONS,
  LOWEST_PLAN_CENTS,
  PAUSE_MONTHS,
  nextCancelStep,
  saveOfferFor,
  talkHref,
  type CancelReason,
  type PauseMonths,
  SUBSCRIPTION_LOSSES,
  type CancelStep,
} from "@/lib/cancel-plan";

/**
 * Cancelling the plan, in four screens (owner 2026-10-03: the old one-screen dialog
 * did not make leaving feel like a loss). What you lose, in your own numbers; why you
 * leave; an offer fitted to that reason (a lower plan, a pause, or a word with Kevin);
 * then the final confirm. Keeping the plan is the primary action on every screen, and
 * "Continue to cancel" sits beside it on every screen too: the rules are in
 * `lib/cancel-plan.ts`. No step counter and no progress bar (owner 2026-10-03): a
 * stepper makes reaching the end feel like the goal.
 */

const ROSE_TINT = "bg-[color-mix(in_srgb,var(--data-rose)_7%,transparent)] border border-[color-mix(in_srgb,var(--data-rose)_22%,transparent)]";

function WarningMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--data-rose)_14%,transparent)] text-[var(--data-rose)]">
      <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.2l6.2 11H1.8L8 2.2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.5v3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.6" r="0.8" fill="currentColor" />
      </svg>
    </span>
  );
}

function CrossMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="mt-[3px] shrink-0 text-[var(--data-rose)]">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** One served count, struck through in rose: what stops working for you. */
function LossFigure({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="p-3">
      <p className="k-label">{label}</p>
      <p className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums text-[var(--data-rose)]">
        {value === undefined ? <span className="k-fg4">—</span> : value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

export function CancelPlanFlow({
  monthlyAmountCents,
  canChangeAmount,
  canPause,
  endsOn,
  pending,
  onCancel,
  onLowerPlan,
  onPause,
  onKeep,
}: {
  monthlyAmountCents: number;
  canChangeAmount: boolean;
  canPause: boolean;
  /** When sending stops if they cancel (end of the trial or of the paid month). */
  endsOn: string | null;
  pending: "cancel" | "amount" | "pause" | null;
  onCancel: () => void;
  onLowerPlan: () => void;
  onPause: (months: PauseMonths) => void;
  onKeep: () => void;
}) {
  const { brandId } = useParams<{ brandId: string }>();
  const counts = useBucketCounts(brandId).data?.counts;
  const [step, setStep] = useState<CancelStep>("loss");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [months, setMonths] = useState<PauseMonths>(1);
  const offer = saveOfferFor(reason, { monthlyAmountCents, canChangeAmount, canPause });
  const busy = pending !== null;

  const track = (outcome: "kept" | "lowered" | "paused" | "cancelled" | "wrote") =>
    posthog.capture("plan_cancel_flow", { outcome, step, reason, monthly_amount_cents: monthlyAmountCents });

  const keep = () => {
    if (busy) return;
    track("kept");
    onKeep();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") keep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  const ends = endsOn ?? "the end of this period";

  const continueToCancel = (
    <button type="button" onClick={() => setStep(nextCancelStep(step))} disabled={busy} className="k-btn-ghost mr-auto text-[12px]">
      Continue to cancel
    </button>
  );
  const keepButton = (
    // On the offer screen the offer is the big blue button; keeping stays one click away.
    <button type="button" onClick={keep} disabled={busy} className={step === "offer" ? "k-btn" : "k-btn-accent"}>
      Keep my plan
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#10101247] px-3 pt-[10vh]" onMouseDown={keep}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-cancel-title"
        className="k-popover flex w-full max-w-[500px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-cancel-title" className="k-label">
            Cancel plan
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={keep} disabled={busy}>
            ×
          </button>
        </div>
        <div className="px-4 pb-4 pt-4">
          {step === "loss" && (
            <>
              <div className={`flex items-start gap-3 rounded-[10px] p-3 ${ROSE_TINT}`}>
                <WarningMark />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-6">You are about to lose your pipeline.</p>
                  <p className="k-fg2 mt-0.5 text-[13px]">This is what we built for you so far.</p>
                </div>
              </div>
              <div className="k-inset mt-3 grid grid-cols-3 divide-x divide-[var(--line-subtle)] rounded-lg">
                <LossFigure label="Contacted" value={counts?.contacted} />
                <LossFigure label="Positive replies" value={counts?.positive_reply} />
                <LossFigure label="Meetings" value={counts?.meeting_booked} />
              </div>
              <ul className="mt-3 space-y-1.5">
                {SUBSCRIPTION_LOSSES.map((loss) => (
                  <li key={loss} className="k-fg2 flex items-start gap-2.5 text-[13px] leading-5">
                    <CrossMark />
                    {loss}
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === "reason" && (
            <>
              <p className="text-[15px] font-semibold leading-6">Why do you want to leave?</p>
              <p className="k-fg2 mt-0.5 text-[13px]">Pick one. We may be able to fix it.</p>
              <div role="radiogroup" aria-label="Why you want to leave" className="mt-3 grid gap-1.5">
                {CANCEL_REASONS.map((r) => {
                  const on = reason === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setReason(r.id)}
                      className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-left text-[13px] ${
                        on ? "bg-[var(--accent)] font-medium text-white" : "k-inset k-fg2 hover:text-[var(--fg-1)]"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                          on ? "bg-white text-[var(--accent)]" : "border border-[var(--line)]"
                        }`}
                      >
                        {on && (
                          <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
                            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === "offer" && offer === "lower_plan" && (
            <>
              <p className="text-[15px] font-semibold leading-6">Stay for {monthlyUsd(LOWEST_PLAN_CENTS)} a month.</p>
              <p className="k-fg2 mt-0.5 text-[13px]">
                Pay {monthlyUsd(LOWEST_PLAN_CENTS)} instead of {monthlyUsd(monthlyAmountCents)}. Your outreach keeps running.
              </p>
              <button
                type="button"
                onClick={() => {
                  track("lowered");
                  onLowerPlan();
                }}
                disabled={busy}
                className={`k-btn-accent k-cta mt-4 w-full justify-center ${pending === "amount" ? "cursor-wait" : ""}`}
              >
                {pending === "amount" ? "Switching..." : `Switch to ${monthlyUsd(LOWEST_PLAN_CENTS)} a month`}
              </button>
            </>
          )}

          {step === "offer" && offer === "pause" && (
            <>
              <p className="text-[15px] font-semibold leading-6">Take a break instead.</p>
              <p className="k-fg2 mt-0.5 text-[13px]">Pause your plan. You pay nothing and keep everything.</p>
              <div role="radiogroup" aria-label="Pause length" className="mt-3 grid grid-cols-3 gap-1.5">
                {PAUSE_MONTHS.map((m) => {
                  const on = months === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMonths(m)}
                      className={`h-10 rounded-lg text-[13px] ${on ? "bg-[var(--accent)] font-medium text-white" : "k-inset k-fg2 hover:text-[var(--fg-1)]"}`}
                    >
                      {m === 1 ? "1 month" : `${m} months`}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  track("paused");
                  onPause(months);
                }}
                disabled={busy}
                className={`k-btn-accent k-cta mt-3 w-full justify-center ${pending === "pause" ? "cursor-wait" : ""}`}
              >
                {pending === "pause" ? "Pausing..." : `Pause for ${months === 1 ? "1 month" : `${months} months`}`}
              </button>
            </>
          )}

          {step === "offer" && offer === "talk" && (
            <>
              <p className="text-[15px] font-semibold leading-6">Talk to Kevin before you go.</p>
              <p className="k-fg2 mt-0.5 text-[13px]">Kevin runs distribute. He reads every message and answers himself.</p>
              <a href={talkHref(reason)} onClick={() => track("wrote")} className="k-btn-accent k-cta mt-4 w-full justify-center">
                Write to Kevin
              </a>
            </>
          )}

          {step === "confirm" && (
            <div className={`flex items-start gap-3 rounded-[10px] p-3 ${ROSE_TINT}`}>
              <WarningMark />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold leading-6">Your plan ends on {ends}.</p>
                <p className="k-fg2 mt-0.5 text-[13px]">After that, sending stops and your replies go unanswered.</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {step === "confirm" ? (
              <button
                type="button"
                onClick={() => {
                  track("cancelled");
                  onCancel();
                }}
                disabled={busy}
                style={{ background: "var(--data-rose)", color: "#fff" }}
                className={`k-btn-strong mr-auto ${pending === "cancel" ? "cursor-wait" : ""}`}
              >
                {pending === "cancel" ? "Cancelling..." : "Cancel my plan"}
              </button>
            ) : (
              continueToCancel
            )}
            {keepButton}
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
