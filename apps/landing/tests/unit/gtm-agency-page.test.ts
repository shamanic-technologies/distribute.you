import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  AGENCY_FEE_BASE_USD,
  DEFAULT_BUDGET_USD,
  ORBIT_OUTCOMES,
  agencyFeeUsd,
  compactCount,
  monthlyHtml,
  parseMonthlyRuns,
  proofHtml,
  renderGtmAgencyPage,
} from "../../src/lib/pages/gtm-agency";
import { renderAgencyAlternativesPage, renderAgencyVsPage } from "../../src/lib/pages/agency-compare";
import { AGENCIES, agencyClusterPaths, agencyVsPath } from "../../src/lib/agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt } from "../../src/lib/site-pages";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-REVENUE-AGENCY-1029: `/gtm-agency` (first shipped at `/revenue-agency`, now a 308), its alternatives page and one vs page per
 * agency. Rendered behaviour (orbit, sticky story, scrubbed proof line, bars, slider,
 * reduced motion) was checked frame by frame with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

const idx = (slug: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Cold Email ${slug} Index`,
  channelSlug: "sales-cold-email-outreach",
  channelName: "Sales Cold Email Outreach",
  outcome: "positive_reply",
  metric: "cost_per_outcome",
  unit: "usd" as const,
  valuePer: "per positive reply",
  method: "",
  day: "2026-10-29",
  value,
  status: "robust" as const,
  outcomes: 43,
  contacted: 24387,
  workflowDynastySlug: null,
  workflowDynastyName: null,
  unavailableReason: value === null ? "not_measured" : null,
  recordedAt: null,
  ...extra,
});

const LIST: IndexList = {
  statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
  indexes: [idx("a", 152.078), idx("b", 609.97, { valueKind: "expected" }), idx("c", null)],
};
const MONTHLY = [
  { month: "2026-09", completed: 749486 },
  { month: "2026-10", completed: 2452723 },
];
const NOW = new Date("2026-10-29T12:00:00Z");
const page = renderGtmAgencyPage(LIST, MONTHLY, NOW);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");

describe("the GTM Agency page", () => {
  it("is live in the catalogue, with the agency footer and its own compare column", () => {
    expect(pageAt("/gtm-agency")?.buyer).toBe("agency");
    const f = footerModel("/gtm-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...AGENCIES.map(agencyVsPath), "/gtm-agency/alternatives"]);
  });

  it("targets GTM agency; Revenue has no Agency page, the first path 308s here", async () => {
    expect(page).toContain("<title>GTM Agency: ");
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/gtm-agency">');
    expect(SITE_PAGES.find((p) => p.outcome === "revenue" && p.buyer === "agency")).toBeUndefined();
    expect(page.toLowerCase()).not.toContain("revenue agency");
    const { GET: top } = await import("@/app/revenue-agency/route");
    const { GET: alt } = await import("@/app/revenue-agency/alternatives/route");
    const { GET: vs } = await import("@/app/revenue-agency/vs/[slug]/route");
    const r = top();
    expect([r.status, r.headers.get("location")]).toEqual([308, "/gtm-agency"]);
    expect(alt().headers.get("location")).toBe("/gtm-agency/alternatives");
    const v = await vs(new Request("https://distribute.you/revenue-agency/vs/belkins"), { params: Promise.resolve({ slug: "belkins" }) });
    expect([v.status, v.headers.get("location")]).toEqual([308, "/gtm-agency/vs/belkins"]);
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(BOOK_A_CALL).toMatch(/^https:\/\/calendar\.app\.google\//);
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(3);
  });

  it("the fee is $1K + 10% of the budget, in the card and in the slider script", () => {
    expect(agencyFeeUsd(10000)).toBe(2000);
    expect(agencyFeeUsd(40000)).toBe(5000);
    expect(AGENCY_FEE_BASE_USD).toBe(1000);
    expect(page).toContain(`value="${DEFAULT_BUDGET_USD}"`);
    expect(page).toContain('<output id="ag-fee-out">$2,000</output>');
    expect(page).toContain('data-base="1000" data-share="0.1"');
  });

  it("every index figure is the served one; an unmeasured one is said in words; expected is labelled", () => {
    const proof = proofHtml(LIST);
    expect(proof).toContain('<span class="v">$152.08</span>');
    expect(proof).toContain('<span class="v">$609.97</span>');
    expect(proof).toContain("<em>Expected</em>");
    expect(proof).toContain('class="v words"');
    expect(proof).not.toContain("$0");
    expect(proof).toContain('href="/indexes/a"');
    expect(proofHtml(null)).toBe("");
  });

  it("the monthly bars are the served counts, the current month marked so far; a failed read drops them", () => {
    const bars = monthlyHtml(MONTHLY, NOW);
    expect(bars).toContain("<b>749k</b>");
    expect(bars).toContain("<b>2.5M</b>");
    expect(bars).toContain("Oct, so far");
    expect(compactCount(999881)).toBe("1M");
    expect(monthlyHtml(null)).toBe("");
    expect(parseMonthlyRuns({ monthly: [{ month: "2026-10", completed: "12" }] })).toEqual([{ month: "2026-10", completed: 12 }]);
    expect(parseMonthlyRuns({ monthly: [{ month: "Oct", completed: 1 }] })).toBeNull();
    const empty = renderGtmAgencyPage(null, null, NOW);
    expect(empty).not.toContain('id="data"');
    expect(empty).not.toContain('id="growth"');
    expect(empty).toContain('id="price"');
  });

  it("calls the motion kit: orbit, sticky story, beams, scrub, bar grow", () => {
    for (const fx of ["orbit", "sticky-story", "beams", "scrub", "bar-grow", "reveal"]) expect(page).toContain(`data-motion="${fx}"`);
    expect(page).toContain('href="/landing/v2/agency.css?v=');
    expect(page).toContain('<body class="ag">');
    // The orbit's final state is drawn in CSS; the kit reads the same radius and takes over.
    const css = read("public/landing/v2/agency.css");
    expect(css).toContain("translate: calc(cos(var(--a)) * var(--orbit-r))");
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('getPropertyValue("--orbit-r")');
    expect(kit).toContain('k.style.translate = "none"');
    expect(ORBIT_OUTCOMES).toHaveLength(8);
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no per-email price", () => {
    for (const html of [page, renderAgencyAlternativesPage(), ...AGENCIES.map(renderAgencyVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/per email|per contact/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
    }
  });
});

describe("the agency comparison cluster", () => {
  it("every agency figure is read from the agency's own site this month", () => {
    expect(AGENCIES.length).toBeGreaterThanOrEqual(3);
    for (const a of AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides, links its source, and the alternatives page lists every agency", () => {
    for (const a of AGENCIES) {
      const html = renderAgencyVsPage(a);
      expect(html).toContain(`<h1>distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${agencyVsPath(a)}">`);
    }
    // A cluster page wears its page's chrome: Book a call first, the agency footer.
    expect(footerModel(agencyVsPath(AGENCIES[0])).variant).toBe("agency");
    expect(navModel("/gtm-agency/alternatives").ctas[0].label).toBe("Book a call");
    const alt = renderAgencyAlternativesPage();
    for (const a of AGENCIES) expect(alt).toContain(`href="${agencyVsPath(a)}"`);
  });

  it("the sitemap lists the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/gtm-agency", ...agencyClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
  });
});
