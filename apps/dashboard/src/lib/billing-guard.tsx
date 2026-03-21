"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createCheckoutSession } from "@/lib/api";

interface PaymentRequiredInfo {
  balance_cents?: number;
  required_cents?: number;
  error?: string;
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const pathname = usePathname();

  const showPaymentRequired = useCallback((paymentInfo: PaymentRequiredInfo) => {
    setInfo(paymentInfo);
    // Pre-select the smallest amount that covers the deficit, or default to $25
    if (paymentInfo.required_cents && paymentInfo.balance_cents !== undefined) {
      const deficit = paymentInfo.required_cents - paymentInfo.balance_cents;
      const match = TOPUP_AMOUNTS.find((a) => a >= deficit);
      setSelectedAmount(match ?? TOPUP_AMOUNTS[TOPUP_AMOUNTS.length - 1]);
    } else {
      setSelectedAmount(2500);
    }
    setCheckoutError(null);
    setCheckoutLoading(false);
    setVisible(true);
  }, []);

  const dismissPaymentRequired = useCallback(() => {
    setVisible(false);
    setInfo({});
    setCheckoutError(null);
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

  async function handleCheckout() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const currentUrl = window.location.href;
      const session = await createCheckoutSession({
        reload_amount_cents: selectedAmount,
        success_url: currentUrl,
        cancel_url: currentUrl,
      });
      window.location.href = session.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to start checkout");
      setCheckoutLoading(false);
    }
  }

  return (
    <BillingGuardContext.Provider value={{ showPaymentRequired, dismissPaymentRequired }}>
      {children}
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Insufficient Credits</h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              Your account doesn&apos;t have enough credits to complete this action. Add credits to continue.
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
                    <span className="text-gray-500">Required</span>
                    <span className="font-medium text-gray-900">{formatCents(info.required_cents)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick top-up amount selection */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TOPUP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSelectedAmount(amount)}
                  className={`flex-1 min-w-[70px] px-3 py-2 text-sm rounded-lg border transition ${
                    selectedAmount === amount
                      ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {formatCents(amount)}
                </button>
              ))}
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
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
              >
                {checkoutLoading ? "Redirecting..." : `Add ${formatCents(selectedAmount)} →`}
              </button>
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
