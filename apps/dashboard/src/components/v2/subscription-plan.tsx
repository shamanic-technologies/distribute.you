"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ApiError,
  cancelSubscription,
  getSubscription,
  changeSubscriptionAmount,
  resumeSubscription,
  type Subscription,
  type SubscriptionRead,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { monthlyUsd, planAmountOptions } from "@/lib/subscription-plan";
import { EmptyNote, Figure, Shimmer, StateDot } from "@/components/v2/ui";

/**
 * The monthly plan on the v2 Billing page (an org billing-service holds in
 * `subscription` mode), drawn as the page's Balance strip is: one `k-card` split into
 * KPI cells, then a control row and a footer line, the way Keel's settings cards end.
 *
 * Owner 2026-10-01: the customer picks the monthly amount they want from a dropdown of
 * several choices (never a bare "+$100"); more money is more credit is more leads. And
 * leaving costs a moment's thought: cancelling (and removing the card) first lists what
 * stops. The list is the owner's; the backend cut-off it describes is built with the
 * first customer who cancels.
 */

/** What the customer loses, in the owner's order. */
export const SUBSCRIPTION_LOSSES = [
  "Your outreach stops. No new prospect gets an email.",
  "Follow-ups stop, so the conversations already started go quiet.",
  "Replies from your leads are no longer handled, and you lose them.",
  "You lose access to your contact list.",
  "You lose access to the history of every email we sent.",
] as const;

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The plan's state as a dot and a word, from billing's own fields. */
function planState(sub: Subscription): { running: boolean; label: string } {
  if (sub.cancel_at_period_end) return { running: false, label: "Cancelling" };
  if (sub.status === "trialing") return { running: true, label: "Free trial" };
  if (sub.status === "active") return { running: true, label: "Active" };
  if (sub.status === "past_due") return { running: false, label: "Payment failed" };
  return { running: false, label: "Ended" };
}

/** The date that matters next, and what it is. */
function nextDate(sub: Subscription): { label: string; date: string | null } {
  if (sub.cancel_at_period_end) return { label: "Ends", date: shortDate(sub.current_period_end) };
  if (sub.status === "trialing") return { label: "Trial ends", date: shortDate(sub.trial_end) };
  return { label: "Next charge", date: shortDate(sub.next_charge_at) };
}

export function SubscriptionPlan() {
  const queryClient = useQueryClient();
  const { data, isFetchedAfterMount, isError } = useAuthQuery(["subscription"], () => getSubscription());
  const [busy, setBusy] = useState<"amount" | "cancel" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lossOpen, setLossOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  async function run(kind: "amount" | "cancel" | "resume", write: () => Promise<SubscriptionRead>) {
    setBusy(kind);
    setError(null);
    try {
      const next = await write();
      queryClient.setQueryData(["subscription"], next);
      setPicked(null);
      await queryClient
        .refetchQueries({ queryKey: ["billingAccount"] })
        .catch((err) => console.error("[billing v2] refetch after plan write failed:", err));
    } catch (err) {
      // Logged, never rendered: the thrown message is the downstream body verbatim.
      console.error(`[billing v2] plan ${kind} failed:`, err);
      const code = err instanceof ApiError ? err.body?.code : undefined;
      setError(
        code === "subscription_trialing"
          ? "You can change the amount once your free trial ends."
          : "We could not change your plan. Please try again.",
      );
    }
    setBusy(null);
    setLossOpen(false);
  }

  if (!data && !isFetchedAfterMount) {
    return (
      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-3 md:divide-x">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 p-4">
            <Shimmer className="h-3 w-20" />
            <Shimmer className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  }
  if (!data || !data.subscription) {
    return (
      <div className="k-card">
        <EmptyNote>{isError ? "We could not read your plan right now." : "No plan has started on this account yet."}</EmptyNote>
      </div>
    );
  }

  const sub = data.subscription;
  const state = planState(sub);
  const next = nextDate(sub);
  const live = !sub.cancel_at_period_end && (sub.status === "trialing" || sub.status === "active" || sub.status === "past_due");
  const amount = picked ?? sub.monthly_amount_cents;
  const changed = picked !== null && picked !== sub.monthly_amount_cents;
  const trialing = sub.status === "trialing";
  // billing says whether the amount can move now (not during the trial, not while a
  // cancel is pending); an older read without the flag falls back to the trial rule.
  const locked = sub.can_change_amount != null ? !sub.can_change_amount : trialing;

  return (
    <div className="k-card">
      {/* The plan in three cells, the Balance strip's anatomy. Credit left is not
          repeated: the Balance row right above states it. */}
      <div className="grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-3 md:divide-x">
        <div className="p-4">
          <p className="k-label">Monthly plan</p>
          <div className="mt-1.5">
            <Figure value={monthlyUsd(sub.monthly_amount_cents)} unit="/ month" />
          </div>
        </div>
        <div className="p-4">
          <p className="k-label">Status</p>
          <div className="mt-2.5">
            <StateDot running={state.running} label={state.label} />
          </div>
        </div>
        <div className="p-4">
          <p className="k-label">{next.label}</p>
          <p className="k-mono mt-2.5 text-[13px] tabular-nums">{next.date ?? <span className="k-fg4">—</span>}</p>
        </div>
      </div>

      {/* The amount: a choice, never a step. */}
      {live && (
        <div className="k-line-subtle flex flex-wrap items-center gap-3 border-t px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Monthly amount</p>
            <p className="k-fg3 text-[12px] leading-[18px]">
              {locked
                ? trialing
                  ? "You can change it once your free trial ends."
                  : "You can change it again once your plan is active."
                : "Each dollar becomes credit for your outreach. A new amount applies from your next charge."}
            </p>
          </div>
          <label className={`k-btn relative h-7 text-[12px] ${locked ? "opacity-50" : ""}`}>
            <span className="tabular-nums">{monthlyUsd(amount)} / month</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="k-fg3">
              <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              aria-label="Monthly amount"
              value={amount}
              disabled={locked || busy !== null}
              onChange={(e) => setPicked(Number(e.target.value))}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            >
              {planAmountOptions(sub.monthly_amount_cents).map((cents) => (
                <option key={cents} value={cents}>
                  {monthlyUsd(cents)} / month
                </option>
              ))}
            </select>
          </label>
          {changed && (
            <button
              type="button"
              className={`k-btn-accent h-7 ${busy === "amount" ? "cursor-wait" : ""}`}
              disabled={busy !== null}
              onClick={() => void run("amount", () => changeSubscriptionAmount(amount))}
            >
              {busy === "amount" ? "Saving..." : "Update plan"}
            </button>
          )}
        </div>
      )}

      {/* Footer line: leaving, or coming back. */}
      <div className="k-line-subtle flex items-center gap-3 border-t px-4 py-2.5">
        <p className="k-fg3 min-w-0 flex-1 text-[12px]">
          {sub.cancel_at_period_end
            ? `Cancelled. Sending stops on ${next.date ?? "the end of this period"}.`
            : "Sending stops when the month's credit reaches $0."}
        </p>
        {sub.cancel_at_period_end ? (
          <button type="button" className="k-btn h-6 text-[12px]" disabled={busy !== null} onClick={() => void run("resume", () => resumeSubscription())}>
            {busy === "resume" ? "Resuming..." : "Keep my plan"}
          </button>
        ) : (
          live && (
            <button type="button" className="k-btn-ghost h-6 text-[12px]" disabled={busy !== null} onClick={() => setLossOpen(true)}>
              Cancel plan
            </button>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="k-line-subtle border-t px-4 py-2.5 text-[13px] text-[var(--data-rose)]">
          {error}
        </p>
      )}

      {lossOpen && (
        <LossDialog
          title="Cancel plan"
          question="Cancel your plan? Here is what stops."
          confirmLabel={busy === "cancel" ? "Cancelling..." : "Cancel my plan"}
          keepLabel="Keep my plan"
          pending={busy === "cancel"}
          onConfirm={() => void run("cancel", () => cancelSubscription())}
          onKeep={() => setLossOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * What leaving costs, stated before the click. A Keel popover: `k-label` header with
 * an `×`, the question, the list, then keeping as the primary action and leaving one
 * click away.
 */
export function LossDialog({
  title,
  question,
  confirmLabel,
  keepLabel,
  pending,
  onConfirm,
  onKeep,
}: {
  title: string;
  question: string;
  confirmLabel: string;
  keepLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onKeep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep, pending]);

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]"
      onMouseDown={() => !pending && onKeep()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-loss-title"
        className="k-popover flex w-full max-w-[460px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-loss-title" className="k-label">
            {title}
          </span>
          <button
            type="button"
            aria-label="Close"
            className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0"
            onClick={onKeep}
            disabled={pending}
          >
            ×
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="text-[13px] font-medium">{question}</p>
          <ul className="k-inset mt-3 divide-y divide-[var(--line-subtle)] rounded-lg">
            {SUBSCRIPTION_LOSSES.map((loss) => (
              <li key={loss} className="k-fg2 flex items-start gap-2.5 px-3 py-2 text-[13px] leading-5">
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className="mt-[3px] shrink-0 text-[var(--data-rose)]">
                  <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                {loss}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onConfirm} disabled={pending} className={`k-btn-ghost ${pending ? "cursor-wait" : ""}`}>
              {confirmLabel}
            </button>
            <button type="button" onClick={onKeep} disabled={pending} className="k-btn-accent">
              {keepLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
