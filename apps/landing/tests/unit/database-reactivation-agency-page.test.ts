import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  CONNECTORS,
  REACTIVATION_FAQ,
  REACTIVATION_OUTCOMES,
  THREAD,
  costTableHtml,
  reactivationIndexes,
  reactivationProofHtml,
  renderDatabaseReactivationAgencyPage,
  threadHtml,
} from "../../src/lib/pages/database-reactivation-agency";
import { renderReactivationAlternativesPage, renderReactivationVsPage } from "../../src/lib/pages/database-reactivation-agency-compare";
import { renderAppointmentSettingAgencyPage } from "../../src/lib/pages/appointment-setting-agency";
import { renderColdEmailAgencyPage } from "../../src/lib/pages/cold-email-agency";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import {
  REACTIVATION_AGENCIES,
  REACTIVATION_PAGE_PATH,
  reactivationClusterPaths,
  reactivationVsPath,
} from "../../src/lib/reactivation-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt } from "../../src/lib/site-pages";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-DATABASE-REACTIVATION-AGENCY-1030: `/database-reactivation-agency`, its alternatives page
 * and one vs page per agency. Rendered behaviour (the WhatsApp thread playing, the sticky story,
 * the scrubbed proof line, the slider, reduced motion) was checked with Playwright; this pins the
 * contract.
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
  valuePer: "per positive reply",
  method: "",
  day: "2026-10-30",
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
    idx("meeting", "meeting_booked", 596.84),
    idx("click", "website_visit", 10.917),
    idx("reply", "positive_reply", 148.794),
    idx("roi", "revenue", 1.8),
  ],
};
const page = renderDatabaseReactivationAgencyPage(LIST);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) => new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));

describe("the Database Reactivation Agency page", () => {
  it("is the Lead Nurturing Agency entry, live at its search path with the agency footer, its sections and compare column", () => {
    const entry = SITE_PAGES.find((p) => p.outcome === "lead-nurturing" && p.buyer === "agency");
    expect(entry?.path).toBe("/database-reactivation-agency");
    expect(entry?.live).toBe(true);
    expect(SITE_PAGES.some((p) => p.path === "/lead-nurturing-agency")).toBe(false);
    expect(pageAt("/database-reactivation-agency")?.navLabel).toBe("Database Reactivation Agency");
    const f = footerModel("/database-reactivation-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...REACTIVATION_AGENCIES.map(reactivationVsPath), "/database-reactivation-agency/alternatives"]);
    for (const id of ["how", "signals", "data", "ours", "compare", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/database-reactivation-agency").ctas[0].label).toBe("Book a call");
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>Database Reactivation Agency: ");
    expect(page).toMatch(/<h1[^>]*>Database reactivation that turns old leads into new meetings\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*database reactivation and lead nurturing agency/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/database-reactivation-agency">');
  });

  it("is its own page, never a sibling page with words swapped", () => {
    const own = sentences(page);
    for (const other of [
      renderGtmAgencyPage(LIST, null),
      renderLeadGenerationAgencyPage(LIST, null),
      renderAppointmentSettingAgencyPage(LIST),
      renderColdEmailAgencyPage(LIST, null),
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
    expect(page).toContain("<h3>Database Reactivation Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(4);
  });

  it("the signature WhatsApp thread: every message in the HTML, ours read, played by the motion kit", () => {
    const t = threadHtml();
    expect(t).toContain('data-motion="wa-thread"');
    // The thread, plus the CRM card that flips to booked as the meeting lands.
    expect(t.match(/data-msg="/g)?.length).toBe(THREAD.length + 1);
    expect(t.match(/class="wa-msg us is-read"/g)?.length).toBe(THREAD.filter((m) => m.from === "us").length);
    expect(t).toContain("data-typing");
    expect(t).toContain("data-presence");
    expect(THREAD.at(-1)?.from).toBe("event");
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('"wa-thread": function (el, gsap)');
    expect(page).toContain('href="/landing/v2/database-reactivation.css?v=');
    for (const fx of ["wa-thread", "sticky-story", "scrub", "reveal"]) expect(page).toContain(`data-motion="${fx}"`);
    const css = read("public/landing/v2/database-reactivation.css");
    expect(css).toContain(".dra-story");
    // The typing bubble is absent from the finished state; it only shows while the thread plays.
    expect(css).toMatch(/\.wa-typing \{ display: none;/);
    expect(css).toContain(".dra-phone-wrap.is-playing .wa-typing { display: inline-flex; }");
    expect(css).toMatch(/prefers-reduced-motion: no-preference[\s\S]*dra-type/);
  });

  it("the thread and the scenes name roles, never a person", () => {
    expect(threadHtml()).toContain("Head of Operations, logistics");
    for (const m of THREAD) expect(m.text).not.toMatch(/\b(Hi|Hello) [A-Z][a-z]+\b/);
  });

  it("names the connectors every client can plug, each with its logo", () => {
    expect(CONNECTORS.map((c) => c.name)).toEqual(["GoHighLevel", "Stripe", "Clerk", "PostHog"]);
    for (const c of CONNECTORS) expect(page).toContain(`img.logo.dev/${c.domain}?`);
  });

  it("the proof keeps the indexes a revived lead reaches, replies first; a failed read drops it", () => {
    expect(REACTIVATION_OUTCOMES).toEqual(["positive_reply", "meeting_booked"]);
    expect(reactivationIndexes(LIST).map((i) => i.slug)).toEqual(["reply", "meeting"]);
    const proof = reactivationProofHtml(LIST);
    expect(proof).toContain('<span class="v">$148.79</span>');
    expect(proof).not.toContain("$10.92");
    expect(reactivationProofHtml(null)).toBe("");
    expect(reactivationProofHtml({ ...LIST, indexes: [LIST.indexes[1]] })).toBe("");
    const bare = renderDatabaseReactivationAgencyPage(null);
    expect(bare).not.toContain('id="data"');
    expect(bare).toContain('id="price"');
  });

  it("the cost table states every agency's own figure and its source", () => {
    const table = costTableHtml();
    for (const a of REACTIVATION_AGENCIES) {
      expect(table).toContain(a.entryPrice);
      expect(table).toContain(`href="${a.sourceUrl}"`);
      expect(table).toContain(`href="${reactivationVsPath(a)}"`);
    }
    expect(table).toContain("$997/month + $497 setup");
    expect(table).toContain("Live in 5 days from our first call.");
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no quoted cost, no promised count, no channel we do not run", () => {
    for (const html of [page, renderReactivationAlternativesPage(), ...REACTIVATION_AGENCIES.map(renderReactivationVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/\$[\d.]+ per (meeting|appointment|lead|reply)/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
    }
    const own = text(page.slice(0, page.indexOf("<footer>")));
    expect(own).not.toMatch(/\b(sms|text message|cold call(s|ing)?|linkedin|phone call|direct mail|voicemail)\b/i);
    expect(own).not.toMatch(/\bagency\b[^.]*\bguarantee/i);
    expect(REACTIVATION_FAQ.length).toBeGreaterThanOrEqual(6);
  });
});

describe("the database reactivation agency comparison cluster", () => {
  it("every agency is read on its own site this month, each fact linked to that site", () => {
    expect(REACTIVATION_AGENCIES.map((a) => a.slug)).toEqual(["ascension-agency", "doubletime-ai", "searchberg", "niagara-stands-out"]);
    for (const a of REACTIVATION_AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every agency", () => {
    for (const a of REACTIVATION_AGENCIES) {
      const html = renderReactivationVsPage(a);
      expect(html).toContain(`<h1>distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${reactivationVsPath(a)}">`);
    }
    expect(footerModel(reactivationVsPath(REACTIVATION_AGENCIES[0])).variant).toBe("agency");
    const alt = renderReactivationAlternativesPage();
    expect(alt).toContain("<title>Database reactivation agency alternatives: ");
    for (const a of REACTIVATION_AGENCIES) expect(alt).toContain(`href="${reactivationVsPath(a)}"`);
    expect(alt).toContain(`href="${REACTIVATION_PAGE_PATH}"`);
  });

  it("the routes serve the page and the cluster, and 404 an unknown agency", async () => {
    const { GET: home } = await import("@/app/database-reactivation-agency/route");
    expect((await home(new Request("https://distribute.you/database-reactivation-agency"))).status).toBe(200);
    const { GET: vs } = await import("@/app/database-reactivation-agency/vs/[slug]/route");
    const ok = await vs(new Request("https://distribute.you/database-reactivation-agency/vs/searchberg"), { params: Promise.resolve({ slug: "searchberg" }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/database-reactivation-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap and llms.txt list the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/database-reactivation-agency", ...reactivationClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
    const llms = read("public/llms.txt");
    for (const p of ["/database-reactivation-agency", ...reactivationClusterPaths()]) expect(llms).toContain(`https://distribute.you${p})`);
  });
});
