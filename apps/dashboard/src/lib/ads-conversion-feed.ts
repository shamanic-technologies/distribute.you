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
 * Three conversion actions, named byte-equal with the account's "Import from
 * clicks" actions: `offline_signup` (value 1), `offline_purchase` (value = the
 * amount Stripe actually received, so "maximize conversion value" bids on real
 * money) and `offline_signup_page` (no value — reaching the sign-up page is the
 * micro-conversion smart bidding has the volume to learn on, and it is read
 * from PostHog rather than from an org that signed up).
 *
 * Google dedupes an upload on (gclid, conversion name, conversion time), so the
 * feed is re-uploadable every day with no double counting.
 *
 * Alias-free on purpose so it carries real unit tests.
 */

export const OFFLINE_SIGNUP_CONVERSION = "offline_signup";
export const OFFLINE_PURCHASE_CONVERSION = "offline_purchase";
/**
 * The MICRO-conversion, and the one smart bidding can actually learn on. Google
 * wants 15-30 conversions per 30 days; the account produces ~5 signups and ~2
 * purchases, so bidding on those two bids blind. Reaching the sign-up page is
 * ~30 a month with a gclid on the same session, which is the volume the
 * algorithm needs, and it is the same move Explee makes (their triggers are a
 * free search and `generate_lead`, not the paid signup).
 *
 * It carries NO value and NO currency: it is a page view, not money. Both CSV
 * columns ship empty so the file keeps one shape for all three actions.
 */
export const OFFLINE_SIGNUP_PAGE_CONVERSION = "offline_signup_page";

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
  /** null = the action's own default value; the sign-up page view states none. */
  conversionValue: number | null;
  currency: "USD" | null;
}

/**
 * One session that reached `/sign-up` carrying a Google click on the same
 * session. PostHog sees these where `gtag` does not: it is served through our
 * own first-party proxy (`e.distribute.you`), so an ad blocker that drops
 * `googleads.g.doubleclick.net` does not drop this.
 */
export interface SignUpPageView {
  /** PostHog session id, the dedup key: one row per session, not per view. */
  sessionId: string;
  gclid: string;
  /** First `/sign-up` view of that session. */
  viewedAt: Date;
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

/**
 * The micro-conversion rows. One per session (a reload is not a second
 * conversion), dropped when it falls outside the rolling window — Google
 * refuses a conversion whose click is older than 90 days.
 *
 * A session whose gclid is blank is not a row: it is a sign-up page view we
 * cannot attribute, and inventing a click id for it would upload garbage.
 */
export function conversionRowsForSignUpPageViews(
  views: SignUpPageView[],
  since: Date,
): ConversionRow[] {
  const seen = new Set<string>();
  const rows: ConversionRow[] = [];
  for (const v of views) {
    if (!v.gclid) continue;
    if (v.viewedAt.getTime() < since.getTime()) continue;
    const key = `${v.gclid}:${v.sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      gclid: v.gclid,
      conversionName: OFFLINE_SIGNUP_PAGE_CONVERSION,
      conversionTime: v.viewedAt,
      conversionValue: null,
      currency: null,
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
      `${r.gclid},${r.conversionName},${formatAdsTime(r.conversionTime)},${r.conversionValue ?? ""},${r.currency ?? ""}`,
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
