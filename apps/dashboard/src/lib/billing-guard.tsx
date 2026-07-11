"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  createEmbeddedCheckoutSession,
  configureAutoTopup,
  getBillingAccount,
  type BillingAccount,
} from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import { topupPresetsForDailyBudget } from "@/lib/credit-runway";

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
  /** Callback invoked once credit has been successfully added (embedded checkout completed
   *  or auto-topup configured on an existing card), so an explicit caller can resume its
   *  blocked action. The decoupled `billing:resolved` window event covers auto-fired 402s. */
  onComplete?: () => void;
  /** Suggested auto-topup reload amount (cents) — proactive flow pre-fills the "Top-up amount"
   *  field with this (= campaign daily price × 10) instead of the flat $25 default. */
  suggestedTopupCents?: number;
  /** Depletion variant (non-proactive): balance is exhausted and campaigns have
   *  stopped. Tailors the modal copy from "needed for this action" to the
   *  arrival-time "all campaigns stopped" message. */
  depleted?: boolean;
  /** Off-session auto-reload is possible for the card's country. When `false`
   *  (e.g. India / RBI e-mandates) auto-topup can never be enabled, so the modal
   *  drops the auto-topup config and becomes a plain one-time recharge. Passed by
   *  the caller (it already has the account) to avoid a config→recharge flash;
   *  falls back to the fetched account when omitted. */
  autoReloadSupported?: boolean;
  /** The in-scope brand's saved daily budget (cents). When present, the top-up
   *  amount buttons annotate each preset with how many days it buys at this
   *  brand's daily budget (amount ÷ dailyBudget). Omitted (org-level callers
   *  with no single brand) → amounts render without a day-equivalent. */
  brandDailyBudgetCents?: number | null;
}

function toCentsNumber(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
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


export function BillingGuardProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<PaymentRequiredInfo>({});
  const [selectedAmount, setSelectedAmount] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // When set, the modal body renders the in-page Embedded Checkout (card iframe)
  // instead of the amount/auto-topup form — no redirect to a hosted Stripe page.
  const [embeddedSecret, setEmbeddedSecret] = useState<string | null>(null);
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
    // Presets are sized to N days of the in-scope brand's daily budget (flat
    // fallback when none). Pre-select the smallest that covers the deficit, else
    // default to the middle (15-day) tier — mirrors the old "$25 default" slot.
    const presets = topupPresetsForDailyBudget(paymentInfo.brandDailyBudgetCents ?? null);
    if (paymentInfo.required_cents !== undefined && paymentInfo.balance_cents !== undefined) {
      const deficit = toCentsNumber(paymentInfo.required_cents) - toCentsNumber(paymentInfo.balance_cents);
      const match = presets.find((a) => a >= deficit);
      const picked = match ?? presets[presets.length - 1];
      setSelectedAmount(picked);
      setTopupAmount((picked / 100).toString());
    } else {
      const picked = presets[1] ?? presets[0];
      setSelectedAmount(picked);
      setTopupAmount((picked / 100).toString());
    }
    // Proactive (campaign-launch) flow: default the auto-topup reload to the campaign's
    // daily price × 10 (passed as suggestedTopupCents), overriding the chip-derived amount.
    if (paymentInfo.suggestedTopupCents !== undefined && paymentInfo.suggestedTopupCents > 0) {
      setTopupAmount(Math.round(paymentInfo.suggestedTopupCents / 100).toString());
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
    setEmbeddedSecret(null);
    setVisible(true);

    // Fetch latest account info to pre-fill auto-topup from existing config
    getBillingAccount().then((acct) => {
      setAccount(acct);
      if (acct.has_auto_topup) {
        setEnableAutoTopup(true);
        if (acct.topup_amount_cents !== null) setTopupAmount((acct.topup_amount_cents / 100).toString());
        if (acct.topup_threshold_cents !== null) setTopupThreshold((acct.topup_threshold_cents / 100).toString());
      }
    }).catch(() => {});
  }, []);

  const dismissPaymentRequired = useCallback(() => {
    setVisible(false);
    setInfo({});
    setCheckoutError(null);
    setAccount(null);
    setEmbeddedSecret(null);
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

  // Open the in-page Embedded Checkout (card iframe) for a one-time top-up of
  // effectiveAmountCents — no redirect to a hosted Stripe page. The session saves
  // the card off-session; the chosen auto-topup config is applied in
  // handleEmbeddedComplete once the card is visible.
  async function handleCheckout() {
    if (hasValidationError) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { client_secret } = await createEmbeddedCheckoutSession(effectiveAmountCents);
      setEmbeddedSecret(client_secret);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Stripe fires this when the embedded session completes (redirect_on_completion:"never").
  // Card + top-up credit land via the checkout.session.completed webhook; here we apply
  // the chosen auto-topup once the saved card is visible, then signal resume.
  async function handleEmbeddedComplete() {
    let acct: BillingAccount | null = null;
    for (let i = 0; i < 8; i++) {
      try {
        acct = await getBillingAccount();
        if (acct.has_payment_method) break;
      } catch {
        /* transient (webhook still reconciling the saved card) — retry */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    // Skip auto-topup config when the card's country can't be auto-charged —
    // the recharge variant only adds one-time credit.
    const autoTopupBlocked =
      info.autoReloadSupported === false || acct?.auto_reload_supported === false;
    try {
      if (enableAutoTopup && topupAmount && acct?.has_payment_method && !autoTopupBlocked) {
        const topupCents = Math.round(parseFloat(topupAmount) * 100);
        const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
        await configureAutoTopup(topupCents, thresholdCents);
      }
    } catch (err) {
      console.error("[dashboard] auto-topup config after embedded checkout failed:", err);
    }
    // Signal any blocked caller (onboarding step, proactive launch) to resume.
    window.dispatchEvent(new CustomEvent("billing:resolved"));
    info.onComplete?.();
    setEmbeddedSecret(null);
    setVisible(false);
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
      window.dispatchEvent(new CustomEvent("billing:resolved"));
      info.onAutoTopupConfigured?.();
      info.onComplete?.();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to configure auto-topup");
    } finally {
      setSavingAutoTopup(false);
    }
  }

  const isProactive = info.proactive === true;
  const isDepleted = info.depleted === true;
  // Auto-reload impossible for this card's country (e.g. India). Prefer the
  // caller-supplied flag (no flash), fall back to the fetched account.
  const autoTopupBlocked =
    info.autoReloadSupported === false || account?.auto_reload_supported === false;
  // A proactive nudge for a blocked brand has nothing to "turn on" — render it as
  // a one-time recharge (amount selector + Add $X, no auto-topup config).
  const rechargeOnly = autoTopupBlocked;
  // Proactive == wallet runway protection. It's not a "you might run out" warning:
  // auto-topup keeps the org wallet funded while brand daily budgets cap allocation.
  const proactiveTitle = "Keep the wallet funded.";
  const proactiveDescription =
    "Your credits live in an org-level wallet. Auto-top-up adds credits when the balance runs low, while each brand daily budget stays the spend cap. You can pause the campaign at any time.";
  // Recharge variant (auto-reload-blocked card): no auto-topup to offer, so frame
  // the modal as a plain top-up.
  const rechargeTitle = "Add credits to keep going.";
  const rechargeDescription =
    "Auto-top-up isn't available for your card's country, so add credits to keep your campaigns running. Each brand daily budget stays the spend cap.";
  // Top-up presets sized to N days of the in-scope brand's daily budget (5/15/45/
  // 135 days). Falls back to flat dollar presets when no brand budget was passed
  // (org-level caller) or it's 0/unset.
  const brandDailyBudgetCents = info.brandDailyBudgetCents ?? null;
  const presetAmounts = topupPresetsForDailyBudget(brandDailyBudgetCents);

  return (
    <BillingGuardContext.Provider value={{ showPaymentRequired, dismissPaymentRequired }}>
      {children}
      {visible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {embeddedSecret ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Add credits</h2>
                  <button
                    onClick={dismissPaymentRequired}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <EmbeddedCheckoutProvider
                  stripe={getStripe()}
                  options={{ clientSecret: embeddedSecret, onComplete: handleEmbeddedComplete }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
            <>
            <div className="flex items-center gap-3 mb-4">
              {isProactive ? (
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              ) : (
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                {isProactive && rechargeOnly
                  ? rechargeTitle
                  : isProactive
                    ? proactiveTitle
                    : isDepleted
                      ? "All campaigns stopped"
                      : "Insufficient Credits"}
              </h2>
            </div>

            <p className="text-gray-600 text-sm mb-4">
              {isProactive && rechargeOnly
                ? rechargeDescription
                : isProactive
                  ? proactiveDescription
                  : isDepleted
                    ? rechargeOnly
                      ? "You\u2019re out of credit, so your campaigns have stopped. Add credits to get them running again."
                      : "You\u2019re out of credit, so your campaigns have stopped. Add credits to get them running again \u2014 or turn on auto-topup so they never stop."
                    : "Your account doesn\u2019t have enough credits to complete this action. Add credits to continue."}
            </p>

            {/* Proactive wallet protection: show the brand daily budget cap, never
                frame it as a campaign checkout price. */}
            {isProactive && !rechargeOnly ? (
              info.required_cents !== undefined && (
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 mb-4 flex justify-between items-center text-sm">
                  <span className="text-brand-700">Brand daily budget cap</span>
                  {/* Daily budget always renders as whole dollars (no cents). */}
                  <span className="font-semibold text-brand-900">${Math.round(toCentsNumber(info.required_cents) / 100).toLocaleString("en-US")} <span className="font-normal text-brand-600">/ day</span></span>
                </div>
              )
            ) : (
              (info.balance_cents !== undefined || info.required_cents !== undefined) && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                  {info.balance_cents !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current balance</span>
                      <span className="font-medium text-gray-900">{formatBillingCents(info.balance_cents)}</span>
                    </div>
                  )}
                  {info.required_cents !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Required</span>
                      <span className="font-medium text-gray-900">{formatBillingCents(info.required_cents)}</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Top-up amount selection — hard-block (insufficient credits) or the
                recharge variant (auto-reload-blocked card). */}
            {(!isProactive || rechargeOnly) && (
              <>
                <h3 className="text-sm font-medium text-gray-800 mb-2">Add Credits</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleSelectTopup(amount)}
                      className={`flex-1 min-w-[70px] px-3 py-2 text-sm rounded-lg border transition ${
                        selectedAmount === amount && !customAmount
                          ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                          : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {formatCentsAsUsd(amount, 0)}
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
              </>
            )}

            {/* Auto-topup option — omitted when the card's country can't auto-reload */}
            {!rechargeOnly && (
            <div className={`border-gray-100 mb-4 ${isProactive ? "" : "border-t pt-4 mt-3"}`}>
              {isProactive ? (
                <div>
                  <p className="text-sm font-medium text-gray-800">Auto-top-up</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Automatically add org wallet credits when your balance gets low, so your campaigns keep running.
                  </p>
                </div>
              ) : (
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
              )}

              {(isProactive || enableAutoTopup) && (
                <div className={`grid grid-cols-2 gap-3 mt-3 ${isProactive ? "" : "ml-7"}`}>
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
            )}

            {checkoutError && (
              <p className="text-sm text-red-600 mb-3">{checkoutError}</p>
            )}

            {isProactive && !rechargeOnly && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Org-level wallet
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Pause anytime
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Brand budget cap
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={dismissPaymentRequired}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>

              {isProactive && !rechargeOnly ? (
                account?.has_payment_method ? (
                  <button
                    onClick={handleSetupAutoTopupOnly}
                    disabled={savingAutoTopup || hasValidationError || !topupAmount}
                    className={`flex-[2] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition ${savingAutoTopup ? "cursor-wait" : "disabled:opacity-50 disabled:cursor-not-allowed"}`}
                  >
                    {savingAutoTopup && <Spinner />}
                    {savingAutoTopup ? "Turning on…" : "Turn on auto-top-up →"}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckout}
                    disabled={checkoutLoading || hasValidationError || !topupAmount}
                    className={`flex-[2] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition ${checkoutLoading ? "cursor-wait" : "disabled:opacity-50 disabled:cursor-not-allowed"}`}
                  >
                    {checkoutLoading && <Spinner />}
                    {checkoutLoading ? "Loading…" : `Load ${formatCentsAsUsd(effectiveAmountCents || 0, 0)} & turn on auto-top-up →`}
                  </button>
                )
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || hasValidationError}
                  className="flex-[2] px-4 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {checkoutLoading ? "Loading\u2026" : `Add ${formatCentsAsUsd(effectiveAmountCents || 0, 0)} \u2192`}
                </button>
              )}
            </div>
            </>
            )}
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
