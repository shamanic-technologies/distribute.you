import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  GTM_AUTOMATION_DESCRIPTION,
  GTM_AUTOMATION_TITLE,
  RUN_STAGES,
  gtmAutomationFaq,
  gtmPriceToken,
  outcomePages,
  renderGtmAutomationPage,
  stagePrices,
  withGtmPrices,
} from "../../src/lib/pages/gtm-automation";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderComparePage, renderGtmAutomationAlternativesPage } from "../../src/lib/compare-page";
import {
  GTM_AUTOMATION_SLUGS,
  competitorBySlug,
  competitorPath,
  gtmAutomationCompetitors,
} from "../../src/lib/competitors";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";
import type { PlatformPrice } from "../../src/lib/pages/catalog";

/**
 * PAGE-GTM-AUTOMATION-1030: the GTM AI Agent page at `/gtm-automation` (keywords "gtm
 * automation", "ai gtm agent"), the umbrella of the AI Agent pages, its vs/alternatives
 * cluster, the 301 from `/compare/default` and the pinned scroll-scrubbed hero.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderGtmAutomationPage();
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

/** Shaped like the served catalogue on 2026-10-30. */
const PRICES: PlatformPrice[] = [
  price({ name: "apollo-credit", provider: "apollo", providerDomain: "apollo.io", type: "Credit", unit: "credit", pricePerUnitInUsdCents: "2.7769" }),
  price({ name: "firecrawl-scrape-credit", provider: "firecrawl", providerDomain: "firecrawl.dev", type: "Scrape credit", unit: "credit", pricePerUnitInUsdCents: "0.8983" }),
  price({ name: "google-flash-lite-output", provider: "google", providerDomain: "google.com", type: "Output tokens (Gemini 3.1 Flash Lite)", unit: "1M tokens", pricePerUnitInUsdCents: "0.00015" }),
  price({ name: "instantly-send-account", provider: "instantly", providerDomain: "instantly.ai", type: "Email send (per account)", unit: "email", pricePerUnitInUsdCents: "1.3624" }),
];

describe("/gtm-automation targets its keywords", () => {
  it("title, description and H1 say GTM automation, and AI GTM agent is on the page", () => {
    expect(GTM_AUTOMATION_TITLE).toMatch(/^GTM Automation:/);
    expect(GTM_AUTOMATION_TITLE).toContain("AI GTM Agent");
    expect(GTM_AUTOMATION_TITLE.length).toBeLessThanOrEqual(70);
    expect(GTM_AUTOMATION_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(GTM_AUTOMATION_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/gtm-automation">');
    expect(html).toMatch(/<h1>GTM Automation<br>/);
    expect(html).toContain("AI GTM agent");
  });

  it("states the why and the AI Agent offer", () => {
    expect(html).toContain("Revenue made easy.");
    expect(html).toContain("0% markup");
    expect(html).toContain("$9");
    expect(html).toContain("$10");
    expect(html).toContain("https://github.com/distribute-you/gtm-factory");
    expect(html).toContain("Start free");
    expect(html).toContain("Claude Code");
    expect(html).toContain("Grok");
  });

  it("bridges to /gtm-agency both ways, in the page and in the footer", () => {
    expect(html).toContain('href="/gtm-agency"');
    expect(footerModel("/gtm-automation").bridge?.href).toBe("/gtm-agency");
    expect(footerModel("/gtm-agency").bridge?.href).toBe("/gtm-automation");
    expect(renderGtmAgencyPage(null, null)).toContain('<a class="alt" href="/gtm-automation">Just testing? Start free</a>');
  });
});

describe("the umbrella of the AI Agent pages", () => {
  it("links every other live AI Agent page, read from the catalogue", () => {
    const live = SITE_PAGES.filter((p) => p.buyer === "agent" && p.live && p.path !== "/gtm-automation").map((p) => p.path);
    expect(outcomePages().map((p) => p.path)).toEqual(live);
    for (const p of ["/", "/ai-sdr", "/ai-lead-generation", "/cold-email-automation"]) {
      expect(live).toContain(p);
      expect(html).toContain(`<a class="gx-out" href="${p}">`);
    }
    // A page that is not live is linked from nowhere.
    for (const p of SITE_PAGES.filter((x) => !x.live)) expect(html).not.toContain(`href="${p.path}"`);
  });
});

describe("every figure is live", () => {
  it("carries the fleet tokens, the price slots and the keyed client cards", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    expect(html).toContain("__HOT_LEAD_BAND__");
    expect(html).toContain("<!--action-prices-->");
    for (const k of ["leads", "research", "ai", "sending"] as const) expect(html).toContain(gtmPriceToken(k));
    expect(html).toContain('<div class="showcase-grid" id="live-cards">');
    expect(html).toContain('data-proof-brand="docdinners.com"');
    expect(html).toContain("data-founder-count");
  });

  it("the route resolves every price slot from one read", () => {
    const route = read("src/app/gtm-automation/route.ts");
    expect(route).toContain('fetchPlatformPrices("/gtm-automation")');
    expect(route).toContain("withActionPrices(withGtmPrices(renderGtmAutomationPage(), prices), prices)");
  });

  it("each priced stage reads its served line; a failed read prints no price", () => {
    expect(stagePrices(PRICES)).toEqual({
      leads: "$0.0278 / credit",
      research: "$0.00898 / credit",
      ai: "$1.50 / 1M tokens",
      sending: "$0.0136 / email",
    });
    const out = withGtmPrices(html, PRICES);
    expect(out).not.toContain("<!--gtm-price:");
    expect(out).toContain('<span class="gx-price">from $0.0278 / credit</span>');
    expect(prose(out)).not.toMatch(/\btotal\b/i);
    for (const p of [null, []]) {
      const none = withGtmPrices(html, p);
      expect(none).not.toContain("<!--gtm-price:");
      expect(none).not.toContain('class="gx-price"');
    }
  });
});

describe("the signature: a pinned hero scrubbed by scroll, one lead from found to paid", () => {
  it("one pin-scrub track; the HTML is the final state, every stage done", () => {
    expect(html.match(/data-motion="pin-scrub"/g)).toHaveLength(1);
    expect(RUN_STAGES.map((s) => s.key)).toEqual(["found", "qualified", "emailed", "replied", "meeting", "paid"]);
    expect(html).toContain(`data-scrub-scene data-stage="${RUN_STAGES.length}" style="--s:${RUN_STAGES.length - 1}"`);
    expect(html.match(/data-scrub-step data-status="done"/g)).toHaveLength(RUN_STAGES.length);
    // The pinned scene keeps its sticky child out of the hero's overflow:hidden box.
    expect(html.indexOf('<div class="gx-pin">')).toBeLessThan(html.indexOf('<div class="hero hero-agent hero-gtm">'));
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('"pin-scrub": function');
    expect(kit).toContain('el.classList.toggle("is-pinned"');
  });

  it("loads its own light sheet after agent.css and ai-sdr.css; pinning lives in CSS behind .is-pinned", () => {
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    const c = html.indexOf("/landing/v2/gtm-automation.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(html).not.toContain("/landing/v2/agency.css");
    const css = read("public/landing/v2/gtm-automation.css");
    expect(css).toContain(".gx-track.is-pinned .gx-pin { position: sticky;");
    expect(css).toContain(".gx-track.is-pinned { height:");
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
  });

  it("FAQ answers ship as FAQPage JSON-LD, tags stripped", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(gtmAutomationFaq().length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the catalogue serves the page", () => {
  it("GTM's agent page is `/gtm-automation`, live, with its own compare column", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "gtm" && p.buyer === "agent")!;
    expect(page.path).toBe("/gtm-automation");
    expect(page.live).toBe(true);
    const model = footerModel("/gtm-automation/vs/unify");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare GTM platforms")!;
    expect(compare.links.map((l) => l.href)).toEqual([...GTM_AUTOMATION_SLUGS.map((s) => `/gtm-automation/vs/${s}`), "/gtm-automation/alternatives"]);
    expect(navHtml("/")).toContain('href="/gtm-automation"><b>GTM Automation</b>');
  });
});

describe("the GTM automation cluster", () => {
  it("Default, Unify and Common Room live under /gtm-automation/vs, each read today; Clay stays with lead generation", () => {
    expect([...GTM_AUTOMATION_SLUGS]).toEqual(["default", "unify", "common-room"]);
    for (const c of gtmAutomationCompetitors()) {
      expect(competitorPath(c)).toBe(`/gtm-automation/vs/${c.slug}`);
      expect(c.verifiedOn).toBe("2026-10-30");
      expect(html).toContain(`href="/gtm-automation/vs/${c.slug}"`);
    }
    expect(competitorPath(competitorBySlug("clay")!)).toBe("/ai-lead-generation/vs/clay");
    expect(html).toContain('href="/ai-lead-generation/vs/clay"');
  });

  it("each vs page is canonical under /gtm-automation and wears its breadcrumb", () => {
    for (const c of gtmAutomationCompetitors()) {
      const page = renderComparePage(c);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/gtm-automation/vs/${c.slug}">`);
      expect(page).toContain('"name":"GTM automation","item":"https://distribute.you/gtm-automation"');
      expect(page).toContain('href="/gtm-automation/alternatives"');
      expect(page).toContain("GTM automation done for you");
      expect(prose(page)).not.toContain("—");
    }
  });

  it("the alternatives page lists the three and Clay with their source, us first", () => {
    const alt = renderGtmAutomationAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/gtm-automation/alternatives">');
    expect(alt).toContain("/landing/v2/gtm-automation.css");
    const ours = alt.indexOf('class="us-row"');
    for (const c of [...gtmAutomationCompetitors(), competitorBySlug("clay")!]) {
      expect(alt.indexOf(`href="${competitorPath(c)}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${c.sourceUrl}"`);
    }
    expect(prose(alt)).not.toContain("—");
  });

  it("the old /compare/default answers a 301, never a 404", async () => {
    const { GET } = await import("@/app/compare/[slug]/route");
    for (const slug of GTM_AUTOMATION_SLUGS) {
      const res = await GET(new Request(`https://distribute.you/compare/${slug}`), { params: Promise.resolve({ slug }) });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`/gtm-automation/vs/${slug}`);
    }
  });

  it("/gtm-automation/vs refuses a competitor outside the cluster", async () => {
    const { GET } = await import("@/app/gtm-automation/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/gtm-automation/vs/clay"), { params: Promise.resolve({ slug: "clay" }) });
    expect(res.status).toBe(404);
  });

  it("llms.txt lists the cluster at its new home", () => {
    const llms = read("public/llms.txt");
    expect(llms).toContain("https://distribute.you/gtm-automation)");
    for (const slug of GTM_AUTOMATION_SLUGS) expect(llms).toContain(`https://distribute.you/gtm-automation/vs/${slug})`);
    expect(llms).not.toContain("https://distribute.you/compare/default)");
  });
});
