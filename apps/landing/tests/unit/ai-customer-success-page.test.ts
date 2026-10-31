import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CS_DESCRIPTION,
  CS_TITLE,
  MOMENTS,
  agencyTwin,
  csFaq,
  renderAiCustomerSuccessPage,
} from "../../src/lib/pages/ai-customer-success";
import { renderCsAlternativesPage, renderCsVsPage } from "../../src/lib/pages/ai-customer-success-compare";
import { CS_TOOLS, aiCsClusterPaths, aiCsVsPath } from "../../src/lib/cs-tools";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";

/**
 * PAGE-AI-CUSTOMER-SUCCESS-1030: the Customer Success AI Agent page at `/ai-customer-success`
 * (keyword "ai customer success", with "customer success automation"), its light customer feed
 * signature, its vs/alternatives cluster, and the bridge to its Agency twin once that one is live.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderAiCustomerSuccessPage();
const prose = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

describe("/ai-customer-success targets its keyword", () => {
  it("title, description and H1 say AI customer success", () => {
    expect(CS_TITLE).toMatch(/^AI Customer Success:/);
    expect(CS_TITLE.length).toBeLessThanOrEqual(70);
    expect(CS_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(CS_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/ai-customer-success">');
    expect(html).toMatch(/<h1>AI Customer Success<br>/);
    expect(html).toContain("Customer success automation");
  });

  it("states the why and the AI Agent offer", () => {
    expect(html).toContain("Revenue made easy.");
    expect(html).toContain("0% markup");
    expect(html).not.toContain('<i></i>Team</span>'); // one free plan, no Team tier (owner 2026-10-31)
    expect(html).toContain("$10");
    expect(html).toContain("https://github.com/distribute-you/gtm-factory");
    expect(html).toContain("Start free");
  });

  it("names the connectors and only the channel the catalogue runs for paying customers", () => {
    for (const t of ["Stripe", "Clerk", "PostHog", "GoHighLevel", "WhatsApp", "Client satisfied"]) expect(prose(html)).toContain(t);
    // The leg after Paid client runs on WhatsApp only: never promise an email check-in.
    expect(prose(html)).not.toMatch(/check[- ]ins? by email|email check[- ]in/i);
  });

  it("links its Agency twin only while the catalogue serves it, in page and footer alike", () => {
    const twin = agencyTwin();
    if (twin) {
      expect(html).toContain(`href="${twin.path}"`);
      expect(footerModel("/ai-customer-success").bridge?.href).toBe(twin.path);
    } else {
      expect(html).not.toContain('href="/customer-success-agency"');
    }
  });
});

describe("every figure is live", () => {
  it("carries the fleet tokens, the price slot and the served founder count", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    expect(html).toContain("__HOT_LEAD_BAND__");
    expect(html).toContain("<!--action-prices-->");
    expect(html).toContain("data-founder-count");
  });

  it("the route resolves the price list from the catalogue read", () => {
    const route = read("src/app/ai-customer-success/route.ts");
    expect(route).toContain('fetchPlatformPrices("/ai-customer-success")');
    expect(route).toContain("withActionPrices(renderAiCustomerSuccessPage(), prices)");
  });

  it("the hero feed names roles, never a person, and states no figure", () => {
    const stage = html.slice(html.indexOf('class="acs-stage"'), html.indexOf('class="faces faces-showcase acs-faces"'));
    expect(prose(stage)).not.toMatch(/\$\d|\d+%/);
    for (const m of MOMENTS) expect(m.who).toMatch(/^[A-Z][A-Za-z ]+, [a-z0-9 ]+$/i);
  });
});

describe("the signature: a light customer feed rolling upward, with its own pause", () => {
  it("one vertical marquee, its pause button bound to it, the HTML its final state", () => {
    expect(html.match(/data-motion="marquee"/g)).toHaveLength(1);
    expect(html).toContain('id="acs-feed" data-motion="marquee" data-motion-axis="y"');
    expect(html).toContain('data-motion-pause="acs-feed" aria-pressed="false"');
    expect(html.match(/class="acs-moment"/g)).toHaveLength(MOMENTS.length);
    // A different effect from the Agency twin's dark sideways reel.
    expect(html).not.toContain('data-motion="post-reel"');
    expect(html).not.toContain('data-motion="wa-thread"');
  });

  it("the kit rolls a marquee upward and honours the pause toggle", () => {
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('el.getAttribute("data-motion-axis") === "y"');
    expect(kit).toContain("[data-motion-pause=");
    expect(kit).toContain('btn.setAttribute("aria-pressed", String(held))');
  });

  it("the page loads its own sheet after agent.css and ai-sdr.css", () => {
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    const c = html.indexOf("/landing/v2/ai-customer-success.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    const css = read("public/landing/v2/ai-customer-success.css");
    expect(css).toContain(".acs-pause:not([hidden])");
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("copy rules", () => {
  const pages = [html, renderCsAlternativesPage(), ...CS_TOOLS.map(renderCsVsPage)];
  it("no dashes, no agency claim about us, no invented promise", () => {
    for (const p of pages) {
      const copy = prose(p);
      expect(copy).not.toContain("—");
      expect(copy).not.toContain("–");
      expect(copy).not.toMatch(/distribute\.you is (?:a|an)\b[^.]*\bagency\b|\bour agency\b/i);
      expect(copy).not.toMatch(/\bopen rate/i);
      expect(copy).not.toMatch(/\bNo [a-z]+, no [a-z]+/);
      expect(copy).toContain("Revenue made easy.");
    }
  });

  it("FAQ answers ship as FAQPage JSON-LD, tags stripped", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(csFaq().length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the catalogue serves the page", () => {
  it("Customer Success's agent page is live at /ai-customer-success, with its own compare column", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "customer-success" && p.buyer === "agent")!;
    expect(page.path).toBe("/ai-customer-success");
    expect(page.live).toBe(true);
    const model = footerModel("/ai-customer-success/vs/intercom");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare customer success tools")!;
    expect(compare.links.map((l) => l.href)).toEqual(aiCsClusterPaths().slice(1).concat(aiCsClusterPaths()[0]));
    expect(navHtml("/")).toContain('href="/ai-customer-success"><b>Customer Success Automation</b>');
  });

  it("the sitemap and llms.txt list the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    const llms = read("public/llms.txt");
    for (const p of ["/ai-customer-success", ...aiCsClusterPaths()]) {
      expect(urls).toContain(`https://distribute.you${p}`);
      expect(llms).toContain(`https://distribute.you${p}`);
    }
  });
});

describe("the customer success tools cluster", () => {
  it("each tool is read on its own site this month, with plans and prices", () => {
    expect(CS_TOOLS.map((t) => t.slug)).toEqual(["intercom", "zendesk", "hubspot-service-hub", "freshdesk"]);
    for (const t of CS_TOOLS) {
      expect(new URL(t.sourceUrl).hostname.replace(/^www\./, ""), t.slug).toBe(t.domain);
      expect(t.verifiedOn, t.slug).toMatch(/^2026-10-\d\d$/);
      expect(t.prices.length, t.slug).toBeGreaterThan(1);
      for (const p of t.prices) expect(p.price, `${t.slug} ${p.plan}`).toMatch(/\$|On request/);
      expect(html).toContain(`href="${aiCsVsPath(t)}"`);
    }
  });

  it("each vs page is canonical under /ai-customer-success, sourced, with every plan", () => {
    for (const t of CS_TOOLS) {
      const page = renderCsVsPage(t);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/ai-customer-success/vs/${t.slug}">`);
      expect(page).toContain(`<h1>distribute.you <span class="accent">vs</span> ${t.name}</h1>`);
      expect(page).toContain(`href="${t.sourceUrl}" rel="nofollow noopener"`);
      for (const p of t.prices) expect(page).toContain(p.price.replace(/&/g, "&amp;"));
      for (const o of CS_TOOLS) if (o.slug !== t.slug) expect(page).toContain(`href="${aiCsVsPath(o)}">distribute.you vs ${o.name}</a>`);
    }
  });

  it("the alternatives page lists all four with their source, us first", () => {
    const alt = renderCsAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/ai-customer-success/alternatives">');
    const ours = alt.indexOf('class="us-row"');
    expect(ours).toBeGreaterThan(0);
    for (const t of CS_TOOLS) {
      expect(alt.indexOf(`href="${aiCsVsPath(t)}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${t.sourceUrl}"`);
    }
  });

  it("/ai-customer-success/vs refuses a tool outside the cluster", async () => {
    const { GET } = await import("@/app/ai-customer-success/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/ai-customer-success/vs/gainsight"), { params: Promise.resolve({ slug: "gainsight" }) });
    expect(res.status).toBe(404);
  }, 20_000);
});
