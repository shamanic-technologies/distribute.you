"use client";

import { offersNoFreeMoney } from "@/lib/v2/get-started";
import { useState } from "react";
import { configureAutoTopup, disableAutoTopup, getOrgUsage } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollIntervalFor } from "@/lib/query-options";
import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import { creditGrantLabel } from "@/lib/credit-grant-label";
import { paymentReturnBadge, paymentReturnState } from "@/lib/payment-return";
import { paymentModeOf, type BillingMode } from "@/lib/payment-mode";
import { postpaidOwed } from "@/lib/v2/pay-balance";
import { LossDialog, SubscriptionPlan } from "@/components/v2/subscription-plan";
import {
  AUTO_TOPUP_ENABLE_AMOUNT_CENTS,
  AUTO_TOPUP_ENABLE_THRESHOLD_CENTS,
  useBillingController,
} from "@/components/billing/use-billing-controller";
import {
  CardBrandLogo,
  cardBrandLabel,
  cardExpiryLabel,
  countryFlag,
  countryLabel,
  formatGrantDate,
} from "@/components/billing/billing-display";
import { ComingCreditsCard } from "@/components/billing/coming-credits-card";
import { PaymentFailedBanner } from "@/components/billing/payment-failed-banner";
import { CardChangeConfirmModal } from "@/components/billing/card-change-confirm-modal";
import { CardRemoveConfirmModal } from "@/components/billing/card-remove-confirm-modal";
import { EmptyNote, Shimmer, TopBar } from "@/components/v2/ui";
import { CreditBalanceCard, PostpaidOwedCard } from "@/components/v2/balance-hero";
import { MonthlyLimitCard } from "@/components/v2/monthly-limit-card";

/**
 * Billing, in the v2 frame.
 *
 * Every read and every action that moves money is `useBillingController`, the SAME
 * hook the v1 page runs: opening the card page asks before it settles, removing the
 * card re-reads instead of reloading, a top-up arms auto top-up the same way. This
 * file only draws, in Keel's settings layout (a title and what it is for, beside the
 * card), and states how the org pays (prepaid or postpaid) as a tag. The mode is set
 * by staff, never by the customer (owner 2026-10-01), so the page shows it and offers
 * no switch; its rules are billing-service's and its words are `lib/payment-mode`.
 */

const MODE_COPY: Record<BillingMode, { title: string; line: string; detail: string }> = {
  prepaid: {
    title: "Prepaid",
    line: "You spend what you have paid in. Your campaigns pause at $0.",
    detail: "No card needed. With a card on file, auto top-up can add credit when you run out.",
  },
  postpaid: {
    title: "Postpaid",
    line: "Your campaigns run on credit and your card is charged as you spend.",
    detail: "Needs a card we can charge automatically. The credit grows as you pay.",
  },
  subscription: {
    title: "Monthly plan",
    line: "Your plan's monthly payment becomes credit, and your campaigns spend it.",
    detail: "Sending stops when the month's credit runs out. Add more to your plan to reach more leads.",
  },
};

function Section({
  id,
  title,
  description,
  children,
  first = false,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section
      id={id}
      className={`grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 ${first ? "" : "k-line-subtle mt-8 border-t pt-8"}`}
    >
      <div>
        <h2 className="text-[14px] font-medium leading-5">{title}</h2>
        <p className="k-fg3 mt-1 text-[12px] leading-[18px]">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Note({ tone, children }: { tone: "rose" | "amber" | "teal"; children: React.ReactNode }) {
  return (
    <div
      className="k-card mb-4 flex items-start gap-2 px-4 py-3 text-[13px]"
      style={{ boxShadow: `inset 0 0 0 1px var(--data-${tone})` }}
    >
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `var(--data-${tone})` }} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function V2BillingPage() {
  const c = useBillingController();
  const queryClient = useQueryClient();
  const account = c.account;
  const mode = paymentModeOf(account);

  // A plan's card: what stops is stated before the usual removal confirmation.
  const [cardLossOpen, setCardLossOpen] = useState(false);
  const [autoPending, setAutoPending] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  async function refetchMoney() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["billingAccount"] }),
      queryClient.refetchQueries({ queryKey: ["billingPayments"] }),
    ]).catch((err) => console.error("[billing v2] refetch after write failed:", err));
  }

  async function toggleAutoTopup(on: boolean) {
    setAutoPending(true);
    setAutoError(null);
    try {
      if (on) await configureAutoTopup(AUTO_TOPUP_ENABLE_AMOUNT_CENTS, AUTO_TOPUP_ENABLE_THRESHOLD_CENTS);
      else await disableAutoTopup();
    } catch (err) {
      console.error("[billing v2] auto top-up change failed:", err);
      setAutoError("We could not change auto top-up. Please try again.");
      setAutoPending(false);
      return;
    }
    await refetchMoney();
    setAutoPending(false);
  }

  const available = c.availableCents;
  const onCredit = available < 0;
  const balanceFigure = formatBillingCents(onCredit ? Math.abs(available) : account?.balance_cents ?? "0");
  const expiry = cardExpiryLabel(account?.card_exp_month, account?.card_exp_year);
  const owed = postpaidOwed(account);
  const cardName =
    account?.card_brand && account?.card_last4 ? `${cardBrandLabel(account.card_brand)} ending ${account.card_last4}` : null;
  const customCents = c.customAmount ? Math.round(parseFloat(c.customAmount) * 100) || 0 : c.topupSelected;

  const sub = c.accountPending
    ? "Your balance, how you pay, and every payment."
    : mode === null
      ? `${onCredit ? `${balanceFigure} over your credit` : `${balanceFigure} available`}.`
      : mode === "postpaid" && owed.owedCents !== null
        ? `${MODE_COPY[mode].title}. Current balance ${formatCentsAsUsd(owed.owedCents, 2)}.`
        : `${MODE_COPY[mode].title}. ${onCredit ? `${balanceFigure} over your credit` : `${balanceFigure} available`}.`;

  return (
    <>
      <TopBar crumbs={[{ label: "Account" }, { label: "Billing" }]} />
      <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-6">
        {/* The money modals are v1's own components: one confirmation per charge path.
            `v2-embed` gives them the Keel look. */}
        <div className="v2-embed">
          {c.confirmSource !== null && c.settleCents !== null && (
            <CardChangeConfirmModal
              settleCents={c.settleCents}
              pending={c.portalLoadingSource !== null}
              onConfirm={() => void c.openCardPage(c.confirmSource!)}
              onCancel={c.settleProblem ? c.dismissSettleProblem : () => c.setConfirmSource(null)}
              problem={c.settleProblem?.problem ?? null}
              onContinue={c.continueAfterSettleProblem}
            />
          )}
          {cardLossOpen && (
            <LossDialog
              title="Remove card"
              question="Remove the card that pays for your plan? Here is what stops."
              confirmLabel="Remove anyway"
              keepLabel="Keep my card"
              pending={false}
              onConfirm={() => {
                setCardLossOpen(false);
                c.setRemoveConfirmOpen(true);
              }}
              onKeep={() => setCardLossOpen(false)}
            />
          )}
          {c.removeConfirmOpen && (
            <CardRemoveConfirmModal
              settleCents={c.settleCents}
              consequence={c.removeConsequence}
              cardLabel={c.cardLabel}
              pending={c.removePending}
              onConfirm={() => void c.handleRemoveCard()}
              onCancel={() => c.setRemoveConfirmOpen(false)}
            />
          )}
        </div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">Billing</h1>
            <p className="k-fg2 mt-1 text-[14px]">{sub}</p>
          </div>
          {/* Postpaid runs on credit, a plan raises its plan: only prepaid adds credit (owner 2026-10-21). */}
          {mode === "prepaid" && !c.hasAutoTopup && !c.accountPending && (
            <button
              type="button"
              className="k-btn-accent"
              onClick={() =>
                c.showPaymentRequired({
                  balance_cents: account?.balance_cents,
                  autoReloadSupported: c.autoReloadSupported,
                  brandDailyBudgetCents: c.orgDailyBurnCents || null,
                })
              }
            >
              Add credit
            </button>
          )}
        </div>

        {c.paymentFailure && (
          <div className="v2-embed mb-4">
            <PaymentFailedBanner
              failure={c.paymentFailure}
              stopped={c.paymentsStopped}
              updatingCard={c.portalLoadingSource === "manage"}
              onRetry={() =>
                // Postpaid has no Pay now: a declined card is fixed by changing it (billing-guard
                // settles what is owed on the new card).
                mode === "postpaid"
                  ? c.handleManagePayment("manage")
                  : c.showPaymentRequired({
                  balance_cents: account?.balance_cents,
                  depleted: c.paymentsStopped,
                  autoReloadSupported: c.autoReloadSupported,
                  brandDailyBudgetCents: c.orgDailyBurnCents || null,
                })
              }
              onUpdateCard={() => c.handleManagePayment("manage")}
            />
          </div>
        )}
        {c.showSuccess && <Note tone="teal">Payment received. Your credit has been added.</Note>}
        {c.error && <Note tone="rose">{c.error}</Note>}
        {mode === "prepaid" && c.isDepleted && (
          <Note tone="amber">Your credit has run out. Add credit to keep your campaigns running.</Note>
        )}
        {mode === "postpaid" && account && !account.has_payment_method && (
          <Note tone="amber">Add a card so your campaigns can run on credit.</Note>
        )}

        {/* Balance: ONE figure answering the mode's question, its parts as a stacked bar
            (owner 2026-10-29: four equal KPI cells read « le moins clair du monde »). Postpaid
            reads like Google Ads, prepaid like the OpenAI / Anthropic consoles, a plan like Vercel. */}
        <Section
          id="balance"
          first
          title="Balance"
          description={
            mode === "postpaid"
              ? "What you have spent so far, and when your card is charged."
              : "What you can still spend, and where your credit went."
          }
        >
          {c.accountPending ? (
            <div className="k-card space-y-3 p-5">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-8 w-32" />
              <Shimmer className="h-2 w-full" />
            </div>
          ) : mode === "postpaid" ? (
            <PostpaidOwedCard
              owed={owed}
              nextChargeDate={c.nextChargeDate}
              charging={!!account?.has_payment_method && c.autoReloadSupported}
              cardName={cardName}
              provisionedCents={c.provisionedChargesCents}
              discountPct={c.hasUsageDiscount ? c.usageDiscountPct : null}
            />
          ) : (
            <CreditBalanceCard
              availableCents={c.availableCents}
              creditedCents={parseFloat(account?.credited_cents ?? "0")}
              spentCents={c.confirmedChargesCents}
              provisionedCents={c.provisionedChargesCents}
              chargesCents={c.totalChargesCents}
              discountPct={c.hasUsageDiscount ? c.usageDiscountPct : null}
              nextPayment={mode === "subscription" ? "next monthly payment" : "next top-up"}
            />
          )}
        </Section>

        {/* The monthly plan, for an org on one: its own row, the Balance strip's anatomy. */}
        {mode === "subscription" && (
          <Section
            id="plan"
            title="Plan"
            description="What you pay each month becomes credit for your outreach. Pick a bigger amount to reach more leads."
          >
            <SubscriptionPlan />
          </Section>
        )}

        {/* How you pay: a tag, set by staff. */}
        <Section
          id="payment-mode"
          title="How you pay"
          description="Set by our team for your account. Write to us if you want it changed."
        >
          {c.accountPending ? (
            <Shimmer className="h-24" />
          ) : (
            <>
              {mode === null ? (
                <p className="k-fg3 text-[12px]">We could not read how this account pays right now.</p>
              ) : (
                <div className="k-card p-4">
                  <span className="k-chip">{MODE_COPY[mode].title}</span>
                  <p className="k-fg mt-2 text-[13px] leading-5">{MODE_COPY[mode].line}</p>
                  <p className="k-fg3 mt-1 text-[12px] leading-[18px]">{MODE_COPY[mode].detail}</p>
                </div>
              )}

              {/* Auto top-up, in the words of the mode it serves. */}
              {mode === "prepaid" && account?.has_payment_method && c.autoReloadSupported && (
                <div className="k-card mt-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">Auto top-up</p>
                      <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">
                        {c.hasAutoTopup
                          ? `When your balance reaches $0, we add ${formatCentsAsUsd(c.topupAmountCents, 0)} from your card.`
                          : "Off. Your campaigns pause when your credit runs out."}
                      </p>
                    </div>
                    {/* Prepaid reload is required once on (owner 2026-10-11, like Google Ads): no
                        off switch; the way out is removing the card or stopping the campaigns. */}
                    {!(mode === "prepaid" && c.hasAutoTopup) && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={c.hasAutoTopup}
                      aria-label="Auto top-up"
                      disabled={autoPending}
                      onClick={() => void toggleAutoTopup(!c.hasAutoTopup)}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                        c.hasAutoTopup ? "bg-[var(--accent)]" : "bg-[var(--data-track)]"
                      } ${autoPending ? "cursor-wait" : ""}`}
                    >
                      <span
                        className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          c.hasAutoTopup ? "translate-x-[18px]" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    )}
                  </div>
                  {c.hasAutoTopup && (
                    <p className="k-fg3 mt-2 text-[12px] leading-[18px]">It stays on while your campaigns run. To stop it, remove your card.</p>
                  )}
                  {autoError && <p role="alert" className="mt-2 text-[13px] text-[var(--data-rose)]">{autoError}</p>}
                </div>
              )}
            </>
          )}
        </Section>

        {/* The monthly limit, a cap on campaign SPEND (owner 2026-10-21): the "limit reached" email links here. */}
        <Section
          id="monthly-limit"
          title="Monthly limit"
          description="Your campaigns stop once they spend this much in a calendar month."
        >
          <MonthlyLimitCard />
        </Section>

        {/* Payment method. */}
        <Section
          id="card"
          title="Payment method"
          description="The card we charge. Adding or replacing it opens our payment provider's form; nothing is removed without asking."
        >
          <div className="k-card p-4">
            {c.accountPending ? (
              <Shimmer className="h-10 w-64" />
            ) : account?.has_payment_method ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <CardBrandLogo brand={account.card_brand} className="k-inset rounded-lg" />
                <div className="min-w-0 flex-1">
                  {account.card_last4 ? (
                    <p className="text-[13px]">
                      <span className="font-medium">{cardBrandLabel(account.card_brand)}</span>
                      <span className="k-fg4 mx-1.5 tracking-[0.2em]" aria-hidden>
                        ••••
                      </span>
                      <span className="font-medium tabular-nums">{account.card_last4}</span>
                    </p>
                  ) : (
                    <p className="text-[13px] font-medium">Card connected</p>
                  )}
                  <p className="k-fg3 mt-0.5 flex flex-wrap items-center gap-x-1.5 whitespace-nowrap text-[12px]">
                    {expiry && <span>Expires {expiry}</span>}
                    {expiry && account.card_country && <span aria-hidden>·</span>}
                    {account.card_country && (
                      <span>
                        {countryFlag(account.card_country)} {countryLabel(account.card_country)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  <button
                    type="button"
                    className="k-btn-ghost"
                    onClick={() => (mode === "subscription" ? setCardLossOpen(true) : c.setRemoveConfirmOpen(true))}
                    disabled={c.portalLoadingSource !== null || c.removePending}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="k-btn"
                    onClick={() => c.handleManagePayment("manage")}
                    disabled={c.portalLoadingSource !== null}
                  >
                    {c.portalLoadingSource === "manage" ? "Opening..." : "Change card"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="k-fg2 text-[13px]">No card yet.</p>
                <button
                  type="button"
                  className="k-btn-strong"
                  onClick={() => c.handleManagePayment("manage")}
                  disabled={c.portalLoadingSource !== null}
                >
                  {c.portalLoadingSource === "manage" ? "Opening..." : "Add card"}
                </button>
              </div>
            )}
            {c.settleCents !== null && (
              <p className="k-fg3 mt-3 text-[12px] leading-[18px]">
                Opening the card page charges your {formatBillingCents(c.settleCents)} balance to the card on file. We ask
                before we take it, and you can change your card whether or not it goes through.
              </p>
            )}
            {account?.has_payment_method && !c.autoReloadSupported && (
              <p className="mt-3 text-[12px] leading-[18px] text-[var(--data-amber)]">
                Cards issued in {countryLabel(account.card_country)} cannot be charged automatically, so auto top-up and
                postpaid stay off. Add another card to use them.
              </p>
            )}
          </div>
        </Section>

        {/* Add credit, only while auto top-up is off (it refills the balance otherwise). */}
        {/* A plan adds money by raising the plan, never a one-off top-up. */}
        {/* Postpaid has nothing to top up (owner 2026-10-21): prepaid only. */}
        {!c.accountPending && !c.hasAutoTopup && mode === "prepaid" && (
          <Section id="add-credit" title="Add credit" description="A one-off payment. The amounts are sized to what your brands spend a day.">
            <div className="k-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                {c.presetAmounts.map((amount) => {
                  const selected = c.topupSelected === amount && !c.customAmount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => c.handleSelectTopup(amount)}
                      className="k-btn tabular-nums"
                      style={selected ? { boxShadow: "inset 0 0 0 1.5px var(--accent)", color: "var(--accent)" } : undefined}
                    >
                      {formatCentsAsUsd(amount, 0)}
                    </button>
                  );
                })}
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Other $"
                  aria-label="Other amount in dollars"
                  value={c.customAmount}
                  onChange={(e) => {
                    c.setCustomAmount(e.target.value);
                    c.setCustomAmountError(null);
                  }}
                  onBlur={c.handleCustomAmountBlur}
                  min="10"
                  step="1"
                  className={`k-input w-28 px-2.5 ${c.customAmountError ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
                />
              </div>
              {c.customAmountError && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{c.customAmountError}</p>}
              {c.autoReloadSupported && (
                <label className="mt-4 flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={c.enableAutoTopup}
                    onChange={(e) => c.setEnableAutoTopup(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-[13px] font-medium">Turn on auto top-up</span>
                    <span className="k-fg3 block text-[12px] leading-[18px]">
                      We top you up as you spend, so your campaigns never stop. The amount follows your usage.
                    </span>
                  </span>
                </label>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void c.handleTopup()}
                  disabled={c.topupLoading || c.hasValidationError}
                  className={`k-btn-accent tabular-nums ${c.topupLoading ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
                >
                  {c.topupLoading ? "Opening payment..." : `Add ${formatCentsAsUsd(customCents, 0)}`}
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* Free credit: what was given, then what is on the way. None on billing's
            no-free-money offers (owner 2026-10-29): its $5 at creation is an advance. */}
        {account && !offersNoFreeMoney(account) && (
        <Section id="free-credit" title="Free credit" description="Credit we added to your account, and credit that unlocks as your payments grow.">
          <div className="k-card overflow-hidden">
            {c.grantsPending && c.grants.length === 0 ? (
              <div className="space-y-3 p-4">
                <Shimmer className="h-4 w-48" />
                <Shimmer className="h-4 w-40" />
              </div>
            ) : c.grants.length === 0 ? (
              <EmptyNote>No free credit yet.</EmptyNote>
            ) : (
              <ul>
                {c.grants.map((grant) => (
                  <li key={grant.id} className="k-row k-line-subtle flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{creditGrantLabel(grant.reason)}</p>
                      <p className="k-fg3 k-mono text-[12px]">
                        {formatGrantDate(grant.createdAt)}
                        {grant.note ? ` · ${grant.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] font-medium tabular-nums text-[var(--data-teal)]">
                      +{formatBillingCents(grant.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="v2-embed mt-3">
            <ComingCreditsCard />
          </div>
        </Section>
        )}

        {/* Payments. */}
        <Section
          id="payments"
          title="Payments"
          description="Every payment you made. Refunds are shown on the payment they came from."
        >
          <div className="k-card overflow-hidden">
            <div className="k-line-subtle flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <span className="k-label">Payments{c.payments.length > 0 ? ` · ${c.payments.length}` : ""}</span>
              {account?.has_payment_method && (
                <button
                  type="button"
                  className="k-btn-ghost h-7"
                  onClick={() => c.handleManagePayment("invoices")}
                  disabled={c.portalLoadingSource !== null}
                >
                  {c.portalLoadingSource === "invoices" ? "Opening..." : "Invoices"}
                </button>
              )}
            </div>
            {c.paymentsPending && c.payments.length === 0 ? (
              <div className="space-y-3 p-4">
                <Shimmer className="h-4 w-48" />
                <Shimmer className="h-4 w-40" />
              </div>
            ) : c.payments.length === 0 ? (
              <EmptyNote>No payments yet.</EmptyNote>
            ) : (
              <ul>
                {c.payments.map((payment) => {
                  const returned = paymentReturnBadge(paymentReturnState(payment.amountCents, payment.amountReturnedCents));
                  const keptCents = Math.max(0, payment.amountCents - payment.amountReturnedCents);
                  return (
                    <li
                      key={payment.id}
                      className="k-row k-line-subtle flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px]">{payment.description || (mode === "postpaid" ? "Card charge" : "Credit top-up")}</p>
                        {returned && (
                          <p className="k-fg3 text-[12px]">{formatBillingCents(payment.amountReturnedCents)} returned to your card</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <span className="k-fg3 k-mono hidden text-[12px] sm:inline">{formatGrantDate(payment.createdAt)}</span>
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: returned ? "var(--data-amber)" : "var(--data-teal)" }}
                          />
                          {returned ? returned.label : "Paid"}
                        </span>
                        <span className="w-20 text-right text-[13px] font-medium tabular-nums">
                          {formatBillingCents(returned ? keptCents : payment.amountCents)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Section>

        <UsageSection billedCents={c.confirmedChargesCents} setAsideCents={c.provisionedChargesCents} />
      </div>
    </>
  );
}

/** Dollars to cents without float noise (0.1 * 100 would ceil to 11). */
function usdToCents(usd: number): number {
  return Math.round(usd * 1e6) / 1e4;
}

/** How soon Usage re-reads while its Total still differs from Billed at the top. */
const USAGE_CATCH_UP_MS = 1_500;

/**
 * Billed spend by category, with a Total row equal to "Billed" at the top.
 *
 * features-service serves billing's own Billed and Set aside as the totals, but from a
 * snapshot it refreshes behind the response, while the Balance card reads billing live.
 * So Usage polls with the page AND, while its Total or set-aside differs from the
 * figures at the top, re-reads every 1.5s until both show the same moment
 * (BILLING-PAGE-COHERENT-1021). The compare is a freshness check, never a figure shown.
 */
function UsageSection({ billedCents, setAsideCents }: { billedCents: number | null; setAsideCents: number | null }) {
  const { data: usage, isPending, isError } = useAuthQuery(["orgUsage"], () => getOrgUsage(), {
    refetchInterval: (query) => {
      const base = pollIntervalFor(query);
      const served = query.state.data;
      if (base === false || !served || billedCents === null || setAsideCents === null) return base;
      const behind =
        formatBillingCents(usdToCents(served.totalBilledUsd)) !== formatBillingCents(billedCents) ||
        formatBillingCents(usdToCents(served.totalSetAsideUsd)) !== formatBillingCents(setAsideCents);
      return behind ? USAGE_CATCH_UP_MS : base;
    },
  });
  // Account adjustments can be NEGATIVE (a correction): keep any row worth half a cent either way.
  const rows = (usage?.categories ?? []).filter((cat) => Math.abs(usdToCents(cat.billedUsd)) >= 0.5);
  const setAsideCentsServed = usdToCents(usage?.totalSetAsideUsd ?? 0);
  const coveredCents = usdToCents(usage?.coveredByUs?.billedUsd ?? 0);
  return (
    <Section
      id="usage"
      title="Usage"
      description="What you have been billed, by what it paid for. The total matches Billed at the top of this page."
    >
      <div className="k-card overflow-hidden">
        {isPending && !isError ? (
          <div className="space-y-3 p-4">
            <Shimmer className="h-4 w-56" />
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-4 w-40" />
          </div>
        ) : !usage ? (
          <EmptyNote>We could not load your usage right now.</EmptyNote>
        ) : (
          <ul>
            {rows.map((cat) => (
              <li
                key={cat.key}
                className="k-row k-line-subtle flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2"
              >
                <p className="min-w-0 truncate text-[13px]">{cat.label}</p>
                <span className="w-20 shrink-0 text-right text-[13px] tabular-nums">
                  {formatBillingCents(usdToCents(cat.billedUsd))}
                </span>
              </li>
            ))}
            <li className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Total</p>
                {setAsideCentsServed >= 0.5 && (
                  <p className="k-fg3 text-[12px]">
                    Plus {formatBillingCents(setAsideCentsServed)} provisioned for emails already scheduled.
                  </p>
                )}
                {coveredCents >= 0.5 && (
                  <p className="k-fg3 text-[12px]">Covered by us: {formatBillingCents(coveredCents)}, on the house.</p>
                )}
              </div>
              <span className="w-20 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                {formatBillingCents(usdToCents(usage.totalBilledUsd))}
              </span>
            </li>
          </ul>
        )}
      </div>
    </Section>
  );
}
