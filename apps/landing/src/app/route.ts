import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderedResponse } from "@/lib/static-html";
import { renderAssistantPage } from "@/lib/pages/assistant";
import { renderConciergePage } from "@/lib/pages/concierge";
import { renderInstinctPage } from "@/lib/pages/instinct";
import { withActionPrices } from "@/lib/pages/home-agent";
import { fetchPlatformPrices } from "@/lib/platform-prices";
import { withSiteChrome } from "@/lib/site-chrome";
import {
  AB_TEST_ENABLED,
  decideVariant,
  variantCookie,
  variantTrackingScript,
  withBeforeBodyEnd,
} from "@/lib/landing-ab";

// Rendered per request: the A/B split reads the visitor's cookie, so a cached `/`
// would hand one variant to everyone. The upstream figures the page interpolates keep
// their own data cache (`next.revalidate` on each fetch), so this costs no extra reads.
export const dynamic = "force-dynamic";

// The homepage. `index-v2.html` was authored in the lab beside the competitor
// clones it borrows from and is served through the whole pipeline: the charter
// favicon, the GA4 + Google Ads + PostHog + Partnero head, one Organization JSON-LD,
// and `Accept: text/markdown` negotiation.
//
// While the A/B test runs (`src/lib/landing-ab.ts`), half of first-time human
// visitors get one of the candidates at this same URL instead (see VARIANT_WEIGHTS).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsMarkdown = (request.headers.get("accept") ?? "").includes("text/markdown");
  const decision = decideVariant({
    cookieHeader: request.headers.get("cookie"),
    userAgent: wantsMarkdown ? null : request.headers.get("user-agent"),
    query: url.searchParams,
    random: Math.random(),
  });

  // `index-v2.html` is the Revenue AI Agent page (PAGE-REVENUE-AGENT-1029, owner
  // 2026-10-29): free, every action at the API price with 0% markup, open
  // source. Served to `control`, `postpaid` and crawlers. Its price list is READ from the
  // public cost catalogue at render (`lib/pages/home-agent.ts`). The first-$100 match
  // banner ended with the offer reset. `index-v2-subscription.html` is the retired
  // $99/month page, reachable only by `?variant=subscription`.
  const homepage = async () =>
    withActionPrices(
      readFileSync(join(process.cwd(), "public/landing", "index-v2.html"), "utf8"),
      await fetchPlatformPrices("/"),
    );
  const subscriptionHomepage = () =>
    readFileSync(join(process.cwd(), "public/landing", "index-v2-subscription.html"), "utf8");
  const page =
    decision.variant === "subscription"
      ? subscriptionHomepage()
      : decision.variant === "assistant"
      ? renderAssistantPage(undefined, { at: "homepage" })
      : decision.variant === "concierge"
        ? renderConciergePage(undefined, { at: "homepage" })
        : decision.variant === "instinct"
          ? renderInstinctPage()
          : await homepage();
  // The hand-written pages carry `<!--site-nav-->` / `<!--site-footer-->`: the nav and
  // footer are drawn from the page catalogue, like every other page's.
  const chromed = withSiteChrome(page, "/");
  const html = decision.inTest
    ? withBeforeBodyEnd(chromed, variantTrackingScript(decision.variant))
    : chromed;

  const res = await renderedResponse(html, request);
  const headers = new Headers(res.headers);
  // Every response to `/` stays out of shared caches while the test runs, crawlers'
  // included: a cached control page served to a human would silently skew the split.
  if (AB_TEST_ENABLED) {
    headers.set("cache-control", "private, no-store");
    headers.set("vary", `${headers.get("vary") ?? "Accept"}, Cookie`);
  }
  if (decision.setCookie) headers.append("set-cookie", variantCookie(decision.variant));
  return new Response(res.body, { status: res.status, headers });
}
