"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { v2Href } from "@/lib/v2/routes";
import { PAYMENT_HOLD_NOTE, PAYMENT_HOLD_TITLE, type PaymentHoldKind } from "@/lib/payment-declined";

/**
 * "Your campaigns are paused" over payment (a declined card, or no card at all),
 * with the way out.
 *
 * Rendered by a surface only when `scopePaymentHold` names a kind: a campaign
 * campaign-service stopped over payment, and nothing in scope running (a start is
 * refused while the hold lasts, so one running campaign proves it has cleared).
 * The link goes to Billing, where the card is added or changed, because that is
 * the only thing that lets a restart through.
 *
 * The org is the URL's, the per-tab source of truth the Billing route itself uses.
 * Rendered in dashboard v2 too, where Billing is the v2 twin.
 */
export function PaymentDeclinedNotice({ kind, className = "" }: { kind: PaymentHoldKind; className?: string }) {
  const params = useParams<{ orgId?: string; brandId?: string }>();
  const orgId = params?.orgId;
  const brandId = params?.brandId;
  const onV2 = usePathname()?.startsWith("/v2/") ?? false;
  const billingHref = orgId
    ? onV2 && brandId
      ? v2Href(orgId, brandId, "billing")
      : `/orgs/${orgId}/billing`
    : null;
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
