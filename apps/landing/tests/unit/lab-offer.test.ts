import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { renderCompetitorAlternativesPage, renderComparePage } from "../../src/lib/compare-page";
import { COMPETITORS } from "../../src/lib/competitors";
import { applyDistrySkin } from "../../src/lib/distry-skin";
import { LAB_BOOK_A_CALL, LAB_PLANS, LAB_SIGN_UP, OLD_OFFER, dressBrandProof, meetingsOnlyShowcase, oldOfferClaims, readableText, withLabOffer } from "../../src/lib/lab-offer";
import { AD_TOOL_CLUSTER } from "../../src/lib/pages/ai-ad-management";
import { renderToolAlternativesPage, renderToolVsPage } from "../../src/lib/pages/agent-tools-compare";
import { BOOK_A_CALL, SIGN_UP } from "../../src/lib/site-chrome";

/**
 * The lab (`lab-distry`) states ONE offer on every page (owner 2026-11-25): Self-served
 * at $99/month with a 3-day free trial, Managed from $499/month with 100% money back
 * on fixed outcome prices. The live pages it skins still state production's offer, so
 * the skin restates them (`withLabOffer`). This sweep renders the real page builders
 * through the skin and reads what a visitor would.
 */
const ROOT = path.resolve(__dirname, "../..");
const PAGES_DIR = path.join(ROOT, "src/lib/pages");

/** Pages the lab leaves on their own offer: the Mac app (its own prepaid beta) and the two archived /lp pages. */
const NOT_SWEPT = /^render(Desktop|Instinct|Assistant|Concierge|NotFound)/;

async function livePages(): Promise<Map<string, string>> {
  const pages = new Map<string, string>();
  for (const file of readdirSync(PAGES_DIR).filter((f) => f.endsWith(".ts"))) {
    const mod = (await import(path.join(PAGES_DIR, file))) as Record<string, unknown>;
    for (const [name, fn] of Object.entries(mod)) {
      if (!/^render\w+(Page|Hub)$/.test(name) || NOT_SWEPT.test(name) || typeof fn !== "function") continue;
      try {
        // A builder that takes live reads draws without them when handed null.
        const html = (fn as (...args: unknown[]) => unknown)(null, null);
        if (typeof html === "string") pages.set(`${file}:${name}`, html);
      } catch {
        // A builder that needs a catalogue entry is rendered explicitly below.
      }
    }
  }
  const compare = (await import(path.join(ROOT, "src/lib/compare-page.ts"))) as Record<string, unknown>;
  for (const [name, fn] of Object.entries(compare)) {
    if (!/^render\w+(Page|Hub)$/.test(name) || typeof fn !== "function") continue;
    try {
      const html = (fn as (...args: unknown[]) => unknown)(null);
      if (typeof html === "string") pages.set(`compare-page.ts:${name}`, html);
    } catch {
      // per-competitor pages, below
    }
  }
  for (const c of COMPETITORS) {
    pages.set(`vs:${c.slug}`, renderComparePage(c));
    if (c.pricingAnswer) pages.set(`alternatives:${c.slug}`, renderCompetitorAlternativesPage(c));
  }
  pages.set("ad-tools:alternatives", renderToolAlternativesPage(AD_TOOL_CLUSTER));
  for (const tool of AD_TOOL_CLUSTER.tools) pages.set(`ad-tools:${tool.slug}`, renderToolVsPage(AD_TOOL_CLUSTER, tool));
  return pages;
}

describe("the old offer is recognised", () => {
  it("in the claims production states today", () => {
    for (const claim of [
      "Usage based. Every action at the API price, 0% markup.",
      "usage-based pricing",
      "You pay the vendor's price with 0% markup",
      "there is no markup",
      "You start with $10, auto reload keeps it going",
      "add your first $10",
      "a prepaid balance",
      "Free on your server",
      "0% additional fee.",
    ]) {
      expect(OLD_OFFER.some((p) => p.test(claim)), claim).toBe(true);
    }
  });

  it("and not in the new offer or a competitor's own plan", () => {
    for (const fine of ["$99/month, 3-day free trial", "From $499/month, 100% money back on fixed outcome prices", "Free plan, then $49/seat/month", "Start free trial", "$10,000 a month"]) {
      expect(OLD_OFFER.some((p) => p.test(fine)), fine).toBe(false);
    }
  });

  it("across two elements, once the markup is stripped", () => {
    expect(oldOfferClaims("<li><b>0%</b><span>markup on every action</span></li>")).toHaveLength(1);
    expect(oldOfferClaims('<script type="application/ld+json">{"description":"Usage based, 0% markup."}</script>').length).toBeGreaterThan(0);
    expect(oldOfferClaims("<script>var s='usage based'</script><p>$99/month</p>")).toEqual([]);
  });
});

describe("every skinned page states the lab's offer", async () => {
  const pages = await livePages();

  it("sweeps the real page builders, and the live pages do state the old offer", () => {
    expect(pages.size).toBeGreaterThanOrEqual(60);
    const stating = [...pages.values()].filter((html) => oldOfferClaims(html).length > 0);
    // The sweep proves something only while production still states what the lab replaces.
    expect(stating.length).toBeGreaterThanOrEqual(20);
  });

  it("leaves no old-offer claim readable after the skin", () => {
    const left: string[] = [];
    for (const [name, html] of pages) {
      for (const claim of oldOfferClaims(applyDistrySkin(html, "/ai-sdr"))) left.push(`${name}: ${claim}`);
    }
    if (process.env.LAB_OFFER_DUMP) writeFileSync(process.env.LAB_OFFER_DUMP, [...new Set(left.map((l) => l.slice(l.indexOf(": ") + 2)))].join("\n"));
    expect(left.slice(0, 12)).toEqual([]);
  });

  it("puts the two plans where the Open source and Hosted cards stood", async () => {
    const { renderAiSdrPage } = await import("../../src/lib/pages/ai-sdr");
    const live = renderAiSdrPage();
    expect(live).toContain("<i></i>Open source</span>");
    const text = readableText(applyDistrySkin(live, "/ai-sdr"));
    expect(text).toContain("Self-served 3-day free trial Then $99/month");
    expect(text).toContain("Managed From $499/month 100% money back");
    expect(text).not.toContain("View the code");
    expect(text).toContain("More pipeline for your sales team.");
  });

  it("restates the live price rows a route fills after the builder", async () => {
    const { ACTION_PRICES_TOKEN, withActionPrices } = await import("../../src/lib/pages/home-agent");
    const { renderAiSdrPage } = await import("../../src/lib/pages/ai-sdr");
    const filled = withActionPrices(renderAiSdrPage(), null);
    expect(filled).not.toContain(ACTION_PRICES_TOKEN);
    expect(oldOfferClaims(applyDistrySkin(filled, "/ai-sdr"))).toEqual([]);
    expect(withLabOffer('<div class="price">from $0.01<small>API price, 0% markup</small></div>')).toBe('<div class="price">from $0.01<small>unit price</small></div>');
  });

  it("leaves an agency page's own plans alone", () => {
    const agency = '<div class="plans"><article class="plan rv"><span class="plan-tag"><i></i>Agency</span></article></div>';
    expect(withLabOffer(agency)).toBe(agency);
  });

  it("returns a page stating none of it unchanged", () => {
    const page = "<html><head></head><body><section><h1>About us</h1><p>Free plan, then $49/seat/month</p></section></body></html>";
    expect(withLabOffer(page)).toBe(page);
  });
});

describe("the plan cards", () => {
  it("send Self-served to signup and Managed to the site's own Book a call", () => {
    expect(LAB_SIGN_UP).toBe(SIGN_UP);
    expect(LAB_BOOK_A_CALL).toBe(BOOK_A_CALL);
    expect(LAB_PLANS).toContain(`href="${SIGN_UP}">Start free trial</a>`);
    expect(LAB_PLANS).toContain(`href="${BOOK_A_CALL}"`);
    expect(oldOfferClaims(LAB_PLANS)).toEqual([]);
  });
});

describe("the lab home", () => {
  const home = readFileSync(path.join(ROOT, "prototypes/distry/index.html"), "utf8");

  it("states the new offer and none of the old one", () => {
    expect(oldOfferClaims(home)).toEqual([]);
    const pricing = home.slice(home.indexOf('id="pricing"'), home.indexOf('id="quotes"'));
    expect(pricing).toContain("3-day free trial <small>Then $99/month</small>");
    expect(pricing).toContain(`href="${SIGN_UP}">Start free trial</a>`);
    expect(pricing).toContain("From $499/month <span>100% money back</span>");
    expect(pricing).toContain(`href="${BOOK_A_CALL}">Book a call</a>`);
    expect(home).toContain("$99/month · 3-day free trial · Cancel anytime");
  });

  it("carries the logo wall and the press band tokens, the wall first", () => {
    expect(home.indexOf("<!--brand-proof-->")).toBeGreaterThan(home.indexOf('id="live-cards"'));
    expect(home.indexOf("<!--press-proof-->")).toBeGreaterThan(home.indexOf("<!--brand-proof-->"));
    expect(home.indexOf("<!--press-proof-->")).toBeLessThan(home.indexOf('id="pricing"'));
  });

  it("ships client cards that state meetings booked only", () => {
    const cards = home.slice(home.indexOf('id="live-cards"'), home.indexOf('class="show-card yours"'));
    expect(cards).toContain('data-step="meeting_booked"');
    expect(cards).not.toContain('data-step="conversation"');
    expect(cards).not.toContain("Interested leads");
  });

  it("is served through the lab transforms", () => {
    const route = readFileSync(path.join(ROOT, "src/app/internal-prototype/[slug]/[[...path]]/route.ts"), "utf8");
    expect(route).toContain("withLabHome(await withOutcomeRanges(await withLiveFigures(");
    const skin = readFileSync(path.join(ROOT, "src/lib/distry-skin.ts"), "utf8");
    expect(skin).toContain("withLabOffer(");
    // Production's pipeline never imports the lab's offer.
    expect(readFileSync(path.join(ROOT, "src/lib/static-html.ts"), "utf8")).not.toContain("lab-offer");
  });
});

describe("meetingsOnlyShowcase", () => {
  const card = (domain: string, meetings: number, leads: number) =>
    `\n<a class="show-card" href="#proof" data-live data-brand="${domain}" data-steps="${meetings},${leads}">
  <div class="show-funnel">
    <span class="sf" data-step="meeting_booked"${meetings === 0 ? " data-zero" : ""}><b data-n="0">${meetings.toLocaleString("en-US")}</b><small>Meetings booked</small></span>
    <span class="sf" data-step="conversation"><b data-n="1">${leads}</b><small>Interested leads</small></span>
  </div>
</a>`;
  const yours = '\n<a class="show-card yours" href="x"><span class="sf"><b>Tonight</b><small>Distry starts</small></span></a>';
  const out = meetingsOnlyShowcase(`<div id="live-cards">${card("a.com", 1204, 38)}${card("b.com", 0, 10)}${card("c.com", 2, 0)}${yours}</div>`);

  it("keeps the meetings cell and drops the other", () => {
    expect(out).toContain('data-brand="a.com" data-steps="1204"');
    expect(out).toContain("<b data-n=\"0\">1,204</b><small>Meetings booked</small>");
    expect(out).not.toContain("Interested leads");
    expect(out).not.toContain('data-step="conversation"');
  });

  it("does not show a client with no meeting booked", () => {
    expect(out).not.toContain("b.com");
    expect(out).toContain('data-brand="c.com" data-steps="2"');
  });

  it("keeps the visitor's own card", () => {
    expect(out).toContain("Tonight");
    expect(out).toContain('class="show-card yours"');
  });
});

describe("dressBrandProof", () => {
  it("puts the wall and the press band in the day band, and names the band as asked", () => {
    const out = dressBrandProof('<section class="framed" id="clients"><ul class="logo-wall"></ul></section><section class="framed" id="featured"><h3>As featured in</h3></section>');
    expect(out).toContain('<section class="framed day" id="clients" data-sky="1"');
    expect(out).toContain('<section class="framed day" id="featured" data-sky="1"');
    expect(out).toContain("<h3>Featured in</h3>");
  });
});

describe("the lab press band (owner 2026-11-25)", () => {
  it("keeps only the four named outlets, in order, still", async () => {
    const { stillPress, LAB_PRESS } = await import("../../src/lib/lab-offer");
    const li = (n: string) => `<li><a href="https://x.test/${n.length}"><img src="https://l.test/a.png" alt=""><span title="${n}">${n}</span></a></li>`;
    const copy = (n: string) => `<li aria-hidden="true"><a href="https://x.test" tabindex="-1"><img src="https://l.test/a.png" alt=""><span title="${n}">${n}</span></a></li>`;
    const names = ["TechBullion", "Grit Daily News", "College Recruiter", "CMO Times", "COO Insider", "Lawyer Magazine"];
    const html = `<div class="press-marquee"><ul class="press-track" data-brand-proof="press">${names.map(li).join("")}${names.map(copy).join("")}</ul></div>`;
    const out = stillPress(html);
    expect(out).not.toContain("press-marquee");
    expect(out).not.toContain("aria-hidden");
    expect([...out.matchAll(/<span title="([^"]*)"/g)].map((m) => m[1])).toEqual([...LAB_PRESS]);
    // An outlet drawn as a wordmark carries no span: its name is read from the alt.
    const wm = (n: string) => `<li><a href="https://x.test/${n.length}"><img class="wordmark" src="https://l.test/w.png" alt="${n}" title="${n}"></a></li>`;
    const wide = stillPress(`<div class="press-marquee"><ul class="press-track" data-brand-proof="press">${names.map(wm).join("")}</ul></div>`);
    expect([...wide.matchAll(/<img class="wordmark"[^>]* alt="([^"]*)"/g)].map((m) => m[1])).toEqual([...LAB_PRESS]);
  });
});
