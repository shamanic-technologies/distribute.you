import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AI_LEAD_GEN_DESCRIPTION,
  AI_LEAD_GEN_FAQ,
  AI_LEAD_GEN_TITLE,
  LEAD_RECEIPT_TOKEN,
  leadReceiptHtml,
  receiptLines,
  renderAiLeadGenerationPage,
  withLeadReceipt,
} from "../../src/lib/pages/ai-lead-generation";
import { renderAiLeadGenAlternativesPage, renderComparePage } from "../../src/lib/compare-page";
import { AI_LEAD_GEN_SLUGS, aiLeadGenCompetitors, competitorBySlug, competitorPath } from "../../src/lib/competitors";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";
import type { PlatformPrice } from "../../src/lib/pages/catalog";

/**
 * PAGE-AI-LEAD-GEN-1029: the Lead Generation AI Agent page at `/ai-lead-generation`
 * (keyword "ai lead generation"), its vs/alternatives cluster, the 301s from the old
 * `/compare/<slug>` URLs and the live receipt of one lead.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderAiLeadGenerationPage();
const prose = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

function price(p: Partial<PlatformPrice> & { name: string; provider: string; type: string; unit: string; pricePerUnitInUsdCents: string }): PlatformPrice {
  return {
    providerDomain: `${p.provider}.com`,
    pricingBasis: "marked-up",
    status: "current",
    lastUsedOn: "2026-10-16",
    usageReadAt: "2026-10-16T01:48:29.649Z",
    bundle: null,
    ...p,
  };
}

/** Shaped like the served catalogue on 2026-10-29. */
const PRICES: PlatformPrice[] = [
  price({ name: "apollo-credit", provider: "apollo", providerDomain: "apollo.io", type: "Credit", unit: "credit", pricePerUnitInUsdCents: "2.7769" }),
  price({ name: "apify-bounceverify-email", provider: "apify", providerDomain: "apify.com", type: "BounceVerify email", unit: "email", pricePerUnitInUsdCents: "1.1689" }),
  price({ name: "typesafe-jev-1.13-tokens-input", provider: "typesafe", providerDomain: "typesafe.ai", type: "Input tokens (Jev 1.13)", unit: "1M tokens", pricePerUnitInUsdCents: "0.0000042" }),
];

describe("/ai-lead-generation targets its keyword", () => {
  it("title, description and H1 say AI lead generation", () => {
    expect(AI_LEAD_GEN_TITLE).toMatch(/^AI Lead Generation:/);
    expect(AI_LEAD_GEN_TITLE.length).toBeLessThanOrEqual(70);
    expect(AI_LEAD_GEN_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(AI_LEAD_GEN_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/ai-lead-generation">');
    expect(html).toMatch(/<h1>AI Lead Generation<br>/);
    // The second and third keywords are on the page.
    expect(html).toContain("AI lead generation agent");
    expect(html).toContain("ead generation automation");
  });

  it("states the why and the AI Agent offer", () => {
    expect(html).toContain("Revenue made easy.");
    expect(html).toContain("0% markup");
    expect(html).not.toContain('<i></i>Team</span>'); // one free plan, no Team tier (owner 2026-10-31)
    expect(html).toContain("$10");
    expect(html).toContain("https://github.com/distribute-you/gtm-factory");
    expect(html).toContain("Start free");
  });

  it("bridges to its Agency twin, and the twin bridges back", () => {
    expect(html).toContain('href="/lead-generation-agency"');
    expect(footerModel("/ai-lead-generation").bridge?.href).toBe("/lead-generation-agency");
    expect(footerModel("/lead-generation-agency").bridge?.href).toBe("/ai-lead-generation");
  });
});

describe("every figure is live", () => {
  it("carries the fleet tokens, the receipt and price slots and the keyed client cards", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    expect(html).toContain("__HOT_LEAD_BAND__");
    expect(html).toContain("<!--action-prices-->");
    expect(html).toContain(LEAD_RECEIPT_TOKEN);
    expect(html).toContain('<div class="showcase-grid" id="live-cards">');
    expect(html).toContain('data-proof-brand="docdinners.com"');
    expect(html).toContain("data-founder-count");
  });

  it("the route resolves the receipt and the price list from one read", () => {
    const route = read("src/app/ai-lead-generation/route.ts");
    expect(route).toContain('fetchPlatformPrices("/ai-lead-generation")');
    expect(route).toContain("withActionPrices(withLeadReceipt(renderAiLeadGenerationPage(), prices), prices)");
  });

  it("the receipt prices finding, checking and judging a lead from the served lines", () => {
    const lines = receiptLines(PRICES);
    expect(lines.map((l) => l.step)).toEqual(["find", "check", "judge"]);
    expect(lines[0]).toMatchObject({ tool: "Apollo", price: "$0.0278 / credit" });
    expect(lines[1]).toMatchObject({ tool: "BounceVerify", price: "$0.0117 / email" });
    expect(lines[2]).toMatchObject({ tool: "Jev 1.13", price: "$0.0420 / 1M tokens" });
    const out = withLeadReceipt(html, PRICES);
    expect(out).not.toContain(LEAD_RECEIPT_TOKEN);
    expect(out).toContain("One lead, priced live");
    // Never a sum the client did not spend.
    expect(prose(out)).not.toMatch(/\btotal\b/i);
  });

  it("a failed or empty read prints no price, only the catalog link", () => {
    for (const p of [null, []]) {
      const r = leadReceiptHtml(p);
      expect(r).toContain('href="/catalog"');
      expect(r).not.toMatch(/\$\d/);
    }
    // A line idle for 30 days is hidden by the catalog, so it is hidden here too.
    expect(receiptLines([{ ...PRICES[0], lastUsedOn: "2026-08-01" }])).toEqual([]);
  });
});

describe("the signature: light lead rows drop in and flash their verdict", () => {
  it("one lead-rows feed, every row already judged in the HTML (the final state)", () => {
    expect(html.match(/data-motion="lead-rows"/g)).toHaveLength(1);
    const rows = html.match(/<li class="lg-row is-judged"/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain('data-fits="yes"');
    expect(html).toContain('data-fits="no"');
  });

  it("loads its own sheet after agent.css and ai-sdr.css, with a light flash distinct from the Agency page's", () => {
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    const c = html.indexOf("/landing/v2/ai-lead-generation.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(html).not.toContain("/landing/v2/leadgen.css");
    const css = read("public/landing/v2/ai-lead-generation.css");
    expect(css).toContain("@keyframes ll-flash-yes");
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("copy rules", () => {
  const copy = prose(html);
  it("no dashes, no agency claim about us, no invented promise", () => {
    expect(copy).not.toContain("—");
    expect(copy).not.toContain("–");
    expect(copy).not.toMatch(/distribute\.you is (?:a|an)\b[^.]*\bagency\b|\bour agency\b/i);
    expect(copy).not.toMatch(/\bguaranteed? leads\b/i);
    expect(copy).not.toMatch(/\bopen rate/i);
    expect(copy).not.toMatch(/\bNo [a-z]+, no [a-z]+/);
  });

  it("FAQ answers ship as FAQPage JSON-LD, tags stripped", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(AI_LEAD_GEN_FAQ.length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the catalogue serves the page", () => {
  it("Lead Generation's agent page is `/ai-lead-generation`, live, with its own compare column", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "lead-generation" && p.buyer === "agent")!;
    expect(page.path).toBe("/ai-lead-generation");
    expect(page.live).toBe(true);
    expect(SITE_PAGES.some((p) => p.path === "/lead-generation-automation")).toBe(false);
    const model = footerModel("/ai-lead-generation/vs/apollo");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare lead tools")!;
    expect(compare.links.map((l) => l.href)).toEqual([
      "/ai-lead-generation/vs/apollo",
      "/ai-lead-generation/vs/clay",
      "/ai-lead-generation/vs/seamless-ai",
      "/ai-lead-generation/vs/lusha",
      "/ai-lead-generation/alternatives",
    ]);
    expect(navHtml("/")).toContain('href="/ai-lead-generation"><b>Lead Generation Automation</b>');
  });
});

describe("the AI lead generation cluster", () => {
  it("moves Apollo, Clay, Seamless.AI and Lusha under /ai-lead-generation/vs, each re-read today", () => {
    expect([...AI_LEAD_GEN_SLUGS]).toEqual(["apollo", "clay", "seamless-ai", "lusha"]);
    for (const c of aiLeadGenCompetitors()) {
      expect(competitorPath(c)).toBe(`/ai-lead-generation/vs/${c.slug}`);
      expect(c.verifiedOn).toBe("2026-10-29");
      expect(html).toContain(`href="/ai-lead-generation/vs/${c.slug}"`);
    }
    expect(competitorPath(competitorBySlug("gojiberry")!)).toBe("/compare/gojiberry");
    expect(competitorPath(competitorBySlug("11x")!)).toBe("/ai-sdr/vs/11x");
  });

  it("each vs page is canonical under /ai-lead-generation and wears its breadcrumb", () => {
    for (const c of aiLeadGenCompetitors()) {
      const page = renderComparePage(c);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/ai-lead-generation/vs/${c.slug}">`);
      expect(page).toContain('"name":"AI lead generation","item":"https://distribute.you/ai-lead-generation"');
      expect(page).toContain('href="/ai-lead-generation/alternatives"');
      expect(page).toContain("the AI lead generation agent");
      expect(prose(page)).not.toContain("—");
    }
  });

  it("the alternatives page lists all four with their source, us first", () => {
    const alt = renderAiLeadGenAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/ai-lead-generation/alternatives">');
    expect(alt).toContain("/landing/v2/ai-lead-generation.css");
    const ours = alt.indexOf('class="us-row"');
    for (const c of aiLeadGenCompetitors()) {
      expect(alt.indexOf(`href="/ai-lead-generation/vs/${c.slug}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${c.sourceUrl}"`);
    }
    expect(prose(alt)).not.toContain("—");
  });

  it("the old /compare URL answers a 301, never a 404", async () => {
    const { GET } = await import("@/app/compare/[slug]/route");
    for (const slug of AI_LEAD_GEN_SLUGS) {
      const res = await GET(new Request(`https://distribute.you/compare/${slug}`), { params: Promise.resolve({ slug }) });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`/ai-lead-generation/vs/${slug}`);
    }
  });

  it("/ai-lead-generation/vs refuses a competitor outside the cluster", async () => {
    const { GET } = await import("@/app/ai-lead-generation/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/ai-lead-generation/vs/11x"), { params: Promise.resolve({ slug: "11x" }) });
    expect(res.status).toBe(404);
  });
});
