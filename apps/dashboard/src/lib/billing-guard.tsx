"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  createCheckoutSession,
  configureAutoTopup,
  disableAutoTopup,
  getBillingAccount,
  type BillingAccount,
} from "@/lib/api";
import { formatBillingCents } from "@/lib/format-number";

// API responses now ship cents as decimal strings (billing-service v2). FE-computed
// budgets are still integer cents — accept both shapes everywhere they cross.
interface PaymentRequiredInfo {
  balance_cents?: string | number;
  required_cents?: string | number;
  error?: string;
  /** When true, this is a proactive warning (campaign may exceed credits) rather than a hard 402 block */
  proactive?: boolean;
  /** Callback invoked after the user dismisses the modal having set up auto-topup (proactive flow only) */
  onAutoTopupConfigured?: () => void;
}

function toCentsNumber(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

interface BillingGuardContextValue {
  showPaymentRequired: (info: PaymentRequiredInfo) => void;
  dismissPaymentRequired: () => void;
}

const BillingGuardContext = createContext<BillingGuardContextValue>({
  showPaymentRequired: () => {},
  dismissPaymentRequired: () => {},
});

export function useBillingGuard() {
  return useContext(BillingGuardContext);
}

const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

export function BillingGuardProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<PaymentRequiredInfo>({});
  const [selectedAmount, setSelectedAmount] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const pathname = usePathname();

  // Auto-topup state
  const [enableAutoTopup, setEnableAutoTopup] = useState(true);
  const [topupAmount, setTopupAmount] = useState("25");
  const [topupThreshold, setTopupThreshold] = useState("5");
  const [topupAmountError, setTopupAmountError] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [savingAutoTopup, setSavingAutoTopup] = useState(false);

  const hasValidationError = !!(thresholdError || customAmountError || topupAmountError);

  function handleThresholdBlur() {
    if (!topupThreshold) {
      setTopupThreshold("5");
      setThresholdError(null);
    } else if (parseFloat(topupThreshold) < 5) {
      setThresholdError("Minimum threshold is $5.");
    } else {
      setThresholdError(null);
    }
  }

  function handleTopupAmountBlur() {
    if (!topupAmount) {
      const defaultTopup = customAmount ? customAmount : (selectedAmount / 100).toString();
      setTopupAmount(defaultTopup);
      setTopupAmountError(null);
    } else if (parseFloat(topupAmount) < 10) {
      setTopupAmountError("Minimum top-up amount is $10.");
    } else {
      setTopupAmountError(null);
    }
  }

  function handleCustomAmountBlur() {
    if (customAmount && parseFloat(customAmount) < 10) {
      setCustomAmountError("Minimum top-up is $10.");
    } else {
      setCustomAmountError(null);
    }
  }

  function handleSelectTopup(amount: number) {
    setSelectedAmount(amount);
    setCustomAmount("");
    setCustomAmountError(null);
    setTopupAmount((amount / 100).toString());
    setTopupAmountError(null);
  }

  const showPaymentRequired = useCallback((paymentInfo: PaymentRequiredInfo) => {
    setInfo(paymentInfo);
    // Pre-select the smallest amount that covers the deficit, or default to $25
    if (paymentInfo.required_cents !== undefined && paymentInfo.balance_cents !== undefined) {
      const deficit = toCentsNumber(paymentInfo.required_cents) - toCentsNumber(paymentInfo.balance_cents);
      const match = TOPUP_AMOUNTS.find((a) => a >= deficit);
      const picked = match ?? TOPUP_AMOUNTS[TOPUP_AMOUNTS.length - 1];
      setSelectedAmount(picked);
      setTopupAmount((picked / 100).toString());
    } else {
      setSelectedAmount(2500);
      setTopupAmount("25");
    }
    setCustomAmount("");
    setCustomAmountError(null);
    setTopupAmountError(null);
    setThresholdError(null);
    setEnableAutoTopup(true);
    setTopupThreshold("5");
    setCheckoutError(null);
    setCheckoutLoading(false);
    setSavingAutoTopup(false);
    setVisible(true);

    // Fetch latest account info to pre-fill auto-topup from existing config
    getBillingAccount().then((acct) => {
      setAccount(acct);
      if (acct.hasAutoReload) {
        setEnableAutoTopup(true);
        if (acct.reloadAmountCents) setTopupAmount((parseFloat(acct.reloadAmountCents) / 100).toString());
        if (acct.reloadThresholdCents) setTopupThreshold((parseFloat(acct.reloadThresholdCents) / 100).toString());
      }
    }).catch(() => {});
  }, []);

  const dismissPaymentRequired = useCallback(() => {
    setVisible(false);
    setInfo({});
    setCheckoutError(null);
    setAccount(null);
  }, []);

  // Listen for custom events from the API error handler
  useEffect(() => {
    function handlePaymentRequired(e: Event) {
      const detail = (e as CustomEvent<PaymentRequiredInfo>).detail;
      showPaymentRequired(detail);
    }
    window.addEventListener("billing:payment-required", handlePaymentRequired);
    return () => window.removeEventListener("billing:payment-required", handlePaymentRequired);
  }, [showPaymentRequired]);

  const effectiveAmountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : selectedAmount;

  async function handleCheckout() {
    if (hasValidationError) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      // If user already has a payment method, save auto-topup now
      if (account?.hasPaymentMethod) {
        if (enableAutoTopup && topupAmount) {
          const topupCents = Math.round(parseFloat(topupAmount) * 100);
          const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
          await configureAutoTopup(topupCents, thresholdCents);
        } else if (!enableAutoTopup && account.hasAutoReload) {
          await disableAutoTopup();
        }
      }

      // Build success URL with pending auto-topup params if no payment method yet
      const successUrl = new URL(window.location.href);
      // Mark that this checkout was triggered from a pending action (e.g. campaign creation)
      if (info.proactive) {
        successUrl.searchParams.set("pending_campaign", "true");
      }
      successUrl.searchParams.set("success", "true");
      if (enableAutoTopup && topupAmount && !account?.hasPaymentMethod) {
        const topupCents = Math.round(parseFloat(topupAmount) * 100);
        const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
        successUrl.searchParams.set("pending_topup", topupCents.toString());
        successUrl.searchParams.set("pending_threshold", thresholdCents.toString());
      }

      const session = await createCheckoutSession({
        topup_amount_cents: effectiveAmountCents,
        success_url: successUrl.toString(),
        cancel_url: window.location.href,
      });
      window.location.href = session.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutLoading(false);
    }
  }

  /** Proactive flow: just configure auto-topup and proceed without checkout */
  async function handleSetupAutoTopupOnly() {
    if (hasValidationError) return;
    if (!enableAutoTopup || !topupAmount) return;
    setSavingAutoTopup(true);
    setCheckoutError(null);
    try {
      const topupCents = Math.round(parseFloat(topupAmount) * 100);
      const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
      await configureAutoTopup(topupCents, thresholdCents);
      setVisible(false);
      info.onAutoTopupConfigured?.();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to configure auto-topup");
    } finally {
      setSavingAutoTopup(false);
    }
  }

  const isProactive = info.proactive === true;

  return (
    <BillingGuardContext.Provider value={{ showPaymentRequired, dismissPaymentRequired }}>
      {children}
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isProactive ? "Campaign May Exceed Credits" : "Insufficient Credits"}
              </h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              {isProactive
                ? "Your campaign budget may exceed your current credit balance. Set up auto-topup to ensure your campaign is never interrupted."
                : "Your account doesn\u2019t have enough credits to complete this action. Add credits to continue."}
            </p>

            {(info.balance_cents !== undefined || info.required_cents !== undefined) && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                {info.balance_cents !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current balance</span>
                    <span className="font-medium text-gray-900">{formatBillingCents(info.balance_cents)}</span>
                  </div>
                )}
                {info.required_cents !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{isProactive ? "Campaign budget" : "Required"}</span>
                    <span className="font-medium text-gray-900">{formatBillingCents(info.required_cents)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Top-up amount selection */}
            <h3 className="text-sm font-medium text-gray-800 mb-2">Add Credits</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {TOPUP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleSelectTopup(amount)}
                  className={`flex-1 min-w-[70px] px-3 py-2 text-sm rounded-lg border transition ${
                    selectedAmount === amount && !customAmount
                      ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {formatBillingCents(amount)}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Custom amount ($)"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setCustomAmountError(null); }}
              onBlur={handleCustomAmountBlur}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 mb-1 ${customAmountError ? "border-red-300" : "border-gray-200"}`}
              min="10"
              step="1"
            />
            {customAmountError && (
              <p className="text-xs text-red-600 mb-2">{customAmountError}</p>
            )}

            {/* Auto-topup option */}
            <div className="border-t border-gray-100 pt-4 mt-3 mb-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={enableAutoTopup}
                  onChange={(e) => setEnableAutoTopup(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  id="modal-auto-topup"
                />
                <label htmlFor="modal-auto-topup" className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-gray-800">Enable auto-topup</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically add credits when your balance gets low, so your campaigns never stop.
                  </p>
                </label>
              </div>

              {enableAutoTopup && (
                <div className="grid grid-cols-2 gap-3 mt-3 ml-7">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Top-up amount ($)</label>
                    <input
                      type="number"
                      value={topupAmount}
                      onChange={(e) => { setTopupAmount(e.target.value); setTopupAmountError(null); }}
                      onBlur={handleTopupAmountBlur}
                      placeholder="e.g. 25"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${topupAmountError ? "border-red-300" : "border-gray-200"}`}
                      min="10"
                    />
                    {topupAmountError && (
                      <p className="text-xs text-red-600 mt-1">{topupAmountError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">When balance below ($)</label>
                    <input
                      type="number"
                      value={topupThreshold}
                      onChange={(e) => { setTopupThreshold(e.target.value); setThresholdError(null); }}
                      onBlur={handleThresholdBlur}
                      placeholder="e.g. 5"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${thresholdError ? "border-red-300" : "border-gray-200"}`}
                      min="5"
                    />
                    {thresholdError && (
                      <p className="text-xs text-red-600 mt-1">{thresholdError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {checkoutError && (
              <p className="text-sm text-red-600 mb-3">{checkoutError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={dismissPaymentRequired}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>

              {isProactive && enableAutoTopup && account?.hasPaymentMethod ? (
                <button
                  onClick={handleSetupAutoTopupOnly}
                  disabled={savingAutoTopup || hasValidationError || !topupAmount}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {savingAutoTopup ? "Saving..." : "Enable Auto-Topup & Continue"}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || hasValidationError}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {checkoutLoading ? "Redirecting..." : `Add ${formatBillingCents(effectiveAmountCents || 0)} \u2192`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </BillingGuardContext.Provider>
  );
}

/**
 * Dispatch a 402 payment-required event from non-React code (e.g. API client).
 * The BillingGuardProvider listens for this event.
 */
export function dispatchPaymentRequired(info: PaymentRequiredInfo) {
  window.dispatchEvent(
    new CustomEvent("billing:payment-required", { detail: info })
  );
}
