import type { BillingAccount } from "./api";

/**
 * Brand credit runway — pure, client-side. "Available credit" is the same
 * spendable balance the billing page shows as "Available" (total credited −
 * confirmed charges − provisioned holds = `balance_cents`), and the brand's
 * saved daily budget is the daily burn, so `available ÷ dailyBudget` is the
 * whole-day runway (floored — we warn early rather than late).
 *
 * No backend dependency: balance + auto-topup + the per-brand daily budget are
 * already on the wire. A display affordance over existing data, not a
 * missing-backend-data workaround.
 */

/**
 * "Available" credit in cents = the billing page's Available =
 * total credited − confirmed charges − provisioned holds = `balance_cents`.
 */
export function availableCreditCents(
  account: Pick<BillingAccount, "balance_cents">,
): number {
  return parseFloat(account.balance_cents);
}

/**
 * Day tiers the top-up amount presets map to. Each preset = daily budget × tier,
 * so the buttons offer "N days of runway" expressed as a dollar amount.
 */
export const TOPUP_DAY_TIERS = [5, 15, 45, 135];

/** Flat fallback presets (cents) when no daily budget is set → can't size by days. */
export const FALLBACK_TOPUP_CENTS = [1000, 2500, 5000, 10000];

/**
 * Top-up preset amounts (cents) sized to {@link TOPUP_DAY_TIERS} days of the given
 * daily budget — rounded to whole dollars, floored at the $10 minimum, deduped so
 * a tiny budget can't collapse two tiers onto the same value. Returns the flat
 * {@link FALLBACK_TOPUP_CENTS} when no daily budget is set (0/null).
 */
export function topupPresetsForDailyBudget(dailyBudgetCents: number | null): number[] {
  if (dailyBudgetCents === null || dailyBudgetCents <= 0) return FALLBACK_TOPUP_CENTS;
  const amounts = TOPUP_DAY_TIERS.map((days) => {
    const roundedToDollar = Math.round((dailyBudgetCents * days) / 100) * 100;
    return Math.max(1000, roundedToDollar);
  });
  return Array.from(new Set(amounts));
}
