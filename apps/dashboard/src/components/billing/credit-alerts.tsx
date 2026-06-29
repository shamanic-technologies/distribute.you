"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getBrandDailyBudget,
  type BillingAccount,
  type BrandDailyBudget,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { pollOptions } from "@/lib/query-options";
import {
  availableCreditCents,
  brandRunwayDays,
  brandRunwaySeverity,
} from "@/lib/credit-runway";

/**
 * Brand credit guard. Two reassurance-vs-nag surfaces over data already on the
 * wire (billing account + the brand's saved daily budget), no backend dependency:
 *
 *  1. A persistent top BANNER while the brand's available credit covers under 3
 *     days at its daily budget AND auto-topup is off (deactivated OR unsupported,
 *     e.g. India) — amber <3 days, red ≤1 day. CTA pushes auto-topup when the
 *     card supports it, "add credits" otherwise.
 *  2. A once-per-day MODAL on arrival (brand overview) under the same condition,
 *     re-arming the next calendar day while the issue persists, reusing the
 *     billing-guard payment modal.
 *
 * "Available" = the billing page's Available = balance_cents (total credited −
 * confirmed − provisioned). Runway = available ÷ the brand's daily budget.
 * Brand-scoped: renders nothing off a brand route or before a daily budget is set.
 */

// localStorage so the once-per-day cadence survives a reload / new session.
function creditModalShownKey(brandId: string) {
  return `credit-modal-shown:${brandId}`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (calendar day)
}

export function CreditAlerts() {
  const { showPaymentRequired } = useBillingGuard();
  const params = useParams();
  const brandId = (params?.brandId as string | undefined) ?? null;

  const { data: account } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptions,
  );
  const { data: budget } = useAuthQuery<BrandDailyBudget>(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId!),
    { enabled: brandId !== null, ...pollOptions },
  );

  const available = account ? availableCreditCents(account) : null;
  const runwayDays =
    budget && available !== null
      ? brandRunwayDays(available, budget.dailyBudgetCents)
      : null;
  const severity =
    account && budget
      ? brandRunwaySeverity(runwayDays, account.has_auto_topup)
      : null;
  const autoReloadSupported = account?.auto_reload_supported !== false;

  // Once-per-day modal on arrival while the condition holds. The localStorage
  // day-stamp guard means at most one popup per calendar day per brand; it
  // re-arms the next day if the issue is still unresolved.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!brandId || !account || !severity) return;
    const key = creditModalShownKey(brandId);
    if (localStorage.getItem(key) === todayStamp()) return;
    localStorage.setItem(key, todayStamp());
    showPaymentRequired({
      balance_cents: account.balance_cents,
      proactive: true,
      autoReloadSupported,
    });
  }, [brandId, account, severity, autoReloadSupported, showPaymentRequired]);

  if (!brandId || !account || !budget || !severity) return null;

  const isUrgent = severity === "urgent";

  const message =
    runwayDays !== null && runwayDays <= 0
      ? "You’re out of credit. Outreach will stop."
      : isUrgent
        ? "Less than a day of credit left. Top up to keep running."
        : `About ${runwayDays} days of credit left at your daily budget.`;

  const cta = autoReloadSupported
    ? "Turn on auto-topup so it never stops →"
    : "Add credits to keep running →";

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
        onClick={() =>
          showPaymentRequired({
            balance_cents: account.balance_cents,
            proactive: true,
            autoReloadSupported,
          })
        }
        className={
          isUrgent
            ? "underline underline-offset-2 font-semibold hover:opacity-90"
            : "underline underline-offset-2 font-semibold hover:opacity-80"
        }
      >
        {cta}
      </button>
    </div>
  );
}
