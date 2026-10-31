import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CS_CONNECTORS,
  CS_FAQ,
  MOMENTS,
  POSTS,
  csCostTableHtml,
  reelHtml,
  renderCustomerSuccessAgencyPage,
} from "../../src/lib/pages/customer-success-agency";
import { renderCsAlternativesPage, renderCsVsPage } from "../../src/lib/pages/customer-success-agency-compare";
import { renderAppointmentSettingAgencyPage } from "../../src/lib/pages/appointment-setting-agency";
import { renderDatabaseReactivationAgencyPage } from "../../src/lib/pages/database-reactivation-agency";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import { CS_AGENCIES, CS_PAGE_PATH, csClusterPaths, csVsPath } from "../../src/lib/customer-success-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt } from "../../src/lib/site-pages";

/**
 * PAGE-CUSTOMER-SUCCESS-AGENCY-1030: `/customer-success-agency`, its alternatives page and one vs
 * page per provider. Rendered behaviour (the reel scrolling and its pause toggle, the sticky story,
 * the slider, reduced motion) was checked with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

const page = renderCustomerSuccessAgencyPage();
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) => new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));

describe("the Customer Success Agency page", () => {
  it("is the Customer Success Agency entry, live with the agency footer, its sections and compare column", () => {
    const entry = SITE_PAGES.find((p) => p.outcome === "customer-success" && p.buyer === "agency");
    expect(entry?.path).toBe("/customer-success-agency");
    expect(entry?.live).toBe(true);
    expect(pageAt("/customer-success-agency")?.navLabel).toBe("Customer Success Agency");
    const f = footerModel("/customer-success-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...CS_AGENCIES.map(csVsPath), "/customer-success-agency/alternatives"]);
    for (const id of ["how", "moments", "ours", "compare", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/customer-success-agency").ctas[0].label).toBe("Book a call");
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>Customer Success Agency: ");
    expect(page).toMatch(/<h1[^>]*>The customer success agency that keeps your clients happy\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*customer success agency[^"]*Customer success outsourcing/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/customer-success-agency">');
  });

  it("is its own page, never a sibling page with words swapped", () => {
    const own = sentences(page);
    for (const other of [
      renderGtmAgencyPage(null, null),
      renderLeadGenerationAgencyPage(null, null),
      renderAppointmentSettingAgencyPage(null),
      renderDatabaseReactivationAgencyPage(null),
    ]) {
      const theirs = sentences(other);
      const shared = [...own].filter((s) => theirs.has(s) && !/Revenue made easy|cookies|©/.test(s));
      // Only the shared call box and the price card's fee lines may repeat.
      expect(shared.length).toBeLessThanOrEqual(6);
    }
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(page).toContain("<h3>Customer Success Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(4);
  });

  it("the signature reel: every thread in the HTML, labelled as an example, a pause toggle the kit plays", () => {
    const r = reelHtml();
    expect(r).toContain('data-motion="post-reel"');
    expect(r).toContain("data-reel-grid");
    expect(r.match(/class="csa-post"/g)?.length).toBe(POSTS.length);
    expect(r).toMatch(/<button type="button" class="csa-reel-toggle" data-reel-toggle aria-pressed="false">/);
    expect(r).toContain("Example threads, written to show the flow.");
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('"post-reel": function (el, gsap)');
    // The toggle stops the reel and puts every card back in its plain grid.
    expect(kit).toMatch(/toggle\.addEventListener\("click", function \(\) \{ paused = !paused; render\(\); \}\)/);
    expect(page).toContain('href="/landing/v2/customer-success.css?v=');
    for (const fx of ["post-reel", "sticky-story", "reveal"]) expect(page).toContain(`data-motion="${fx}"`);
    const css = read("public/landing/v2/customer-success.css");
    expect(css).toContain(".csa-story");
    // The toggle is absent from the finished state; it shows only once the reel can play.
    expect(css).toMatch(/\.csa-reel-toggle \{ display: none;/);
    expect(css).toContain(".csa-reel.is-playing .csa-reel-toggle, .csa-reel.is-paused .csa-reel-toggle { display: inline-flex; }");
  });

  it("the threads start on catalogue moments and name no person", () => {
    const known = new Set(["Paid client", "Message received", "Follow-up due", "Signup", "Client satisfied"]);
    for (const p of POSTS) {
      expect(known.has(p.moment)).toBe(true);
      for (const l of p.lines) expect(l.text).not.toMatch(/\b(Hi|Hello|Hey|Thanks) [A-Z][a-z]+\b/);
    }
    expect(MOMENTS.map((m) => m.title)).toEqual(["Paid client", "Message received", "Follow-up due", "Client satisfied"]);
  });

  it("names the connectors every client can plug, each with its logo, Stripe first", () => {
    expect(CS_CONNECTORS.map((c) => c.name)).toEqual(["Stripe", "GoHighLevel", "Clerk", "PostHog"]);
    for (const c of CS_CONNECTORS) expect(page).toContain(`img.logo.dev/${c.domain}?`);
  });

  it("the cost table states every provider's own figure and its source", () => {
    const table = csCostTableHtml();
    for (const a of CS_AGENCIES) {
      expect(table).toContain(a.entryPrice);
      expect(table).toContain(`href="${a.sourceUrl}"`);
      expect(table).toContain(`href="${csVsPath(a)}"`);
    }
    expect(table).toContain("Live in 5 days from our first call.");
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no figure of ours, no channel we do not run", () => {
    for (const html of [page, renderCsAlternativesPage(), ...CS_AGENCIES.map(renderCsVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/\$[\d.]+ per (meeting|appointment|lead|reply|client)/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
    }
    const own = text(page.slice(0, page.indexOf("<footer>")));
    expect(own).not.toMatch(/\b(sms|text message|cold call(s|ing)?|linkedin|phone call|direct mail|voicemail|ticket desk|live chat)\b/i);
    // The only percentage is the fee's share of the budget: no rate of ours is measured for this leg yet.
    expect(own).not.toMatch(/\b\d+(\.\d+)?%(?! of (your |the )?budget)/);
    expect(CS_FAQ.length).toBeGreaterThanOrEqual(6);
  });
});

describe("the customer success agency comparison cluster", () => {
  it("every provider is read on its own site this month, each fact linked to that site", () => {
    expect(CS_AGENCIES.length).toBeGreaterThanOrEqual(3);
    for (const a of CS_AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every provider", () => {
    for (const a of CS_AGENCIES) {
      const html = renderCsVsPage(a);
      expect(html).toContain(`<h1>distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${csVsPath(a)}">`);
    }
    expect(footerModel(csVsPath(CS_AGENCIES[0])).variant).toBe("agency");
    const alt = renderCsAlternativesPage();
    expect(alt).toContain("<title>Customer success agency alternatives: ");
    for (const a of CS_AGENCIES) expect(alt).toContain(`href="${csVsPath(a)}"`);
    expect(alt).toContain(`href="${CS_PAGE_PATH}"`);
  });

  it("the routes serve the page and the cluster, and 404 an unknown provider", async () => {
    const { GET: home } = await import("@/app/customer-success-agency/route");
    expect((await home(new Request("https://distribute.you/customer-success-agency"))).status).toBe(200);
    const { GET: vs } = await import("@/app/customer-success-agency/vs/[slug]/route");
    const slug = CS_AGENCIES[0].slug;
    const ok = await vs(new Request(`https://distribute.you/customer-success-agency/vs/${slug}`), { params: Promise.resolve({ slug }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/customer-success-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap and llms.txt list the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/customer-success-agency", ...csClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
    const llms = read("public/llms.txt");
    for (const p of ["/customer-success-agency", ...csClusterPaths()]) expect(llms).toContain(`https://distribute.you${p})`);
  });
});
