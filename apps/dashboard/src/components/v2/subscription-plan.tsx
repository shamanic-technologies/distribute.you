"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ApiError,
  cancelSubscription,
  getSubscription,
  raiseSubscription,
  resumeSubscription,
  type SubscriptionRead,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatBillingCents } from "@/lib/format-number";
import { monthlyUsd } from "@/lib/subscription-plan";
import { Shimmer } from "@/components/v2/ui";

/**
 * The $99/month plan on the Billing page (an org billing-service holds in
 * `subscription` mode). Reads `GET /v1/billing/accounts/subscription` and drives the
 * three customer writes: add $100 a month, cancel, resume.
 *
 * Owner 2026-10-01: once subscribed (never during the trial) more money is the way to
 * more leads, so "Add $100 a month" is the one call to action; and leaving is made to
 * cost a moment's thought: cancelling (and removing the card) first lists what stops.
 * The list is what the owner decided to state; the backend cut-off it describes is
 * built with the first customer who cancels.
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

/** One sentence on where the plan stands, from billing's own fields. */
function statusLine(sub: NonNullable<SubscriptionRead["subscription"]>): string {
  const amount = monthlyUsd(sub.monthly_amount_cents);
  const ends = shortDate(sub.current_period_end);
  if (sub.cancel_at_period_end) return ends ? `Cancelled. Your plan ends on ${ends}.` : "Cancelled.";
  if (sub.status === "trialing") {
    const trialEnd = shortDate(sub.trial_end);
    return trialEnd ? `Free trial until ${trialEnd}, then ${amount} a month.` : `Free trial, then ${amount} a month.`;
  }
  if (sub.status === "active") {
    const next = shortDate(sub.next_charge_at);
    return next ? `${amount} a month. Next charge on ${next}.` : `${amount} a month.`;
  }
  if (sub.status === "past_due") return "Your last payment did not go through. Change your card to keep sending.";
  return "Your plan has ended.";
}

export function SubscriptionPlan() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useAuthQuery(["subscription"], () => getSubscription());
  const [busy, setBusy] = useState<"raise" | "cancel" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lossOpen, setLossOpen] = useState(false);

  async function run(kind: "raise" | "cancel" | "resume", write: () => Promise<SubscriptionRead>) {
    setBusy(kind);
    setError(null);
    try {
      const next = await write();
      queryClient.setQueryData(["subscription"], next);
      await queryClient
        .refetchQueries({ queryKey: ["billingAccount"] })
        .catch((err) => console.error("[billing v2] refetch after subscription write failed:", err));
    } catch (err) {
      // Logged, never rendered: the thrown message is the downstream body verbatim.
      console.error(`[billing v2] subscription ${kind} failed:`, err);
      const code = err instanceof ApiError ? err.body?.code : undefined;
      setError(
        code === "subscription_trialing"
          ? "You can add more once your free trial ends."
          : "We could not change your plan. Please try again.",
      );
    }
    setBusy(null);
    setLossOpen(false);
  }

  if (isPending) return <Shimmer className="mt-3 h-24" />;
  if (isError || !data) {
    return <p className="k-fg3 mt-3 text-[12px]">We could not read your plan right now.</p>;
  }
  const sub = data.subscription;
  if (!sub) {
    return <p className="k-fg3 mt-3 text-[12px]">No plan has started on this account yet.</p>;
  }
  const credit = data.credits_remaining_cents != null ? formatBillingCents(data.credits_remaining_cents) : null;
  const live = sub.status === "trialing" || sub.status === "active" || sub.status === "past_due";

  return (
    <div className="k-card mt-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">Your plan</p>
        <p className="text-[22px] font-medium leading-7 tabular-nums">
          {monthlyUsd(sub.monthly_amount_cents)}
          <span className="k-fg3 text-[12px] font-normal"> / month</span>
        </p>
      </div>
      <p className="k-fg mt-1 text-[13px] leading-5">{statusLine(sub)}</p>
      {credit && (
        <p className="k-fg3 mt-1 text-[12px] leading-[18px]">
          {credit} of credit left this month. Sending stops when it reaches $0.
        </p>
      )}

      {live && !sub.cancel_at_period_end && (
        <div className="k-inset mt-4 rounded-lg p-3">
          <p className="text-[13px] font-medium">Reach more leads</p>
          <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">
            Every extra $100 a month becomes $100 more credit for your outreach.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sub.can_raise && sub.next_raise_monthly_amount_cents != null ? (
              <button
                type="button"
                className={`k-btn-accent tabular-nums ${busy === "raise" ? "cursor-wait" : ""}`}
                disabled={busy !== null}
                onClick={() => void run("raise", () => raiseSubscription(sub.next_raise_monthly_amount_cents!))}
              >
                {busy === "raise"
                  ? "Updating..."
                  : `Add $100 a month (${monthlyUsd(sub.next_raise_monthly_amount_cents)} total)`}
              </button>
            ) : (
              <p className="k-fg3 text-[12px]">
                {sub.status === "trialing" ? "You can add more once your free trial ends." : "Not available right now."}
              </p>
            )}
          </div>
          {sub.can_raise && (
            <p className="k-fg3 mt-2 text-[12px]">The new amount applies from your next charge.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {sub.cancel_at_period_end ? (
          <button
            type="button"
            className="k-btn"
            disabled={busy !== null}
            onClick={() => void run("resume", () => resumeSubscription())}
          >
            {busy === "resume" ? "Resuming..." : "Keep my plan"}
          </button>
        ) : (
          live && (
            <button type="button" className="k-btn-ghost" disabled={busy !== null} onClick={() => setLossOpen(true)}>
              Cancel plan
            </button>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--data-rose)]">
          {error}
        </p>
      )}

      {lossOpen && (
        <LossDialog
          title="Before you cancel"
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
 * What leaving costs, stated before the click. Keeping the plan is the primary
 * action; leaving stays one click away.
 */
export function LossDialog({
  title,
  confirmLabel,
  keepLabel,
  pending,
  onConfirm,
  onKeep,
}: {
  title: string;
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
          <p className="text-[13px] font-medium">Here is what stops:</p>
          <ul className="mt-2 space-y-1.5">
            {SUBSCRIPTION_LOSSES.map((loss) => (
              <li key={loss} className="flex items-start gap-2 text-[13px] leading-5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-rose)]" />
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
