import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BEATS,
  NURTURING_DESCRIPTION,
  NURTURING_FAQ,
  NURTURING_TITLE,
  renderLeadNurturingAutomationPage,
} from "../../src/lib/pages/lead-nurturing-automation";
import { renderNurturingAlternativesPage, renderNurturingVsPage } from "../../src/lib/pages/lead-nurturing-automation-compare";
import { renderDatabaseReactivationAgencyPage } from "../../src/lib/pages/database-reactivation-agency";
import { NURTURING_TOOLS, nurturingClusterPaths, nurturingVsPath } from "../../src/lib/nurturing-tools";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";

/**
 * PAGE-LEAD-NURTURING-AUTOMATION-1030: the Lead Nurturing AI Agent page at
 * `/lead-nurturing-automation` (keyword "lead nurturing automation", with "ai lead nurturing"),
 * its signals-and-WhatsApp signature, its vs/alternatives cluster, and the bridge with its
 * Agency twin `/database-reactivation-agency`.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderLeadNurturingAutomationPage();
const prose = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

describe("/lead-nurturing-automation targets its keyword", () => {
  it("title, description and H1 say lead nurturing automation", () => {
    expect(NURTURING_TITLE).toMatch(/^Lead Nurturing Automation:/);
    expect(NURTURING_TITLE.length).toBeLessThanOrEqual(70);
    expect(NURTURING_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(NURTURING_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/lead-nurturing-automation">');
    expect(html).toMatch(/<h1>Lead Nurturing Automation<br>/);
    expect(html).toContain("AI lead nurturing");
  });

  it("states the why and the AI Agent offer", () => {
    expect(html).toContain("Revenue made easy.");
    expect(html).toContain("0% markup");
    expect(html).not.toContain('<i></i>Team</span>'); // one free plan, no Team tier (owner 2026-10-31)
    expect(html).toContain("$10");
    expect(html).toContain("https://github.com/distribute-you/gtm-factory");
    expect(html).toContain("Start free");
  });

  it("names the four connectors and both channels", () => {
    for (const t of ["Clerk", "Stripe", "PostHog", "GoHighLevel", "WhatsApp", "email"]) expect(prose(html)).toContain(t);
  });

  it("bridges to its Agency twin, and the twin bridges back, in page and footer", () => {
    expect(html).toContain('href="/database-reactivation-agency"');
    expect(renderDatabaseReactivationAgencyPage(null)).toContain('href="/lead-nurturing-automation"');
    expect(footerModel("/lead-nurturing-automation").bridge?.href).toBe("/database-reactivation-agency");
    expect(footerModel("/database-reactivation-agency").bridge?.href).toBe("/lead-nurturing-automation");
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
    const route = read("src/app/lead-nurturing-automation/route.ts");
    expect(route).toContain('fetchPlatformPrices("/lead-nurturing-automation")');
    expect(route).toContain("withActionPrices(renderLeadNurturingAutomationPage(), prices)");
  });

  it("the hero preview names a role, never a person, and states no figure", () => {
    const stage = html.slice(html.indexOf('data-motion="signal-thread"'), html.indexOf('class="faces faces-showcase ln-faces"'));
    expect(prose(stage)).not.toMatch(/\$\d/);
    expect(stage).toContain("Head of Growth, B2B SaaS");
  });
});

describe("the signature: a signals feed answered on WhatsApp, light", () => {
  it("one signal-thread stage, every beat numbered in order, the HTML its final state", () => {
    expect(html.match(/data-motion="signal-thread"/g)).toHaveLength(1);
    const beats = [...html.matchAll(/data-beat="(\d+)" data-kind="(signal|us|them|event)"/g)].map((m) => Number(m[1])).sort((a, b) => a - b);
    expect(beats).toEqual(BEATS.map((_, i) => i + 1));
    expect(html.match(/data-kind="signal"/g)?.length).toBeGreaterThanOrEqual(3);
    for (const tool of ["posthog.com", "clerk.com", "stripe.com"]) expect(html).toContain(tool);
    // Ours already read in the finished state; the typing bubble only shows while playing.
    expect(html).toContain('class="ln-msg us is-read"');
    expect(html).toContain("data-typing");
    // A different effect from the Agency twin's dark thread.
    expect(html).not.toContain('data-motion="wa-thread"');
  });

  it("the kit runs it, and the page loads its own sheet after agent.css and ai-sdr.css", () => {
    expect(read("public/landing/v2/motion.js")).toContain('"signal-thread": function (el, gsap)');
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    const c = html.indexOf("/landing/v2/lead-nurturing-automation.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    const css = read("public/landing/v2/lead-nurturing-automation.css");
    expect(css).toContain(".ln-sig.is-live");
    expect(css).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("copy rules", () => {
  const pages = [html, renderNurturingAlternativesPage(), ...NURTURING_TOOLS.map(renderNurturingVsPage)];
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
    expect(faq.mainEntity).toHaveLength(NURTURING_FAQ.length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the catalogue serves the page", () => {
  it("Lead Nurturing's agent page is live at /lead-nurturing-automation, with its own compare column", () => {
    const page = SITE_PAGES.find((p) => p.outcome === "lead-nurturing" && p.buyer === "agent")!;
    expect(page.path).toBe("/lead-nurturing-automation");
    expect(page.live).toBe(true);
    const model = footerModel("/lead-nurturing-automation/vs/brevo");
    expect(model.variant).toBe("agent");
    const compare = model.columns.find((c) => c.title === "Compare nurturing tools")!;
    expect(compare.links.map((l) => l.href)).toEqual(nurturingClusterPaths().slice(1).concat(nurturingClusterPaths()[0]));
    expect(navHtml("/")).toContain('href="/lead-nurturing-automation"><b>Lead Nurturing Automation</b>');
  });

  it("the sitemap and llms.txt list the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    const llms = read("public/llms.txt");
    for (const p of ["/lead-nurturing-automation", ...nurturingClusterPaths()]) {
      expect(urls).toContain(`https://distribute.you${p}`);
      expect(llms).toContain(`https://distribute.you${p}`);
    }
  });
});

describe("the lead nurturing tools cluster", () => {
  it("each tool is read on its own site this month, with plans and prices", () => {
    expect(NURTURING_TOOLS.map((t) => t.slug)).toEqual(["activecampaign", "hubspot-marketing-hub", "customer-io", "brevo"]);
    for (const t of NURTURING_TOOLS) {
      expect(new URL(t.sourceUrl).hostname.replace(/^www\./, ""), t.slug).toBe(t.domain);
      expect(t.verifiedOn, t.slug).toMatch(/^2026-10-\d\d$/);
      expect(t.prices.length, t.slug).toBeGreaterThan(1);
      for (const p of t.prices) expect(p.price, `${t.slug} ${p.plan}`).toMatch(/\$|On request/);
      expect(html).toContain(`href="${nurturingVsPath(t)}"`);
    }
  });

  it("each vs page is canonical under /lead-nurturing-automation, sourced, with every plan", () => {
    for (const t of NURTURING_TOOLS) {
      const page = renderNurturingVsPage(t);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/lead-nurturing-automation/vs/${t.slug}">`);
      expect(page).toContain(`<h1>distribute.you <span class="accent">vs</span> ${t.name}</h1>`);
      expect(page).toContain(`href="${t.sourceUrl}" rel="nofollow noopener"`);
      for (const p of t.prices) expect(page).toContain(p.price.replace(/&/g, "&amp;"));
      for (const o of NURTURING_TOOLS) if (o.slug !== t.slug) expect(page).toContain(`href="${nurturingVsPath(o)}">distribute.you vs ${o.name}</a>`);
    }
  });

  it("the alternatives page lists all four with their source, us first", () => {
    const alt = renderNurturingAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/lead-nurturing-automation/alternatives">');
    const ours = alt.indexOf('class="us-row"');
    expect(ours).toBeGreaterThan(0);
    for (const t of NURTURING_TOOLS) {
      expect(alt.indexOf(`href="${nurturingVsPath(t)}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${t.sourceUrl}"`);
    }
  });

  it("/lead-nurturing-automation/vs refuses a tool outside the cluster", async () => {
    const { GET } = await import("@/app/lead-nurturing-automation/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/lead-nurturing-automation/vs/apollo"), { params: Promise.resolve({ slug: "apollo" }) });
    expect(res.status).toBe(404);
  }, 20_000);
});
