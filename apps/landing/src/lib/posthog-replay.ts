/**
 * Which browsers PostHog session replay skips: the email-link scanners.
 *
 * BYTE-EQUAL TWINS: `apps/landing/src/lib/posthog-replay.ts` and
 * `apps/dashboard/src/lib/posthog-replay.ts` (pinned by the dashboard's
 * `tests/posthog-replay.test.ts`). Edit both.
 *
 * Mail security gateways (Microsoft Defender, Proofpoint, ...) open every link of our
 * newsletter and cold emails in a headless desktop browser. On 2026-10-15, over 30 days,
 * they were 6,051 of the 7,014 recorded sessions (86%) and burned the free replay quota;
 * real visitors were 673. Their tell: a desktop browser whose window fills the whole
 * screen in BOTH dimensions (a real window has browser chrome), the same fingerprint the
 * daily brief uses to split scanners out of the visitor counts. `navigator.webdriver`
 * (an automated browser announcing itself) is added on top.
 *
 * Only the RECORDING is skipped: pageviews, events and exceptions are still captured, so
 * the funnel and the visit counts do not change. The false positive is a real person in
 * full-screen mode on a desktop: 1 identified person in the same 30 days. Phones and
 * tablets never match (no browser chrome in a standalone web app would otherwise look
 * like one).
 *
 * `HEADLESS_SCANNER_JS` is the same predicate for the static pages' inline snippet; the
 * tests run both against the same browsers.
 */
export type ScreenEnv = {
  userAgent: string;
  webdriver: boolean;
  maxTouchPoints: number;
  screenWidth: number;
  screenHeight: number;
  innerWidth: number;
  innerHeight: number;
};

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i;

export function looksLikeHeadlessScanner(env: ScreenEnv): boolean {
  if (env.webdriver) return true;
  if (MOBILE_UA.test(env.userAgent) || env.maxTouchPoints > 1) return false;
  return env.screenWidth === env.innerWidth && env.screenHeight === env.innerHeight;
}

export function browserScreenEnv(): ScreenEnv {
  return {
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver === true,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  };
}

export const HEADLESS_SCANNER_JS = `(function(){var n=navigator,s=window.screen;if(n.webdriver===true)return true;if(/Mobi|Android|iPhone|iPad|iPod/i.test(n.userAgent)||(n.maxTouchPoints||0)>1)return false;return s.width===window.innerWidth&&s.height===window.innerHeight})()`;
