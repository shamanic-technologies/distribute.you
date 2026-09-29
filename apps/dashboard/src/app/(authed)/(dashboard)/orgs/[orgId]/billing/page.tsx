"use client";

import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import { creditGrantLabel } from "@/lib/credit-grant-label";
import { paymentReturnBadge, paymentReturnState } from "@/lib/payment-return";
import { DashboardPage } from "@/components/dashboard-page";
import { ComingCreditsCard } from "@/components/billing/coming-credits-card";
import { PaymentFailedBanner } from "@/components/billing/payment-failed-banner";
import { CardChangeConfirmModal } from "@/components/billing/card-change-confirm-modal";
import { CardRemoveConfirmModal } from "@/components/billing/card-remove-confirm-modal";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { Skeleton } from "@/components/skeleton";
import { useBillingController } from "@/components/billing/use-billing-controller";
import {
  CardBrandLogo,
  cardBrandLabel,
  cardExpiryLabel,
  countryFlag,
  countryLabel,
  formatGrantDate,
  paymentStatusBadge,
} from "@/components/billing/billing-display";


export default function BillingPage() {
  const {
    settleCents,
    confirmSource,
    setConfirmSource,
    portalLoadingSource,
    openCardPage,
    settleProblem,
    dismissSettleProblem,
    continueAfterSettleProblem,
    removeConfirmOpen,
    setRemoveConfirmOpen,
    removeConsequence,
    cardLabel,
    removePending,
    handleRemoveCard,
    hasAutoTopup,
    showPaymentRequired,
    account,
    accountPending,
    autoReloadSupported,
    orgDailyBurnCents,
    paymentFailure,
    paymentsStopped,
    handleManagePayment,
    showSuccess,
    error,
    setError,
    hasUsageDiscount,
    usageDiscountPct,
    isDepleted,
    balanceLabel,
    balanceTip,
    availableCents,
    totalCreditsCents,
    confirmedChargesCents,
    provisionedChargesCents,
    totalChargesCents,
    spentSinceChargeCents,
    creditLineCents,
    chargePct,
    topupAmountCents,
    nextChargeDate,
    presetAmounts,
    handleSelectTopup,
    topupSelected,
    customAmount,
    setCustomAmount,
    setCustomAmountError,
    handleCustomAmountBlur,
    customAmountError,
    enableAutoTopup,
    setEnableAutoTopup,
    handleTopup,
    topupLoading,
    hasValidationError,
    grantsPending,
    grants,
    paymentsPending,
    payments,
  } = useBillingController();

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
      {/* Nothing owed means no modal at all: `settleCents` is null and the
          buttons open the card page directly, which is the common case. */}
      {confirmSource !== null && settleCents !== null && (
        <CardChangeConfirmModal
          settleCents={settleCents}
          pending={portalLoadingSource !== null}
          onConfirm={() => void openCardPage(confirmSource)}
          onCancel={settleProblem ? dismissSettleProblem : () => setConfirmSource(null)}
          problem={settleProblem?.problem ?? null}
          onContinue={continueAfterSettleProblem}
        />
      )}
      {removeConfirmOpen && (
        <CardRemoveConfirmModal
          settleCents={settleCents}
          consequence={removeConsequence}
          cardLabel={cardLabel}
          pending={removePending}
          onConfirm={() => void handleRemoveCard()}
          onCancel={() => setRemoveConfirmOpen(false)}
        />
      )}
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

      {/* A refused charge is the first thing to say on this page, so it sits above
          everything else. The retry opens the SAME modal the "Top Up Credits"
          button opens, in its depleted variant when the balance really is out, so
          the two doors never tell different stories.

          `required_cents` is deliberately NOT passed: the modal renders it as
          "Required", and the refused amount is what auto-topup tried to charge,
          not a debt. The presets are already sized to this org's daily burn. */}
      {paymentFailure && (
        <div className="max-w-2xl">
          <PaymentFailedBanner
            failure={paymentFailure}
            stopped={paymentsStopped}
            updatingCard={portalLoadingSource === "manage"}
            onRetry={() =>
              showPaymentRequired({
                balance_cents: account?.balance_cents,
                depleted: paymentsStopped,
                autoReloadSupported,
                brandDailyBudgetCents: orgDailyBurnCents || null,
              })
            }
            onUpdateCard={() => handleManagePayment("manage")}
          />
        </div>
      )}

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
              {/* A negative available balance = postpaid usage running on credit; frame it
                  positively as "Balance" with the absolute amount in green, not a red deficit. */}
              <p className="text-sm text-gray-500">{balanceLabel}</p>
              <InfoTooltip tip={balanceTip} />
            </div>
            <p className={`text-3xl font-bold mt-1 ${availableCents < 0 ? "text-green-600" : availableCents === 0 ? "text-red-600" : "text-gray-900"}`}>
              {formatBillingCents(availableCents < 0 ? Math.abs(availableCents) : account?.balance_cents ?? "0")}
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
                {balanceLabel}
                <InfoTooltip tip={balanceTip} />
              </dt>
              <dd className={`font-semibold ${availableCents < 0 ? "text-green-600" : availableCents === 0 ? "text-red-600" : "text-gray-900"}`}>
                {formatBillingCents(availableCents < 0 ? Math.abs(availableCents) : account?.balance_cents ?? "0")}
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
            <p className="text-sm font-medium text-gray-900">Payment method</p>
            {account?.has_payment_method && (
              // Stacked, the removal under the replacement and quieter than it:
              // replacing is the ordinary thing to do here and removing is the
              // rare one, so the weight says which is which. Deliberately NOT
              // `disabled` at rest: a greyed control with no reason beside it
              // reads as broken rather than as secondary.
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <button
                  onClick={() => handleManagePayment("manage")}
                  disabled={portalLoadingSource !== null}
                  className="text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
                >
                  {portalLoadingSource === "manage" ? "Opening..." : "Change card"}
                </button>
                <button
                  onClick={() => setRemoveConfirmOpen(true)}
                  disabled={portalLoadingSource !== null || removePending}
                  className="text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-50"
                >
                  Remove card
                </button>
              </div>
            )}
          </div>

          {/* Settle notice (Google Ads pattern): a customer running on credit is
              charged what they owe on the CURRENT card when the card page opens.
              The SECOND sentence is load-bearing. The charge used to gate the
              page, which locked out the one customer who needed it (their card
              declines, which is why they came to replace it), so the page now
              opens whatever the charge does and the copy has to say so before
              the click. billing-service does the charge; this only states it.
              The card page itself lets a customer REPLACE a card, never remove
              one (stripe-service owns that). */}
          {settleCents !== null && (
            <p className="mt-2 text-xs text-gray-500">
              Opening this charges your {formatBillingCents(settleCents)} balance to the card on file. We ask before we take it, and you can change your card whether or not it goes through.
            </p>
          )}

          {account?.has_payment_method ? (
            // Card row — network logo tile + masked number on one line, expiry +
            // issuing country as muted secondary (Stripe billing-portal pattern).
            <div className="mt-3 flex items-center gap-3">
              <CardBrandLogo brand={account.card_brand} />
              <div className="min-w-0">
                {account.card_last4 ? (
                  <>
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{cardBrandLabel(account.card_brand)}</span>
                      <span className="mx-1.5 align-middle tracking-[0.2em] text-gray-400" aria-hidden>
                        ••••
                      </span>
                      <span className="font-medium tabular-nums">{account.card_last4}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                      {cardExpiryLabel(account.card_exp_month, account.card_exp_year) && (
                        <span>Expires {cardExpiryLabel(account.card_exp_month, account.card_exp_year)}</span>
                      )}
                      {cardExpiryLabel(account.card_exp_month, account.card_exp_year) && account.card_country && (
                        <span aria-hidden>·</span>
                      )}
                      {account.card_country && (
                        <span className="inline-flex items-center gap-1">
                          {countryFlag(account.card_country) && (
                            <span aria-hidden>{countryFlag(account.card_country)}</span>
                          )}
                          {countryLabel(account.card_country)}
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  // Older billing deploy (no card detail fields yet) — connected +
                  // country only, still on one clean row.
                  <>
                    <p className="flex items-center gap-1.5 text-sm text-gray-900">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Card connected
                    </p>
                    {account.card_country && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                        {countryFlag(account.card_country) && (
                          <span aria-hidden>{countryFlag(account.card_country)}</span>
                        )}
                        Issued in {countryLabel(account.card_country)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-gray-300" />
              <span className="text-xs text-gray-500">No card yet, added at your first top-up</span>
            </div>
          )}

          {/* Non-chargeable card (RBI e-mandate: India + similar) — actionable
              orange callout asking the user to swap to an auto-chargeable card so
              auto-topup unlocks. Owns this message (the passive blue notice in the
              Add Credits block was removed to avoid saying it twice). */}
          {account?.has_payment_method && !autoReloadSupported && (
            <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 flex items-start gap-2">
              <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-orange-800">
                  Auto-topup unavailable for this card
                </p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Cards issued in {countryLabel(account?.card_country)}{" "}can&apos;t be charged
                  automatically (RBI e-mandate rules), so auto-topup stays off. Add a
                  non-Indian card so we can top you up automatically and your campaign can keep running.
                </p>
                <button
                  onClick={() => handleManagePayment("manage")}
                  disabled={portalLoadingSource !== null}
                  className="mt-2 text-sm font-medium text-orange-800 underline underline-offset-2 transition hover:text-orange-900 disabled:opacity-50"
                >
                  {portalLoadingSource === "manage" ? "Opening..." : "Change card"}
                </button>
              </div>
            </div>
          )}
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
            {autoReloadSupported && (
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
                    <p className="text-sm font-medium text-gray-800">{creditGrantLabel(grant.reason)}</p>
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

        {/* On the way — free credits committed but not yet granted (the welcome
            remainder, plus a promise per converting referral). Sits directly under
            the gifts already received, because the distinction between the two is
            the whole point: a gift is in the balance, a promise is not yet. Renders
            nothing when the org has none coming. */}
        <ComingCreditsCard />

        {/* Payments — the org's own Stripe top-up history (PaymentIntents).
            Complements the Stripe-portal "Invoices" button above: customers pay
            via one-off charges, not invoices, so this is where the real payment
            log lives. */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <h2 className="text-lg font-medium text-gray-900">Payments</h2>
            </div>
            {account?.has_payment_method && (
              <button
                onClick={() => handleManagePayment("invoices")}
                disabled={portalLoadingSource !== null}
                className="flex-shrink-0 text-sm font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
              >
                {portalLoadingSource === "invoices" ? "Opening..." : "View invoices"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-4">Every top-up you&apos;ve paid.</p>

          {paymentsPending && payments.length === 0 ? (
            // Static-shell reveal: frame + title/subtitle stay; skeleton the list
            // while pending so the "No payments yet." empty-state never flashes
            // before the fetch settles. Warm persisted cache → instant, no skeleton.
            <div className="space-y-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-0.5">
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payments.map((payment) => {
                // Stripe keeps a refunded top-up `succeeded` at its full amount, so the
                // returned total is what decides the badge and the amount shown. Nothing
                // is hidden or filtered out: the charge stays in the history, tagged.
                const returned = paymentReturnBadge(
                  paymentReturnState(payment.amountCents, payment.amountReturnedCents)
                );
                const badge = returned ?? paymentStatusBadge(payment.status);
                const keptCents = Math.max(0, payment.amountCents - payment.amountReturnedCents);
                return (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {payment.description || "Credit top-up"}
                      </p>
                      <p className="text-xs text-gray-500">{formatGrantDate(payment.createdAt)}</p>
                      {returned && (
                        <p className="text-xs text-gray-500">
                          {formatBillingCents(payment.amountReturnedCents)} returned to your card
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      {returned ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="text-sm text-gray-400 line-through">
                            {formatBillingCents(payment.amountCents)}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatBillingCents(keptCents)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          {formatBillingCents(payment.amountCents)}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
