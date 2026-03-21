"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  createCheckoutSession,
  configureAutoReload,
  disableAutoReload,
  getBillingAccount,
  type BillingAccount,
} from "@/lib/api";

interface PaymentRequiredInfo {
  balance_cents?: number;
  required_cents?: number;
  error?: string;
  /** When true, this is a proactive warning (campaign may exceed credits) rather than a hard 402 block */
  proactive?: boolean;
  /** Callback invoked after the user dismisses the modal having set up auto-reload (proactive flow only) */
  onAutoReloadConfigured?: () => void;
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

  // Auto-reload state
  const [enableAutoReload, setEnableAutoReload] = useState(true);
  const [reloadAmount, setReloadAmount] = useState("25");
  const [reloadThreshold, setReloadThreshold] = useState("5");
  const [reloadAmountError, setReloadAmountError] = useState<string | null>(null);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [savingAutoReload, setSavingAutoReload] = useState(false);

  const hasValidationError = !!(thresholdError || customAmountError || reloadAmountError);

  function handleThresholdBlur() {
    if (!reloadThreshold) {
      setReloadThreshold("5");
      setThresholdError(null);
    } else if (parseFloat(reloadThreshold) < 5) {
      setThresholdError("Minimum threshold is $5.");
    } else {
      setThresholdError(null);
    }
  }

  function handleReloadAmountBlur() {
    if (!reloadAmount) {
      const defaultReload = customAmount ? customAmount : (selectedAmount / 100).toString();
      setReloadAmount(defaultReload);
      setReloadAmountError(null);
    } else if (parseFloat(reloadAmount) < 10) {
      setReloadAmountError("Minimum reload amount is $10.");
    } else {
      setReloadAmountError(null);
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
    setReloadAmount((amount / 100).toString());
    setReloadAmountError(null);
  }

  const showPaymentRequired = useCallback((paymentInfo: PaymentRequiredInfo) => {
    setInfo(paymentInfo);
    // Pre-select the smallest amount that covers the deficit, or default to $25
    if (paymentInfo.required_cents && paymentInfo.balance_cents !== undefined) {
      const deficit = paymentInfo.required_cents - paymentInfo.balance_cents;
      const match = TOPUP_AMOUNTS.find((a) => a >= deficit);
      const picked = match ?? TOPUP_AMOUNTS[TOPUP_AMOUNTS.length - 1];
      setSelectedAmount(picked);
      setReloadAmount((picked / 100).toString());
    } else {
      setSelectedAmount(2500);
      setReloadAmount("25");
    }
    setCustomAmount("");
    setCustomAmountError(null);
    setReloadAmountError(null);
    setThresholdError(null);
    setEnableAutoReload(true);
    setReloadThreshold("5");
    setCheckoutError(null);
    setCheckoutLoading(false);
    setSavingAutoReload(false);
    setVisible(true);

    // Fetch latest account info to pre-fill auto-reload from existing config
    getBillingAccount().then((acct) => {
      setAccount(acct);
      if (acct.hasAutoReload) {
        setEnableAutoReload(true);
        if (acct.reloadAmountCents) setReloadAmount((acct.reloadAmountCents / 100).toString());
        if (acct.reloadThresholdCents) setReloadThreshold((acct.reloadThresholdCents / 100).toString());
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
      // If user already has a payment method, save auto-reload now
      if (account?.hasPaymentMethod) {
        if (enableAutoReload && reloadAmount) {
          const reloadCents = Math.round(parseFloat(reloadAmount) * 100);
          const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : 500;
          await configureAutoReload(reloadCents, thresholdCents);
        } else if (!enableAutoReload && account.hasAutoReload) {
          await disableAutoReload();
        }
      }

      // Build success URL with pending auto-reload params if no payment method yet
      const successUrl = new URL(window.location.href);
      successUrl.searchParams.set("success", "true");
      if (enableAutoReload && reloadAmount && !account?.hasPaymentMethod) {
        const reloadCents = Math.round(parseFloat(reloadAmount) * 100);
        const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : 500;
        successUrl.searchParams.set("pending_reload", reloadCents.toString());
        successUrl.searchParams.set("pending_threshold", thresholdCents.toString());
      }

      const session = await createCheckoutSession({
        reload_amount_cents: effectiveAmountCents,
        success_url: successUrl.toString(),
        cancel_url: window.location.href,
      });
      window.location.href = session.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutLoading(false);
    }
  }

  /** Proactive flow: just configure auto-reload and proceed without checkout */
  async function handleSetupAutoReloadOnly() {
    if (hasValidationError) return;
    if (!enableAutoReload || !reloadAmount) return;
    setSavingAutoReload(true);
    setCheckoutError(null);
    try {
      const reloadCents = Math.round(parseFloat(reloadAmount) * 100);
      const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : 500;
      await configureAutoReload(reloadCents, thresholdCents);
      setVisible(false);
      info.onAutoReloadConfigured?.();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to configure auto-reload");
    } finally {
      setSavingAutoReload(false);
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
                ? "Your campaign budget may exceed your current credit balance. Set up auto-reload to ensure your campaign is never interrupted."
                : "Your account doesn\u2019t have enough credits to complete this action. Add credits to continue."}
            </p>

            {(info.balance_cents !== undefined || info.required_cents !== undefined) && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                {info.balance_cents !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current balance</span>
                    <span className="font-medium text-gray-900">{formatCents(info.balance_cents)}</span>
                  </div>
                )}
                {info.required_cents !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{isProactive ? "Campaign budget" : "Required"}</span>
                    <span className="font-medium text-gray-900">{formatCents(info.required_cents)}</span>
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
                  {formatCents(amount)}
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

            {/* Auto-reload option */}
            <div className="border-t border-gray-100 pt-4 mt-3 mb-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={enableAutoReload}
                  onChange={(e) => setEnableAutoReload(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  id="modal-auto-reload"
                />
                <label htmlFor="modal-auto-reload" className="flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-gray-800">Enable auto-reload</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically add credits when your balance gets low, so your campaigns never stop.
                  </p>
                </label>
              </div>

              {enableAutoReload && (
                <div className="grid grid-cols-2 gap-3 mt-3 ml-7">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Reload amount ($)</label>
                    <input
                      type="number"
                      value={reloadAmount}
                      onChange={(e) => { setReloadAmount(e.target.value); setReloadAmountError(null); }}
                      onBlur={handleReloadAmountBlur}
                      placeholder="e.g. 25"
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${reloadAmountError ? "border-red-300" : "border-gray-200"}`}
                      min="10"
                    />
                    {reloadAmountError && (
                      <p className="text-xs text-red-600 mt-1">{reloadAmountError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">When balance below ($)</label>
                    <input
                      type="number"
                      value={reloadThreshold}
                      onChange={(e) => { setReloadThreshold(e.target.value); setThresholdError(null); }}
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

              {isProactive && enableAutoReload && account?.hasPaymentMethod ? (
                <button
                  onClick={handleSetupAutoReloadOnly}
                  disabled={savingAutoReload || hasValidationError || !reloadAmount}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {savingAutoReload ? "Saving..." : "Enable Auto-Reload & Continue"}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || hasValidationError}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {checkoutLoading ? "Redirecting..." : `Add ${formatCents(effectiveAmountCents || 0)} \u2192`}
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
