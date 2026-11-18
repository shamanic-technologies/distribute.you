import { formatCentsAsUsd } from "../format-number";

/**
 * The Billing "Auto top-up" sentence, built ONLY from the figures billing-service serves
 * for the org (`topup_threshold_cents`, `topup_amount_cents`), so the client reads exactly
 * what the next reload does. Owner 2026-11-18: the threshold is $0 for everyone and
 * editable nowhere (« On mets $0 pour tout le monde »), so the served 0 reads "When your
 * balance reaches $0, we add $10 from your card."; an account billing has not moved yet
 * still reads its own figure ("falls below $5"). The AMOUNT is the client's to change.
 * Never a hard-coded threshold and never a sum computed here.
 *
 * `autoTopupWhen` is the sentence up to the amount (the page renders the amount as an
 * editable value after it); null when billing serves no threshold: the caller says so.
 */
export function autoTopupWhen(thresholdCents: number | null | undefined): string | null {
  if (typeof thresholdCents !== "number") {
    console.error("[auto-topup-line] billing serves auto top-up on without a threshold", { thresholdCents });
    return null;
  }
  return thresholdCents === 0
    ? "When your balance reaches $0, we add"
    : `When your balance falls below ${usd(thresholdCents)}, we add`;
}

/** The whole sentence, for a surface that does not edit the amount. */
export function autoTopupLine(thresholdCents: number | null | undefined, amountCents: number | null | undefined): string | null {
  const when = autoTopupWhen(thresholdCents);
  if (when === null) return null;
  if (typeof amountCents !== "number") {
    console.error("[auto-topup-line] billing serves auto top-up on without an amount", { amountCents });
    return null;
  }
  return `${when} ${usd(amountCents)} from your card.`;
}

/**
 * A reload amount typed by the client: whole dollars ("10", "$25", "1,000") to cents.
 * 0 is accepted: it turns auto top-up off (owner 2026-11-18). Any other minimum is
 * billing's (it refuses less with `minimum_cents`), never a copy here.
 */
export function parseReloadAmountCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned) * 100;
}

/** Whole dollars when the figure is whole ($5), cents otherwise ($2.50). */
export function usd(cents: number): string {
  return formatCentsAsUsd(cents, cents % 100 === 0 ? 0 : 2);
}
