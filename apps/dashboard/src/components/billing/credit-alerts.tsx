"use client";

import { useEffect, useRef } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBillingAccount, listCampaigns, type BillingAccount, type Campaign } from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { pollOptionsSlower } from "@/lib/query-options";
import { computeRunway, runwaySeverity } from "@/lib/campaign-runway";

const DEPLETED_MODAL_SESSION_KEY = "credit-depleted-modal-shown";

/**
 * App-shell credit guard. Two reassurance-vs-nag surfaces over data already on
 * the wire (billing account + org campaigns), no backend dependency:
 *
 *  1. A persistent top banner when an active recurring campaign is about to run
 *     out of credit AND auto-topup is off — amber ≤3 days, red ≤1 day. CTA pushes
 *     auto-topup (the friction-free "never stops again" fix). Suppressed once
 *     auto-topup is on or no recurring campaign is running.
 *  2. A one-per-session modal on arrival when the balance is already exhausted
 *     and the org has campaigns — "all campaigns stopped, add credit / set up
 *     auto-topup".
 *
 * The email side of this (instant + +3d/+10d dunning) is backend-owned and
 * tracked separately; this component is the dashboard half only.
 */
export function CreditAlerts() {
  const { showPaymentRequired } = useBillingGuard();

  const { data: account } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptionsSlower,
  );
  const { data: campaignsData } = useAuthQuery<{ campaigns: Campaign[] }>(
    ["campaigns"],
    () => listCampaigns(),
    pollOptionsSlower,
  );

  const depletedShownRef = useRef(false);

  // One-per-session depleted modal on arrival. Cleared when the balance recovers
  // so a later depletion re-arms it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!account || !campaignsData) return;
    const status = computeRunway(campaignsData.campaigns, account);

    if (!status.depleted) {
      sessionStorage.removeItem(DEPLETED_MODAL_SESSION_KEY);
      depletedShownRef.current = false;
      return;
    }
    if (campaignsData.campaigns.length === 0) return;
    if (depletedShownRef.current || sessionStorage.getItem(DEPLETED_MODAL_SESSION_KEY)) return;

    depletedShownRef.current = true;
    sessionStorage.setItem(DEPLETED_MODAL_SESSION_KEY, "1");
    showPaymentRequired({ balance_cents: account.balance_cents, depleted: true });
  }, [account, campaignsData, showPaymentRequired]);

  if (!account || !campaignsData) return null;

  const status = computeRunway(campaignsData.campaigns, account);
  const severity = runwaySeverity(status, account.has_auto_topup);
  if (!severity) return null;

  const plural = status.recurringCount > 1;
  const subject = plural ? "campaigns" : "campaign";
  const verbHave = plural ? "have" : "has";

  // Only `depleted` (balance ≤ 0) means the campaigns actually stopped. A
  // runwayDays of 0 still has POSITIVE credit (less than one day of burn) — the
  // campaigns keep running until the balance truly hits zero, so don't claim
  // "stopped". Auto-topup being off is a nudge condition, NOT proof of depletion.
  const message =
    status.depleted
      ? `Out of credit — your ${subject} ${plural ? "have" : "has"} stopped.`
      : status.runwayDays !== null && status.runwayDays <= 1
        ? `Your ${subject} will stop within a day — you’re almost out of credit.`
        : `Your ${subject} ${verbHave} about ${status.runwayDays} days of credit left.`;

  const isUrgent = severity === "urgent";

  return (
    <div
      className={
        isUrgent
          ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm bg-red-600 text-white"
          : "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm bg-amber-100 text-amber-900 border-b border-amber-200"
      }
      role="alert"
    >
      <span className="flex items-center gap-2 font-medium">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        {message}
      </span>
      <button
        onClick={() => showPaymentRequired({ balance_cents: account.balance_cents, proactive: true })}
        className={
          isUrgent
            ? "underline underline-offset-2 font-semibold hover:opacity-90"
            : "underline underline-offset-2 font-semibold hover:opacity-80"
        }
      >
        Turn on auto-topup so {plural ? "they" : "it"} never stop{plural ? "" : "s"} →
      </button>
    </div>
  );
}
