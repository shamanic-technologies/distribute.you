"use client";

import { useState } from "react";
import { configureAutoTopup, disableAutoTopup, getOrgUsage } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatBillingCents, formatCentsAsUsd } from "@/lib/format-number";
import { creditGrantLabel } from "@/lib/credit-grant-label";
import { paymentReturnBadge, paymentReturnState } from "@/lib/payment-return";
import { paymentModeOf, type PaymentMode } from "@/lib/payment-mode";
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
import { EmptyNote, Figure, Meter, Shimmer, TopBar } from "@/components/v2/ui";

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

const MODE_COPY: Record<PaymentMode, { title: string; line: string; detail: string }> = {
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
  const customCents = c.customAmount ? Math.round(parseFloat(c.customAmount) * 100) || 0 : c.topupSelected;

  const sub = c.accountPending
    ? "Your balance, how you pay, and every payment."
    : mode === null
      ? `${onCredit ? `${balanceFigure} spent on credit` : `${balanceFigure} available`}.`
      : `${MODE_COPY[mode].title}. ${onCredit ? `${balanceFigure} spent on credit` : `${balanceFigure} available`}.`;

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
          {!c.hasAutoTopup && !c.accountPending && (
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
                c.showPaymentRequired({
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
        {c.hasUsageDiscount && (
          <Note tone="teal">
            You have {c.usageDiscountPct}% off all usage. It comes off every charge automatically.
          </Note>
        )}
        {c.isDepleted && (
          <Note tone="amber">Your credit has run out. Add credit to keep your campaigns running.</Note>
        )}

        {/* Balance: one card split into cells, the Keel KPI strip. */}
        <Section
          id="balance"
          first
          title="Balance"
          description="What you can spend now, and how it adds up: every credit added, minus what was billed and what is set aside for follow-ups already scheduled."
        >
          <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
            {c.accountPending
              ? [0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2 p-4">
                    <Shimmer className="h-3 w-20" />
                    <Shimmer className="h-6 w-24" />
                  </div>
                ))
              : [
                  { label: onCredit ? "Spent on credit" : "Available", value: balanceFigure, strong: true },
                  { label: "Total credits", value: formatBillingCents(account?.credited_cents ?? "0") },
                  ...(c.confirmedChargesCents !== null && c.provisionedChargesCents !== null
                    ? [
                        { label: "Billed", value: formatBillingCents(c.confirmedChargesCents) },
                        { label: "Set aside", value: formatBillingCents(c.provisionedChargesCents) },
                      ]
                    : [{ label: "Charges", value: formatBillingCents(c.totalChargesCents) }]),
                ].map((cell) => (
                  <div key={cell.label} className="p-4">
                    <p className="k-label">{cell.label}</p>
                    <div className="mt-1.5">
                      <Figure value={cell.value} />
                    </div>
                  </div>
                ))}
          </div>
        </Section>

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
              {account?.has_payment_method && c.autoReloadSupported && (
                <div className="k-card mt-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">Auto top-up</p>
                      <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">
                        {c.hasAutoTopup
                          ? mode === "prepaid"
                            ? `When your balance reaches $0, we add ${formatCentsAsUsd(c.topupAmountCents, 0)} from your card.`
                            : `We charge ${formatCentsAsUsd(c.topupAmountCents, 0)} once you have spent ${formatCentsAsUsd(c.creditLineCents, 0)} on credit, or on ${c.nextChargeDate}.`
                          : "Off. Your campaigns pause when your credit runs out."}
                      </p>
                    </div>
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
                  </div>
                  {c.hasAutoTopup && mode === "postpaid" && c.creditLineCents > 0 && (
                    <div className="mt-3">
                      <Meter value={c.spentSinceChargeCents} max={c.creditLineCents} />
                      <p className="k-fg3 mt-1.5 text-[12px] tabular-nums">
                        {formatCentsAsUsd(c.spentSinceChargeCents, 2)} of {formatCentsAsUsd(c.creditLineCents, 2)} spent
                      </p>
                    </div>
                  )}
                  {autoError && <p role="alert" className="mt-2 text-[13px] text-[var(--data-rose)]">{autoError}</p>}
                </div>
              )}
            </>
          )}
        </Section>

        {/* Payment method. */}
        <Section
          id="card"
          title="Payment method"
          description="The card we charge. Replacing it opens our payment provider's page; nothing is removed without asking."
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
                    onClick={() => c.setRemoveConfirmOpen(true)}
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
              <p className="k-fg2 text-[13px]">No card yet. One is saved with your first payment.</p>
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
        {!c.accountPending && !c.hasAutoTopup && (
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

        {/* Free credit: what was given, then what is on the way. */}
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
                        <p className="truncate text-[13px]">{payment.description || "Credit top-up"}</p>
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

        <UsageSection />
      </div>
    </>
  );
}

/** Dollars to cents without float noise (0.1 * 100 would ceil to 11). */
function usdToCents(usd: number): number {
  return Math.round(usd * 1e6) / 1e4;
}

/** Billed spend by category, with a Total row equal to "Billed" at the top. */
function UsageSection() {
  const { data: usage, isPending, isError } = useAuthQuery(["orgUsage"], () => getOrgUsage());
  const rows = (usage?.categories ?? []).filter((cat) => usdToCents(cat.billedUsd) >= 0.5);
  const setAsideCents = usdToCents(usage?.totalSetAsideUsd ?? 0);
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
                {setAsideCents >= 0.5 && (
                  <p className="k-fg3 text-[12px]">
                    Plus {formatBillingCents(setAsideCents)} set aside for emails already scheduled.
                  </p>
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
