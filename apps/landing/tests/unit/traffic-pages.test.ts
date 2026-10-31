import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AD_MANAGEMENT_FAQ, AD_MANAGEMENT_DESCRIPTION, AD_MANAGEMENT_TITLE, AD_TOOL_CLUSTER, NO_AD_ACCOUNT, renderAiAdManagementPage } from "../../src/lib/pages/ai-ad-management";
import {
  TRAFFIC_AUTOMATION_DESCRIPTION,
  TRAFFIC_AUTOMATION_FAQ,
  TRAFFIC_AUTOMATION_TITLE,
  TRAFFIC_TOOL_CLUSTER,
  renderWebsiteTrafficAutomationPage,
} from "../../src/lib/pages/website-traffic-automation";
import { TRAFFIC_AGENCY_DESCRIPTION, TRAFFIC_AGENCY_TITLE, renderWebsiteTrafficAgencyPage } from "../../src/lib/pages/website-traffic-agency";
import { renderTrafficAgencyAlternativesPage, renderTrafficAgencyVsPage } from "../../src/lib/pages/website-traffic-agency-compare";
import { renderToolAlternativesPage, renderToolVsPage } from "../../src/lib/pages/agent-tools-compare";
import { BEAM_BUYERS, BEAM_CLICKS, BEAM_FINAL_VISITS, beamMapHtml, visitIndexes, visitIndexesHtml } from "../../src/lib/pages/traffic-shared";
import { renderPpcAgencyPage } from "../../src/lib/pages/ppc-agency";
import { renderGtmAutomationPage } from "../../src/lib/pages/gtm-automation";
import { TRAFFIC_TOOLS, trafficToolClusterPaths } from "../../src/lib/traffic-tools";
import { AD_TOOLS, adToolClusterPaths } from "../../src/lib/ad-management-tools";
import { TRAFFIC_AGENCIES, trafficAgencyClusterPaths } from "../../src/lib/traffic-agencies";
import type { IndexList } from "../../src/lib/fleet-indexes";
import { footerModel, navHtml } from "../../src/lib/site-chrome";
import { SITE_PAGES } from "../../src/lib/site-pages";

/**
 * PAGE-TRAFFIC-1030: three low-volume pages shipped together.
 * - `/website-traffic-automation` (Website Visits, AI Agent; "get qualified website visitors"),
 * - `/website-traffic-agency` (Website Visits, Agency; "website traffic agency", never "seo agency"),
 * - `/ai-ad-management` (Paid Acquisition, AI Agent; "ai ad management"), which says plainly that
 *   we run no ad account: the budget goes to outreach that brings buyers who click.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const prose = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

const LIST: IndexList = {
  statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
  indexes: [
    { slug: "cold-email-cost-per-click", name: "Cold Email Cost Per Click Index", channelSlug: "c", channelName: "C", outcome: "website_visit", metric: "cost_per_outcome", unit: "usd", valuePer: "per website visit", method: "Counting only clicks judged human.", day: "2026-10-30", value: 10.92, status: "signal", outcomes: 18, contacted: 1101, workflowDynastySlug: null, workflowDynastyName: null, unavailableReason: null, recordedAt: null },
    { slug: "cold-email-click-rate", name: "Cold Email Click Rate Index", channelSlug: "c", channelName: "C", outcome: "website_visit", metric: "conversion_rate", unit: "percent", valuePer: "of people emailed", method: "Share who visit.", day: "2026-10-30", value: 1.63, status: "signal", outcomes: 18, contacted: 1101, workflowDynastySlug: null, workflowDynastyName: null, unavailableReason: null, recordedAt: null },
    { slug: "cold-email-roi", name: "Cold Email ROI Index", channelSlug: "c", channelName: "C", outcome: "revenue", metric: "return_on_spend", unit: "multiple", valuePer: "back per dollar", method: "m", day: "2026-10-30", value: 1.8, status: "noise", outcomes: 7, contacted: null, workflowDynastySlug: null, workflowDynastyName: null, unavailableReason: null, recordedAt: null },
  ],
};

const pages: [string, string, string, string][] = [
  ["/website-traffic-automation", renderWebsiteTrafficAutomationPage(LIST), TRAFFIC_AUTOMATION_TITLE, TRAFFIC_AUTOMATION_DESCRIPTION],
  ["/website-traffic-agency", renderWebsiteTrafficAgencyPage(LIST), TRAFFIC_AGENCY_TITLE, TRAFFIC_AGENCY_DESCRIPTION],
  ["/ai-ad-management", renderAiAdManagementPage(LIST), AD_MANAGEMENT_TITLE, AD_MANAGEMENT_DESCRIPTION],
];

describe("each page targets its keyword and states the why", () => {
  for (const [p, html, title, description] of pages) {
    it(`${p}: title, description, canonical, why`, () => {
      expect(title.length).toBeLessThanOrEqual(90);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description.startsWith("Revenue made easy.")).toBe(true);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${p}">`);
      expect(html).toContain("Revenue made easy.");
    });

    it(`${p}: no dash in the copy, no open rate, no Agency guarantee`, () => {
      const text = prose(html);
      expect(text).not.toMatch(/[—–]/);
      expect(text.toLowerCase()).not.toContain("open rate");
      expect(html).not.toContain('class="ag-guar"');
      expect(html).not.toContain("paid media budget back");
    });
  }

  it("each keyword sits in its title and H1", () => {
    expect(TRAFFIC_AUTOMATION_TITLE).toMatch(/^Website Traffic Automation: Get Qualified Website Visitors/);
    expect(pages[0][1]).toMatch(/<h1>Website Traffic Automation<br>/);
    expect(TRAFFIC_AGENCY_TITLE).toMatch(/^Website Traffic Agency:/);
    expect(pages[1][1]).toContain("The website traffic agency that brings your buyers.");
    expect(AD_MANAGEMENT_TITLE).toMatch(/^AI Ad Management:/);
    expect(pages[2][1]).toMatch(/<h1>AI Ad Management<br>/);
  });
});

describe("the offer follows the buyer", () => {
  it("the AI Agent pages: free, 0% markup, no Team tier, $10 top-up, open source, Start free", () => {
    for (const html of [pages[0][1], pages[2][1]]) {
      expect(html).not.toContain("<i></i>Team</span>");
      for (const s of ["0% markup", "$10", "https://github.com/distribute-you/gtm-factory", "Start free", "Claude Code", "Grok"]) expect(html).toContain(s);
      expect(html).toContain('<form class="launch" action="https://dashboard.distribute.you/get-started" method="get" id="hero-form">');
    }
  });

  it("the Agency page: From $1K/month + 10% of budget, Book a call", () => {
    const html = pages[1][1];
    expect(html).toContain("From $1K/month + 10% of budget");
    expect(html).toContain("Book a call");
    expect(html).toContain("data-agency-calc");
  });
});

describe("only what we run", () => {
  it("/website-traffic-agency never sells SEO nor targets 'seo agency'", () => {
    const html = pages[1][1];
    expect(html.toLowerCase()).not.toContain("seo agency");
    expect(TRAFFIC_AGENCY_TITLE).not.toMatch(/seo/i);
    expect(TRAFFIC_AGENCY_DESCRIPTION).not.toMatch(/seo/i);
  });

  it("/ai-ad-management says plainly that we run no ad account, where the budget goes, in hero, table and FAQ", () => {
    const html = pages[2][1];
    expect(NO_AD_ACCOUNT).toBe("We run no Google or Meta ad account. Your budget goes to outreach that brings buyers who click.");
    expect(html.split(NO_AD_ACCOUNT).length - 1).toBeGreaterThanOrEqual(2);
    const q = AD_MANAGEMENT_FAQ.find((f) => f.q === "Do you manage my Google or Meta ad account?");
    expect(q?.a.startsWith("We run no ad account.")).toBe(true);
    expect(prose(html)).not.toMatch(/we (manage|run) your (google|meta|facebook|ad)/i);
  });

  it("every channel named is one we run: cold email and WhatsApp", () => {
    for (const [, html] of pages) {
      expect(prose(html)).toContain("WhatsApp");
      expect(prose(html).toLowerCase()).toContain("email");
    }
  });
});

describe("every figure is live", () => {
  it("the agent pages carry the fleet tokens, the price slot and the founder count", () => {
    for (const html of [pages[0][1], pages[2][1]]) {
      expect(html).toContain("__HOT_LEAD_ROW__");
      expect(html).toContain("__HOT_LEAD_BAND__");
      expect(html).toContain("<!--action-prices-->");
      expect(html).toContain("data-founder-count");
    }
  });

  it("the website visit indexes are picked by outcome, never by slug, and drop on a failed read", () => {
    expect(visitIndexes(LIST).map((i) => i.slug)).toEqual(["cold-email-cost-per-click", "cold-email-click-rate"]);
    expect(visitIndexesHtml(null, { eyebrow: "a", h2: "b", p: "c" })).toBe("");
    for (const [, html] of pages) {
      expect(html).toContain('href="/indexes/cold-email-cost-per-click"');
      expect(html).toContain("$10.92");
      expect(html).toContain("1.63%");
      expect(html).not.toContain("Cold Email ROI Index</b>");
    }
    expect(renderWebsiteTrafficAutomationPage(null)).not.toContain('id="data"');
    expect(renderWebsiteTrafficAgencyPage(null)).not.toContain('id="data"');
  });

  it("the routes read the indexes and the price list", () => {
    for (const r of ["website-traffic-automation", "ai-ad-management"]) {
      const route = read(`src/app/${r}/route.ts`);
      expect(route).toContain("fetchIndexList()");
      expect(route).toContain(`fetchPlatformPrices("/${r}")`);
      expect(route).toContain("withActionPrices(");
    }
    expect(read("src/app/website-traffic-agency/route.ts")).toContain("fetchIndexList()");
  });
});

describe("the signature effects", () => {
  it("Website Visits: the beam map, light on the agent page and dark on the Agency page, final state listed", () => {
    expect(pages[0][1]).toContain('class="tb tb-light" data-motion="traffic-beams"');
    expect(pages[1][1]).toContain('class="tb tb-dark" data-motion="traffic-beams"');
    expect(pages[1][1]).toContain('data-motion="sticky-story"');
    const map = beamMapHtml();
    expect(map.match(/data-beam="buyer"/g)?.length).toBe(BEAM_BUYERS.length);
    expect(map.match(/<li><b>/g)?.length).toBe(BEAM_FINAL_VISITS.length);
    expect(BEAM_CLICKS.every((c) => c.buyer < BEAM_BUYERS.length)).toBe(true);
    expect(BEAM_CLICKS.some((c) => !c.human)).toBe(true);
    expect(read("public/landing/v2/motion.js")).toContain('"traffic-beams": function (el, gsap)');
  });

  it("Paid Acquisition: bars that grow sideways, light, distinct from /ppc-agency's monthly bars", () => {
    const html = pages[2][1];
    expect(html).toContain('class="am" data-motion="bar-grow" data-motion-axis="x"');
    expect(html).not.toContain("pp-bars");
    expect(html).not.toContain("ag-dark");
  });

  it("the stylesheet loads with a version", () => {
    for (const [, html] of pages) expect(html).toMatch(/\/landing\/v2\/traffic\.css\?v=\d+/);
  });
});

describe("catalogue, nav, footer, bridges", () => {
  it("the three paths are live in the catalogue, under their outcome and buyer", () => {
    const at = (p: string) => SITE_PAGES.find((x) => x.path === p);
    expect(at("/website-traffic-automation")).toMatchObject({ outcome: "website-visits", buyer: "agent", live: true });
    expect(at("/website-traffic-agency")).toMatchObject({ outcome: "website-visits", buyer: "agency", live: true });
    expect(at("/ai-ad-management")).toMatchObject({ outcome: "paid-acquisition", buyer: "agent", live: true, navLabel: "AI Ad Management" });
    const nav = navHtml("/");
    for (const p of ["/website-traffic-automation", "/website-traffic-agency", "/ai-ad-management"]) expect(nav).toContain(`href="${p}"`);
  });

  it("Website Visits bridges both ways, in page and footer", () => {
    expect(pages[0][1]).toContain('href="/website-traffic-agency"');
    expect(pages[1][1]).toContain('href="/website-traffic-automation"');
    expect(footerModel("/website-traffic-automation").bridge?.href).toBe("/website-traffic-agency");
    expect(footerModel("/website-traffic-agency").bridge?.href).toBe("/website-traffic-automation");
  });

  it("/ai-ad-management bridges both ways with /ppc-agency", () => {
    expect(pages[2][1]).toContain('href="/ppc-agency"');
    expect(renderPpcAgencyPage(null, null)).toContain('href="/ai-ad-management"');
    expect(footerModel("/ai-ad-management").bridge?.href).toBe("/ppc-agency");
    expect(footerModel("/ppc-agency").bridge?.href).toBe("/ai-ad-management");
  });

  it("the GTM umbrella lists both new AI Agent pages", () => {
    const gtm = renderGtmAutomationPage();
    expect(gtm).toContain('href="/website-traffic-automation"');
    expect(gtm).toContain('href="/ai-ad-management"');
  });
});

describe("the comparison clusters", () => {
  const all = [
    ...TRAFFIC_TOOLS.map((t) => ({ name: t.name, domain: t.domain, sourceUrl: t.sourceUrl, verifiedOn: t.verifiedOn })),
    ...AD_TOOLS.map((t) => ({ name: t.name, domain: t.domain, sourceUrl: t.sourceUrl, verifiedOn: t.verifiedOn })),
    ...TRAFFIC_AGENCIES.map((a) => ({ name: a.name, domain: a.domain, sourceUrl: a.sourceUrl, verifiedOn: a.verifiedOn })),
  ];

  it("every competitor figure is read on its own site, this month", () => {
    for (const c of all) {
      const host = new URL(c.sourceUrl).hostname.replace(/^www\./, "");
      expect(c.sourceUrl.startsWith("https://")).toBe(true);
      expect(host.endsWith(c.domain)).toBe(true);
      expect(c.verifiedOn).toMatch(/^2026-10-\d\d$/);
    }
    for (const a of TRAFFIC_AGENCIES) {
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "").endsWith(a.domain)).toBe(true);
      }
    }
  });

  it("each cluster has four entries with a readable price", () => {
    for (const list of [TRAFFIC_TOOLS, AD_TOOLS, TRAFFIC_AGENCIES]) {
      expect(list).toHaveLength(4);
      for (const c of list) expect(c.entryPrice).toMatch(/\$/);
    }
  });

  it("the vs and alternatives pages render, with their canonical, and reach the sitemap", () => {
    for (const t of TRAFFIC_TOOLS) expect(renderToolVsPage(TRAFFIC_TOOL_CLUSTER, t)).toContain(`<link rel="canonical" href="https://distribute.you/website-traffic-automation/vs/${t.slug}">`);
    for (const t of AD_TOOLS) expect(renderToolVsPage(AD_TOOL_CLUSTER, t)).toContain(`<link rel="canonical" href="https://distribute.you/ai-ad-management/vs/${t.slug}">`);
    for (const a of TRAFFIC_AGENCIES) expect(renderTrafficAgencyVsPage(a)).toContain(`<link rel="canonical" href="https://distribute.you/website-traffic-agency/vs/${a.slug}">`);
    expect(renderToolAlternativesPage(TRAFFIC_TOOL_CLUSTER)).toContain("Website traffic automation alternatives, side by side");
    expect(renderToolAlternativesPage(AD_TOOL_CLUSTER)).toContain("AI ad management alternatives, side by side");
    expect(renderTrafficAgencyAlternativesPage()).toContain("Website traffic agency alternatives, side by side");
    for (const p of [...trafficToolClusterPaths(), ...adToolClusterPaths(), ...trafficAgencyClusterPaths()]) expect(p).toMatch(/^\/(website-traffic-automation|ai-ad-management|website-traffic-agency)\/(vs\/[a-z0-9-]+|alternatives)$/);
    const sitemap = read("src/app/sitemap.ts");
    for (const fn of ["trafficToolClusterPaths()", "trafficAgencyClusterPaths()", "adToolClusterPaths()"]) expect(sitemap).toContain(fn);
  });

  it("the FAQ of the agent page links every comparison", () => {
    const a = TRAFFIC_AUTOMATION_FAQ.map((f) => f.a).join(" ");
    for (const t of TRAFFIC_TOOLS) expect(a).toContain(`/website-traffic-automation/vs/${t.slug}`);
  });
});
