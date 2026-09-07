/**
 * What the onboarding gift step promises, for a plain signup and for one that
 * arrived through a referral link.
 *
 * The welcome offer is GIVEN, not earned: $30 lands in the account the moment it
 * is created, with no payments bar and no second instalment. It used to be a
 * match ($5 up front, $395 more once cumulative payments reached $400), which is
 * why every sentence here once named a threshold — there is no threshold left to
 * name, and copy that mentions one is describing the retired offer.
 *
 * The REFERRAL offer is still earned: it releases once cumulative PAYMENTS reach
 * a bar, never on usage consumed. Its bar is billing's rule (each promise freezes
 * its own at `previous highest bar + its own amount`), restated here only as
 * words — so it is DERIVED from the two amounts here and never written out, or
 * this copy states a bar billing does not hold.
 *
 * Why this screen may state the figures at all: an org's entitlement is frozen on
 * its billing account when the account is created, and this step is only ever
 * shown to a brand-new signup, so it is always the current cohort.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */

/** Free credits a new account receives at signup, in full, with nothing to earn. */
export const WELCOME_CREDIT_USD = 30;

/** Free credits each side of a converting referral earns. */
export const REFERRAL_CREDIT_USD = 500;

function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/**
 * The headline.
 *
 * A referred signup is told the FULL amount it is owed. Quoting only the welcome
 * figure to someone who is actually getting both understates the offer by the
 * larger of the two, at the exact screen where they decide to pay, and it
 * contradicts the invite link that brought them here.
 */
export function welcomeHeadline(referred: boolean): string {
  if (!referred) {
    return `${usd(WELCOME_CREDIT_USD)} in free credits, on the house.`;
  }
  return `You have ${usd(WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD)} in free credits waiting.`;
}

/**
 * The sentence under it: what is already there, and what still has to be earned.
 *
 * The welcome half states no condition because it has none. The referral half
 * states its bar, because that half really is gated and a single figure would
 * read as though the whole amount arrives at once.
 */
export function welcomeDetail(referred: boolean): string {
  const granted = `${usd(WELCOME_CREDIT_USD)} is in your account already.`;
  if (!referred) {
    return `${granted} Nothing to claim, and nothing to pay first.`;
  }
  return (
    `${granted} Your ${usd(REFERRAL_CREDIT_USD)} referral credits land once your ` +
    `payments reach ${usd(WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD)}.`
  );
}

/** Short line naming who sent them, when the invite told us. */
export function referredByLine(inviterName: string | null | undefined): string | null {
  const name = (inviterName ?? "").trim();
  if (!name) return null;
  return `${name} invited you.`;
}
