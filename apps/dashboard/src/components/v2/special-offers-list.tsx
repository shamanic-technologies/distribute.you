"use client";

import { formatBillingCents } from "@/lib/format-number";
import { formatGrantDate } from "@/components/billing/billing-display";
import type { SpecialOffer } from "@/lib/special-offers";

/**
 * One card per special offer the org took (Black Friday 2026...): its name, what
 * the org paid under it and the free credit it gave, then each payment with its date.
 * Every figure is billing-service's own total, printed as served (SPECIAL-OFFER-BF-1127).
 */
export function SpecialOffersList({ offers }: { offers: SpecialOffer[] }) {
  return (
    <div className="space-y-3">
      {offers.map((offer) => (
        <div key={offer.slug} className="k-card overflow-hidden" data-special-offer={offer.slug}>
          <p className="px-4 pb-3 pt-3.5 text-[14px] font-medium leading-5">{offer.name}</p>
          <div className="k-line-subtle grid grid-cols-2 divide-x divide-[var(--line-subtle)] border-t">
            <div className="px-4 py-3">
              <p className="k-label">You paid</p>
              <p className="mt-1 text-[22px] font-medium leading-7 tabular-nums">{formatBillingCents(offer.paidCents)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="k-label">Free credit</p>
              <p className="mt-1 text-[22px] font-medium leading-7 tabular-nums text-[var(--data-teal)]">
                +{formatBillingCents(offer.freeCreditCents)}
              </p>
            </div>
          </div>
          {/* One payment: its date only (its amounts ARE the totals above). Several: one row each. */}
          {offer.payments.length === 1 && (
            <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
              Paid on <span className="k-mono">{formatGrantDate(offer.payments[0].paidAt)}</span>
            </p>
          )}
          {offer.payments.length > 1 && (
            <ul>
              {offer.payments.map((payment) => (
                <li
                  key={payment.paymentId}
                  className="k-line-subtle flex min-h-10 items-center justify-between gap-3 border-t px-4 py-2"
                >
                  <span className="k-fg3 k-mono text-[12px]">{formatGrantDate(payment.paidAt)}</span>
                  <span className="flex shrink-0 items-center gap-4 text-[13px] tabular-nums">
                    <span>{formatBillingCents(payment.paidCents)} paid</span>
                    <span className="text-[var(--data-teal)]">+{formatBillingCents(payment.freeCreditCents)} credit</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
