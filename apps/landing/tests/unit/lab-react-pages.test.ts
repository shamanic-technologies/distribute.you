import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { applyDistrySkin, isHydratedPage, isRestatedReactPage, withoutHydration } from "../../src/lib/distry-skin";
import { LAB_HIDDEN_ARTICLES, LAB_HIDDEN_PAGES, LAB_UNRESTATED_PAGES, isLabHiddenPage, labRedirectFor, oldOfferClaims, readableText as readableTextOf, withoutHiddenCards } from "../../src/lib/lab-offer";

/**
 * The React pages of the site (docs, blog, investors, privacy, terms) as the lab serves
 * them (LAB-DISTRY-REACT-OFFER-1125). Each fixture is the HTML production rendered on
 * 2026-11-25 (`curl https://distribute.you/<path> | gzip -9`), hydration payload included,
 * and goes through the same `applyDistrySkin` the lab's skin route calls.
 */

const FIXTURES = path.resolve(__dirname, "../fixtures/lab-react-pages");
const pages = readdirSync(FIXTURES)
  .filter((f) => f.endsWith(".html.gz"))
  .map((f) => ({ pathname: `/${f.replace(/\.html\.gz$/, "").replace(/_/g, "/")}`, html: gunzipSync(readFileSync(path.join(FIXTURES, f))).toString("utf8") }));
const restated = pages.filter((p) => !LAB_UNRESTATED_PAGES.includes(p.pathname));

describe("the React pages on the lab state the lab's offer", () => {
  it("covers every kind of React page", () => {
    const paths = pages.map((p) => p.pathname);
    for (const p of ["/docs", "/docs/api/billing", "/docs/mcp/tools", "/blog", "/blog/api-for-ai-agents", "/investors", "/privacy", "/terms"]) expect(paths).toContain(p);
  });

  it("starts from production pages that are hydrated and state the old offer", () => {
    for (const { pathname, html } of pages) {
      expect(isHydratedPage(html), pathname).toBe(true);
      expect(oldOfferClaims(html).length, pathname).toBeGreaterThan(0);
    }
  });

  it("leaves none of the old offer in the text a lab reader gets", () => {
    for (const { pathname, html } of restated) {
      expect(isRestatedReactPage(pathname), pathname).toBe(true);
      expect(oldOfferClaims(applyDistrySkin(html, pathname)), pathname).toEqual([]);
    }
  });

  it("states the lab's offer in each page's structured data", () => {
    for (const { pathname, html } of restated) {
      const out = applyDistrySkin(html, pathname);
      expect(out, pathname).toContain('"price":"99"');
      expect(out, pathname).toContain("Free with your own keys or your Claude subscription. Or $99/month on our keys at 0% markup, with a 3-day free trial.");
      // Owner 2026-11-25 (LAB-SOLO-PIVOT-1125): no Managed plan, no "same agent" line.
      expect(readableTextOf(out), pathname).not.toMatch(/custom price|same agent|Managed (?:starts|from)|from \$499/i);
    }
  });

  it("serves them without React, so the restated text is the text shown", () => {
    for (const { pathname, html } of restated) {
      const out = applyDistrySkin(html, pathname);
      expect(isHydratedPage(out), pathname).toBe(false);
      expect(out, pathname).not.toMatch(/<script\b[^>]*src="\/_next\/static\/[^"]*\.js"/);
      expect(out, pathname).not.toMatch(/as="script"[^>]*_next\/static/);
      // The page keeps its stylesheet and gets the static skin (sky in the body).
      expect(out, pathname).toMatch(/<link rel="stylesheet" href="\/_next\/static\/[^"]+\.css"/);
      expect(out, pathname).toContain('<div class="d-sky"');
    }
  });

  it("restates the /investors business model with one arm", () => {
    const investors = pages.find((p) => p.pathname === "/investors");
    const out = applyDistrySkin(investors!.html, "/investors");
    expect(out).toContain('The business model has one arm, the <strong class="text-gray-900">AI agent</strong>. Free with your own keys');
    expect(out).toContain("More budget adds $100 a month at a time.");
    expect(out).not.toContain("GTM agency</strong> is from $1K");
    expect(readableTextOf(out)).not.toMatch(/Managed|\$499|money back/);
  });

  it("keeps /terms exactly as production serves it: the contract accounts sign today", () => {
    expect(LAB_UNRESTATED_PAGES).toEqual(["/terms"]);
    const terms = pages.find((p) => p.pathname === "/terms")!;
    const out = applyDistrySkin(terms.html, "/terms");
    expect(isRestatedReactPage("/terms")).toBe(false);
    expect(out.slice(out.indexOf("<body"))).toBe(terms.html.slice(terms.html.indexOf("<body")));
  });
});

describe("an article about the old offer is not on the lab", () => {
  it("drops its card from the blog index", () => {
    const blog = pages.find((p) => p.pathname === "/blog")!;
    expect(blog.html).toContain('href="/blog/ai-gtm"');
    expect(applyDistrySkin(blog.html, "/blog")).not.toContain("/blog/ai-gtm");
  });

  it("keeps the words of a link inside a sentence", () => {
    expect(withoutHiddenCards('<p>Read <a href="/blog/ai-gtm">our pricing note</a>.</p>')).toBe("<p>Read our pricing note.</p>");
    expect(withoutHiddenCards('<a class="card" href="https://distribute.you/blog/ai-gtm"><article>x</article></a><a href="/blog/other">y</a>')).toBe('<a href="/blog/other">y</a>');
  });

  it("sends a reader of its address to the blog", () => {
    expect(LAB_HIDDEN_ARTICLES).toEqual(["/blog/ai-gtm"]);
    expect(labRedirectFor("/blog/ai-gtm")).toBe("/blog");
    expect(labRedirectFor("/blog/ai-gtm/")).toBe("/blog");
    expect(isLabHiddenPage("/blog/ai-gtm-2")).toBe(false);
    const route = readFileSync(path.resolve(__dirname, "../../src/app/internal-skin/[slug]/[[...path]]/route.ts"), "utf8");
    expect(route.indexOf("labRedirectFor(pathname)")).toBeGreaterThan(-1);
    expect(route.indexOf("labRedirectFor(pathname)")).toBeLessThan(route.indexOf("await fetch("));
  });
});

describe("the solo-founder pivot hides every page it does not name (owner 2026-11-25)", () => {
  it("sends every Agency page, the killed products and their compare pages home", () => {
    for (const p of [
      "/gtm-agency",
      "/gtm-agency/alternatives",
      "/cold-email-agency/best/cold-email-agency-for-saas-founders",
      "/appointment-setting-agency/vs/belkins",
      "/ppc-agency",
      "/user-acquisition-agency",
      "/gtm-automation",
      "/cold-email-automation/vs/instantly",
      "/ai-lead-generation",
      "/lead-nurturing-automation",
      "/ai-customer-success",
      "/ai-ad-management",
      "/desktop",
      "/lp/concierge",
      "/lp/instinct/sign-up",
      "/best/outbound-agency-for-startups",
      "/docs/integrations/claude",
      "/docs/integrations/cursor",
      "/docs/integrations/zapier",
      "/docs/integrations/n8n",
      "/docs/integrations/make",
    ]) {
      expect(labRedirectFor(p), p).toBe("/");
    }
  });

  it("keeps the solo founder's pages", () => {
    for (const p of ["/", "/ai-sdr", "/ai-sdr/vs/11x", "/signup-automation", "/website-traffic-automation", "/docs", "/docs/mcp", "/docs/api", "/docs/quickstart", "/docs/integrations", "/docs/integrations/claude-desktop", "/docs/integrations/chatgpt", "/docs/integrations/conductor", "/catalog", "/indexes", "/blog", "/about", "/contact", "/privacy", "/terms", "/investors"]) {
      expect(labRedirectFor(p), p).toBeNull();
    }
    expect(LAB_HIDDEN_PAGES.length).toBeGreaterThan(20);
  });

  it("drops the Agency menu, its column, Book a call and every hidden link from the docs chrome", () => {
    const docs = pages.find((p) => p.pathname === "/docs")!;
    expect(docs.html).toMatch(/>Agency<svg/);
    const text = readableTextOf(applyDistrySkin(docs.html, "/docs"));
    expect(text).not.toMatch(/\bAgency\b|Book a call|GTM Automation|Cursor|Zapier|n8n|Make\.com/);
    expect(text).toContain("Use it from your AI");
  });

  it("links to the dashboard nowhere on the React pages it restates (owner 2026-11-25)", () => {
    for (const { pathname, html } of restated) {
      const out = applyDistrySkin(html, pathname);
      expect(out.slice(out.indexOf("<body")), pathname).not.toContain("dashboard.distribute.you");
      expect(readableTextOf(out), pathname).not.toMatch(/\bLog in\b/);
    }
  });
});

describe("withoutHydration", () => {
  it("keeps React's inline streaming helpers and every non-framework script", () => {
    const html = '<script>$RC("B:0","S:0")</script><script src="/_next/static/chunks/a.js" async=""></script><script>self.__next_f.push([1,"x"])</script><script type="application/ld+json">{}</script>';
    expect(withoutHydration(html)).toBe('<script>$RC("B:0","S:0")</script><script type="application/ld+json">{}</script>');
  });
});

describe("production is unchanged", () => {
  const SRC = path.resolve(__dirname, "../../src");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const full = path.join(dir, f);
      return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(f) ? [full] : [];
    });

  it("only the lab's routes and the skin itself reach the lab rewrites", () => {
    const readers = files(SRC)
      .filter((f) => /from "(?:@\/lib|\.)\/(?:lab-offer|distry-skin)"/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC, f))
      .sort();
    expect(readers).toEqual(["app/internal-prototype/[slug]/[[...path]]/route.ts", "app/internal-skin/[slug]/[[...path]]/route.ts", "lib/distry-skin.ts", "lib/lab-docs.ts", "proxy.ts"]);
    // The proxy reads only the skin's path helpers, and only on a prototype host.
    const proxy = readFileSync(path.join(SRC, "proxy.ts"), "utf8");
    expect(proxy).toContain('import { SKIN_ROUTE_PREFIX, isSkinPassThrough } from "@/lib/distry-skin";');
    expect(proxy).not.toMatch(/applyDistrySkin|withoutHydration|withLabOffer/);
  });

  it("the React pages render nothing lab-aware", () => {
    for (const dir of ["app/docs", "app/blog", "app/investors", "app/privacy", "app/terms", "app/layout.tsx", "components"]) {
      const full = path.join(SRC, dir);
      for (const f of statSync(full).isDirectory() ? files(full) : [full]) {
        expect(readFileSync(f, "utf8"), f).not.toMatch(/lab-offer|distry-skin|lab-distry|LAB_/);
      }
    }
  });
});
