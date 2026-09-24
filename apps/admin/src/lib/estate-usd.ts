/**
 * The cold-email estate in ONE currency: US dollars.
 *
 * The estate bills in two currencies (Gandi in euros, every other vendor in
 * dollars), and instantly-service now serves a USD TWIN beside every money
 * figure, converted at the ECB daily reference rate it names on the response
 * (`fx`). This module reads those twins; it converts nothing and holds no rate.
 * A dashboard-side conversion would be a second rate nobody owns, which is the
 * thing the twins exist to remove.
 *
 * ⚠️ A null `usd` on a PRICED row means "cannot state this in dollars" (no rate
 * is on record), never zero. So a total never sums a null twin as 0: if any
 * priced row has no USD figure, the total is UNAVAILABLE, not partial.
 *
 * Deliberately alias-free (no `@` import at all) so it carries real unit tests.
 */

/** Structural subset of the served `fx` block. */
export interface FxRateLike {
  base: string;
  quote: string;
  rate: number;
  asOf: string;
  source: string;
}

/** How a rate's source is named to a reader. An unknown source reads verbatim. */
const FX_SOURCE_LABEL: Record<string, string> = {
  "ecb-eurofxref-daily": "ECB reference rate",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * `2026-09-23` -> `23 Sep 2026`, read in UTC so it never slips a day. Spelled
 * by hand: ICU's en-GB short month is `Sept` in some runtimes and `Sep` in
 * others, so the same rate would read two ways across server and browser.
 */
function fxDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The one line that says how euros became dollars, e.g.
 * `EUR converted at 1 EUR = $1.1411 (ECB reference rate, 23 Sep 2026)`.
 * Read off the served `fx`, never a constant.
 */
export function fxRateLine(fx: FxRateLike): string {
  const source = FX_SOURCE_LABEL[fx.source] ?? fx.source;
  return `${fx.base} converted at 1 ${fx.base} = $${fx.rate} (${source}, ${fxDay(fx.asOf)})`;
}

/** What the page says when no rate is on record, so no USD figure can be stated. */
export const FX_UNAVAILABLE_NOTE =
  "No EUR to USD exchange rate is on record, so the estate cannot be stated in dollars right now.";

export type UsdTotal =
  | {
      kind: "total";
      cents: number;
      /** Rows with no price at all, contributing nothing rather than a guess. */
      unpriced: number;
    }
  | {
      kind: "unavailable";
      /** Priced rows whose USD twin is null: the reason there is no total. */
      unconvertible: number;
    };

/**
 * Sum one USD twin over a set of rows.
 *
 * A row with NO native price is unpriced and adds nothing (stated as a count).
 * A row WITH a native price and a null twin cannot be stated in dollars, and
 * one such row makes the whole total unavailable: a partial sum labelled as the
 * total would understate by an amount nobody can see.
 */
export function usdTotal(
  rows: readonly { native: number | null; usd: number | null }[],
): UsdTotal {
  let cents = 0;
  let unpriced = 0;
  let unconvertible = 0;
  for (const r of rows) {
    if (r.native === null) {
      unpriced += 1;
      continue;
    }
    if (r.usd === null) {
      unconvertible += 1;
      continue;
    }
    cents += r.usd;
  }
  if (unconvertible > 0) return { kind: "unavailable", unconvertible };
  return { kind: "total", cents, unpriced };
}

/**
 * The native amount as provenance beside a USD figure, e.g. `billed €3.20`.
 * Null when the native amount is already dollars (nothing to add) or absent.
 */
export function billedNative(cents: number | null, currency: string | null): string | null {
  if (cents === null || !currency || currency === "USD") return null;
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `billed ${amount}`;
}

/**
 * Whether the vendor's mailbox count genuinely disagrees with ours.
 *
 * A vendor whose inventory never reports mailboxes (Instantly DFY: its
 * mailboxes ARE the Instantly accounts, and reporting them would double-count
 * the fleet) serves `vendorMailboxes: 0` meaning "not reported". That is not a
 * disagreement, so it is never flagged.
 */
export function vendorMailboxMismatch(row: {
  vendorReportsMailboxes: boolean;
  vendorMailboxes: number;
  mailboxes: number;
}): boolean {
  return row.vendorReportsMailboxes && row.vendorMailboxes !== row.mailboxes;
}
