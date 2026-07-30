/**
 * Timestamps a reader can place without doing arithmetic — "Today at 8:45am"
 * rather than "Jul 30, 2026", which makes you check today's date to know whether
 * it was an hour ago or last month.
 *
 * `now` is injectable so the day-boundary logic is unit-testable; every caller
 * leaves it defaulted.
 */

const DAY_MS = 86_400_000;

// Local midnight, NOT a UTC day count: "yesterday" is the reader's yesterday. A
// UTC-based diff calls 11pm and 1am the same night two different days for anyone
// west of Greenwich.
const startOfLocalDay = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * `Today` · `Yesterday` · `Jul 28, 2026`.
 *
 * There is deliberately no `Tomorrow`: the only future rows we render are
 * scheduled sends, and naming their day in relative terms overstates how firmly
 * they are pinned (the send window is weekdays 8am-5pm, so the day itself can
 * move). A future instant gets its plain calendar date.
 */
export function friendlyDate(at: string | Date, now: Date = new Date()): string {
  const d = new Date(at);
  const days = Math.round((startOfLocalDay(d) - startOfLocalDay(now)) / DAY_MS);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * `8:45am` · `10:45pm` · `12:03am`.
 *
 * Built by hand rather than via `toLocaleTimeString`, which separates the meridiem
 * with a NARROW NO-BREAK SPACE (U+202F) in current ICU — so the obvious
 * `.replace(" ", "")` silently leaves it in and the string renders with a stray gap.
 */
export function friendlyTime(at: string | Date): string {
  const d = new Date(at);
  const h24 = d.getHours();
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}${h24 < 12 ? "am" : "pm"}`;
}

/** `Today at 8:45am`. For instants that HAPPENED — see `friendlyDate` on the future. */
export function friendlyDateTime(at: string | Date, now: Date = new Date()): string {
  return `${friendlyDate(at, now)} at ${friendlyTime(at)}`;
}
