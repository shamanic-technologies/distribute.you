"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getCreditGrants,
  createCheckoutSession,
  createPortalSession,
  type BillingAccount,
  type CreditGrant,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { formatBillingCents } from "@/lib/format-number";
import { pollOptions } from "@/lib/query-options";
import { DashboardPage } from "@/components/dashboard-page";

const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]; // cents

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

// Small (i) info affordance with a hover/focus tooltip. Full-perimeter 1px border + bg tint
// (no side/top accent). `title` gives a native fallback for touch + screen readers.
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={text}
        title={text}
        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-300"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-60 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 text-xs leading-relaxed text-gray-600 shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

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

  // Credit grants ("gifts received") — the org's own free-credit ledger.
  const { data: grantsData } = useAuthQuery<{ grants: CreditGrant[] }>(
    ["creditGrants"],
    () => getCreditGrants(),
  );
  const grants = grantsData?.grants ?? [];

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

  // Credit breakdown (math in fractional cents; format once at render). The three lines
  // reconcile: total credits − confirmed charges − provisioned charges = available.
  //   credited_cents        = lifetime credited            -> Total credits
  //   actual_balance_cents  = credited minus ACTUALIZED usage only (holds not yet subtracted)
  //   balance_cents         = credited minus usage INCLUDING provisioned holds -> Available (spendable)
  // When actual_balance_cents is absent (older billing deploy) holds are unknown, so fold them
  // into confirmed (actual := balance) and provisioned reads 0 — never a guessed hold value.
  const totalCreditsCents = account?.credited_cents ?? "0";
  const availableCents = account?.balance_cents ?? "0";
  const actualBalanceCents = account?.actual_balance_cents ?? availableCents;
  const confirmedChargesCents = parseFloat(totalCreditsCents) - parseFloat(actualBalanceCents);
  const provisionedChargesCents = parseFloat(actualBalanceCents) - parseFloat(availableCents);

  const hasAutoTopup = account?.has_auto_topup ?? false;
  // Auto-reload (off_session auto-topup) can be impossible for the saved card's issuing
  // country. Absent/undefined => supported (older billing deploy, today's behavior);
  // only an explicit `false` blocks the auto-topup controls.
  const autoReloadSupported = account?.auto_reload_supported !== false;
  // Depleted keys on AVAILABLE (balance_cents, net of provisioned holds) — the number that
  // actually gates spending — NOT the gross actual balance, which can read positive while
  // available is already negative. Suppressed when auto-topup is armed (it backstops the balance).
  const isDepleted = account ? !hasAutoTopup && parseFloat(availableCents) <= 0 : false;

  // Pre-fill auto-topup fields from existing config
  useEffect(() => {
    if (account?.has_auto_topup) {
      setEnableAutoTopup(true);
      if (!topupAmount && account.topup_amount_cents !== null) setTopupAmount((account.topup_amount_cents / 100).toString());
      if (!topupThreshold && account.topup_threshold_cents !== null) setTopupThreshold((account.topup_threshold_cents / 100).toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.has_auto_topup, account?.topup_amount_cents, account?.topup_threshold_cents]);

  // Auto-reload unavailable for this card's country: never arm the auto-topup checkbox
  // (its controls are hidden, and handleTopup must not attempt configureAutoTopup).
  useEffect(() => {
    if (!autoReloadSupported) setEnableAutoTopup(false);
  }, [autoReloadSupported]);

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
      <DashboardPage width="standard">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">Billing</h1>
          <p className="text-gray-600">Manage your credits and payment method.</p>
        </div>
        <div className="space-y-4 max-w-2xl animate-pulse">
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-32" />
          <div className="bg-white rounded-xl border border-gray-200 p-5 h-48" />
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
        <button
          onClick={() => showPaymentRequired({
            balance_cents: account?.balance_cents,
          })}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 sm:w-auto"
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-gray-500">Available</p>
                <InfoTip text="What you can spend right now: total credits minus confirmed and provisioned charges." />
              </div>
              <p className={`text-3xl font-bold mt-1 ${isDepleted ? "text-red-600" : "text-gray-900"}`}>
                {formatBillingCents(availableCents)}
              </p>
            </div>
            <div className="sm:text-right">
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

          {/* Reconciling breakdown: Total credits − Confirmed − Provisioned = Available.
              Makes the numbers stop contradicting each other and explains why Available moves. */}
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                Total credits
                <InfoTip text="Everything added to your account, including top-ups." />
              </span>
              <span className="text-sm font-medium text-gray-900">{formatBillingCents(totalCreditsCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                Confirmed charges
                <InfoTip text="Emails already sent and billed. This won't change." />
              </span>
              <span className="text-sm font-medium text-gray-700">-{formatBillingCents(confirmedChargesCents)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                Provisioned charges
                <InfoTip text="Reserved for follow-up emails we've scheduled. It rises when we plan new follow-ups and drops when one sends (it becomes a confirmed charge) or gets cancelled because a contact replied or couldn't be reached. That's why your available amount changes over time." />
              </span>
              <span className="text-sm font-medium text-gray-700">-{formatBillingCents(provisionedChargesCents)}</span>
            </div>
          </div>
        </div>

        {/* Auto-Topup Settings (when already configured) */}
        {hasAutoTopup ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="text-lg font-medium text-gray-900">Auto-Topup</h2>
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Auto-topup active
                </span>
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
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    onClick={handleSaveTopup}
                    disabled={savingTopup || hasValidationError || !topupAmount}
                    className="w-full rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
                  >
                    {savingTopup ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingTopup(false);
                      if (account?.topup_amount_cents !== null && account?.topup_amount_cents !== undefined) setTopupAmount((account.topup_amount_cents / 100).toString());
                      if (account?.topup_threshold_cents !== null && account?.topup_threshold_cents !== undefined) setTopupThreshold((account.topup_threshold_cents / 100).toString());
                    }}
                    className="w-full px-5 py-2 text-sm text-gray-600 transition hover:text-gray-800 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisableTopup}
                    disabled={disablingTopup}
                    className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50 sm:ml-auto"
                  >
                    {disablingTopup ? "Disabling..." : "Disable auto-topup"}
                  </button>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 sm:w-28 ${customAmountError ? "border-red-300" : "border-gray-200"}`}
                min="10"
                step="1"
              />
            </div>
            {customAmountError && (
              <p className="text-xs text-red-600 mt-1">{customAmountError}</p>
            )}

            {/* Auto-topup option — hidden when the card's country can't be auto-charged */}
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
                    Automatically add credits when your balance gets low, so your campaigns never stop.
                  </p>
                </div>
              </div>

              {enableAutoTopup && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:ml-7 sm:grid-cols-2">
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
            ) : (
              <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Auto-reload not available</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Cards issued in {countryLabel(account?.card_country)} can&apos;t be set up for auto-reload. Add credit any time with the Add Credit button below.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleTopup}
              disabled={topupLoading || (enableAutoTopup && !topupAmount) || hasValidationError}
              className="w-full rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50 sm:w-auto"
            >
              {topupLoading ? "Redirecting to Stripe..." : `Add ${formatBillingCents(customAmount ? Math.round(parseFloat(customAmount) * 100) || 0 : topupSelected)}`}
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

          {grants.length === 0 ? (
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
