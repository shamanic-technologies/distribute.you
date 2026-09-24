/**
 * The homepage A/B test: `/` serves either the current homepage (`control`) or the
 * AI-sales-assistant candidate (`assistant`, also reachable at `/lp/assistant`).
 *
 * Server-side and sticky: the first visit draws a variant and stores it in a cookie on
 * the registrable domain, so a returning visitor (and the dashboard, which shares the
 * domain) keeps seeing the same page. The URL never changes, so ads and links are
 * untouched. The metric is a PostHog funnel: `landing_variant_viewed` (carrying
 * `lp_variant`) then a pageview on `dashboard.distribute.you/start`.
 *
 * Crawlers and agents always get `control`: the homepage is the one page whose index
 * entry matters most, and a crawler landing on a variant would be told a different
 * page lives at `/`. They also get no cookie, so they never count in the test.
 *
 * `AB_TEST_ENABLED` is the kill switch: false serves `control` to everyone, sets no
 * cookie, and `/` behaves exactly as it did before the test.
 *
 * Alias-free and pure so the rules carry real unit tests.
 */

export const AB_TEST_ENABLED = true;

export const LANDING_VARIANTS = ["control", "assistant"] as const;
export type LandingVariant = (typeof LANDING_VARIANTS)[number];

export const VARIANT_COOKIE = "lp_variant";
const COOKIE_MAX_AGE_S = 90 * 24 * 60 * 60;

/** Share of first visits drawn into `assistant`. */
export const ASSISTANT_SHARE = 0.5;

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|inspectiontool|gptbot|chatgpt|oai-search|claude|anthropic|perplexity|bytespider|ahrefs|semrush|curl|wget|python|node-fetch|axios|go-http|java\//i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_UA.test(userAgent);
}

function asVariant(value: string | null | undefined): LandingVariant | null {
  return LANDING_VARIANTS.find((v) => v === value) ?? null;
}

export function cookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export type VariantDecision = {
  variant: LandingVariant;
  /** Write the cookie on this response (a fresh draw, or a forced variant). */
  setCookie: boolean;
  /** This visitor takes part in the test (not a crawler, test enabled). */
  inTest: boolean;
};

export function decideVariant(input: {
  cookieHeader: string | null;
  userAgent: string | null;
  query: URLSearchParams;
  random: number;
  enabled?: boolean;
}): VariantDecision {
  const enabled = input.enabled ?? AB_TEST_ENABLED;
  if (!enabled || isBot(input.userAgent)) {
    return { variant: "control", setCookie: false, inTest: false };
  }
  const forced = asVariant(input.query.get("variant"));
  if (forced) return { variant: forced, setCookie: true, inTest: true };
  const stored = asVariant(cookieValue(input.cookieHeader, VARIANT_COOKIE));
  if (stored) return { variant: stored, setCookie: false, inTest: true };
  const variant: LandingVariant = input.random < ASSISTANT_SHARE ? "assistant" : "control";
  return { variant, setCookie: true, inTest: true };
}

export function variantCookie(variant: LandingVariant): string {
  return `${VARIANT_COOKIE}=${variant}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; Domain=.distribute.you; SameSite=Lax; Secure`;
}

/**
 * Tags the visit in PostHog. The snippet's stub queues calls made before the library
 * loads, so these run in order once it does. Guarded on `window.posthog`, which is
 * absent when the build carried no project token.
 */
export function variantTrackingScript(variant: LandingVariant): string {
  const v = JSON.stringify(variant);
  return `<script>if(window.posthog){posthog.register({lp_variant:${v}});posthog.capture("landing_variant_viewed",{lp_variant:${v}});}</script>`;
}

export function withBeforeBodyEnd(html: string, snippet: string): string {
  const at = html.lastIndexOf("</body>");
  if (at < 0) throw new Error("[landing] no </body> to inject the A/B tracking into");
  return html.slice(0, at) + snippet + html.slice(at);
}
