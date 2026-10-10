"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { v2Href } from "@/lib/v2/routes";
import { getPaymentHoldNow } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  billingHoldKind,
  PAYMENT_HOLD_NOTE,
  PAYMENT_HOLD_TITLE,
  scopePaymentHold,
  scopeStoppedOverPayment,
  type PaymentHoldKind,
  type StatusWithReason,
} from "@/lib/payment-declined";

/** Billing for the org the URL is on (v2 twin on a v2 page). */
function useBillingHref(): string | null {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const orgId = params?.orgId;
  const brandId = params?.brandId;
  const onV2 = usePathname()?.startsWith("/v2/") ?? false;
  return orgId ? (onV2 && brandId ? v2Href(orgId, brandId, "billing") : `/orgs/${orgId}/billing`) : null;
}

/**
 * The payment notice for a scope, decided on billing's CURRENT state.
 *
 * A campaign's payment stop reason is history; it stays after the org added a card
 * or moved to prepaid. So the notice asks billing (`["paymentHoldNow"]`, only while
 * the scope was stopped over payment) and speaks only while billing blocks the org,
 * in billing's own words (`scopePaymentHold(campaigns, billingHoldKind(...))`).
 * Billing unreadable: says it could not check, never a guessed "Add a card".
 */
export function PaymentHoldNotice({
  campaigns,
  className = "",
}: {
  campaigns: readonly StatusWithReason[];
  className?: string;
}) {
  const stopped = scopeStoppedOverPayment(campaigns);
  const hold = useAuthQuery(["paymentHoldNow"], getPaymentHoldNow, { enabled: stopped });
  const billingHref = useBillingHref();
  if (!stopped) return null;
  if (!hold.data) {
    if (!hold.isError) return null;
    return (
      <div
        role="status"
        className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
      >
        <p className="font-medium">We could not check your billing status.</p>
        {billingHref && (
          <Link
            href={billingHref}
            className="mt-2 inline-block rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            Open billing
          </Link>
        )}
      </div>
    );
  }
  const kind = scopePaymentHold(campaigns, billingHoldKind(hold.data));
  if (!kind) return null;
  return <PaymentDeclinedNotice kind={kind} className={className} />;
}

/**
 * "Your campaigns are paused" over payment (a declined card, or no card at all),
 * with the way out.
 *
 * Rendered only through `PaymentHoldNotice`, once billing says the org is held NOW
 * and the scope was stopped over payment with nothing running (a start is refused
 * while the hold lasts, so one running campaign proves it has cleared). The link
 * goes to Billing, where the card is added or changed, because that is the only
 * thing that lets a restart through.
 *
 * The org is the URL's, the per-tab source of truth the Billing route itself uses.
 * Rendered in dashboard v2 too, where Billing is the v2 twin.
 */
function PaymentDeclinedNotice({ kind, className = "" }: { kind: PaymentHoldKind; className?: string }) {
  const billingHref = useBillingHref();
  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      <p className="font-medium">{PAYMENT_HOLD_TITLE[kind]}</p>
      <p className="mt-0.5 text-amber-700">{PAYMENT_HOLD_NOTE[kind]}</p>
      {billingHref && (
        <Link
          href={billingHref}
          className="mt-2 inline-block rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          {kind === "no_payment_method" ? "Add a card" : "Fix billing"}
        </Link>
      )}
    </div>
  );
}
