/**
 * How an outstanding free-credit promise reads on the Billing page.
 *
 * A promise is money we have committed to but not granted: it unlocks once the
 * org's cumulative payments reach a bar billing froze when the promise was
 * created. billing-service owns every number here (amount, bar, progress); this
 * module only decides the words, and never computes a metric.
 *
 * Alias-free on purpose so it carries real unit tests. Do not add an `@/…` import.
 */

/** The shape this module reads. Structural, so a producer that adds fields still works. */
export interface PromiseView {
  kind?: string | null;
  referredOrgId?: string | null;
  referrerOrgId?: string | null;
  referredOrgName?: string | null;
  referredOrgDomain?: string | null;
  progressPct?: number | null;
}

/**
 * A promise exists because someone this org referred converted.
 *
 * Keyed on `referredOrgId` rather than on `kind`, because the id is what the
 * whole row is ABOUT: it is the difference between "$500 you are earning" and
 * "$500 someone earned for you", which is the distinction the customer asked to
 * see. A `kind` string is the producer's vocabulary and may be renamed.
 */
export function isEarnedByReferral(p: PromiseView): boolean {
  return !!p.referredOrgId;
}

/** A promise the invitee holds because they signed up through someone's link. */
export function isFromBeingReferred(p: PromiseView): boolean {
  return !p.referredOrgId && !!p.referrerOrgId;
}

/**
 * The row's heading.
 *
 * A referral row names the org that earned it when we have a name, because an
 * inviter holding three pending $500 rows cannot otherwise tell them apart. When
 * the name is absent it says so plainly rather than printing an id: a UUID is not
 * an answer to "who is this", and inventing a label would be worse.
 */
export function promiseTitle(p: PromiseView): string {
  if (isEarnedByReferral(p)) {
    const name = (p.referredOrgName ?? "").trim();
    return name ? `Referral credits from ${name}` : "Referral credits";
  }
  if (isFromBeingReferred(p)) return "Referral credits";
  return "Welcome credits";
}

/**
 * The one-line explanation under the heading.
 *
 * Deliberately states the REMAINING amount rather than the bar: "$500 more in
 * payments" is actionable, where "at $900 of cumulative payments" asks the reader
 * to do subtraction against a number they do not have on screen. `remaining` is
 * served, never computed here.
 */
export function promiseSubtitle(remainingLabel: string | null): string {
  if (!remainingLabel) return "Unlocks with your next payments.";
  return `Unlocks after ${remainingLabel} more in payments.`;
}

/**
 * The same sentence, naming the AMOUNT it unlocks.
 *
 * The sidebar states the total an org is owed as its heading, so the line under
 * the bar has to say which slice of that total the next payments actually open,
 * or a customer holding three promises reads the bar as progress toward the
 * whole. Billing needs no such disambiguation: its rows carry their own amount
 * on the right, so `promiseSubtitle` stays as it is and the two surfaces keep
 * one vocabulary.
 *
 * Both labels are formatted by the caller from served figures. With no remaining
 * amount it degrades to the same "with your next payments" wording rather than
 * inventing a bar.
 */
export function promiseUnlockLine(
  amountLabel: string,
  remainingLabel: string | null,
): string {
  // "free credits" is load-bearing, not decoration: without it the sentence puts
  // two dollar figures side by side and the first one reads as something else the
  // customer owes, rather than as the gift the second one buys.
  if (!remainingLabel) return `Unlock ${amountLabel} free credits with your next payments.`;
  return `Unlock ${amountLabel} free credits after ${remainingLabel} more in payments.`;
}

/**
 * Progress bar width, clamped to 0-100.
 *
 * The clamp guards the BAR, not the number: a served value outside the range
 * would otherwise paint outside its track. It is not a fallback, since an absent
 * progress renders no bar at all rather than a zeroed one, which would read as
 * "you have paid nothing" for a promise we simply could not measure.
 */
export function promiseProgressWidth(progressPct: number | null | undefined): number | null {
  if (typeof progressPct !== "number" || !Number.isFinite(progressPct)) return null;
  return Math.max(0, Math.min(100, progressPct));
}

/**
 * The percentage stated beside the bar.
 *
 * The bar alone shows a shape; a reader coming back tomorrow cannot tell a
 * slightly longer shape from yesterday's. A number can be compared day to day,
 * which is the whole point of putting it there.
 *
 * Two roundings are deliberate. Below 1% it reads `1%` rather than `0%`: a
 * promise with real payments behind it must never state that nothing has
 * happened. Below 100% it reads at most `99%`: rounding 99.6 up to `100%` claims
 * an unlock that has not happened, on the one surface whose job is to say how
 * close it is. `100%` therefore means exactly what it says.
 *
 * Returns null on the same input `promiseProgressWidth` returns null for, so the
 * label and the bar can never disagree about whether progress is measurable.
 */
export function promiseProgressLabel(progressPct: number | null | undefined): string | null {
  const width = promiseProgressWidth(progressPct);
  if (width === null) return null;
  if (width >= 100) return "100%";
  const rounded = Math.round(width);
  if (rounded >= 100) return "99%";
  if (rounded <= 0 && width > 0) return "1%";
  return `${rounded}%`;
}

/**
 * The line under the bar: where the promise stands, and an ask to keep going.
 *
 * The percentage alone is a reading; a reader has to decide for themselves what
 * it is asking of them. Stating both makes the bar a goal rather than a gauge,
 * which is the goal-gradient reading the card is built on.
 *
 * At 100% the encouragement is dropped: there is nothing left to keep going
 * toward, and asking for more payments on a bar that is already full contradicts
 * the number beside it. Returns null wherever `promiseProgressLabel` does, so the
 * sentence and the bar can never disagree about whether progress is measurable.
 */
export function promiseProgressSentence(progressPct: number | null | undefined): string | null {
  const label = promiseProgressLabel(progressPct);
  if (label === null) return null;
  if (label === "100%") return "100% achieved 🎉";
  return `${label} achieved. Keep going 💪`;
}
