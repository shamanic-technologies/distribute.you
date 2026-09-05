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

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/**
 * `Just now` · `1 minute ago` · `3 hours ago` · `2 days ago` · `Jul 28, 2026`.
 *
 * How long ago, for a surface where the reader is judging FRESHNESS rather than
 * placing an instant — a triage card asking "is this still moving". Under a minute
 * reads `Just now` rather than a second count, which changes while you look at it
 * and says nothing a person acts on.
 *
 * Days are CALENDAR days, the same local-midnight diff `friendlyDate` uses, so a
 * card that says `Yesterday` on the lead's panel cannot say `1 day ago` here for an
 * instant 30 hours back and `2 days ago` for one 26 hours back. Past ~30 days the
 * elapsed count stops helping and it falls back to the plain calendar date.
 *
 * A FUTURE instant reads `Just now`, never a negative count: nothing rendered
 * through this has happened later than now, so a clock skew of a few seconds must
 * not print `-1 minutes ago`.
 */
export function timeAgo(at: string | Date, now: Date = new Date()): string {
  const d = new Date(at);
  const elapsed = now.getTime() - d.getTime();
  if (elapsed < MINUTE_MS) return "Just now";
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(d)) / DAY_MS);
  if (days < 1) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (days > 30) return friendlyDate(d, now);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/**
 * How long UNTIL something, for a reader deciding whether to wait or to act now.
 *
 * The mirror of `timeAgo`, and it exists because that function deliberately refuses
 * the future: it reads a later instant as `Just now` so a few seconds of clock skew
 * cannot print `-1 minutes ago`. A follow-up we owe is legitimately days out, so the
 * one surface that renders it needs the other direction rather than a negated copy.
 *
 * Days are CALENDAR days, the same local-midnight diff the rest of this module uses,
 * so a follow-up due tomorrow morning cannot read `in 14 hours` here while the row
 * above it says `Tomorrow`. Past ~30 days the count stops helping and it falls back to
 * the plain calendar date.
 *
 * A PAST instant reads `now`, never a negative count. That is not a rounding: a due
 * date in the past means the person is owed an answer and is waiting in the queue,
 * which is exactly what `now` says.
 */
export function timeUntil(at: string | Date, now: Date = new Date()): string {
  const d = new Date(at);
  const remaining = d.getTime() - now.getTime();
  if (remaining < MINUTE_MS) return "now";
  if (remaining < HOUR_MS) {
    const minutes = Math.floor(remaining / MINUTE_MS);
    return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const days = Math.round((startOfLocalDay(d) - startOfLocalDay(now)) / DAY_MS);
  if (days < 1) {
    const hours = Math.floor(remaining / HOUR_MS);
    return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  if (days > 30) return `on ${friendlyDate(d, now)}`;
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}
