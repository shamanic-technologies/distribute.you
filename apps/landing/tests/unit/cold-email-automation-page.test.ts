import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  COLD_EMAIL_AUTOMATION_DESCRIPTION,
  COLD_EMAIL_AUTOMATION_FAQ,
  COLD_EMAIL_AUTOMATION_TITLE,
  FLOW_LEADS,
  SEND_TIERS_TOKEN,
  flowPriceToken,
  flowPrices,
  renderColdEmailAutomationPage,
  sendTiers,
  withColdEmailPrices,
} from "../../src/lib/pages/cold-email-automation";
import { renderColdEmailAutomationAlternativesPage, renderComparePage } from "../../src/lib/compare-page";
import {
  COLD_EMAIL_AUTOMATION_SLUGS,
  coldEmailAutomationCompetitors,
  competitorBySlug,
  competitorPath,
} from "../../src/lib/competitors";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";
import type { PlatformPrice } from "../../src/lib/pages/catalog";

/**
 * PAGE-COLD-EMAIL-AUTOMATION-1030: the Sales Cold Email AI Agent page at
 * `/cold-email-automation` (keywords "cold email automation", "ai cold email"), its
 * vs/alternatives cluster, the 301s from the old `/compare/<slug>` URLs and the live price
 * of each step of a cold email.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderColdEmailAutomationPage();
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

const bundle = (verdict: string, cents: string) => ({
  name: `email-sent-${verdict}`,
  unit: "email",
  members: [],
  pricePerUnitInUsdCents: cents,
  label: `Email sent, address verified ${verdict} by BounceVerify`,
  emailVerification: { provider: "bounceverify", verdict, priceMultipleOfValid: 1, validBundle: "email-sent-valid" },
});

/** Shaped like the served catalogue on 2026-10-30. */
const PRICES: PlatformPrice[] = [
  price({ name: "apollo-credit", provider: "apollo", providerDomain: "apollo.io", type: "Credit", unit: "credit", pricePerUnitInUsdCents: "2.7769" }),
  price({ name: "firecrawl-scrape-credit", provider: "firecrawl", providerDomain: "firecrawl.dev", type: "Scrape credit", unit: "credit", pricePerUnitInUsdCents: "0.8983" }),
  price({ name: "google-flash-lite-output", provider: "google", providerDomain: "google.com", type: "Output tokens (Gemini 3.1 Flash Lite)", unit: "1M tokens", pricePerUnitInUsdCents: "0.00015" }),
  price({ name: "instantly-send-account", provider: "instantly", providerDomain: "instantly.ai", type: "Email send (per account)", unit: "email", pricePerUnitInUsdCents: "1.3624", bundle: bundle("valid", "2.7248") }),
  price({ name: "instantly-send-catch-all", provider: "instantly", providerDomain: "instantly.ai", type: "Email sent, catch-all", unit: "email", pricePerUnitInUsdCents: "2.7248", bundle: bundle("catch-all", "5.4496") }),
];

describe("/cold-email-automation targets its keywords", () => {
  it("title, description and H1 say cold email automation, and AI cold email is on the page", () => {
    expect(COLD_EMAIL_AUTOMATION_TITLE).toMatch(/^Cold Email Automation:/);
    expect(COLD_EMAIL_AUTOMATION_TITLE).toContain("AI Cold Email");
    expect(COLD_EMAIL_AUTOMATION_TITLE.length).toBeLessThanOrEqual(70);
    expect(COLD_EMAIL_AUTOMATION_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(COLD_EMAIL_AUTOMATION_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/cold-email-automation">');
    expect(html).toMatch(/<h1>Cold Email Automation<br>/);
    expect(html).toContain("AI cold email");
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
    expect(html).toContain('href="/cold-email-agency"');
    expect(footerModel("/cold-email-automation").bridge?.href).toBe("/cold-email-agency");
    expect(footerModel("/cold-email-agency").bridge?.href).toBe("/cold-email-automation");
  });
});

describe("every figure is live", () => {
  it("carries the fleet tokens, the price slots and the keyed client cards", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    expect(html).toContain("__HOT_LEAD_BAND__");
    expect(html).toContain("<!--action-prices-->");
    expect(html).toContain(SEND_TIERS_TOKEN);
    for (const k of ["leads", "research", "ai", "sending"] as const) expect(html).toContain(flowPriceToken(k));
    expect(html).toContain('<div class="showcase-grid" id="live-cards">');
    expect(html).toContain('data-proof-brand="docdinners.com"');
    expect(html).toContain("data-founder-count");
  });

  it("the route resolves every price slot from one read", () => {
    const route = read("src/app/cold-email-automation/route.ts");
    expect(route).toContain('fetchPlatformPrices("/cold-email-automation")');
    expect(route).toContain("withActionPrices(withColdEmailPrices(renderColdEmailAutomationPage(), prices), prices)");
  });

  it("each workflow step and each send tier is priced from the served lines", () => {
    expect(flowPrices(PRICES)).toEqual({
      leads: "$0.0278 / credit",
      research: "$0.00898 / credit",
      ai: "$1.50 / 1M tokens",
      sending: "$0.0272 / email",
    });
    expect(sendTiers(PRICES)).toEqual([
      { what: "Email sent, address verified valid by BounceVerify", price: "$0.0272 / email" },
      { what: "Email sent, address verified catch-all by BounceVerify", price: "$0.0545 / email" },
    ]);
    const out = withColdEmailPrices(html, PRICES);
    expect(out).not.toContain("<!--flow-price:");
    expect(out).not.toContain(SEND_TIERS_TOKEN);
    expect(out).toContain('<span class="cx-price">from $0.0278 / credit</span>');
    expect(out).toContain("One email sent, priced live");
    // Never a sum the client did not spend.
    expect(prose(out)).not.toMatch(/\btotal\b/i);
  });

  it("a failed or empty read prints no price, only the catalog link", () => {
    for (const p of [null, []]) {
      const out = withColdEmailPrices(html, p);
      expect(out).not.toContain("<!--flow-price:");
      expect(out).not.toContain('class="cx-price"');
      expect(out).toContain("The price of each email sent is live on our");
    }
    // A line idle for 30 days is hidden by the catalog, so it is hidden here too.
    expect(flowPrices([{ ...PRICES[0], lastUsedOn: "2026-08-01" }])).toEqual({});
  });
});

describe("the signature: a light workflow types the email, presses Send, collapses the step", () => {
  it("one mail-flow card, every step done in the HTML (the final state), the buyers in its JSON", () => {
    expect(html.match(/data-motion="mail-flow"/g)).toHaveLength(1);
    for (const key of ["found", "research", "write", "reply"]) expect(html).toContain(`data-node="${key}" data-status="done"`);
    expect(html).toContain("data-type>");
    expect(html).toContain("data-send>");
    expect(html).toContain("data-cursor");
    const json = /<script type="application\/json" data-leads>([\s\S]*?)<\/script>/.exec(html)!;
    expect(JSON.parse(json[1])).toHaveLength(FLOW_LEADS.length);
    // The motion kit this card relies on.
    expect(read("public/landing/v2/motion.js")).toContain('"mail-flow": function');
  });

  it("loads its own light sheet after agent.css and ai-sdr.css, never the Agency page's dark one", () => {
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    const c = html.indexOf("/landing/v2/cold-email-automation.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(html).not.toContain("/landing/v2/cold-email.css");
    const css = read("public/landing/v2/cold-email-automation.css");
    expect(css).toContain(".cx-node.is-open .cx-body");
    expect(css).toContain(".cx-send.is-pressed");
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("copy rules", () => {
  const copy = prose(html);
  it("no dashes, no agency claim about us, no invented promise", () => {
    expect(copy).not.toContain("—");
    expect(copy).not.toContain("–");
    expect(copy).not.toMatch(/distribute\.you is (?:a|an)\b[^.]*\bagency\b|\bour agency\b/i);
    expect(copy).not.toMatch(/\bguarantee/i);
    expect(copy).not.toMatch(/\bopen rate/i);
    expect(copy).not.toMatch(/\bNo [a-z]+, no [a-z]+/);
    for (const l of FLOW_LEADS) expect(`${l.body} ${l.answer} ${l.reply}`).not.toMatch(/[—–]/);
  });

  it("FAQ answers ship as FAQPage JSON-LD, tags stripped", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(COLD_EMAIL_AUTOMATION_FAQ.length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the catalogue serves the page", () => {
  it("Sales Cold Email's agent page is `/cold-email-automation`, live, with its own compare column", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "cold-email" && p.buyer === "agent")!;
    expect(page.path).toBe("/cold-email-automation");
    expect(page.live).toBe(true);
    const model = footerModel("/cold-email-automation/vs/instantly");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare cold email tools")!;
    expect(compare.links.map((l) => l.href)).toEqual([
      ...COLD_EMAIL_AUTOMATION_SLUGS.map((s) => `/cold-email-automation/vs/${s}`),
      "/cold-email-automation/alternatives",
    ]);
    expect(navHtml("/")).toContain('href="/cold-email-automation"><b>Sales Cold Email Automation</b>');
  });
});

describe("the cold email automation cluster", () => {
  it("moves the seven cold email tools under /cold-email-automation/vs, each re-read today", () => {
    expect([...COLD_EMAIL_AUTOMATION_SLUGS]).toEqual(["instantly", "smartlead", "lemlist", "reply-io", "saleshandy", "woodpecker", "mailshake"]);
    for (const c of coldEmailAutomationCompetitors()) {
      expect(competitorPath(c)).toBe(`/cold-email-automation/vs/${c.slug}`);
      expect(c.verifiedOn).toBe("2026-10-30");
      expect(html).toContain(`href="/cold-email-automation/vs/${c.slug}"`);
    }
    expect(competitorPath(competitorBySlug("gojiberry")!)).toBe("/compare/gojiberry");
  });

  it("each vs page is canonical under /cold-email-automation and wears its breadcrumb", () => {
    for (const c of coldEmailAutomationCompetitors()) {
      const page = renderComparePage(c);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/cold-email-automation/vs/${c.slug}">`);
      expect(page).toContain('"name":"Cold email automation","item":"https://distribute.you/cold-email-automation"');
      expect(page).toContain('href="/cold-email-automation/alternatives"');
      expect(page).toContain("cold email automation done for you");
      expect(prose(page)).not.toContain("—");
    }
  });

  it("the alternatives page lists all seven with their source, us first", () => {
    const alt = renderColdEmailAutomationAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/cold-email-automation/alternatives">');
    expect(alt).toContain("/landing/v2/cold-email-automation.css");
    const ours = alt.indexOf('class="us-row"');
    for (const c of coldEmailAutomationCompetitors()) {
      expect(alt.indexOf(`href="/cold-email-automation/vs/${c.slug}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${c.sourceUrl}"`);
    }
    expect(prose(alt)).not.toContain("—");
  });

  it("the old /compare URL answers a 301, never a 404", async () => {
    const { GET } = await import("@/app/compare/[slug]/route");
    for (const slug of COLD_EMAIL_AUTOMATION_SLUGS) {
      const res = await GET(new Request(`https://distribute.you/compare/${slug}`), { params: Promise.resolve({ slug }) });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`/cold-email-automation/vs/${slug}`);
    }
  });

  it("/cold-email-automation/vs refuses a competitor outside the cluster", async () => {
    const { GET } = await import("@/app/cold-email-automation/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/cold-email-automation/vs/apollo"), { params: Promise.resolve({ slug: "apollo" }) });
    expect(res.status).toBe(404);
  });

  it("llms.txt lists the cluster at its new home", () => {
    const llms = read("public/llms.txt");
    for (const slug of COLD_EMAIL_AUTOMATION_SLUGS) {
      expect(llms).toContain(`https://distribute.you/cold-email-automation/vs/${slug})`);
      expect(llms).not.toContain(`https://distribute.you/compare/${slug})`);
    }
  });
});
