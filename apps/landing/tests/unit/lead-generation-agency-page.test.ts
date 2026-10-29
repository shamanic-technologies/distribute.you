import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  FEED_ROWS,
  checkedDeliveryHtml,
  leadIndexes,
  leadProofHtml,
  parseCheckedDelivery,
  renderLeadGenerationAgencyPage,
} from "../../src/lib/pages/lead-generation-agency";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadgenAlternativesPage, renderLeadgenVsPage } from "../../src/lib/pages/lead-generation-agency-compare";
import { AGENCIES } from "../../src/lib/agencies";
import { LEADGEN_AGENCIES, leadgenClusterPaths, leadgenVsPath } from "../../src/lib/lead-generation-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { pageAt } from "../../src/lib/site-pages";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-LEADGEN-AGENCY-1029: `/lead-generation-agency`, its alternatives page and one vs page per
 * agency. Rendered behaviour (lead rows dropping in and flashing their verdict, sticky story,
 * scrubbed proof line, slider, reduced motion) was checked with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

const idx = (slug: string, outcome: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Cold Email ${slug} Index`,
  channelSlug: "sales-cold-email-outreach",
  channelName: "Sales Cold Email Outreach",
  outcome,
  metric: "cost_per_outcome",
  unit: "usd" as const,
  valuePer: "per engaged lead",
  method: "",
  day: "2026-10-29",
  value,
  status: "signal" as const,
  outcomes: 16,
  contacted: null,
  workflowDynastySlug: null,
  workflowDynastyName: null,
  unavailableReason: value === null ? "not_measured" : null,
  recordedAt: null,
  ...extra,
});

const LIST: IndexList = {
  statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
  indexes: [
    idx("click", "website_visit", 10.88),
    idx("reply", "positive_reply", 152.078),
    idx("meeting", "meeting_booked", 609.97),
    idx("engaged", "engaged_lead", 80.619),
  ],
};
const CHANNELS = {
  emailDeliveryByVerdict: {
    verificationsSince: "2026-09-25T09:56:21.653Z",
    byVerdictAtSend: [
      { verdict: "valid", sent: 7629, delivered: 7603, bounced: 26, deliveryRatePct: 99.66, bounceRatePct: 0.34 },
      { verdict: "never_verified", sent: 56445, delivered: 53458, bounced: 2987, deliveryRatePct: 94.71, bounceRatePct: 5.29 },
    ],
  },
};
const delivery = parseCheckedDelivery(CHANNELS);
const page = renderLeadGenerationAgencyPage(LIST, delivery);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");

describe("the Lead Generation Agency page", () => {
  it("is live in the catalogue with the agency footer, its sections and its own compare column", () => {
    expect(pageAt("/lead-generation-agency")?.buyer).toBe("agency");
    const f = footerModel("/lead-generation-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...LEADGEN_AGENCIES.map(leadgenVsPath), "/lead-generation-agency/alternatives"]);
    const agency = f.columns.find((c) => c.title === "Agency");
    expect(agency?.links.map((l) => l.href)).toContain("/lead-generation-agency#lead");
    for (const id of ["how", "lead", "data", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/lead-generation-agency").ctas[0].label).toBe("Book a call");
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>Lead Generation Agency: ");
    expect(page).toMatch(/<h1[^>]*>The lead generation agency that judges every lead\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*B2B lead generation agency/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/lead-generation-agency">');
  });

  it("is its own page, never the GTM page with words swapped", () => {
    const own = new Set(text(page).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));
    const gtm = new Set(text(renderGtmAgencyPage(LIST, null)).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));
    const shared = [...own].filter((s) => gtm.has(s) && !/Revenue made easy|cookies|©/.test(s));
    // Only the shared call box and the price card's fee lines may repeat.
    expect(shared.length).toBeLessThanOrEqual(6);
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(page).toContain("<h3>Lead Generation Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(3);
  });

  it("the signature feed: every row judged in the HTML, both verdicts, and the kit replays it", () => {
    expect(page).toContain('<ol class="lg-rows" data-motion="lead-rows">');
    expect(page.match(/class="lg-row is-judged"/g)?.length).toBe(FEED_ROWS.length);
    expect(FEED_ROWS.some((r) => r.fits) && FEED_ROWS.some((r) => !r.fits)).toBe(true);
    expect(page).toContain('href="/landing/v2/leadgen.css?v=');
    expect(page).toContain('href="/landing/v2/agency.css?v=');
    for (const fx of ["lead-rows", "sticky-story", "beams", "scrub", "reveal", "count-up"]) expect(page).toContain(`data-motion="${fx}"`);
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('r.classList.add("is-judged")');
    const css = read("public/landing/v2/leadgen.css");
    expect(css).toContain("@keyframes lg-flash-yes");
    expect(css).toContain("@keyframes lg-flash-no");
    // The flash plays only once the kit runs, never on a static first paint.
    expect(css).toContain('.lg-rows.is-playing .lg-row.is-judged[data-fits="yes"]');
  });

  it("the proof keeps the indexes a lead reaches, engaged leads first; a failed read drops it", () => {
    expect(leadIndexes(LIST).map((i) => i.slug)).toEqual(["engaged", "reply"]);
    const proof = leadProofHtml(LIST);
    expect(proof).toContain('<span class="v">$80.62</span>');
    expect(proof).toContain('<span class="v">$152.08</span>');
    expect(proof).not.toContain("$10.88");
    expect(proof).not.toContain("$609.97");
    expect(leadProofHtml(null)).toBe("");
    expect(leadProofHtml({ ...LIST, indexes: [LIST.indexes[0]] })).toBe("");
  });

  it("the delivery figure is the served one for checked addresses; a bad read drops the line", () => {
    expect(delivery).toEqual({ deliveryRatePct: 99.66, sent: 7629, since: "2026-09-25" });
    expect(checkedDeliveryHtml(delivery)).toContain("<b data-motion=\"count-up\">99.7%</b>");
    expect(checkedDeliveryHtml(delivery)).toContain("7,629 emails since September 25, 2026");
    expect(parseCheckedDelivery({})).toBeNull();
    expect(parseCheckedDelivery({ emailDeliveryByVerdict: { verificationsSince: "2026-09-25", byVerdictAtSend: [{ verdict: "valid", sent: 0, deliveryRatePct: null }] } })).toBeNull();
    const bare = renderLeadGenerationAgencyPage(null, null);
    expect(bare).not.toContain('class="lg-stat"');
    expect(bare).not.toContain('id="data"');
    expect(bare).toContain('id="price"');
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no per-lead price, no framework words", () => {
    for (const html of [page, renderLeadgenAlternativesPage(), ...LEADGEN_AGENCIES.map(renderLeadgenVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/per email|per contact|\$[\d.]+ per lead/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
    }
  });
});

describe("the lead generation agency comparison cluster", () => {
  it("every agency figure is read from the agency's own site this month; Belkins and CIENCE are the GTM cluster's own entries", () => {
    expect(LEADGEN_AGENCIES.length).toBeGreaterThanOrEqual(3);
    for (const slug of ["belkins", "cience"]) expect(LEADGEN_AGENCIES.find((a) => a.slug === slug)).toBe(AGENCIES.find((a) => a.slug === slug));
    for (const a of LEADGEN_AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every agency", () => {
    for (const a of LEADGEN_AGENCIES) {
      const html = renderLeadgenVsPage(a);
      expect(html).toContain(`<h1 style="margin-top:18px">distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${leadgenVsPath(a)}">`);
    }
    expect(footerModel(leadgenVsPath(LEADGEN_AGENCIES[0])).variant).toBe("agency");
    const alt = renderLeadgenAlternativesPage();
    expect(alt).toContain("<title>Lead generation agency alternatives: ");
    for (const a of LEADGEN_AGENCIES) expect(alt).toContain(`href="${leadgenVsPath(a)}"`);
  });

  it("the routes serve the page, the cluster, and 404 an unknown agency", async () => {
    const { GET: vs } = await import("@/app/lead-generation-agency/vs/[slug]/route");
    const ok = await vs(new Request("https://distribute.you/lead-generation-agency/vs/callbox"), { params: Promise.resolve({ slug: "callbox" }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/lead-generation-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap lists the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/lead-generation-agency", ...leadgenClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
  });
});
