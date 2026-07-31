/**
 * What the onboarding gift step promises, for a plain signup and for one that
 * arrived through a referral link.
 *
 * The offer is a total, not a per-dollar match: a flat amount released once
 * cumulative PAYMENTS reach a bar, never on usage consumed. A referred signup
 * carries two of them, and the bars STACK rather than overlap, so the second
 * lands at the sum. That is billing's rule (each promise freezes its own bar at
 * `previous highest bar + its own amount`), restated here only as words.
 *
 * Why this screen may state the figures at all: an org's entitlement and bar are
 * frozen on its billing account when the account is created, and this step is
 * only ever shown to a brand-new signup, so it is always the current cohort.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */

/** Free credits a new account is offered today, and the payments that release them. */
export const WELCOME_CREDIT_USD = 400;

/** Up-front portion, in the account before anything is paid. Same for every cohort. */
export const WELCOME_UPFRONT_USD = 5;

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
    return `We will match your first ${usd(WELCOME_CREDIT_USD)} with ${usd(WELCOME_CREDIT_USD)} free credits.`;
  }
  return `You have ${usd(WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD)} in free credits waiting.`;
}

/**
 * The sentence under it: when each part actually lands.
 *
 * States both bars for a referred signup, because the second is what the extra
 * $500 is gated on and a single figure would read as though the whole amount
 * arrives at once.
 */
export function welcomeDetail(referred: boolean): string {
  const upfront = `${usd(WELCOME_UPFRONT_USD)} is in your account already.`;
  if (!referred) {
    return `${upfront} The rest lands automatically once your payments reach ${usd(WELCOME_CREDIT_USD)}.`;
  }
  return (
    `${upfront} ${usd(WELCOME_CREDIT_USD)} lands once your payments reach ${usd(WELCOME_CREDIT_USD)}, ` +
    `and your ${usd(REFERRAL_CREDIT_USD)} referral credits at ${usd(WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD)}.`
  );
}

/** Short line naming who sent them, when the invite told us. */
export function referredByLine(inviterName: string | null | undefined): string | null {
  const name = (inviterName ?? "").trim();
  if (!name) return null;
  return `${name} invited you.`;
}
