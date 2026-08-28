/**
 * The ONE way an ROI multiple is printed anywhere in the dashboard.
 *
 * Under 10x the decimal carries information a reader acts on — 2.4x and 2.9x are
 * different answers about whether a campaign pays. At 30x it does not: nobody funds
 * differently at 29.5x than at 30x, and the decimal reads as false precision on a
 * figure that moves several points a day. So the rule is the same adaptive one the
 * repo already applies to money (`formatUsdAdaptive`): detail where it changes a
 * decision, none where it does not.
 *
 * EVERY ROI surface reads this function, and that is the load-bearing part rather
 * than the threshold itself. Coarsening was tried once before on a single surface
 * and correctly reverted: at a real 11.7 the chart headline read `12x` two inches
 * under a stat card reading `11.7x`, which is one number disagreeing with itself on
 * one screen. A second copy of this rule is how that comes back — so a new ROI cell,
 * axis tick, headline or email token calls `formatRoi`, never its own `toFixed`.
 */
const WHOLE_NUMBER_FROM = 10;

/** `2.4x` under ten, `30x` at ten and above. Absolute value, so a negative return coarsens on its own magnitude. */
export function roiDigits(multiple: number): number {
  return Math.abs(multiple) < WHOLE_NUMBER_FROM ? 1 : 0;
}

/**
 * `null`/`undefined` means the producer could not measure a return — it is NOT a
 * zero, so the caller supplies the word it uses for that (`-`, `—`, `Not measured`)
 * rather than getting a fabricated number here.
 */
export function formatRoi(multiple: number | null | undefined, absent = "—"): string {
  if (multiple == null || !Number.isFinite(multiple)) return absent;
  return `${multiple.toFixed(roiDigits(multiple))}×`;
}

/**
 * Break-even. A return above it means the money is coming back.
 */
const BREAK_EVEN = 1;

/**
 * Whether a return reads GREEN.
 *
 * ONE rule, one home, for the same reason `formatRoi` is one function: the ROI stat
 * card, the Return-on-spend headline and the Campaigns table's ROI cell all sit within
 * inches of each other, and three copies of `multiple > 1` is how they come to disagree
 * about where green starts.
 *
 * Above break-even is green; BELOW IT STAYS THE ORDINARY TEXT COLOUR, never red. A
 * campaign that has not finished learning is under 1x by construction, and painting that
 * red calls it a failure. Red is a verdict and there is none to state here.
 *
 * An unmeasurable return is not a bad one: `null` reads false, so it renders in the
 * ordinary colour beside the caller's own word for "we have no figure".
 */
export function roiIsGood(multiple: number | null | undefined): boolean {
  return multiple != null && Number.isFinite(multiple) && multiple > BREAK_EVEN;
}
