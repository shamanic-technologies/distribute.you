/**
 * The homepage's offer banner states a deadline that always reads as the last day of the
 * current month (owner 2026-10-06: "the $100 matching is ongoing for now. Always put the
 * last day of the month, whatever today's date"). The offer itself has no end date in
 * billing; the date is urgency, rewritten on every request so it never goes stale.
 *
 * Alias-free and pure so it carries real unit tests.
 */
const UNTIL = /<span data-promo-until>[^<]*<\/span>/g;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "October 31": the last day of `now`'s month, in UTC. */
export function lastDayOfMonthLabel(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return `${MONTHS[m]} ${new Date(Date.UTC(y, m + 1, 0)).getUTCDate()}`;
}

export function withPromoUntil(html: string, now: Date): string {
  if (!UNTIL.test(html)) throw new Error("[landing] the offer banner has no <span data-promo-until> to date");
  UNTIL.lastIndex = 0;
  return html.replace(UNTIL, `<span data-promo-until>${lastDayOfMonthLabel(now)}</span>`);
}
