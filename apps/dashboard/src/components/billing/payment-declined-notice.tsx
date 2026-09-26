"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PAYMENT_DECLINED_NOTE } from "@/lib/payment-declined";

/**
 * "Your campaigns are paused because your card was declined", with the way out.
 *
 * Rendered by a surface only when `scopeHeldByPayment` says so: a campaign
 * campaign-service stopped over a declined card, and nothing in scope running
 * (a start is refused while the hold lasts, so one running campaign proves it has
 * cleared). The link goes to Billing, where the balance is paid and the card is
 * changed, because that is the only thing that lets a restart through.
 *
 * The org is the URL's, the per-tab source of truth the Billing route itself uses.
 */
export function PaymentDeclinedNotice({ className = "" }: { className?: string }) {
  const params = useParams<{ orgId?: string }>();
  const orgId = params?.orgId;
  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      <p className="font-medium">Campaigns paused: payment declined</p>
      <p className="mt-0.5 text-amber-700">{PAYMENT_DECLINED_NOTE}</p>
      {orgId && (
        <Link
          href={`/orgs/${orgId}/billing`}
          className="mt-2 inline-block rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Fix billing
        </Link>
      )}
    </div>
  );
}
