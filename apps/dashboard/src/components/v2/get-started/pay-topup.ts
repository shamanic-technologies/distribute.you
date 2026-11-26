/**
 * The prepaid credit's money path, shared by the `/get-started` wall and the dashboard
 * walk's launch (owner 2026-10-06: prepaid, no trial). It asks billing for the IN-PAGE
 * payment first (`createEmbeddedCheckoutSession`): a Revolut org answers its widget,
 * which takes the money AND saves the card (its hosted page keeps no card, 2026-10-01),
 * a Stripe org answers an embedded checkout the caller mounts. Then the org is set to
 * prepaid and the automatic reload armed when asked, once billing holds the credit.
 */

import {
  ApiError,
  chargeSavedCard,
  configureAutoTopup,
  createEmbeddedCheckoutSession,
  type PaymentConsent,
  disableAutoTopup,
  getBillingAccount,
  setPaymentMode,
  type BillingAccount,
} from "@/lib/api";
import { topupRefusal } from "@/lib/v2/get-started";

/** What a refused billing call says to the person: billing's own words for its minimum, else null. */
function refusalOf(e: unknown): string | null {
  return e instanceof ApiError && e.status === 400 ? topupRefusal(e.body) : null;
}

/** billing's credited total, in cents (a decimal string on the wire). */
function creditedCents(a: BillingAccount | null): number {
  const n = Number(a?.credited_cents ?? NaN);
  if (!Number.isFinite(n)) {
    console.error("[get-started] billing account served no readable credited_cents", a);
    return NaN;
  }
  return n;
}

/**
 * Open the payment of `amountUsd`. A Revolut widget calls `onPaid` itself; a Stripe org
 * gets `clientSecret` back, to mount, whose completion the caller reports to `settleTopup`
 * with the `creditedBefore` returned here.
 */
export async function payTopup(params: {
  amountUsd: number;
  /** A NEW org is set to prepaid here; an org that has a mode already keeps it (a mode is a tag). */
  setPrepaid: boolean;
  /** The boxes ticked before paying, stored by billing with this payment. */
  consent: PaymentConsent;
  name?: string;
  email?: string;
  onPaid: (creditedBefore: number) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}): Promise<{ clientSecret: string | null; creditedBefore: number }> {
  // Prepaid first: the org spends only what it holds (a new org is postpaid by default).
  if (params.setPrepaid) await setPaymentMode("prepaid");
  const creditedBefore = creditedCents(await getBillingAccount());
  if (!Number.isFinite(creditedBefore)) throw new Error("We could not read your account. Try again.");
  const session = await createEmbeddedCheckoutSession(params.amountUsd * 100, undefined, params.consent).catch((e: unknown) => {
    const refusal = refusalOf(e);
    throw refusal ? new Error(refusal) : e;
  });
  if (session.mode === "embedded_widget") {
    const { openCardWidget } = await import("@/lib/card-setup-widget");
    await openCardWidget({
      token: session.token,
      environment: session.environment,
      savePaymentMethodFor: session.save_payment_method_for,
      name: params.name,
      email: params.email,
      onSuccess: () => params.onPaid(creditedBefore),
      onCancel: params.onCancel,
      onError: params.onError,
    });
    return { clientSecret: null, creditedBefore };
  }
  // A session with no form to mount left the button spinning for ever: said instead.
  if (!session.client_secret) {
    console.error("[get-started] billing answered a checkout with no card form to mount", session);
    throw new Error("We could not open the card form. Try again.");
  }
  return { clientSecret: session.client_secret, creditedBefore };
}

/**
 * Card first (owner 2026-11-25: « rien ne leur sera débité pour le moment »): the org is
 * set to prepaid BEFORE the card is saved, so the save charges nothing (a postpaid org's
 * new card runs billing's card check, and a switch to prepaid WITH a card arms the
 * reload at a $0 balance). Then the card is saved through the plain card setup.
 */
export async function prepareCardFirst(setPrepaid: boolean): Promise<void> {
  if (setPrepaid) await setPaymentMode("prepaid");
}

/** What a refused charge on the saved card leads to. */
export type SavedCardRefusal =
  /** The card cannot pay this off-session: pay in the card form instead. */
  | { kind: "use_form"; message: string }
  /** Nothing wrong with the card: the same press works in a moment. */
  | { kind: "retry"; message: string };

/**
 * Pay the credit on the card saved at the first step. On success the caller settles it
 * with `settleTopup(creditedBefore, reload)` like a form payment.
 */
export async function payFromSavedCard(params: {
  amountUsd: number;
  consent: PaymentConsent;
}): Promise<{ ok: true; creditedBefore: number } | { ok: false; refusal: SavedCardRefusal }> {
  const creditedBefore = creditedCents(await getBillingAccount());
  if (!Number.isFinite(creditedBefore)) throw new Error("We could not read your account. Try again.");
  try {
    await chargeSavedCard({
      amountCents: params.amountUsd * 100,
      idempotencyKey: `card-first-${crypto.randomUUID()}`,
      consent: params.consent,
    });
    return { ok: true, creditedBefore };
  } catch (e) {
    const refusal = refusalOf(e);
    if (refusal) throw new Error(refusal);
    const code = e instanceof ApiError ? e.body?.code : undefined;
    console.error("[get-started] charge on the saved card refused:", e);
    if (code === "charge_declined" || code === "no_chargeable_payment_method" || code === "card_not_chargeable_off_session") {
      return { ok: false, refusal: { kind: "use_form", message: "Your card did not go through. Pay with a card below." } };
    }
    if (code === "charge_backoff") {
      return { ok: false, refusal: { kind: "retry", message: "Your bank asked us to wait a moment. Try again in a minute." } };
    }
    return { ok: false, refusal: { kind: "retry", message: "We could not reach your bank. Try again." } };
  }
}

/**
 * Wait for billing to hold the new credit and the card (the provider's webhook lands a
 * moment after the form reports), then arm the automatic reload when asked. Never pays.
 */
export async function settleTopup(
  creditedBefore: number,
  reload: { amountUsd: number } | null,
): Promise<{ ok: true; account: BillingAccount; reloadRefused: boolean } | { ok: false; message: string }> {
  let acct: BillingAccount | null = null;
  for (let i = 0; i < 20; i++) {
    acct = await getBillingAccount().catch((e) => {
      console.error("[get-started] billing read after payment failed:", e);
      return null;
    });
    if (acct && creditedCents(acct) > creditedBefore) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!acct || !(creditedCents(acct) > creditedBefore)) {
    console.error("[get-started] the paid credit did not reach billing in time", { creditedBefore, acct });
    return { ok: false, message: "Your payment is still being confirmed. Wait a few seconds and check again." };
  }
  try {
    // No threshold: billing reloads at $0 for everyone (owner 2026-11-18).
    if (reload) acct = await configureAutoTopup(reload.amountUsd * 100);
    // Optional (owner 2026-10-06): billing arms one by itself when a card is on file at
    // the switch to prepaid, so an org that did not ask for it has it taken off.
    // Postpaid has no auto top-up to take off (billing 409s it, owner 2026-10-21).
    else if (acct.payment_mode !== "postpaid" && acct.has_auto_topup) acct = await disableAutoTopup();
  } catch (e) {
    // The credit is paid, so a reload billing REFUSES never holds the launch back: the
    // org runs on what it paid and tops up by hand (Senthil 2026-10-17, CeXO AI: a card
    // issued in India takes no off-session mandate, and "Check again" looped forever).
    // A refusal is a 400 and the same card is refused every time; anything else may pass
    // on a retry.
    // An org billing still holds to a mandatory reload (409 `auto_topup_required`) keeps it:
    // the credit is paid, so the launch goes on with the reload on.
    if (e instanceof ApiError && e.status === 409 && e.body?.code === "auto_topup_required") {
      console.warn("[get-started] billing keeps the automatic reload on for this org:", e.body);
      return { ok: true, account: acct, reloadRefused: false };
    }
    if (e instanceof ApiError && e.status === 400) {
      console.warn("[get-started] automatic reload refused by billing, launching without it:", e.body);
      return { ok: true, account: acct, reloadRefused: true };
    }
    console.error("[get-started] automatic reload could not be set:", e);
    return { ok: false, message: "Your credit is added, but the automatic reload could not be set. Check again to retry." };
  }
  return { ok: true, account: acct, reloadRefused: false };
}
