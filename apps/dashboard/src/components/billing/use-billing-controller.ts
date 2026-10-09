"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueries } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getCreditGrants,
  getBillingPayments,
  createCheckoutSession,
  createEmbeddedCheckoutSession,
  createPortalSession,
  declareRevolutDefault,
  listBrands,
  getBrandDailyBudget,
  type BillingAccount,
  type CreditGrant,
  type Payment,
  type Brand,
  type CardSetup,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { topupPresetsForDailyBudget } from "@/lib/credit-runway";
import { latestPaymentFailure } from "@/lib/payment-failure";
import { availableCreditCents } from "@/lib/credit-runway";
import {
  cardChangeSettleCents,
  cardSessionSettleProblem,
  type SettleProblem,
} from "@/lib/card-change-settle";
import { cardRemoveConsequence } from "@/lib/card-remove";
import { pollOptions } from "@/lib/query-options";
import { cardBrandLabel } from "@/components/billing/billing-display";

/**
 * Everything the Billing page DOES, apart from how it looks: the reads, the figures
 * derived from them, and every action that can move money (open the card page and
 * settle first, remove the card, top up, arm auto top-up).
 *
 * It lives here, not in a page, because two pages render it (the v1 Billing page and
 * the v2 one) and a second copy of a charge path is how one of them comes to charge
 * without asking. Each page only draws; neither re-implements a handler.
 */

// Last calendar day of the current month, formatted for the "…or on <date>"
// month-end sweep guarantee (billing-service runMonthEndSweep). Day 0 of next
// month = last day of this month.
function lastDayOfMonthLabel(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

// Fixed values sent to configureAutoTopup ONLY to set the "auto-topup enabled"
// flag (both columns non-null ⇒ enabled). The effective reload amount + credit-
// line floor are DERIVED server-side from a tier ladder (billing-service
// topup-tier), so these numbers are never used for the charge math — they only
// arm the flag. See "Threshold-based postpaid top-up" in billing-service.
export const AUTO_TOPUP_ENABLE_AMOUNT_CENTS = 5000;
export const AUTO_TOPUP_ENABLE_THRESHOLD_CENTS = 500;

export function useBillingController() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  void orgId;
  const queryClient = useQueryClient();
  const { showPaymentRequired } = useBillingGuard();

  const showSuccess = searchParams.get("success") === "true";
  const pendingTopup = searchParams.get("pending_topup");
  const pendingThreshold = searchParams.get("pending_threshold");

  // Data fetching
  // Gate the page on isPending (not isLoading): during Clerk org-settle useAuthQuery
  // disables the query → isLoading:false while account is still undefined → the page
  // would render $0 numbers + hide the discount banner for the settle window. isPending
  // stays true through settle, so we skeleton instead. Warm persisted cache → instant.
  const { data: account, isPending: accountPending } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptions,
  );

  // Credit grants ("gifts received") — the org's own free-credit ledger.
  const { data: grantsData, isPending: grantsPending } = useAuthQuery<{ grants: CreditGrant[] }>(
    ["creditGrants"],
    () => getCreditGrants(),
  );
  const grants = grantsData?.grants ?? [];

  // Payments ("Payments" card) — the org's own Stripe top-up history. These are
  // one-off PaymentIntents, NOT Stripe invoices, so the Stripe billing-portal
  // "invoices" view is empty for customers; this card is the real payment log.
  const { data: paymentsData, isPending: paymentsPending } = useAuthQuery<{ payments: Payment[] }>(
    ["billingPayments"],
    () => getBillingPayments(),
  );
  // Only show successful top-ups — incomplete/failed PaymentIntents are noise to
  // the customer (an abandoned checkout leaves a requires_* husk); hide them.
  const payments = (paymentsData?.payments ?? []).filter((p) => p.status === "succeeded");

  // Has a charge been refused since the last one that went through? Read off the
  // UNFILTERED list on purpose — the card above drops every non-succeeded intent,
  // which is exactly why a declined card was invisible here. See lib/payment-failure.ts.
  const paymentFailure = latestPaymentFailure(paymentsData?.payments ?? []);
  // A declined top-up on an org still holding credit has stopped nothing, so the
  // "your campaigns are stopped" half of the banner is gated on the balance the
  // page already reads rather than on the decline.
  const paymentsStopped = account ? availableCreditCents(account) <= 0 : false;

  // Org-wide daily burn = sum of every brand's saved daily budget (paused/unset
  // brands contribute 0). The org wallet is shared across brands, so this is how
  // fast a top-up actually drains — it drives the "~N days" estimate on each
  // amount. Display affordance over existing per-brand budgets (same class as the
  // credit-runway banner), not a server-owned metric. Reuses the per-brand
  // ["brandDailyBudget", id] cache the brand pages already populate.
  const { data: brandsData } = useAuthQuery<{ brands: Brand[] }>(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  const brandBudgetQueries = useQueries({
    queries: (brandsData?.brands ?? []).map((b) => ({
      queryKey: ["brandDailyBudget", b.id],
      queryFn: () => getBrandDailyBudget(b.id),
      enabled: !!brandsData,
      ...pollOptions,
    })),
  });
  const orgDailyBurnCents = brandBudgetQueries.reduce(
    (sum, q) => sum + (q.data?.dailyBudgetCents ?? 0),
    0,
  );
  // Presets sized to N days of the org's combined daily burn (5/15/45/135 days);
  // flat fallback when no brand has a budget set.
  const presetAmounts = topupPresetsForDailyBudget(orgDailyBurnCents);
  const presetKey = presetAmounts.join(",");

  // Top-up state (one-off "Add Credits" only — auto-topup amount/threshold are
  // DERIVED server-side, not user-set)
  const [topupSelected, setTopupSelected] = useState(2500);
  const [customAmount, setCustomAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);

  // Keep the selected amount on a real preset once the day-sized amounts resolve
  // (the initial $25 default isn't one of them). Skip when the user typed a
  // custom amount; the includes-guard prevents a re-render loop and only fires
  // during the initial resolve (no clobber of edits).
  useEffect(() => {
    if (customAmount) return;
    if (presetAmounts.includes(topupSelected)) return;
    setTopupSelected(presetAmounts[1] ?? presetAmounts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey, customAmount]);

  // Auto-topup toggle (arms the flag; amount/threshold are derived) — on by default
  const [enableAutoTopup, setEnableAutoTopup] = useState(true);

  // Portal state — track WHICH button opened the portal so only that button
  // shows the spinner (both buttons open the same Stripe portal session).
  const [portalLoadingSource, setPortalLoadingSource] = useState<"manage" | "invoices" | null>(null);

  // Which button is waiting on the settle confirmation. Non-null = the modal is
  // up; the source is held so Confirm opens the page the customer asked for.
  const [confirmSource, setConfirmSource] = useState<"manage" | "invoices" | null>(null);

  // The charge behind the confirmation did not land. The card page was already
  // prepared by the same call, so it is held here and opened only when the
  // customer chooses to, after being told why the charge failed.
  const [settleProblem, setSettleProblem] = useState<{
    problem: SettleProblem;
    setup: CardSetup;
  } | null>(null);

  // Removing the card is its own confirmation and its own in-flight state: it
  // shares neither with the portal buttons, because it opens no portal.
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removePending, setRemovePending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Inline validation error (shown on blur) for the one-off custom amount
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  function handleCustomAmountBlur() {
    if (customAmount && parseFloat(customAmount) < 10) {
      setCustomAmountError("Minimum top-up is $10.");
    } else {
      setCustomAmountError(null);
    }
  }

  const hasValidationError = !!customAmountError;

  const hasAutoTopup = account?.has_auto_topup ?? false;
  // Auto-reload (off_session auto-topup) can be impossible for the saved card's issuing
  // country. Absent/undefined => supported (older billing deploy, today's behavior);
  // only an explicit `false` blocks the auto-topup controls.
  const autoReloadSupported = account?.auto_reload_supported !== false;

  // Credit-balance breakdown — all four lines reconcile so the displayed numbers stop
  // contradicting each other. Math in cents (full-precision decimal strings); format once.
  //   Available           = balance_cents (spendable, net of provisioned holds) — the number to act on
  //   Total credits       = credited_cents (lifetime credited)
  //   Confirmed charges   = credited_cents - actual_balance_cents (actualized usage only)
  //   Provisioned charges = actual_balance_cents - balance_cents (open holds for scheduled follow-ups)
  // Total - Confirmed - Provisioned == Available, by construction.
  const availableCents = account ? parseFloat(account.balance_cents) : 0;
  const totalCreditsCents = account ? parseFloat(account.credited_cents) : 0;
  // actual_balance_cents is absent on older billing deploys; without it the confirmed/provisioned
  // split is unknowable, so collapse to a single "Charges" line (= total - available) rather than
  // show a misleading $0 hold. Available + Total credits are always derivable.
  const actualBalanceStr = account?.actual_balance_cents;
  const hasActualBalance = actualBalanceStr !== undefined && actualBalanceStr !== null;
  const actualBalanceCents = hasActualBalance ? parseFloat(actualBalanceStr as string) : null;
  const confirmedChargesCents = actualBalanceCents !== null ? totalCreditsCents - actualBalanceCents : null;
  const provisionedChargesCents = actualBalanceCents !== null ? actualBalanceCents - availableCents : null;
  const totalChargesCents = totalCreditsCents - availableCents; // confirmed + provisioned

  // Postpaid next-charge progress. Auto-topup is threshold-based: the balance runs
  // NEGATIVE down to a derived credit-line floor (topup_threshold_cents, negative)
  // and a fixed reload (topup_amount_cents) fires when spend crosses it.
  //   creditLineCents       = |negative floor| = the amount of spend that triggers the next charge
  //   spentSinceChargeCents = how far into the line we are = max(0, -available)
  //   nextChargeDate        = the month-end sweep guarantee (billing-service runMonthEndSweep)
  const creditLineCents = Math.abs(account?.topup_threshold_cents ?? 0);
  const topupAmountCents = account?.topup_amount_cents ?? 0;
  const spentSinceChargeCents = Math.max(0, -availableCents);
  const chargePct = creditLineCents > 0 ? Math.min(100, (spentSinceChargeCents / creditLineCents) * 100) : 0;
  const nextChargeDate = lastDayOfMonthLabel();

  // Per-org usage discount (frozen upstream at cost-declaration). Every account number
  // is already NET, so we only READ the rate to render the positive banner. We do NOT
  // reconstruct a gross price for the next-charge figure — with the frozen-net approach
  // the shown amount IS what gets charged, so a struck-through gross would be misleading.
  const usageDiscountPct = account?.usage_discount_pct ?? null;
  const hasUsageDiscount = typeof usageDiscountPct === "number" && usageDiscountPct > 0 && usageDiscountPct < 100;

  // A negative available balance = postpaid usage running on credit. Frame it as "Balance"
  // (label) with the absolute amount in green, and align the tooltip to that meaning — the
  // "what you can spend right now" copy is wrong once the balance is negative. Both the big
  // number and the breakdown footer read from these so they never drift apart.
  // What opening the card page will CHARGE, or null when it will charge nothing.
  // ONE derivation: the notice under the button and the confirmation modal both
  // read it, so they cannot state different amounts for the same click. It is
  // stricter than `availableCents < 0` on purpose — billing skips the settle for
  // a card that cannot be charged off_session and for a deficit under the
  // acquirer minimum, and the notice used to promise a charge in both cases.
  const settleCents = cardChangeSettleCents(account);

  // What REMOVING the card stops, and when. Derived per account rather than
  // stated as a constant: an org sitting on credit keeps running until it is
  // spent, so "your campaigns stop" would be false in the common case. The
  // AMOUNT we would collect first is `settleCents` above, deliberately not
  // re-derived here, so both card controls state the same money.
  const removeConsequence = cardRemoveConsequence(account);

  // The card in the customer's own words, so the confirmation names the thing
  // they are looking at. Null when we hold no display fields for it (older
  // billing deploy), and the modal then asks about "your card".
  const cardLabel =
    account?.card_brand && account?.card_last4
      ? `${cardBrandLabel(account.card_brand)} ${account.card_last4}`
      : null;

  const isNegativeBalance = availableCents < 0;
  const balanceLabel = isNegativeBalance ? "Balance" : "Available";
  const balanceTip = isNegativeBalance
    ? "Your usage running on credit. This is covered automatically by your next top-up charge."
    : "What you can spend right now: total credits minus confirmed and provisioned charges.";

  // Depleted = AVAILABLE (spendable, net of provisioned holds) at/below zero AND no auto-topup
  // to cover it. Keys on balance_cents — the value spending is actually blocked on — not the
  // gross actual balance (which hid open holds and let the warning never fire while blocked).
  // Auto-topup armed backstops the balance, so suppress the warning then.
  const isDepleted = account ? !hasAutoTopup && availableCents <= 0 : false;

  // Auto-reload unavailable for this card's country: never arm the auto-topup checkbox
  // (its controls are hidden, and handleTopup must not attempt configureAutoTopup).
  useEffect(() => {
    if (!autoReloadSupported) setEnableAutoTopup(false);
  }, [autoReloadSupported]);

  // After successful Stripe checkout, arm auto-topup if it was requested pre-checkout
  // (no card yet). The pending values only set the enabled flag; the reload amount +
  // floor are derived server-side.
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

  // When the user selects a one-off top-up amount
  function handleSelectTopup(amount: number) {
    setTopupSelected(amount);
    setCustomAmount("");
  }

  /**
   * Open the card page, charging first when something is owed.
   *
   * The gate is the whole point. billing-service settles an outstanding balance
   * on this call and hands the session over whatever the charge does, so the
   * click has always been able to move real money — and the only thing that said
   * so was a grey line under the button, on a page where the settle takes
   * SECONDS. Nothing asked, and a customer who gave up during the wait had
   * already been charged.
   *
   * BOTH buttons go through it: "View invoices" hits the same endpoint and
   * therefore settles identically, and nothing about its label suggests money
   * moves. Gating only "Change card" would leave the same surprise charge on the
   * other one.
   *
   * Nothing owed (or a charge billing would skip anyway) opens the page
   * directly, exactly as before — that is the common case and it must not grow a
   * confirmation about a charge of nothing.
   */
  function handleManagePayment(source: "manage" | "invoices") {
    if (settleCents !== null) {
      setError(null);
      setConfirmSource(source);
      return;
    }
    void openCardPage(source);
  }

  /**
   * Re-read after the provider has saved a card.
   *
   * The account is what carries `has_payment_method`, the credit-line floor and
   * the auto-topup state; payments are read alongside it because saving a card
   * can carry a charge. The spinner on the button is what says this is running,
   * so it is cleared only once the fresh answer has landed — clearing it first
   * hands the customer a settled-looking page still claiming they have no card.
   */
  async function refreshAfterCardSaved() {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["billingAccount"] }),
      queryClient.refetchQueries({ queryKey: ["billingPayments"] }),
    ]).catch((err) => {
      // The card IS saved; only our re-read failed. The next poll corrects the
      // page, so the customer is told nothing — but never swallow it silently.
      console.error("[billing] post-card-save refetch failed:", err);
    });

    setPortalLoadingSource(null);
    setConfirmSource(null);
  }

  async function openCardPage(source: "manage" | "invoices") {
    setPortalLoadingSource(source);
    setError(null);
    try {
      // Revolut Business by default; an org with a card elsewhere keeps paying there.
      await declareRevolutDefault();
      const setup = await createPortalSession(
        `${window.location.origin}${window.location.pathname}`
      );

      // The session is handed over whatever the charge did, and the redirect
      // used to follow immediately, so a declined charge was never mentioned.
      // Stop here and say so; the card page stays one click away.
      const problem = cardSessionSettleProblem(setup);
      if (problem) {
        setSettleProblem({ problem, setup });
        setPortalLoadingSource(null);
        // The refused charge is now a payment on the list (the failed-payment
        // banner reads it), so re-read rather than wait for the next poll.
        void queryClient
          .refetchQueries({ queryKey: ["billingPayments"] })
          .catch((err) => console.error("[billing] post-decline refetch failed:", err));
        return;
      }

      await continueToCardPage(setup);
    } catch (err) {
      console.error("[billing] card page failed to open", err);
      setError("Failed to open the card page. Please try again.");
      setPortalLoadingSource(null);
      // Drop the modal so the error under the button is readable.
      setConfirmSource(null);
    }
  }

  /** Close the declined-charge notice without opening the card page. */
  function dismissSettleProblem() {
    setSettleProblem(null);
    setConfirmSource(null);
  }

  /** The customer read why the charge failed and chose to change the card. */
  function continueAfterSettleProblem() {
    const held = settleProblem;
    const source = confirmSource ?? "manage";
    setSettleProblem(null);
    // Close the modal rather than fall back to its "Charging..." state: nothing
    // is being charged now, and the button's own spinner covers the redirect.
    setConfirmSource(null);
    if (!held) return;
    setPortalLoadingSource(source);
    void continueToCardPage(held.setup).catch((err) => {
      console.error("[billing] card page failed to open", err);
      setError("Failed to open the card page. Please try again.");
      setPortalLoadingSource(null);
      setConfirmSource(null);
    });
  }

  /** Send the customer to the card page the backend prepared (or mount its widget). */
  async function continueToCardPage(setup: CardSetup) {
    // Providers do not all do this the same way: some host a page we send the
    // customer to, others save a card only through a widget mounted here. The
    // backend says which; this only renders it.
    if (setup.mode === "hosted_redirect") {
      window.location.href = setup.url;
      return;
    }
    // Only the New organization modal asks for the in-page variant; this page never
    // sends `ui_mode`, so reaching here means the backend answered something unasked.
    if (setup.mode === "embedded_checkout") {
      console.error("[billing] card setup answered embedded_checkout to a hosted request", setup);
      setError("We could not open the card page. Please try again.");
      setPortalLoadingSource(null);
      setConfirmSource(null);
      return;
    }

    const { openCardWidget } = await import("@/lib/card-setup-widget");
    await openCardWidget({
      token: setup.token,
      environment: setup.environment,
      savePaymentMethodFor: setup.save_payment_method_for,
      name: setup.customer_name ?? undefined,
      email: setup.customer_email ?? undefined,
      onSuccess: () => {
        // The card only exists at the provider once this fires, so re-read
        // rather than assuming — otherwise the page would claim a card is on
        // file before one is. Re-read, NEVER reload: the cache is local-first,
        // so a reload paints the previous visit's snapshot first and tells a
        // customer who has just saved a card that they have no payment method,
        // for as long as the cold billing read takes. Same bug the removal had
        // (#4252), pointed the other way. The widget has taken itself down by
        // the time this runs, so the page underneath is what they are looking
        // at while it settles.
        void refreshAfterCardSaved();
      },
      onCancel: () => {
        setPortalLoadingSource(null);
        setConfirmSource(null);
      },
      onError: (message) => {
        setError(message);
        setPortalLoadingSource(null);
        setConfirmSource(null);
      },
    });
    // The widget is mounted, so the confirmation has done its job. The hosted
    // branch above returns before this and navigates away instead.
    setConfirmSource(null);
  }

  async function handleRemoveCard() {
    setRemovePending(true);
    setError(null);
    let removal: Awaited<ReturnType<typeof import("@/lib/api").removePaymentMethod>>;
    try {
      const { removePaymentMethod } = await import("@/lib/api");
      removal = await removePaymentMethod();
    } catch (err) {
      // The thrown error carries the whole downstream body verbatim, so it is
      // logged and never rendered: that is how a JSON blob reaches a customer.
      console.error("[billing] remove card failed:", err);
      setError("Could not remove your card. Nothing was changed.");
      setRemovePending(false);
      setRemoveConfirmOpen(false);
      return;
    }

    // The card is GONE from here on, which is why the catch above is its own —
    // "Nothing was changed" would be a lie for anything that fails past this
    // point.
    //
    // Re-read rather than patching the account in place: the removal changes the
    // credit-line floor and the auto-topup state as well as the card, and billing
    // is the only thing that knows what it settled on the way out. But NEVER by
    // reloading the page. The cache is local-first, so a reload paints the
    // PREVIOUS visit's snapshot first — the removed card, still there — and only
    // swaps it out when the cold billing read lands seconds later. That reads as
    // the click having done nothing. Awaiting the refetch keeps "Removing..." on
    // screen for the same wait and then repaints in one frame, correct.
    //
    // Payments are re-read too: billing collects the outstanding balance on the
    // way out, so a charge may have landed in the list.
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["billingAccount"] }),
      queryClient.refetchQueries({ queryKey: ["billingPayments"] }),
    ]).catch((err) => {
      // The removal succeeded; only our re-read did not. Say nothing to the
      // customer — the next poll corrects the page — but never swallow silently.
      console.error("[billing] post-removal refetch failed:", err);
    });

    // A 200 that removed nothing while this page showed a card is NOT a removal:
    // the acquirer answering did not hold the card (2026-10-09, a Revolut card
    // left on file twice with "detached 0"). Say so instead of letting the card
    // silently reappear, which reads as a dead button.
    if (removal.removed === 0 && removal.already_removed === 0 && account?.has_payment_method) {
      console.error("[billing] card removal removed nothing while a card is on file:", removal);
      setError("We could not remove your card. Please try again later.");
    }

    setRemovePending(false);
    setRemoveConfirmOpen(false);
  }

  async function handleTopup() {
    const amountCents = customAmount ? Math.round(parseFloat(customAmount) * 100) : topupSelected;
    if (!amountCents || amountCents <= 0) return;

    if (hasValidationError) return;

    setTopupLoading(true);
    setError(null);
    try {
      // If the user already has a payment method, arm/disarm auto-topup now.
      // Otherwise, pass the enabled flag via URL params to arm after checkout.
      if (account?.has_payment_method) {
        if (enableAutoTopup) {
          const { configureAutoTopup } = await import("@/lib/api");
          await configureAutoTopup(AUTO_TOPUP_ENABLE_AMOUNT_CENTS, AUTO_TOPUP_ENABLE_THRESHOLD_CENTS);
        } else if (!enableAutoTopup && hasAutoTopup) {
          const { disableAutoTopup } = await import("@/lib/api");
          await disableAutoTopup();
        }
      }

      // Build success URL — if no payment method yet, pass the pending enable flag
      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      // Google Ads PURCHASE conversion value = the amount actually charged (cents).
      // The checkout is always payment-mode, so hitting this success_url means the
      // payment succeeded; AdsPurchaseTracker reads paid_amount on return.
      successUrl.searchParams.set("paid_amount", String(amountCents));
      if (enableAutoTopup && !account?.has_payment_method) {
        successUrl.searchParams.set("pending_topup", String(AUTO_TOPUP_ENABLE_AMOUNT_CENTS));
        successUrl.searchParams.set("pending_threshold", String(AUTO_TOPUP_ENABLE_THRESHOLD_CENTS));
      }

      // Revolut Business by default; an org with a card elsewhere keeps paying there.
      await declareRevolutDefault();

      // Revolut saves the card ONLY when the payment is taken in its in-page card
      // field: its hosted page takes the money and keeps no card (seen in prod
      // 2026-10-01: a $135 top-up left the org with no card and auto top-up never
      // armed). So ask for the in-page variant first; a Revolut org answers with
      // its widget, which pays AND saves the card. A Stripe org answers with an
      // embedded session this page does not mount, and keeps the hosted page.
      const embedded = await createEmbeddedCheckoutSession(amountCents);
      if (embedded.mode === "embedded_widget") {
        const { openCardWidget } = await import("@/lib/card-setup-widget");
        await openCardWidget({
          token: embedded.token,
          environment: embedded.environment,
          savePaymentMethodFor: embedded.save_payment_method_for,
          onSuccess: () => {
            // Same return the hosted page makes, without leaving the page: the
            // success banner, the purchase conversion and the pending auto
            // top-up all read these params.
            router.replace(`${successUrl.pathname}${successUrl.search}`);
            void refreshAfterCardSaved();
            setTopupLoading(false);
          },
          onCancel: () => setTopupLoading(false),
          onError: (message) => {
            setError(message);
            setTopupLoading(false);
          },
        });
        return;
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


  return {
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
  };
}
