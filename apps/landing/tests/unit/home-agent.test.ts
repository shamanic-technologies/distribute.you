import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { ACTION_PRICES_TOKEN, HOME_PRICE_GROUPS, actionPrices, actionPricesHtml, withActionPrices } from "../../src/lib/pages/home-agent";
import type { PlatformPrice } from "../../src/lib/pages/catalog";
import { CLAUDE_CODE_MCP_COMMAND } from "../../src/lib/docs/developer-surfaces";
import { livePages } from "../../src/lib/site-pages";

/**
 * `/` as the Revenue AI Agent page (PAGE-REVENUE-AGENT-1029, owner 2026-10-29): the
 * cheap SaaS founder gets our agent at the API price with 0% markup, open source, run
 * locally if they want, and starts free. These guards hold the parts that are not copy:
 * the live price list, the agent command, the bridges, the sourced competitor prices
 * and the signature motion.
 */
const LANDING = path.resolve(__dirname, "../../public/landing");
const html = readFileSync(path.join(LANDING, "index-v2.html"), "utf8");
const css = readFileSync(path.join(LANDING, "v2/agent.css"), "utf8");
const js = readFileSync(path.join(LANDING, "v2/main.js"), "utf8");
const section = (id: string) => {
  const at = html.indexOf(`id="${id}"`);
  return html.slice(at, html.indexOf("</section>", at));
};

const READ_AT = "2026-10-29T00:00:00.000Z";
function price(p: Partial<PlatformPrice>): PlatformPrice {
  return {
    name: "x",
    pricePerUnitInUsdCents: "1",
    provider: "apollo",
    providerDomain: "apollo.io",
    type: "Credit",
    unit: "credit",
    pricingBasis: "marked-up",
    status: "current",
    lastUsedOn: "2026-10-28",
    usageReadAt: READ_AT,
    bundle: null,
    ...p,
  };
}
const FIXTURE: PlatformPrice[] = [
  price({ name: "apollo-credit", pricePerUnitInUsdCents: "2.7769" }),
  price({ name: "explee-credit", provider: "explee", providerDomain: "explee.com", pricePerUnitInUsdCents: "0.98" }),
  price({ name: "firecrawl-scrape", provider: "firecrawl", providerDomain: "firecrawl.dev", type: "Scrape credit", pricePerUnitInUsdCents: "0.898" }),
  price({ name: "haiku-in", provider: "anthropic", providerDomain: "anthropic.com", type: "Input tokens (Haiku 5.5)", unit: "1M tokens", pricePerUnitInUsdCents: "0.00001" }),
  price({ name: "instantly-sent", provider: "instantly", providerDomain: "instantly.ai", type: "Email send", unit: "email", pricePerUnitInUsdCents: "2.72" }),
  price({ name: "twilio-min", provider: "twilio", providerDomain: "twilio.com", type: "Outbound voice minute (US)", unit: "minute", pricePerUnitInUsdCents: "1.4" }),
  // Idle for 60 days: the catalog hides it, so the homepage must too.
  price({ name: "old", provider: "explee", providerDomain: "explee.com", type: "Old credit", pricePerUnitInUsdCents: "0.01", lastUsedOn: "2026-08-01" }),
];

describe("the price before every action", () => {
  it("states one line per kind of action, its cheapest served line, from the catalog's own rows", () => {
    const rows = actionPrices(FIXTURE);
    expect(rows.map((r) => r.group)).toEqual(["leads", "research", "ai", "sending"]);
    expect(rows[0]).toMatchObject({ tool: "Explee", price: "$0.00980 / credit" });
    expect(rows.find((r) => r.group === "ai")?.price).toBe("$0.100 / 1M tokens");
    // Calls are not priced on the homepage, and an idle line never wins "cheapest".
    expect(HOME_PRICE_GROUPS).not.toContain("calls");
    expect(rows.some((r) => r.what === "Old credit")).toBe(false);
  });

  it("renders each line with its logo, `from` and the 0% markup, and only the catalog line when the read failed", () => {
    const block = actionPricesHtml(FIXTURE);
    expect(block.match(/<li data-group=/g)).toHaveLength(4);
    expect(block).toContain("from $0.00980 / credit");
    expect(block).toContain("img.logo.dev/explee.com");
    expect(block).toContain('href="/catalog"');
    const failed = actionPricesHtml(null);
    expect(failed).not.toContain("<li");
    expect(failed).not.toMatch(/\$\d/);
    expect(failed).toContain('href="/catalog"');
  });

  it("has one slot on the homepage, inside the prices section, resolved by the route", () => {
    expect(html.split(ACTION_PRICES_TOKEN)).toHaveLength(2);
    expect(section("prices")).toContain(ACTION_PRICES_TOKEN);
    expect(withActionPrices(html, FIXTURE)).not.toContain(ACTION_PRICES_TOKEN);
    const route = readFileSync(path.resolve(__dirname, "../../src/app/route.ts"), "utf8");
    expect(route).toContain("withActionPrices(");
    expect(route).toContain('fetchPlatformPrices("/")');
  });
});

describe("the agent command and the open source repo", () => {
  it("prints the Claude Code command the docs print, byte for byte", () => {
    expect(section("agent")).toContain(`<code>${CLAUDE_CODE_MCP_COMMAND}</code>`);
    expect(js).toContain('document.querySelectorAll("[data-copy]")');
    expect(section("agent").match(/data-copy/g)).toHaveLength(2);
  });

  it("links the public gtm-factory repo, MIT", () => {
    expect(section("open-source")).toContain('href="https://github.com/distribute-you/gtm-factory"');
    expect(section("open-source")).toContain("git clone https://github.com/distribute-you/gtm-factory");
    expect(section("open-source")).toContain("MIT");
  });
});

describe("the bridges to the Agency page", () => {
  it("point only at a live Agency page of the catalogue", () => {
    const live = new Set(livePages("agency").map((p) => p.path));
    const agencyLinks = [...html.matchAll(/href="(\/[a-z-]*agency)"/g)].map((m) => m[1]);
    expect(agencyLinks.length).toBeGreaterThanOrEqual(3);
    for (const href of agencyLinks) expect(live.has(href), href).toBe(true);
  });
});

describe("the point-tool stack", () => {
  const stack = section("stack");

  it("states each vendor's price with its own pricing page and the day it was read", () => {
    for (const src of ["https://www.apollo.io/pricing", "https://www.clay.com/pricing", "https://instantly.ai/pricing", "https://www.mailforge.ai/pricing"]) {
      expect(stack).toContain(`href="${src}"`);
    }
    expect(stack).toContain("October 29, 2026");
  });

  it("totals the monthly plans it lists, and nothing it does not", () => {
    const body = stack.slice(stack.indexOf("<tbody>"), stack.indexOf("</tbody>"));
    const monthly = [...body.matchAll(/<b>\$(\d+)\/(?:user\/)?month<\/b>/g)].map((m) => Number(m[1]));
    expect(monthly).toEqual([49, 167, 47]);
    expect(stack).toContain(`<b>$${monthly.reduce((a, b) => a + b, 0)}/month</b> before mailboxes`);
  });
});

describe("the signature motion: the provider orbit and the WhatsApp agent", () => {
  it("places ten provider logos evenly on the orbit, in CSS first", () => {
    const orbit = html.slice(html.indexOf('data-motion="orbit"'), html.indexOf('<div class="wa"'));
    const angles = [...orbit.matchAll(/--a:(\d+)deg/g)].map((m) => Number(m[1]));
    expect(angles).toEqual([0, 36, 72, 108, 144, 180, 216, 252, 288, 324]);
    expect(css).toContain("translate: calc(cos(var(--a)) * var(--orbit-r)) calc(sin(var(--a)) * var(--orbit-r));");
  });

  it("plays every CSS animation only when motion is welcome", () => {
    const gated = css.slice(css.indexOf("@media (prefers-reduced-motion: no-preference)"));
    for (const anim of ["orbit-spin", "orbit-wave", "orbit-ping", "wa-in", "wa-dots"]) {
      const use = new RegExp(`animation: ${anim}`);
      expect(css.slice(0, css.indexOf("@media (prefers-reduced-motion: no-preference)"))).not.toMatch(use);
      expect(gated).toMatch(use);
    }
  });

  it("plays the thread once, set up before paint, in message order", () => {
    const wa = html.slice(html.indexOf('<div class="wa"'), html.indexOf("</script>", html.indexOf('<div class="wa"')));
    expect(wa).toContain('prefers-reduced-motion: reduce)").matches))document.currentScript.previousElementSibling.classList.add("play")');
    const times = [...wa.matchAll(/--t:([\d.]+)s/g)].map((m) => Number(m[1]));
    expect(times.length).toBe(5);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // A thread with no invented person: the buyer is a company already used in the mocks.
    expect(wa).toContain("Northwind Health");
  });
});
