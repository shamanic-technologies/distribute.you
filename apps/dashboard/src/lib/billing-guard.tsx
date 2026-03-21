"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

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

export function BillingGuardProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<PaymentRequiredInfo>({});
  const pathname = usePathname();
  const router = useRouter();

  const showPaymentRequired = useCallback((paymentInfo: PaymentRequiredInfo) => {
    setInfo(paymentInfo);
    setVisible(true);
  }, []);

  const dismissPaymentRequired = useCallback(() => {
    setVisible(false);
    setInfo({});
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

  // Extract orgId from pathname for billing link
  const segments = pathname.split("/").filter(Boolean);
  const orgIdIndex = segments.indexOf("orgs");
  const orgId = orgIdIndex >= 0 ? segments[orgIdIndex + 1] : null;

  function handleGoToBilling() {
    setVisible(false);
    if (orgId) {
      router.push(`/orgs/${orgId}/billing`);
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
              Your account doesn&apos;t have enough credits to complete this action.
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

            <div className="flex gap-3">
              <button
                onClick={dismissPaymentRequired}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Dismiss
              </button>
              {orgId && (
                <button
                  onClick={handleGoToBilling}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition"
                >
                  Add Credits
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
