import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  PPC_OUTCOMES,
  compactUsd,
  parseMonthlySpend,
  ppcIndexes,
  ppcProofHtml,
  renderPpcAgencyPage,
  spendChartHtml,
} from "../../src/lib/pages/ppc-agency";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import { renderPpcAlternativesPage, renderPpcVsPage } from "../../src/lib/pages/ppc-agency-compare";
import { PPC_AGENCIES, ppcClusterPaths, ppcVsPath } from "../../src/lib/ppc-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt } from "../../src/lib/site-pages";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-PPC-AGENCY-1029: `/ppc-agency`, its alternatives page and one vs page per agency.
 * Rendered behaviour (bars growing, sticky story, scrubbed proof line, slider, reduced motion)
 * was checked with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

const idx = (slug: string, outcome: string, value: number | null) => ({
  slug,
  name: `Cold Email ${slug} Index`,
  channelSlug: "sales-cold-email-outreach",
  channelName: "Sales Cold Email Outreach",
  outcome,
  metric: "cost_per_outcome",
  unit: "usd" as const,
  valuePer: "per website visit",
  method: "",
  day: "2026-10-29",
  value,
  status: "signal" as const,
  outcomes: 18,
  contacted: 1098,
  workflowDynastySlug: null,
  workflowDynastyName: null,
  unavailableReason: value === null ? "not_measured" : null,
  recordedAt: null,
});

const LIST: IndexList = {
  statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
  indexes: [
    idx("reply", "positive_reply", 152.078),
    idx("roi", "revenue", 2.04),
    idx("click", "website_visit", 10.886),
    idx("engaged", "engaged_lead", 80.619),
  ],
};
// The served shape of `/public/stats/runs` (runs-service #475): the bars read `vendorMonthly`, what each
// month cost at the VENDOR price (PUBLIC-VENDOR-COST-1031), never the billed `monthly` beside it.
const vm = (month: string, vendor: string | null, reason: string | null = null) => ({
  month,
  chargedCostInUsdCents: "999999",
  vendorCostInUsdCents: vendor,
  unpricedChargedCostInUsdCents: "0",
  unpricedShare: vendor === null ? 0.35 : 0,
  unavailableReason: reason,
});
const RUNS = {
  monthly: [{ month: "2026-10", completed: 2478198, totalCostInUsdCents: "999999999" }],
  vendorMonthly: [
    vm("2026-10", "477457.3769835825"),
    vm("2026-02", "11190.3874666661"),
    vm("2026-08", null, "unpriced share above 1%"),
    vm("2026-09", "403296.6979077956"),
  ],
  vendorUnavailableReason: null,
};
const NOW = new Date("2026-10-29T12:00:00Z");
const spend = parseMonthlySpend(RUNS);
const page = renderPpcAgencyPage(LIST, spend, NOW);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) => new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));

describe("the PPC Agency page", () => {
  it("is the Paid Acquisition Agency entry, live at /ppc-agency with the agency footer, its sections and compare column", () => {
    const entry = SITE_PAGES.find((p) => p.outcome === "paid-acquisition" && p.buyer === "agency");
    expect(entry?.path).toBe("/ppc-agency");
    expect(entry?.live).toBe(true);
    expect(pageAt("/ppc-agency")?.navLabel).toBe("PPC Agency");
    const f = footerModel("/ppc-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...PPC_AGENCIES.map(ppcVsPath), "/ppc-agency/alternatives"]);
    for (const id of ["how", "clicks", "data", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/ppc-agency").ctas[0].label).toBe("Book a call");
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>PPC Agency: ");
    expect(page).toMatch(/<h1[^>]*>The PPC agency where every click is a buyer you chose\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*A PPC agency/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/ppc-agency">');
  });

  it("is its own page, never a sibling Agency page with words swapped", () => {
    const own = sentences(page);
    for (const other of [renderGtmAgencyPage(LIST, null), renderLeadGenerationAgencyPage(LIST, null)]) {
      const theirs = sentences(other);
      const shared = [...own].filter((s) => theirs.has(s) && !/Revenue made easy|cookies|©/.test(s));
      // Only the shared call box and the price card's fee lines may repeat.
      expect(shared.length).toBeLessThanOrEqual(6);
    }
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(page).toContain("<h3>PPC Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(3);
  });

  it("the signature bars: the served vendor cost per month, withheld months left out, oldest first, full height in the HTML, the month in progress marked", () => {
    expect(spend?.map((r) => r.month)).toEqual(["2026-02", "2026-09", "2026-10"]);
    expect(spend?.map((r) => Math.round(r.usd))).toEqual([112, 4033, 4775]);
    const chart = spendChartHtml(spend, NOW);
    expect(chart).toContain('data-motion="bar-grow"');
    expect(chart.match(/<i data-bar style="--h:/g)?.length).toBe(3);
    expect(chart).toContain('--h:100.0%');
    expect(chart).toContain("<b>$112</b>");
    expect(chart).toContain("<b>$4.8k</b>");
    expect(chart).toContain('<div class="pp-bar now">');
    expect(chart).toContain("Oct, so far");
    // The headline is the last FULL month, never the month in progress.
    expect(chart).toContain("<b>$4k</b><span>paid to our vendors in September, no markup</span>");
    expect(chart).toContain("each month since February 2026");
    expect(page).toContain('href="/landing/v2/ppc.css?v=');
    for (const fx of ["bar-grow", "sticky-story", "beams", "scrub", "reveal"]) expect(page).toContain(`data-motion="${fx}"`);
    const css = read("public/landing/v2/ppc.css");
    expect(css).toContain(".pp-story");
    expect(css).toMatch(/prefers-reduced-motion: no-preference[\s\S]*pp-sheen/);
  });

  it("a failed or malformed spend read drops the chart, never the page", () => {
    expect(parseMonthlySpend({})).toBeNull();
    expect(parseMonthlySpend({ monthly: [{ month: "2026-10", totalCostInUsdCents: "40000" }] })).toBeNull();
    expect(parseMonthlySpend({ vendorMonthly: [vm("2026-10", "abc")] })).toBeNull();
    expect(parseMonthlySpend({ vendorMonthly: [] })).toBeNull();
    expect(parseMonthlySpend({ vendorMonthly: null, vendorUnavailableReason: "catalogue unreadable" })).toBeNull();
    expect(spendChartHtml(null, NOW)).toBe("");
    expect(spendChartHtml([{ month: "2026-10", usd: 0 }], NOW)).toBe("");
    const bare = renderPpcAgencyPage(null, null, NOW);
    expect(bare).not.toContain('class="pp-chart"');
    expect(bare).toContain("pp-hero solo");
    expect(bare).not.toContain('id="data"');
    expect(bare).toContain('id="price"');
  });

  it("compactUsd reads in one glance", () => {
    expect(compactUsd(111.9)).toBe("$112");
    expect(compactUsd(4032.97)).toBe("$4k");
    expect(compactUsd(4774.57)).toBe("$4.8k");
    expect(compactUsd(1_250_000)).toBe("$1.3M");
  });

  it("the proof keeps the indexes a click and a sale reach, clicks first; a failed read drops it", () => {
    expect(PPC_OUTCOMES).toEqual(["website_visit", "revenue"]);
    expect(ppcIndexes(LIST).map((i) => i.slug)).toEqual(["click", "roi"]);
    const proof = ppcProofHtml(LIST);
    expect(proof).toContain('<span class="v">$10.89</span>');
    expect(proof).not.toContain("$152.08");
    expect(proof).not.toContain("$80.62");
    expect(ppcProofHtml(null)).toBe("");
    expect(ppcProofHtml({ ...LIST, indexes: [LIST.indexes[0]] })).toBe("");
  });

  it("names no ad network: none is run for clients today", () => {
    for (const html of [page, renderPpcAlternativesPage(), ...PPC_AGENCIES.map(renderPpcVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/\b(google|meta|facebook|instagram|linkedin|bing|microsoft|tiktok|youtube|amazon|reddit|chatgpt)\b/i);
    }
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no quoted cost per click, no framework words", () => {
    for (const html of [page, renderPpcAlternativesPage(), ...PPC_AGENCIES.map(renderPpcVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/per email|per contact|\$[\d.]+ per (click|lead)/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
    }
  });
});

describe("the PPC agency comparison cluster", () => {
  it("every agency figure is read from the agency's own site this month", () => {
    expect(PPC_AGENCIES.length).toBeGreaterThanOrEqual(3);
    for (const a of PPC_AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every agency", () => {
    for (const a of PPC_AGENCIES) {
      const html = renderPpcVsPage(a);
      expect(html).toContain(`<h1>distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${ppcVsPath(a)}">`);
    }
    expect(footerModel(ppcVsPath(PPC_AGENCIES[0])).variant).toBe("agency");
    const alt = renderPpcAlternativesPage();
    expect(alt).toContain("<title>PPC agency alternatives: ");
    for (const a of PPC_AGENCIES) expect(alt).toContain(`href="${ppcVsPath(a)}"`);
  });

  it("the routes serve the cluster and 404 an unknown agency", async () => {
    const { GET: vs } = await import("@/app/ppc-agency/vs/[slug]/route");
    const ok = await vs(new Request("https://distribute.you/ppc-agency/vs/webfx"), { params: Promise.resolve({ slug: "webfx" }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/ppc-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap lists the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/ppc-agency", ...ppcClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
  });
});
