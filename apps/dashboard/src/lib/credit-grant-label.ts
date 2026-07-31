/**
 * Human name for a credit grant's `reason`, on the Billing page's gifts ledger.
 *
 * The reason is billing-service's own vocabulary, and the ledger is where a
 * customer finds out the money they were promised actually arrived. So an
 * unmapped reason is not a cosmetic gap: it prints a database column at the exact
 * moment the feature pays off. `referral_reward` and `welcome_completion` both
 * used to land in the `Promo: <code>` default, so the first $500 a customer ever
 * earned would have read `Promo: referral_reward`.
 *
 * A reason we genuinely do not know still falls through to `Promo: <code>`,
 * deliberately: that is honest about it being an unrecognised code rather than
 * inventing a friendly name for something we cannot describe.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */

/** Grant reasons billing issues today, mapped to what a customer should read. */
const GRANT_LABELS: Record<string, string> = {
  // Signup gift, the up-front part of the welcome offer.
  welcome: "Welcome gift",
  // The remainder of the welcome offer, released once payments reach its bar.
  welcome_completion: "Welcome credits",
  // A referral that converted: either one we earned, or the one we were given.
  referral_reward: "Referral credits",
  // Staff-issued.
  admin_grant: "Bonus credit",
};

export function creditGrantLabel(reason: string): string {
  const known = GRANT_LABELS[reason];
  if (known) return known;
  // Legacy reasons from the first invite implementation (`invite_welcome`,
  // `invite_reward`). Historical rows exist and deserve a human name.
  if (reason.startsWith("invite")) return "Referral credits";
  return `Promo: ${reason}`;
}
