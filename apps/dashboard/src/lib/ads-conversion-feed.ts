/**
 * The Google Ads OFFLINE CONVERSION feed: what happened to each ad click, in the
 * shape Google's "Conversions from clicks" upload takes.
 *
 * Why it exists: the in-browser `gtag` conversions (`manual_event_SIGNUP` /
 * `manual_event_PURCHASE`) reach Google for roughly one signup in six — ad
 * blockers, consent, the onboarding return landing on a different layout — and
 * the purchase never fired at all. Max-conversions bidding cannot learn on that.
 * So the dashboard records the click id (gclid) on the org at signup, and this
 * feed states every signup and every paid top-up against that gclid. A Google
 * Ads Script fetches it daily and bulk-uploads it, which needs no API token.
 *
 * Two conversion actions, named byte-equal with the account's "Import from
 * clicks" actions: `offline_signup` (value 1) and `offline_purchase` (value =
 * the amount Stripe actually received, so "maximize conversion value" bids on
 * real money).
 *
 * Google dedupes an upload on (gclid, conversion name, conversion time), so the
 * feed is re-uploadable every day with no double counting.
 *
 * Alias-free on purpose so it carries real unit tests.
 */

export const OFFLINE_SIGNUP_CONVERSION = "offline_signup";
export const OFFLINE_PURCHASE_CONVERSION = "offline_purchase";

/** Google refuses a conversion whose click is older than 90 days. */
export const GCLID_MAX_AGE_DAYS = 90;

export interface AttributedOrg {
  orgId: string;
  gclid: string;
  /** When the signup happened (the org's first-touch attribution moment). */
  gclidAt: Date;
}

export interface PaidTopUp {
  /** Stripe PaymentIntent id, for logging only. */
  id: string;
  /** Unix seconds, Stripe's own `created`. */
  created: number;
  /** Cents Stripe received, net of what it returned. */
  netCents: number;
}

export interface ConversionRow {
  gclid: string;
  conversionName: string;
  conversionTime: Date;
  conversionValue: number;
  currency: "USD";
}

/** Google's upload time format: `yyyy-MM-dd HH:mm:ss+00:00`. */
export function formatAdsTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
  );
}

/**
 * Build the rows for one attributed org. Rules, each of which Google enforces on
 * its side too, so they are stated here rather than discovered on upload:
 * - the signup is the moment attribution was recorded; a signup older than
 *   `since` is left out (the feed is a rolling window, and the click behind an
 *   older signup is past the 90-day match window anyway);
 * - a top-up before the signup cannot belong to this click and is skipped;
 * - a top-up that received nothing (setup-mode card imprint, fully refunded)
 *   is not a purchase.
 */
export function conversionRowsForOrg(
  org: AttributedOrg,
  payments: PaidTopUp[],
  since: Date,
): ConversionRow[] {
  const rows: ConversionRow[] = [];
  if (org.gclidAt.getTime() >= since.getTime()) {
    rows.push({
      gclid: org.gclid,
      conversionName: OFFLINE_SIGNUP_CONVERSION,
      conversionTime: org.gclidAt,
      conversionValue: 1,
      currency: "USD",
    });
  }
  for (const p of payments) {
    const at = new Date(p.created * 1000);
    if (p.netCents <= 0) continue;
    if (at.getTime() < org.gclidAt.getTime()) continue;
    if (at.getTime() < since.getTime()) continue;
    rows.push({
      gclid: org.gclid,
      conversionName: OFFLINE_PURCHASE_CONVERSION,
      conversionTime: at,
      conversionValue: Math.round(p.netCents) / 100,
      currency: "USD",
    });
  }
  return rows;
}

export const CONVERSION_CSV_HEADER =
  "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency";

/** The exact CSV Google's bulk upload reads. No field here can contain a comma. */
export function conversionRowsToCsv(rows: ConversionRow[]): string {
  const lines = rows.map(
    (r) =>
      `${r.gclid},${r.conversionName},${formatAdsTime(r.conversionTime)},${r.conversionValue},${r.currency}`,
  );
  return [CONVERSION_CSV_HEADER, ...lines].join("\n") + "\n";
}

/** The rolling window start: 90 days back, never later than `now`. */
export function feedWindowStart(now: Date, sinceParam: string | null): Date {
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (Number.isNaN(d.getTime())) throw new Error(`[dashboard-ads-feed] invalid since: ${sinceParam}`);
    return d;
  }
  return new Date(now.getTime() - GCLID_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
}
