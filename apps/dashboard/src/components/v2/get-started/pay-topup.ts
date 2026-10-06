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
  configureAutoTopup,
  createEmbeddedCheckoutSession,
  disableAutoTopup,
  getBillingAccount,
  setPaymentMode,
  type BillingAccount,
} from "@/lib/api";
import { topupRefusal } from "@/lib/v2/get-started";

/** What a refused billing call says to the person: billing's minimums by name, else null. */
function refusalOf(e: unknown): string | null {
  return e instanceof ApiError && e.status === 400 ? topupRefusal(typeof e.body?.code === "string" ? e.body.code : undefined) : null;
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
  const session = await createEmbeddedCheckoutSession(params.amountUsd * 100).catch((e: unknown) => {
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
  return { clientSecret: session.client_secret, creditedBefore };
}

/**
 * Wait for billing to hold the new credit and the card (the provider's webhook lands a
 * moment after the form reports), then arm the automatic reload when asked. Never pays.
 */
export async function settleTopup(
  creditedBefore: number,
  reload: { thresholdUsd: number; amountUsd: number } | null,
): Promise<{ ok: true; account: BillingAccount } | { ok: false; message: string }> {
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
    if (reload) acct = await configureAutoTopup(reload.amountUsd * 100, reload.thresholdUsd * 100);
    // Optional (owner 2026-10-06): billing arms one by itself when a card is on file at
    // the switch to prepaid, so an org that did not ask for it has it taken off.
    else if (acct.has_auto_topup) acct = await disableAutoTopup();
  } catch (e) {
    console.error("[get-started] automatic reload could not be set:", e);
    return { ok: false, message: refusalOf(e) ?? "Your credit is added, but the automatic reload could not be set. Check again to retry." };
  }
  return { ok: true, account: acct };
}
