"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  listOrgRuns,
  createCheckoutSession,
  createPortalSession,
  grantCredits,
  listOrgCreditGrants,
  listAllCreditGrants,
  type BillingAccount,
  type OrgRun,
  type CreditGrant,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { formatBillingCents } from "@/lib/format-number";
import { pollOptions } from "@/lib/query-options";

const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]; // cents
const RUNS_PAGE_SIZE = 10;

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
  const { data: account, isLoading: accountLoading } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptions,
  );

  const [runsPage, setRunsPage] = useState(0);

  // Runs ledger (server-paginated via runs-service proxy)
  const { data: runsData, isLoading: runsLoading } = useAuthQuery<{ runs: OrgRun[]; offset: number; limit?: number }>(
    ["orgRuns", runsPage],
    () => listOrgRuns(RUNS_PAGE_SIZE, runsPage * RUNS_PAGE_SIZE),
    pollOptions,
  );

  // Free-credit grants — this org's grants + the platform-wide ledger (staff oversight).
  const { data: orgGrantsData } = useAuthQuery<{ grants: CreditGrant[] }>(
    ["creditGrants"],
    () => listOrgCreditGrants(),
  );
  const { data: allGrantsData } = useAuthQuery<{ grants: CreditGrant[] }>(
    ["creditGrantsAll"],
    () => listAllCreditGrants(),
  );

  // Grant form state
  const [grantDollars, setGrantDollars] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  async function handleGrant() {
    const amountCents = Math.round(parseFloat(grantDollars) * 100);
    if (!amountCents || amountCents <= 0) {
      setGrantError("Enter an amount greater than $0.");
      return;
    }
    setGrantLoading(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      await grantCredits(amountCents, grantNote.trim());
      setGrantDollars("");
      setGrantNote("");
      setGrantSuccess(`Granted ${formatBillingCents(amountCents)}.`);
      queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      queryClient.invalidateQueries({ queryKey: ["creditGrants"] });
      queryClient.invalidateQueries({ queryKey: ["creditGrantsAll"] });
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : "Failed to grant credits");
    } finally {
      setGrantLoading(false);
    }
  }

  // Top-up state
  const [topupSelected, setTopupSelected] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Auto-topup toggle (integrated into top-up flow) — pre-selected by default
  const [enableAutoTopup, setEnableAutoTopup] = useState(true);
  const [topupAmount, setTopupAmount] = useState("25");
  const [topupThreshold, setTopupThreshold] = useState("5");

  // Edit mode for existing auto-topup config
  const [editingTopup, setEditingTopup] = useState(false);
  const [savingTopup, setSavingTopup] = useState(false);
  const [disablingTopup, setDisablingTopup] = useState(false);

  // Portal state
  const [portalLoading, setPortalLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Inline validation errors (shown on blur)
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);
  const [topupAmountError, setTopupAmountError] = useState<string | null>(null);

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
      const defaultTopup = customAmount ? customAmount : (topupSelected / 100).toString();
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

  const hasValidationError = !!(thresholdError || customAmountError || topupAmountError);

  const isDepleted = account ? parseFloat(account.balance_cents) <= 0 : false;
  const hasAutoTopup = account?.has_auto_topup ?? false;

  // Credit breakdown (math in fractional cents): total − confirmed − provisioned = available.
  // actual_balance_cents absent (older billing deploy) => fold holds into confirmed (provisioned 0).
  const totalCreditsCents = account?.credited_cents ?? "0";
  const availableCents = account?.balance_cents ?? "0";
  const actualBalanceCents = account?.actual_balance_cents ?? availableCents;
  const confirmedChargesCents = parseFloat(totalCreditsCents) - parseFloat(actualBalanceCents);
  const provisionedChargesCents = parseFloat(actualBalanceCents) - parseFloat(availableCents);

  // Pre-fill auto-topup fields from existing config
  useEffect(() => {
    if (account?.has_auto_topup) {
      setEnableAutoTopup(true);
      if (!topupAmount && account.topup_amount_cents !== null) setTopupAmount((account.topup_amount_cents / 100).toString());
      if (!topupThreshold && account.topup_threshold_cents !== null) setTopupThreshold((account.topup_threshold_cents / 100).toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.has_auto_topup, account?.topup_amount_cents, account?.topup_threshold_cents]);

  // After successful Stripe checkout, save pending auto-topup settings
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

  // When the user selects a top-up amount, sync both selected and auto-topup amount
  function handleSelectTopup(amount: number) {
    setTopupSelected(amount);
    setCustomAmount("");
    setTopupAmount((amount / 100).toString());
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
      // If user already has a payment method, save auto-topup now.
      // Otherwise, pass settings via URL params to save after checkout.
      if (account?.has_payment_method) {
        if (enableAutoTopup && topupAmount) {
          const topupCents = Math.round(parseFloat(topupAmount) * 100);
          const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
          const { configureAutoTopup } = await import("@/lib/api");
          await configureAutoTopup(topupCents, thresholdCents);
        } else if (!enableAutoTopup && hasAutoTopup) {
          const { disableAutoTopup } = await import("@/lib/api");
          await disableAutoTopup();
        }
      }

      // Build success URL — if no payment method yet, pass pending auto-topup params
      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      if (enableAutoTopup && topupAmount && !account?.has_payment_method) {
        const topupCents = Math.round(parseFloat(topupAmount) * 100);
        const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
        successUrl.searchParams.set("pending_topup", topupCents.toString());
        successUrl.searchParams.set("pending_threshold", thresholdCents.toString());
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

  async function handleSaveTopup() {
    if (hasValidationError || !topupAmount) return;
    setSavingTopup(true);
    setError(null);
    try {
      const topupCents = Math.round(parseFloat(topupAmount) * 100);
      const thresholdCents = topupThreshold ? Math.round(parseFloat(topupThreshold) * 100) : 500;
      const { configureAutoTopup } = await import("@/lib/api");
      await configureAutoTopup(topupCents, thresholdCents);
      queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      setEditingTopup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update auto-topup settings");
    } finally {
      setSavingTopup(false);
    }
  }

  async function handleDisableTopup() {
    setDisablingTopup(true);
    setError(null);
    try {
      const { disableAutoTopup } = await import("@/lib/api");
      await disableAutoTopup();
      queryClient.invalidateQueries({ queryKey: ["billingAccount"] });
      setEditingTopup(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable auto-topup");
    } finally {
      setDisablingTopup(false);
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

  const orgRuns: OrgRun[] = runsData?.runs ?? [];
  const runsHasNext = orgRuns.length === RUNS_PAGE_SIZE;
  const runsHasPrev = runsPage > 0;

  const orgGrants: CreditGrant[] = orgGrantsData?.grants ?? [];
  const allGrants: CreditGrant[] = allGrantsData?.grants ?? [];

  function formatGrantDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function runRowLabel(run: OrgRun): string {
    if (run.taskName && run.serviceName) return `${run.serviceName}.${run.taskName}`;
    return run.taskName ?? run.serviceName ?? "Run";
  }

  function runRowTimestamp(run: OrgRun): string | null {
    return run.completedAt ?? run.startedAt;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between max-w-2xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage your credits and payment method.</p>
        </div>
        <button
          onClick={() => showPaymentRequired({
            balance_cents: account?.balance_cents,
          })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Top Up Credits
        </button>
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
                {formatBillingCents(account?.balance_cents ?? "0")}
              </p>
              {hasAutoTopup && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Auto-topup active
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${account?.has_payment_method ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="text-sm text-gray-500">
                  {account?.has_payment_method ? "Card connected" : "No card"}
                </span>
              </div>
              {account?.has_payment_method && (
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

          {/* Reconciling breakdown: Total credits − Confirmed − Provisioned = Credit Balance (available). */}
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Total credits</span>
              <span className="text-sm font-medium text-gray-900">{formatBillingCents(totalCreditsCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Confirmed charges</span>
              <span className="text-sm font-medium text-gray-700">-{formatBillingCents(confirmedChargesCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-500">Provisioned charges (reserved for scheduled follow-ups)</span>
              <span className="text-sm font-medium text-gray-700">-{formatBillingCents(provisionedChargesCents)}</span>
            </div>
          </div>
        </div>

        {/* Auto-Topup Settings (when already configured) */}
        {hasAutoTopup ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="text-lg font-medium text-gray-900">Auto-Topup</h2>
              </div>
              {!editingTopup && (
                <button
                  onClick={() => setEditingTopup(true)}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {editingTopup ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveTopup}
                    disabled={savingTopup || hasValidationError || !topupAmount}
                    className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {savingTopup ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingTopup(false);
                      if (account?.topup_amount_cents !== null && account?.topup_amount_cents !== undefined) setTopupAmount((account.topup_amount_cents / 100).toString());
                      if (account?.topup_threshold_cents !== null && account?.topup_threshold_cents !== undefined) setTopupThreshold((account.topup_threshold_cents / 100).toString());
                    }}
                    className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisableTopup}
                    disabled={disablingTopup}
                    className="ml-auto text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50 transition"
                  >
                    {disablingTopup ? "Disabling..." : "Disable auto-topup"}
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Top-up amount</p>
                  <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatBillingCents(account!.topup_amount_cents ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">When balance below</p>
                  <p className="text-lg font-semibold text-gray-900 mt-0.5">{formatBillingCents(account!.topup_threshold_cents ?? 0)}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Add Credits + Auto-Topup (when not yet configured) */
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Add Credits</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {TOPUP_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleSelectTopup(amount)}
                  className={`px-4 py-2 text-sm rounded-lg border transition ${
                    topupSelected === amount && !customAmount
                      ? "border-brand-300 bg-brand-50 text-brand-700 font-medium"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {formatBillingCents(amount)}
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

            {/* Auto-topup option */}
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
                    Automatically add credits when your balance gets low, so your campaigns never stop.
                  </p>
                </div>
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

            <button
              onClick={handleTopup}
              disabled={topupLoading || (enableAutoTopup && !topupAmount) || hasValidationError}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
            >
              {topupLoading ? "Redirecting to Stripe..." : `Add ${formatBillingCents(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : topupSelected)}`}
            </button>
          </div>
        )}

        {/* Grant free credits (staff-only) — drops straight into spendable balance */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Grant free credits</h2>
          <p className="text-xs text-gray-500 mb-4">
            Adds credit to this org&apos;s spendable balance immediately. No card, no charge.
          </p>

          {grantSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {grantSuccess}
            </div>
          )}
          {grantError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">
              {grantError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
              <input
                type="number"
                value={grantDollars}
                onChange={(e) => { setGrantDollars(e.target.value); setGrantError(null); }}
                placeholder="e.g. 50"
                min="0"
                step="1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Note (optional)</label>
              <input
                type="text"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="e.g. onboarding goodwill"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>

          <button
            onClick={handleGrant}
            disabled={grantLoading || !grantDollars}
            className="bg-brand-600 text-white px-6 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium transition"
          >
            {grantLoading ? "Granting..." : "Grant credits"}
          </button>

          {/* This org's grant history */}
          <div className="border-t border-gray-100 pt-4 mt-5">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Credit grants for this org</h3>
            {orgGrants.length === 0 ? (
              <p className="text-sm text-gray-500">No grants yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {orgGrants.map((g) => (
                  <div key={g.id} className="flex items-start justify-between py-2.5">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm text-gray-800">{g.note || <span className="text-gray-400">No note</span>}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {g.grantedBy ?? "—"} · {formatGrantDate(g.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-green-600 whitespace-nowrap">
                      +{formatBillingCents(g.amountCents)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Runs Ledger — per-run cost history (sourced from runs-service) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Runs</h2>
          </div>

          {runsLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg" />
              ))}
            </div>
          ) : orgRuns.length === 0 ? (
            <p className="text-sm text-gray-500">No runs yet.</p>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {orgRuns.map((run) => {
                  const ts = runRowTimestamp(run);
                  const cost = run.ownCostInUsdCents ? parseFloat(run.ownCostInUsdCents) : 0;
                  return (
                    <div key={run.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-gray-800">{runRowLabel(run)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {ts
                            ? new Date(ts).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">
                          -{formatBillingCents(Math.abs(cost))}
                        </p>
                        <p className="text-xs text-gray-400 capitalize">{run.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(runsHasPrev || runsHasNext) && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                  <p className="text-xs text-gray-400">
                    Page {runsPage + 1}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRunsPage((p) => Math.max(0, p - 1))}
                      disabled={!runsHasPrev}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setRunsPage((p) => p + 1)}
                      disabled={!runsHasNext}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Platform-wide grant ledger — every free credit ever issued, across all orgs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-medium text-gray-900 mb-1">All credit grants</h2>
          <p className="text-xs text-gray-500 mb-4">
            Every free-credit grant issued so far, across all orgs.
          </p>
          {allGrants.length === 0 ? (
            <p className="text-sm text-gray-500">No grants issued yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Org</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">By</th>
                    <th className="py-2 pr-3 font-medium">Note</th>
                    <th className="py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allGrants.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs text-gray-500" title={g.orgId}>
                        {g.orgId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-green-600 whitespace-nowrap">
                        +{formatBillingCents(g.amountCents)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{g.grantedBy ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-gray-600">{g.note || <span className="text-gray-400">—</span>}</td>
                      <td className="py-2.5 text-gray-400 whitespace-nowrap">{formatGrantDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
