"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getCreditGrants,
  createCheckoutSession,
  createPortalSession,
  listBrands,
  getBrandDailyBudget,
  type BillingAccount,
  type CreditGrant,
  type Brand,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import { topupPresetsForDailyBudget } from "@/lib/credit-runway";
import { pollOptions } from "@/lib/query-options";
import { DashboardPage } from "@/components/dashboard-page";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { Skeleton } from "@/components/skeleton";


// Friendly label for a credit grant's `reason` (pure display lookup, no metric).
// reason ∈ welcome | first_load_match | admin_grant | invite_* | <promo code>.
function grantLabel(reason: string): string {
  switch (reason) {
    case "welcome":
      return "Welcome gift";
    case "first_load_match":
      return "First deposit match";
    case "admin_grant":
      return "Bonus credit";
    default:
      if (reason.startsWith("invite")) return "Referral bonus";
      return `Promo: ${reason}`;
  }
}

function formatGrantDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ISO-3166-1 alpha-2 -> display name. Display-only mapping (billing owns the
// blocklist via `auto_reload_supported`); we only name the country for the notice.
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  NP: "Nepal",
  LK: "Sri Lanka",
};

function countryLabel(code: string | null | undefined): string {
  if (!code) return "your card's country";
  return COUNTRY_NAMES[code.toUpperCase()] ?? "your card's country";
}

// Last calendar day of the current month, formatted for the "…or on <date>"
// month-end sweep guarantee (billing-service runMonthEndSweep). Day 0 of next
// month = last day of this month.
function lastDayOfMonthLabel(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// Fixed values sent to configureAutoTopup ONLY to set the "auto-topup enabled"
// flag (both columns non-null ⇒ enabled). The effective reload amount + credit-
// line floor are DERIVED server-side from a tier ladder (billing-service
// topup-tier), so these numbers are never used for the charge math — they only
// arm the flag. See "Threshold-based postpaid top-up" in billing-service.
const AUTO_TOPUP_ENABLE_AMOUNT_CENTS = 5000;
const AUTO_TOPUP_ENABLE_THRESHOLD_CENTS = 500;

export default function BillingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  void orgId;
  const queryClient = useQueryClient();
  const { showPaymentRequired } = useBillingGuard();

  const showSuccess = searchParams.get("success") === "true";
  const pendingTopup = searchParams.get("pending_topup");
  const pendingThreshold = searchParams.get("pending_threshold");

  // Data fetching
  // Gate the page on isPending (not isLoading): during Clerk org-settle useAuthQuery
  // disables the query → isLoading:false while account is still undefined → the page
  // would render $0 numbers + hide the discount banner for the settle window. isPending
  // stays true through settle, so we skeleton instead. Warm persisted cache → instant.
  const { data: account, isPending: accountPending } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptions,
  );

  // Credit grants ("gifts received") — the org's own free-credit ledger.
  const { data: grantsData, isPending: grantsPending } = useAuthQuery<{ grants: CreditGrant[] }>(
    ["creditGrants"],
    () => getCreditGrants(),
  );
  const grants = grantsData?.grants ?? [];

  // Org-wide daily burn = sum of every brand's saved daily budget (paused/unset
  // brands contribute 0). The org wallet is shared across brands, so this is how
  // fast a top-up actually drains — it drives the "~N days" estimate on each
  // amount. Display affordance over existing per-brand budgets (same class as the
  // credit-runway banner), not a server-owned metric. Reuses the per-brand
  // ["brandDailyBudget", id] cache the brand pages already populate.
  const { data: brandsData } = useAuthQuery<{ brands: Brand[] }>(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brandBudgetQueries = useQueries({
    queries: (brandsData?.brands ?? []).map((b) => ({
      queryKey: ["brandDailyBudget", b.id],
      queryFn: () => getBrandDailyBudget(b.id),
      enabled: !!brandsData,
      ...pollOptions,
    })),
  });
  const orgDailyBurnCents = brandBudgetQueries.reduce(
    (sum, q) => sum + (q.data?.dailyBudgetCents ?? 0),
    0,
  );
  // Presets sized to N days of the org's combined daily burn (5/15/45/135 days);
  // flat fallback when no brand has a budget set.
  const presetAmounts = topupPresetsForDailyBudget(orgDailyBurnCents);
  const presetKey = presetAmounts.join(",");

  // Top-up state (one-off "Add Credits" only — auto-topup amount/threshold are
  // DERIVED server-side, not user-set)
  const [topupSelected, setTopupSelected] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Keep the selected amount on a real preset once the day-sized amounts resolve
  // (the initial $25 default isn't one of them). Skip when the user typed a
  // custom amount; the includes-guard prevents a re-render loop and only fires
  // during the initial resolve (no clobber of edits).
  useEffect(() => {
    if (customAmount) return;
    if (presetAmounts.includes(topupSelected)) return;
    setTopupSelected(presetAmounts[1] ?? presetAmounts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey, customAmount]);

  // Auto-topup toggle (arms the flag; amount/threshold are derived) — on by default
  const [enableAutoTopup, setEnableAutoTopup] = useState(true);

  // Portal state
  const [portalLoading, setPortalLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Inline validation error (shown on blur) for the one-off custom amount
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  function handleCustomAmountBlur() {
    if (customAmount && parseFloat(customAmount) < 10) {
      setCustomAmountError("Minimum top-up is $10.");
    } else {
      setCustomAmountError(null);
    }
  }

  const hasValidationError = !!customAmountError;

  const hasAutoTopup = account?.has_auto_topup ?? false;
  // Auto-reload (off_session auto-topup) can be impossible for the saved card's issuing
  // country. Absent/undefined => supported (older billing deploy, today's behavior);
  // only an explicit `false` blocks the auto-topup controls.
  const autoReloadSupported = account?.auto_reload_supported !== false;

  // Credit-balance breakdown — all four lines reconcile so the displayed numbers stop
  // contradicting each other. Math in cents (full-precision decimal strings); format once.
  //   Available           = balance_cents (spendable, net of provisioned holds) — the number to act on
  //   Total credits       = credited_cents (lifetime credited)
  //   Confirmed charges   = credited_cents - actual_balance_cents (actualized usage only)
  //   Provisioned charges = actual_balance_cents - balance_cents (open holds for scheduled follow-ups)
  // Total - Confirmed - Provisioned == Available, by construction.
  const availableCents = account ? parseFloat(account.balance_cents) : 0;
  const totalCreditsCents = account ? parseFloat(account.credited_cents) : 0;
  // actual_balance_cents is absent on older billing deploys; without it the confirmed/provisioned
  // split is unknowable, so collapse to a single "Charges" line (= total - available) rather than
  // show a misleading $0 hold. Available + Total credits are always derivable.
  const actualBalanceStr = account?.actual_balance_cents;
  const hasActualBalance = actualBalanceStr !== undefined && actualBalanceStr !== null;
  const actualBalanceCents = hasActualBalance ? parseFloat(actualBalanceStr as string) : null;
  const confirmedChargesCents = actualBalanceCents !== null ? totalCreditsCents - actualBalanceCents : null;
  const provisionedChargesCents = actualBalanceCents !== null ? actualBalanceCents - availableCents : null;
  const totalChargesCents = totalCreditsCents - availableCents; // confirmed + provisioned

  // Postpaid next-charge progress. Auto-topup is threshold-based: the balance runs
  // NEGATIVE down to a derived credit-line floor (topup_threshold_cents, negative)
  // and a fixed reload (topup_amount_cents) fires when spend crosses it.
  //   creditLineCents       = |negative floor| = the amount of spend that triggers the next charge
  //   spentSinceChargeCents = how far into the line we are = max(0, -available)
  //   nextChargeDate        = the month-end sweep guarantee (billing-service runMonthEndSweep)
  const creditLineCents = Math.abs(account?.topup_threshold_cents ?? 0);
  const topupAmountCents = account?.topup_amount_cents ?? 0;
  const spentSinceChargeCents = Math.max(0, -availableCents);
  const chargePct = creditLineCents > 0 ? Math.min(100, (spentSinceChargeCents / creditLineCents) * 100) : 0;
  const nextChargeDate = lastDayOfMonthLabel();

  // Per-org usage discount (frozen upstream at cost-declaration). Every account number
  // is already NET, so we only READ the rate to render the positive banner. We do NOT
  // reconstruct a gross price for the next-charge figure — with the frozen-net approach
  // the shown amount IS what gets charged, so a struck-through gross would be misleading.
  const usageDiscountPct = account?.usage_discount_pct ?? null;
  const hasUsageDiscount = typeof usageDiscountPct === "number" && usageDiscountPct > 0 && usageDiscountPct < 100;

  // Depleted = AVAILABLE (spendable, net of provisioned holds) at/below zero AND no auto-topup
  // to cover it. Keys on balance_cents — the value spending is actually blocked on — not the
  // gross actual balance (which hid open holds and let the warning never fire while blocked).
  // Auto-topup armed backstops the balance, so suppress the warning then.
  const isDepleted = account ? !hasAutoTopup && availableCents <= 0 : false;

  // Auto-reload unavailable for this card's country: never arm the auto-topup checkbox
  // (its controls are hidden, and handleTopup must not attempt configureAutoTopup).
  useEffect(() => {
    if (!autoReloadSupported) setEnableAutoTopup(false);
  }, [autoReloadSupported]);

  // After successful Stripe checkout, arm auto-topup if it was requested pre-checkout
  // (no card yet). The pending values only set the enabled flag; the reload amount +
  // floor are derived server-side.
  useEffect(() => {
    if (showSuccess && pendingTopup) {
      const topupCents = parseInt(pendingTopup, 10);
      const thresholdCents = pendingThreshold ? parseInt(pendingThreshold, 10) : 500;
      import("@/lib/api").then(({ configureAutoTopup }) =>
        configureAutoTopup(topupCents, thresholdCents)
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      }).catch(() => {});
      // Clean URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("pending_topup");
      url.searchParams.delete("pending_threshold");
      window.history.replaceState({}, "", url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccess, pendingTopup, pendingThreshold]);

  // When the user selects a one-off top-up amount
  function handleSelectTopup(amount: number) {
    setTopupSelected(amount);
    setCustomAmount("");
  }

  async function handleManagePayment() {
    setPortalLoading(true);
    setError(null);
    try {
      const { url } = await createPortalSession(
        `${window.location.origin}${window.location.pathname}`
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open payment portal");
      setPortalLoading(false);
    }
  }

  async function handleTopup() {
    const amountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : topupSelected;
    if (!amountCents || amountCents <= 0) return;

    if (hasValidationError) return;

    setTopupLoading(true);
    setError(null);
    try {
      // If the user already has a payment method, arm/disarm auto-topup now.
      // Otherwise, pass the enabled flag via URL params to arm after checkout.
      if (account?.has_payment_method) {
        if (enableAutoTopup) {
          const { configureAutoTopup } = await import("@/lib/api");
          await configureAutoTopup(AUTO_TOPUP_ENABLE_AMOUNT_CENTS, AUTO_TOPUP_ENABLE_THRESHOLD_CENTS);
        } else if (!enableAutoTopup && hasAutoTopup) {
          const { disableAutoTopup } = await import("@/lib/api");
          await disableAutoTopup();
        }
      }

      // Build success URL — if no payment method yet, pass the pending enable flag
      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      if (enableAutoTopup && !account?.has_payment_method) {
        successUrl.searchParams.set("pending_topup", String(AUTO_TOPUP_ENABLE_AMOUNT_CENTS));
        successUrl.searchParams.set("pending_threshold", String(AUTO_TOPUP_ENABLE_THRESHOLD_CENTS));
      }

      const session = await createCheckoutSession({
        topup_amount_cents: amountCents,
        success_url: successUrl.toString(),
        cancel_url: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
      setTopupLoading(false);
    }
  }

  if (accountPending) {
    return (
      <DashboardPage width="standard">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage your credits and payment method.</p>
        </div>
        <div className="space-y-4 max-w-2xl animate-pulse">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-48" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-16" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-64" />
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="standard">
      <div className="mb-6 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage your credits and payment method.</p>
        </div>
        {/* Manual "Top Up Credits" only when auto-topup is NOT armed — once it's on
            and functional the balance refills itself, so the button is redundant/confusing. */}
        {!hasAutoTopup && (
          <button
            onClick={() => showPaymentRequired({
              balance_cents: account?.balance_cents,
              autoReloadSupported,
              // Size the modal presets to the same org daily burn the page uses, so
              // the modal shows the same amounts ($150/$450/…) + $450 default.
              brandDailyBudgetCents: orgDailyBurnCents || null,
            })}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 sm:w-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Top Up Credits
          </button>
        )}
      </div>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          Payment successful! Your credits have been added.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Usage discount — positive banner, shown only while a discount is active */}
        {hasUsageDiscount && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800">You have {usageDiscountPct}% off all usage</p>
              <p className="mt-0.5 text-xs text-green-700">
                This discount comes off every charge automatically. There is nothing to set up.
              </p>
            </div>
          </div>
        )}

        {/* Credits — balance + breakdown + (when configured) the postpaid auto-topup
            next-charge status folded in as a compact footer. One consolidated card;
            the auto-topup status is dynamic subtext, not its own card. */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {isDepleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-700 font-medium">Credits depleted. Add credits to continue using the platform.</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-gray-500">Available</p>
              <InfoTooltip tip="What you can spend right now: total credits minus confirmed and provisioned charges." />
            </div>
            <p className={`text-3xl font-bold mt-1 ${availableCents <= 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatBillingCents(account?.balance_cents ?? "0")}
            </p>
          </div>

          {/* Breakdown — reconciles to Available so the numbers stop contradicting each other.
              Total credits - Confirmed charges - Provisioned charges == Available. */}
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-gray-500">
                Total credits
                <InfoTooltip tip="Everything added to your account, including top-ups." />
              </dt>
              <dd className="font-medium text-gray-900">{formatBillingCents(account?.credited_cents ?? "0")}</dd>
            </div>

            {confirmedChargesCents !== null && provisionedChargesCents !== null ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    Confirmed charges
                    <InfoTooltip tip="Emails already sent and billed. This won't change." />
                  </dt>
                  <dd className="font-medium text-gray-700">&minus;{formatBillingCents(confirmedChargesCents)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-gray-500">
                    Provisioned charges
                    <InfoTooltip tip="Reserved for follow-up emails we've scheduled. It rises when we plan new follow-ups and drops when one sends (it becomes a confirmed charge) or gets cancelled because a contact replied or couldn't be reached. That's why your available amount changes over time." />
                  </dt>
                  <dd className="font-medium text-gray-700">&minus;{formatBillingCents(provisionedChargesCents)}</dd>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  Charges
                  <InfoTooltip tip="Emails sent and billed, plus credits reserved for follow-up emails we've scheduled." />
                </dt>
                <dd className="font-medium text-gray-700">&minus;{formatBillingCents(totalChargesCents)}</dd>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
              <dt className="flex items-center gap-1.5 font-medium text-gray-700">
                Available
                <InfoTooltip tip="What you can spend right now: total credits minus confirmed and provisioned charges." />
              </dt>
              <dd className={`font-semibold ${availableCents <= 0 ? "text-red-600" : "text-gray-900"}`}>
                {formatBillingCents(account?.balance_cents ?? "0")}
              </dd>
            </div>
          </dl>

          {/* Auto-topup next-charge — dynamic subtext folded into the Credits card. */}
          {hasAutoTopup && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-700">Auto-topup on</span>
                  <InfoTooltip tip="We let your balance run on credit, then charge a fixed amount once your spend reaches the line. The line grows as your account builds a payment history." />
                </div>
                <span className="text-xs text-gray-500">
                  {formatCentsAsUsd(spentSinceChargeCents, 2)} / {formatCentsAsUsd(creditLineCents, 2)} spent
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${chargePct}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Next charge {formatCentsAsUsd(topupAmountCents, 0)}{" "}
                once you&apos;ve spent {formatCentsAsUsd(creditLineCents, 0)}, or on {nextChargeDate}.
              </p>
            </div>
          )}
        </div>

        {/* Payment method — short dedicated section (linked funding source). */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Payment method</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${account?.has_payment_method ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="text-xs text-gray-500">
                    {account?.has_payment_method ? "Card connected" : "No card yet, added at your first top-up"}
                  </span>
                </div>
              </div>
            </div>
            {account?.has_payment_method && (
              <button
                onClick={handleManagePayment}
                disabled={portalLoading}
                className="text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
              >
                {portalLoading ? "Opening..." : "Manage"}
              </button>
            )}
          </div>
        </div>

        {/* Add Credits + enable Auto-Topup — only until auto-topup is configured */}
        {!hasAutoTopup && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add Credits</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {presetAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleSelectTopup(amount)}
                  className={`px-4 py-2 text-sm rounded-lg border transition ${
                    topupSelected === amount && !customAmount
                      ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {formatCentsAsUsd(amount, 0)}
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom $"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setCustomAmountError(null); }}
                onBlur={handleCustomAmountBlur}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 sm:w-28 ${customAmountError ? "border-red-300" : "border-gray-200"}`}
                min="10"
                step="1"
              />
            </div>
            {customAmountError && (
              <p className="text-xs text-red-600 mt-1">{customAmountError}</p>
            )}

            {/* Auto-topup opt-in — the amount + trigger are set automatically (no inputs);
                hidden when the card's country can't be auto-charged */}
            {autoReloadSupported ? (
            <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={enableAutoTopup}
                  onChange={(e) => setEnableAutoTopup(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Enable auto-topup</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    We top you up automatically as you spend, so your campaigns never stop. The amount adjusts to your usage.
                  </p>
                </div>
              </div>
            </div>
            ) : (
              <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Auto-reload not available</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Cards issued in {countryLabel(account?.card_country)}&nbsp;can&apos;t be set up for auto-reload. Add credit any time with the Add Credit button below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleTopup}
              disabled={topupLoading || hasValidationError}
              className="w-full rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
            >
              {topupLoading ? "Redirecting to Stripe..." : `Add ${formatCentsAsUsd(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : topupSelected, 0)}`}
            </button>
          </div>
        )}

        {/* Gifts received — the org's own credit-grants ledger */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-1 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <h2 className="text-lg font-medium text-gray-900">Gifts received</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Free credits we added to your account.</p>

          {grantsPending && grants.length === 0 ? (
            // Static-shell reveal: card frame + title/subtitle stay; skeleton the list
            // while genuinely pending so the "No gifts yet." empty-state never flashes
            // before the fetch settles. Warm persisted cache → instant, no skeleton.
            <div className="space-y-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ) : grants.length === 0 ? (
            <p className="text-sm text-gray-500">No gifts yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {grants.map((grant) => (
                <li key={grant.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{grantLabel(grant.reason)}</p>
                    <p className="text-xs text-gray-500">
                      {formatGrantDate(grant.createdAt)}
                      {grant.note ? ` · ${grant.note}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
                    +{formatBillingCents(grant.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
