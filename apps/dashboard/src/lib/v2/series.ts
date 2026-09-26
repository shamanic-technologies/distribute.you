/**
 * Sparkline windows for the v2 Dashboard's performance cards.
 *
 * features-service serves its per-day series SPARSE: a day nobody reached a step on
 * is ABSENT rather than present at zero, and a cumulative series has a point only on
 * a day something moved. A sparkline on a categorical axis would space two adjacent
 * days and a three-week gap identically, so the window is filled here — which is
 * READING the producer's contract (absent day = nothing happened; cumulative flat
 * across a gap), never a metric of ours. Nothing here sums or divides.
 *
 * Days are UTC calendar days (`YYYY-MM-DD`), the producer's own bucket.
 *
 * Alias-free so it carries real unit tests.
 */

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** The `days` UTC days ending on `today`, oldest first. */
export function windowDays(days: number, today: string): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(addDays(today, -i));
  return out;
}

/** Per-day counts over the window; a day the producer did not list is a zero. */
export function dailyWindow(
  daily: ReadonlyArray<{ date: string; count: number }> | undefined,
  days: number,
  today: string,
): number[] {
  const byDay = new Map<string, number>();
  for (const d of daily ?? []) byDay.set(d.date, d.count);
  return windowDays(days, today).map((day) => byDay.get(day) ?? 0);
}

/**
 * A CUMULATIVE series over the window: each day holds the latest value on or before
 * it, and a day before the first point holds 0 (nothing had accumulated yet).
 */
export function cumulativeWindow(
  points: ReadonlyArray<{ date: string; value: number }> | undefined,
  days: number,
  today: string,
): number[] {
  const sorted = [...(points ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let i = 0;
  let last = 0;
  return windowDays(days, today).map((day) => {
    while (i < sorted.length && sorted[i].date <= day) {
      last = sorted[i].value;
      i += 1;
    }
    return last;
  });
}
