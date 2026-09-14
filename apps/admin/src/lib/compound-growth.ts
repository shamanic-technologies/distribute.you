/**
 * Compound growth rate (CMGR / CWGR) of a per-period value series, since inception.
 *
 * For each bucket i: `((v_i / v_base) ^ (1/n) - 1) * 100`, where `v_base` is the
 * first value > 0 (the anchor) and `n` is the number of CALENDAR periods between
 * the anchor's bucket and bucket i. Anchoring on the first non-zero value avoids
 * the zero-base blowup. Values are per-period counts (a flow), never cumulative.
 * Null for the anchor itself and any leading zero periods.
 *
 * The exponent counts CALENDAR periods, not bars, because a series can have a
 * HOLE: a producer serves no bucket for a period it could not measure, and the
 * dashboard drops the buckets it cannot chart. Counting bars then divides a
 * ten-week span by seven, which overstates the rate — and on a categorical axis
 * the two neighbours of the hole render side by side, so nothing on screen says
 * a period is missing. Prod today: the weekly MRR split runs 2026-W29 → 2026-W38
 * with W32 absent, nine bars for ten weeks.
 */
export function compoundGrowthSeries(values: number[], keys: string[]): Array<number | null> {
  const baseIndex = values.findIndex((v) => v > 0);
  const baseValue = baseIndex >= 0 ? values[baseIndex] : 0;
  return values.map((value, index) => {
    const periods = baseIndex >= 0 ? periodsBetween(keys[baseIndex], keys[index]) : null;
    if (!(baseValue > 0) || periods === null || periods < 1) return null;
    return Number(((Math.pow(value / baseValue, 1 / periods) - 1) * 100).toFixed(1));
  });
}

export interface CompoundGrowthSummary {
  latestPct: number | null;
  /**
   * How many CALENDAR periods the headline rate spans: the anchor period (the
   * first value > 0) through the last CONCLUDED period, inclusive. So the
   * compound exponent is `1/(periodsSpanned - 1)`. Null whenever `latestPct` is
   * null — there is no rate, so there is no span to state.
   *
   * Inclusive and calendar-counted, so it reads as an ordinal on the card
   * ("CWGR since inception (Week #10)" = the tenth week since the first one) and
   * it stays true across a hole in the series, where a bar count would not.
   */
  periodsSpanned: number | null;
}

/**
 * The headline compound growth rate for a series, excluding the current
 * (still-in-progress, partial) period = the last element.
 *
 * ONE rate per card. There used to be a second line under it reading
 * "N% average <unit> since inception", and it was the arithmetic MEAN of the
 * plotted compound-rate points. Averaging a rate that is already cumulative from
 * one fixed anchor measures nothing — it is the mean of a converging curve — so
 * it routinely carried the OPPOSITE SIGN to the headline directly above it, under
 * a label claiming they described the same thing (prod 2026-09-14: `+3.6%` beside
 * `-3.7%`). Do NOT re-add an average; a better label would not make it a statistic.
 */
export function compoundGrowthSummary(
  cmgr: Array<number | null>,
  keys: string[],
): CompoundGrowthSummary {
  if (cmgr.length < 2) return { latestPct: null, periodsSpanned: null };
  const concluded = cmgr.slice(0, -1); // drop the current partial period
  const latestPct = concluded[concluded.length - 1] ?? null;
  return { latestPct, periodsSpanned: calendarSpan(concluded, keys, latestPct) };
}

/**
 * Calendar periods the headline rate spans. The anchor is the first index
 * carrying a compound point minus one (that point is already one period past the
 * anchor); the span is the calendar distance from there to the last concluded
 * bucket, plus one so it counts inclusively.
 */
function calendarSpan(
  concluded: Array<number | null>,
  keys: string[],
  latestPct: number | null,
): number | null {
  if (latestPct === null) return null;
  const firstPoint = concluded.findIndex((v) => v !== null);
  if (firstPoint < 1) return null;
  const distance = periodsBetween(keys[firstPoint - 1], keys[concluded.length - 1]);
  return distance === null ? null : distance + 1;
}

/**
 * Calendar periods between two bucket keys, read off the key's own SHAPE:
 * `YYYY-MM` months, `YYYY-Www` ISO weeks, `YYYY-MM-DD` days. Null when either key
 * is absent or malformed — "we cannot tell how far apart these are" is not zero,
 * and a zero would divide a rate by nothing.
 *
 * Every producer in this app already keys its buckets one of those three ways
 * (features-service `period`, the signup/active-user aggregators), so this needs
 * no new field on the wire.
 */
export function periodsBetween(fromKey: string | undefined, toKey: string | undefined): number | null {
  if (!fromKey || !toKey) return null;
  const from = periodOrdinal(fromKey);
  const to = periodOrdinal(toKey);
  if (from === null || to === null || from.unit !== to.unit) return null;
  return to.ordinal - from.ordinal;
}

type PeriodOrdinal = { unit: "month" | "week" | "day"; ordinal: number };

function periodOrdinal(key: string): PeriodOrdinal | null {
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) {
    const monday = isoWeekMonday(Number(week[1]), Number(week[2]));
    return monday === null ? null : { unit: "week", ordinal: Math.round(monday / 604800000) };
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (day) {
    const utc = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return Number.isNaN(utc) ? null : { unit: "day", ordinal: Math.round(utc / 86400000) };
  }
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) return { unit: "month", ordinal: Number(month[1]) * 12 + (Number(month[2]) - 1) };
  return null;
}

/** UTC ms of the Monday opening ISO week `week` of `year`. Jan 4 is always in week 1. */
function isoWeekMonday(year: number, week: number): number | null {
  if (!(week >= 1 && week <= 53)) return null;
  const jan4 = Date.UTC(year, 0, 4);
  const dow = new Date(jan4).getUTCDay() || 7; // Sunday -> 7
  return jan4 - (dow - 1) * 86400000 + (week - 1) * 604800000;
}
