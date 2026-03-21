"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  listBillingTransactions,
  createCheckoutSession,
  createPortalSession,
  type BillingAccount,
  type BillingTransaction,
} from "@/lib/api";

const POLL_INTERVAL = 10_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BillingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  void orgId;
  const queryClient = useQueryClient();

  const showSuccess = searchParams.get("success") === "true";
  const pendingReload = searchParams.get("pending_reload");
  const pendingThreshold = searchParams.get("pending_threshold");

  // Data fetching
  const { data: account, isLoading: accountLoading } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptions,
  );

  const { data: txData, isLoading: txLoading } = useAuthQuery<{ transactions: BillingTransaction[]; has_more: boolean }>(
    ["billingTransactions"],
    () => listBillingTransactions(),
    pollOptions,
  );

  // Top-up state
  const [topupAmount, setTopupAmount] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Auto-reload toggle (integrated into top-up flow) — pre-selected by default
  const [enableAutoReload, setEnableAutoReload] = useState(true);
  const [reloadAmount, setReloadAmount] = useState("25");
  const [reloadThreshold, setReloadThreshold] = useState("5");

  // Portal state
  const [portalLoading, setPortalLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Inline validation errors (shown on blur)
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [reloadAmountError, setReloadAmountError] = useState<string | null>(null);

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
      const defaultReload = customAmount ? customAmount : (topupAmount / 100).toString();
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

  const hasValidationError = !!(thresholdError || customAmountError || reloadAmountError);

  const isDepleted = account ? account.creditBalanceCents <= 0 : false;
  const hasAutoReload = account?.hasAutoReload ?? false;

  // Pre-fill auto-reload fields from existing config
  useEffect(() => {
    if (account?.hasAutoReload) {
      setEnableAutoReload(true);
      if (!reloadAmount && account.reloadAmountCents) setReloadAmount((account.reloadAmountCents / 100).toString());
      if (!reloadThreshold && account.reloadThresholdCents) setReloadThreshold((account.reloadThresholdCents / 100).toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.hasAutoReload, account?.reloadAmountCents, account?.reloadThresholdCents]);

  // After successful Stripe checkout, save pending auto-reload settings
  useEffect(() => {
    if (showSuccess && pendingReload) {
      const reloadCents = parseInt(pendingReload, 10);
      const thresholdCents = pendingThreshold ? parseInt(pendingThreshold, 10) : 500;
      import("@/lib/api").then(({ configureAutoReload }) =>
        configureAutoReload(reloadCents, thresholdCents)
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      }).catch(() => {});
      // Clean URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("pending_reload");
      url.searchParams.delete("pending_threshold");
      window.history.replaceState({}, "", url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSuccess, pendingReload, pendingThreshold]);

  // When the user selects a top-up amount, sync both topup and reload amount
  function handleSelectTopup(amount: number) {
    setTopupAmount(amount);
    setCustomAmount("");
    setReloadAmount((amount / 100).toString());
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
    const amountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : topupAmount;
    if (!amountCents || amountCents <= 0) return;

    if (hasValidationError) return;

    setTopupLoading(true);
    setError(null);
    try {
      // If user already has a payment method, save auto-reload now.
      // Otherwise, pass settings via URL params to save after checkout.
      if (account?.hasPaymentMethod) {
        if (enableAutoReload && reloadAmount) {
          const reloadCents = Math.round(parseFloat(reloadAmount) * 100);
          const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : 500;
          const { configureAutoReload } = await import("@/lib/api");
          await configureAutoReload(reloadCents, thresholdCents);
        } else if (!enableAutoReload && hasAutoReload) {
          const { disableAutoReload } = await import("@/lib/api");
          await disableAutoReload();
        }
      }

      // Build success URL — if no payment method yet, pass pending auto-reload params
      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      if (enableAutoReload && reloadAmount && !account?.hasPaymentMethod) {
        const reloadCents = Math.round(parseFloat(reloadAmount) * 100);
        const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : 500;
        successUrl.searchParams.set("pending_reload", reloadCents.toString());
        successUrl.searchParams.set("pending_threshold", thresholdCents.toString());
      }

      const session = await createCheckoutSession({
        reload_amount_cents: amountCents,
        success_url: successUrl.toString(),
        cancel_url: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
      setTopupLoading(false);
    }
  }

  if (accountLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage your credits and payment method.</p>
        </div>
        <div className="space-y-4 max-w-2xl animate-pulse">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-48" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-64" />
        </div>
      </div>
    );
  }

  const transactions = txData?.transactions ?? [];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
        <p className="text-gray-600">Manage your credits and payment method.</p>
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
        {/* Credit Balance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {isDepleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-700 font-medium">Credits depleted. Add credits to continue using the platform.</p>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Credit Balance</p>
              <p className={`text-3xl font-bold mt-1 ${isDepleted ? "text-red-600" : "text-gray-900"}`}>
                {formatCents(account?.creditBalanceCents ?? 0)}
              </p>
              {hasAutoReload && (
                <p className="text-xs text-gray-400 mt-1">
                  Auto-reload: {formatCents(account!.reloadAmountCents!)} when below {formatCents(account!.reloadThresholdCents ?? 0)}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${account?.hasPaymentMethod ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-500">
                  {account?.hasPaymentMethod ? "Card connected" : "No card"}
                </span>
              </div>
              {account?.hasPaymentMethod && (
                <button
                  onClick={handleManagePayment}
                  disabled={portalLoading}
                  className="mt-1 text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                >
                  {portalLoading ? "Opening..." : "Manage payment method"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Add Credits + Auto-Reload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Add Credits</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {TOPUP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => handleSelectTopup(amount)}
                className={`px-4 py-2 text-sm rounded-lg border transition ${
                  topupAmount === amount && !customAmount
                    ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                }`}
              >
                {formatCents(amount)}
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom $"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setCustomAmountError(null); }}
              onBlur={handleCustomAmountBlur}
              className={`w-28 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${customAmountError ? "border-red-300" : "border-gray-200"}`}
              min="10"
              step="1"
            />
          </div>
          {customAmountError && (
            <p className="text-xs text-red-600 mt-1">{customAmountError}</p>
          )}

          {/* Auto-reload option */}
          <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={enableAutoReload}
                onChange={(e) => setEnableAutoReload(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Enable auto-reload</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Automatically add credits when your balance gets low, so your campaigns never stop.
                </p>
              </div>
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

          <button
            onClick={handleTopup}
            disabled={topupLoading || (enableAutoReload && !reloadAmount) || hasValidationError}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
          >
            {topupLoading ? "Redirecting to Stripe..." : `Add ${formatCents(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : topupAmount)}`}
          </button>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction History</h2>

          {txLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-gray-800">{tx.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      tx.type === "deduction" ? "text-red-600" : "text-green-600"
                    }`}>
                      {tx.type === "deduction" ? "-" : "+"}{formatCents(Math.abs(tx.amount_cents))}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{tx.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
