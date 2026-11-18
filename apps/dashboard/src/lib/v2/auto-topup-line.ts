import { formatCentsAsUsd } from "../format-number";

/**
 * The Billing "Auto top-up" card and its modal (owner 2026-11-18, BILLING-AUTOTOPUP-MODAL-1118).
 * The card reads ONE plain sentence built only from billing's served figures
 * (`topup_threshold_cents`, `topup_amount_cents`); the amount changes in the modal the launch
 * payment step already draws ("Reload my credit automatically", "When my balance reaches $0,
 * add $[ ]"). The threshold is $0 for everyone and editable nowhere; an account billing has
 * not moved yet still reads its own figure. $0 (or the box unticked) turns auto top-up off.
 * Every minimum is billing's (reload rules / `minimum_cents`), never a copy here.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

/** Whole dollars when the figure is whole ($5), cents otherwise ($2.50). */
export function usd(cents: number): string {
  return formatCentsAsUsd(cents, cents % 100 === 0 ? 0 : 2);
}

/**
 * The card's sentence, value first. null when billing serves auto top-up on without a
 * threshold or an amount: the caller says it could not read them, never fills one in.
 */
export function autoTopupSentence(
  on: boolean,
  thresholdCents: number | null | undefined,
  amountCents: number | null | undefined,
): string | null {
  if (!on) return "Off. Your campaigns pause when your balance reaches $0.";
  if (typeof thresholdCents !== "number" || typeof amountCents !== "number") {
    console.error("[auto-topup-line] billing serves auto top-up on without its figures", { thresholdCents, amountCents });
    return null;
  }
  return thresholdCents === 0
    ? `Adds ${usd(amountCents)} each time your balance reaches $0.`
    : `Adds ${usd(amountCents)} each time your balance falls below ${usd(thresholdCents)}.`;
}

/**
 * A reload amount typed by the client: whole dollars ("10", "$25", "1,000") to cents.
 * 0 is accepted: it turns auto top-up off (owner 2026-11-18).
 */
export function parseReloadAmountCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned) * 100;
}

/**
 * What the modal saves: 0 (off) when the box is unticked or $0 is typed, else the amount,
 * checked against billing's reload minimum (`reloadMinCents`, from its reload rules).
 */
export function reloadToSave(
  input: { on: boolean; amount: string },
  reloadMinCents: number,
): { cents: number } | { problem: string } {
  if (!input.on) return { cents: 0 };
  const cents = parseReloadAmountCents(input.amount);
  if (cents === null) return { problem: "Whole dollars." };
  if (cents !== 0 && cents < reloadMinCents) return { problem: `At least ${usd(reloadMinCents)}, or $0 to turn it off.` };
  return { cents };
}

/**
 * billing's refusal, in plain words for the modal. A 409 `auto_topup_required` is billing
 * refusing to switch it off; it contradicts the owner's rule ($0 turns it off for everyone)
 * and billing-service drops it (RELOAD-ZERO-OFF-1118), so it is said as ours to fix.
 */
export function reloadRefusal(status: number | null, body: { code?: unknown; minimum_cents?: unknown } | null | undefined): string {
  if (status === 400 && typeof body?.minimum_cents === "number") return `At least ${usd(body.minimum_cents)}, or $0 to turn it off.`;
  if (status === 409 && body?.code === "auto_topup_required")
    return "Auto top-up could not be turned off on this account yet. We are fixing it, try again in a few minutes.";
  return "Not saved. Try again.";
}
