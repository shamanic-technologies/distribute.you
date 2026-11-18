import { formatCentsAsUsd } from "../format-number";

/**
 * The Billing "Auto top-up" sentence, built ONLY from the two figures billing-service
 * serves for the org (`topup_threshold_cents`, `topup_amount_cents`), so the client reads
 * exactly what the next reload does: "When your balance falls below $5, we add $10 from
 * your card." (owner 2026-11-11: each reload ADDS at least $10 when the balance falls below
 * the threshold; billing-service owns that minimum, this line only prints what it stores).
 * Never a hard-coded threshold (the page said "reaches $0" for a $5 threshold, 2026-11-18)
 * and never a sum computed here ("threshold + $10" is not the rule).
 *
 * Returns null when billing serves either figure missing: the caller says so plainly
 * instead of printing a made-up amount.
 */
export function autoTopupLine(thresholdCents: number | null | undefined, amountCents: number | null | undefined): string | null {
  if (typeof thresholdCents !== "number" || typeof amountCents !== "number") {
    console.error("[auto-topup-line] billing serves auto top-up on without both figures", { thresholdCents, amountCents });
    return null;
  }
  return `When your balance falls below ${usd(thresholdCents)}, we add ${usd(amountCents)} from your card.`;
}

/** Whole dollars when the figure is whole ($5), cents otherwise ($2.50). */
function usd(cents: number): string {
  return formatCentsAsUsd(cents, cents % 100 === 0 ? 0 : 2);
}
