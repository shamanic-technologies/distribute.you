"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  listBillingTransactions,
  switchBillingMode,
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

function ModeBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    trial: "bg-blue-100 text-blue-700",
    byok: "bg-purple-100 text-purple-700",
    payg: "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[mode] ?? "bg-gray-100 text-gray-700"}`}>
      {mode.toUpperCase()}
    </span>
  );
}

export default function BillingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgId = params.orgId as string;
  void orgId;
  const queryClient = useQueryClient();

  const showSuccess = searchParams.get("success") === "true";

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

  // Mode switch state
  const [switching, setSwitching] = useState(false);

  // Auto-reload config state
  const [reloadAmount, setReloadAmount] = useState("");
  const [reloadThreshold, setReloadThreshold] = useState("");
  const [savingReload, setSavingReload] = useState(false);
  const [reloadSuccess, setReloadSuccess] = useState(false);

  // Portal state
  const [portalLoading, setPortalLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isDepleted = account ? account.creditBalanceCents <= 0 : false;

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

    setTopupLoading(true);
    setError(null);
    try {
      const session = await createCheckoutSession({
        reload_amount_cents: amountCents,
        success_url: `${window.location.origin}${window.location.pathname}?success=true`,
        cancel_url: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout session");
      setTopupLoading(false);
    }
  }

  async function handleModeSwitch(newMode: "byok" | "payg") {
    setSwitching(true);
    setError(null);
    try {
      await switchBillingMode(newMode);
      await queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch billing mode");
    } finally {
      setSwitching(false);
    }
  }

  async function handleSaveReload() {
    const amountCents = reloadAmount ? Math.round(parseFloat(reloadAmount) * 100) : undefined;
    const thresholdCents = reloadThreshold ? Math.round(parseFloat(reloadThreshold) * 100) : undefined;
    if (!amountCents) return;

    setSavingReload(true);
    setError(null);
    try {
      await switchBillingMode("payg", amountCents, thresholdCents);
      await queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      setReloadSuccess(true);
      setTimeout(() => setReloadSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update auto-reload settings");
    } finally {
      setSavingReload(false);
    }
  }

  if (accountLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage credits, payment methods, and billing mode.</p>
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
        <p className="text-gray-600">Manage credits, payment methods, and billing mode.</p>
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
        {/* Account Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Account Overview</h2>

          {isDepleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm text-amber-700 font-medium">Credits depleted. Add credits to continue using the platform.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Billing Mode</p>
              <div className="mt-1">
                <ModeBadge mode={account?.billingMode ?? "trial"} />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Credit Balance</p>
              <p className={`text-2xl font-bold mt-0.5 ${isDepleted ? "text-red-600" : "text-gray-900"}`}>
                {formatCents(account?.creditBalanceCents ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Method</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-2 h-2 rounded-full ${account?.hasPaymentMethod ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-700">
                  {account?.hasPaymentMethod ? "Connected" : "Not configured"}
                </span>
              </div>
              {account?.hasPaymentMethod && (
                <button
                  onClick={handleManagePayment}
                  disabled={portalLoading}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium disabled:opacity-50"
                >
                  {portalLoading ? "Opening..." : "Manage payment method"}
                </button>
              )}
            </div>
            {account?.reloadAmountCents && (
              <div>
                <p className="text-sm text-gray-500">Auto-Reload</p>
                <p className="text-sm text-gray-700 mt-1">
                  {formatCents(account.reloadAmountCents)} when below {formatCents(account.reloadThresholdCents ?? 0)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top Up */}
        {account?.billingMode === "payg" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add Credits</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {TOPUP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => { setTopupAmount(amount); setCustomAmount(""); }}
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
                onChange={(e) => { setCustomAmount(e.target.value); }}
                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                min="1"
                step="1"
              />
            </div>
            <button
              onClick={handleTopup}
              disabled={topupLoading}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
            >
              {topupLoading ? "Redirecting to Stripe..." : `Add ${formatCents(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : topupAmount)}`}
            </button>
          </div>
        )}

        {/* Auto-Reload Configuration */}
        {account?.billingMode === "payg" && account.hasPaymentMethod && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Auto-Reload</h2>
            <p className="text-sm text-gray-500 mb-4">
              Automatically reload your credits when your balance drops below a threshold.
            </p>

            {reloadSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                Auto-reload settings saved.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reload amount ($)</label>
                <input
                  type="number"
                  value={reloadAmount || (account.reloadAmountCents ? (account.reloadAmountCents / 100).toString() : "")}
                  onChange={(e) => setReloadAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">When balance below ($)</label>
                <input
                  type="number"
                  value={reloadThreshold || (account.reloadThresholdCents ? (account.reloadThresholdCents / 100).toString() : "")}
                  onChange={(e) => setReloadThreshold(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                  min="0"
                />
              </div>
            </div>
            <button
              onClick={handleSaveReload}
              disabled={savingReload || !reloadAmount}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
            >
              {savingReload ? "Saving..." : "Save Auto-Reload"}
            </button>
          </div>
        )}

        {/* Mode Switching */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Billing Mode</h2>
          <p className="text-sm text-gray-500 mb-4">
            Switch between using your own API keys (BYOK) or pay-as-you-go credits (PAYG).
          </p>

          {account?.billingMode === "trial" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                You&apos;re currently on a trial. Choose a billing mode to continue.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleModeSwitch("byok")}
              disabled={switching || account?.billingMode === "byok"}
              className={`p-4 rounded-lg border text-left transition ${
                account?.billingMode === "byok"
                  ? "border-brand-300 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              } disabled:opacity-50`}
            >
              <p className="font-medium text-gray-900 text-sm">BYOK</p>
              <p className="text-xs text-gray-500 mt-1">Bring your own API keys. No credit usage.</p>
              {account?.billingMode === "byok" && (
                <span className="inline-block mt-2 text-xs text-brand-600 font-medium">Current</span>
              )}
            </button>
            <button
              onClick={() => handleModeSwitch("payg")}
              disabled={switching || account?.billingMode === "payg"}
              className={`p-4 rounded-lg border text-left transition ${
                account?.billingMode === "payg"
                  ? "border-brand-300 bg-brand-50"
                  : "border-gray-200 hover:border-gray-300"
              } disabled:opacity-50`}
            >
              <p className="font-medium text-gray-900 text-sm">Pay-as-you-go</p>
              <p className="text-xs text-gray-500 mt-1">Use platform keys, pay per action via credits.</p>
              {account?.billingMode === "payg" && (
                <span className="inline-block mt-2 text-xs text-brand-600 font-medium">Current</span>
              )}
            </button>
          </div>
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
