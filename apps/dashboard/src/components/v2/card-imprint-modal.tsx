"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import {
  configureAutoTopup,
  createEmbeddedCardSetup,
  declareRevolutDefault,
  getBillingAccount,
  setPaymentMode,
  type BillingAccount,
} from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import {
  AUTO_TOPUP_ENABLE_AMOUNT_CENTS,
  AUTO_TOPUP_ENABLE_THRESHOLD_CENTS,
} from "@/components/billing/use-billing-controller";

/**
 * Picking POSTPAID on an account with no card: save one, charging nothing, then switch.
 *
 * The same in-page card save the New organization modal and /get-started run
 * (`createEmbeddedCardSetup`), on Revolut Business by default. It charges nothing,
 * and the provider decides the mechanism: Revolut's popup, which verifies the card
 * with a $1 authorisation it releases (the modal says so), or Stripe's embedded
 * form for an org whose card already lives there. Once billing
 * sees the card, the org moves to postpaid and auto top-up is switched on, which
 * is what lets billing charge the card as it spends. Never the other way round: a
 * postpaid org with no chargeable card is stopped at once by billing.
 */

const SAVE_POLL_TRIES = 12;
const SAVE_POLL_MS = 1000;

type Stage = "opening" | "form" | "widget" | "saving";

export function CardImprintModal({
  onCancel,
  onSwitched,
}: {
  onCancel: () => void;
  /** Called once billing holds the card AND the org is postpaid. The page re-reads and closes. */
  onSwitched: () => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>("opening");
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which step a "Try again" replays: re-opening the form, or re-reading a card
  // already saved (a second form would save a second card).
  const [retryStep, setRetryStep] = useState<"open" | "save" | null>(null);
  // Revolut cannot save a card for $0: it authorises $1 and releases it (never
  // captured). Said only when that is the mechanism billing answered with.
  const [verificationHold, setVerificationHold] = useState(false);
  const started = useRef(false);

  async function openForm() {
    setError(null);
    setRetryStep(null);
    setStage("opening");
    try {
      // Revolut Business by default; an org with a card elsewhere keeps paying there.
      await declareRevolutDefault();
      const setup = await createEmbeddedCardSetup();
      if (setup.mode === "embedded_checkout") {
        setSecret(setup.client_secret);
        setStage("form");
        return;
      }
      if (setup.mode === "embedded_widget") {
        setVerificationHold(true);
        setStage("widget");
        const { openCardWidget } = await import("@/lib/card-setup-widget");
        await openCardWidget({
          token: setup.token,
          environment: setup.environment,
          savePaymentMethodFor: setup.save_payment_method_for,
          name: setup.customer_name ?? undefined,
          email: setup.customer_email ?? undefined,
          onSuccess: () => void afterCardSaved(),
          onCancel,
          onError: (message) => {
            console.error("[billing v2] card widget failed:", message);
            setError("We could not save this card. Please try again.");
            setRetryStep("open");
          },
        });
        return;
      }
      console.error("[billing v2] card setup answered a hosted page to an in-page request", setup);
      throw new Error("hosted card setup");
    } catch (err) {
      // Logged, never rendered: the thrown message is the downstream body verbatim.
      console.error("[billing v2] card setup failed:", err);
      setError("We could not open the card form. Please try again.");
      setRetryStep("open");
    }
  }

  async function afterCardSaved() {
    setSecret(null);
    setStage("saving");
    setError(null);
    setRetryStep(null);
    // The saved card reaches billing through the provider's webhook a moment later.
    let acct: BillingAccount | null = null;
    for (let i = 0; i < SAVE_POLL_TRIES; i++) {
      acct = await getBillingAccount().catch((err) => {
        console.error("[billing v2] billing read after card save failed:", err);
        return null;
      });
      if (acct?.has_payment_method) break;
      await new Promise((r) => setTimeout(r, SAVE_POLL_MS));
    }
    if (!acct?.has_payment_method) {
      setError("Your card is still being confirmed. Wait a few seconds, then try again.");
      setRetryStep("save");
      return;
    }
    if (acct.auto_reload_supported === false) {
      setError("This card cannot be charged automatically, so it cannot carry postpaid. You stay on prepaid.");
      return;
    }
    try {
      await setPaymentMode("postpaid");
      if (!acct.has_auto_topup) {
        await configureAutoTopup(AUTO_TOPUP_ENABLE_AMOUNT_CENTS, AUTO_TOPUP_ENABLE_THRESHOLD_CENTS);
      }
    } catch (err) {
      console.error("[billing v2] switch to postpaid after card save failed:", err);
      setError("Your card is saved, but we could not switch you to postpaid. Please try again.");
      setRetryStep("save");
      return;
    }
    await onSwitched();
  }

  useEffect(() => {
    // Once per mount: a second call would mint a second card session.
    if (started.current) return;
    started.current = true;
    void openForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saving = stage === "saving" && error === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    // No close on a backdrop click: a stray click would throw away a half-typed card.
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-card-imprint-title"
        className="k-popover flex max-h-[86vh] w-full max-w-[480px] flex-col overflow-hidden"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-card-imprint-title" className="k-label">
            Switch to postpaid
          </span>
          <button
            type="button"
            aria-label="Close"
            className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0"
            onClick={onCancel}
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          <p className="text-[13px] leading-5">
            Add the card we charge as you spend. <span className="font-medium">Nothing is charged now</span>. We save it,
            then switch you to postpaid.
          </p>
          {verificationHold && (
            <p className="k-fg3 mt-2 text-[12px] leading-[18px]">
              Your bank may show a $1 check. It is released within minutes and never charged.
            </p>
          )}

          {stage === "opening" && error === null && (
            <p className="k-fg3 mt-3 text-[12px]" aria-live="polite">
              Opening the card form...
            </p>
          )}
          {stage === "widget" && error === null && (
            <p className="k-fg3 mt-3 text-[12px]" aria-live="polite">
              Enter your card in the window that opened.
            </p>
          )}
          {saving && (
            <p className="k-fg3 mt-3 text-[12px]" aria-live="polite">
              Saving your card and switching to postpaid. Please keep this page open.
            </p>
          )}

          {stage === "form" && secret && (
            <div className="mt-4">
              <EmbeddedCheckoutProvider
                stripe={getStripe()}
                options={{ clientSecret: secret, onComplete: () => void afterCardSaved() }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {error}
            </p>
          )}

          {error && (
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={onCancel} className="k-btn-ghost">
                Close
              </button>
              {retryStep && (
                <button
                  type="button"
                  onClick={() => void (retryStep === "open" ? openForm() : afterCardSaved())}
                  className="k-btn-accent"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    host,
  );
}
