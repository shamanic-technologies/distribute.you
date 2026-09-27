// The maturation window: an email sent today has not had time to earn its reply or its click, so
// every cost per outcome and every outcome rate that counts recent sends reads too expensive and
// too low. The window is MEASURED from our own data, never guessed: the time from the email that
// earned an outcome to the outcome, per outcome, at a high percentile. Emails sent within that many
// days of the window's end are left out of every outcome figure (their outcomes with them).
//
// Pure functions, no I/O, so they carry real unit tests (tests/unit/blog-data-maturation.test.ts).

/** The percentile the window covers: 95 of 100 outcomes arrive within it. */
export const MATURATION_PERCENTILE = 0.95;
/**
 * A latency is only measured on emails sent at least this long before the window's end. A recent
 * email can only show a short latency (the long ones have not happened yet), so measuring on it
 * would pull the percentile down and the window with it.
 */
export const MEASURE_LOOKBACK_DAYS = 45;

const DAY_MS = 86_400_000;

/** A timestamp as the dumps carry it (`2026-09-10 14:38:03.179`, UTC) or ISO, in ms. */
export function toMs(ts) {
  const s = String(ts).trim();
  const iso = s.replace(" ", "T");
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso.slice(10)) ? iso : `${iso}Z`);
  if (!Number.isFinite(ms)) throw new Error(`not a timestamp: ${ts}`);
  return ms;
}

/** Nearest-rank percentile. An empty sample has none, and says so. */
export function percentile(values, p) {
  if (!values.length) throw new Error("percentile of an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

/**
 * Measure the window from outcome latencies. `samples` is `{ reply: [{sentMs, outcomeMs}], click: [...] }`,
 * each pair being one outcome and the email that earned it. Only emails old enough to have shown a
 * long latency count. The window is the LONGER of the two, rounded up to a whole day, so one rule
 * covers every figure.
 */
export function measureMaturation(samples, windowEndMs, { percentileAt = MATURATION_PERCENTILE, lookbackDays = MEASURE_LOOKBACK_DAYS } = {}) {
  const oldEnough = windowEndMs - lookbackDays * DAY_MS;
  const measure = (pairs) => {
    const days = pairs.filter((s) => s.sentMs < oldEnough && s.outcomeMs >= s.sentMs).map((s) => (s.outcomeMs - s.sentMs) / DAY_MS);
    if (!days.length) throw new Error("no outcome old enough to measure a maturation window on");
    return { sample: days.length, p50: round1(percentile(days, 0.5)), pAt: round1(percentile(days, percentileAt)) };
  };
  const reply = measure(samples.reply);
  const click = measure(samples.click);
  const days = Math.ceil(Math.max(reply.pAt, click.pAt));
  return { percentile: percentileAt, lookbackDays, reply, click, days };
}

/** The first day NOT counted: emails sent on or after it are too young. `YYYY-MM-DD`. */
export function maturationCutoff(windowEnd, days) {
  const end = toMs(`${windowEnd} 00:00:00`);
  return new Date(end - days * DAY_MS).toISOString().slice(0, 10);
}

/** True when an email sent at `sentAt` has had the full window to earn its outcome. */
export function isMature(sentAt, cutoff) {
  return toMs(sentAt) < toMs(`${cutoff} 00:00:00`);
}

/** The line a reader sees under every chart and study, in plain English. */
export function maturationNote(m, cutoff) {
  return `Emails sent in the last ${m.days} days are left out (from ${cutoffText(cutoff)} on): 95 in 100 replies and clicks arrive within ${m.days} days of the email that earned them.`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function cutoffText(cutoff) {
  return `${MONTHS[Number(cutoff.slice(5, 7)) - 1]} ${Number(cutoff.slice(8, 10))}`;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
