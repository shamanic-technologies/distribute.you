import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  APPOINTMENT_FAQ,
  CAL_EVENTS,
  MEETING_OUTCOMES,
  calendarHtml,
  costTableHtml,
  meetingIndexes,
  meetingProofHtml,
  renderAppointmentSettingAgencyPage,
} from "../../src/lib/pages/appointment-setting-agency";
import { renderAppointmentAlternativesPage, renderAppointmentVsPage } from "../../src/lib/pages/appointment-setting-agency-compare";
import { renderAiSdrPage } from "../../src/lib/pages/ai-sdr";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import { renderPpcAgencyPage } from "../../src/lib/pages/ppc-agency";
import { AGENCIES } from "../../src/lib/agencies";
import { LEADGEN_AGENCIES } from "../../src/lib/lead-generation-agencies";
import {
  APPOINTMENT_AGENCIES,
  APPOINTMENT_PAGE_PATH,
  appointmentClusterPaths,
  appointmentVsPath,
} from "../../src/lib/appointment-setting-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt } from "../../src/lib/site-pages";
import { renderShowcaseSelection } from "../../src/lib/showcase-outcomes";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-APPOINTMENT-AGENCY-1030: `/appointment-setting-agency`, its alternatives page and one vs
 * page per agency. Rendered behaviour (the calendar filling, the toasts, the sticky story, the
 * scrubbed proof line, the slider, reduced motion) was checked with Playwright; this pins the
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
  valuePer: "per meeting booked",
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
    idx("reply", "positive_reply", 152.078),
    idx("click", "website_visit", 10.886),
    idx("meeting", "meeting_booked", 609.977),
    idx("roi", "revenue", 2.04),
  ],
};
const page = renderAppointmentSettingAgencyPage(LIST);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) => new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));

describe("the Appointment Setting Agency page", () => {
  it("is the Meetings Booked Agency entry, live at its search path with the agency footer, its sections and compare column", () => {
    const entry = SITE_PAGES.find((p) => p.outcome === "meetings" && p.buyer === "agency");
    expect(entry?.path).toBe("/appointment-setting-agency");
    expect(entry?.live).toBe(true);
    expect(SITE_PAGES.some((p) => p.path === "/meetings-agency")).toBe(false);
    expect(pageAt("/appointment-setting-agency")?.navLabel).toBe("Appointment Setting Agency");
    const f = footerModel("/appointment-setting-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([...APPOINTMENT_AGENCIES.map(appointmentVsPath), "/appointment-setting-agency/alternatives"]);
    for (const id of ["clients", "how", "meeting", "data", "proof", "compare", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/appointment-setting-agency").ctas[0].label).toBe("Book a call");
  });

  it("bridges both ways with its AI Agent twin, /ai-sdr", () => {
    expect(footerModel("/appointment-setting-agency").bridge?.href).toBe("/ai-sdr");
    expect(footerModel("/ai-sdr").bridge?.href).toBe(APPOINTMENT_PAGE_PATH);
    expect(page).toContain('class="asa-bridge" href="/ai-sdr"');
    const sdr = renderAiSdrPage();
    expect(sdr).toContain(`<a class="agency-bridge rv" href="${APPOINTMENT_PAGE_PATH}">`);
    expect(sdr).toContain(`href="${APPOINTMENT_PAGE_PATH}">Want our team on it? Appointment Setting Agency</a>`);
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>Appointment Setting Agency: ");
    expect(page).toMatch(/<h1[^>]*>The appointment setting agency that fills your calendar\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*B2B appointment setting agency/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/appointment-setting-agency">');
  });

  it("is its own page, never a sibling page with words swapped", () => {
    const own = sentences(page);
    for (const other of [renderGtmAgencyPage(LIST, null), renderLeadGenerationAgencyPage(LIST, null), renderPpcAgencyPage(LIST, null), renderAiSdrPage()]) {
      const theirs = sentences(other);
      const shared = [...own].filter((s) => theirs.has(s) && !/Revenue made easy|cookies|©/.test(s));
      // Only the shared call box, the price card's fee lines and the shipped client cards may repeat.
      expect(shared.length).toBeLessThanOrEqual(8);
    }
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(page).toContain("<h3>Appointment Setting Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(4);
  });

  it("the signature calendar: the full week in the HTML, emptied before first paint only with motion on, and filled by main.js", () => {
    const cal = calendarHtml();
    expect(cal).toContain('<div class="cal" data-cal-stage="5"');
    expect(cal.match(/class="cal-ev /g)?.length).toBe(CAL_EVENTS.length);
    for (const stage of [1, 2, 3, 4, 5]) expect(CAL_EVENTS.some((e) => e.stage === stage)).toBe(true);
    expect(cal).toContain('prefers-reduced-motion: reduce)").matches))document.currentScript.previousElementSibling.setAttribute("data-cal-stage","1")');
    expect(cal.match(/<li style="--t:/g)?.length).toBe(3);
    expect(read("public/landing/v2/main.js")).toContain('document.querySelector(".cal")');
    // One calendar per page: main.js drives the first `.cal` only.
    expect(page.match(/<div class="cal" /g)?.length).toBe(1);
    expect(page).toContain('href="/landing/v2/appointment.css?v=');
    for (const fx of ["sticky-story", "scrub", "reveal"]) expect(page).toContain(`data-motion="${fx}"`);
    const css = read("public/landing/v2/appointment.css");
    expect(css).toContain(".asa-story");
    expect(css).toMatch(/prefers-reduced-motion: no-preference[\s\S]*asa-toast-in/);
  });

  it("calendar events and scenes name roles, never a person or a company", () => {
    for (const e of CAL_EVENTS) expect(e.who).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
  });

  it("the live figures ride the shared reads: the hero meeting price token and keyed client cards", () => {
    expect(page).toContain("__HOT_LEAD_ROW__");
    for (const d of ["docdinners.com", "pressbeat.io", "shockwavecenters.com"]) expect(page).toContain(`data-brand="${d}"`);
    expect(page).toContain('data-proof-brand="docdinners.com"');
    expect(page).toContain('<a class="show-card yours"');
    // The producer's pick replaces the shipped clients and keeps the "Your company" card last.
    const swapped = renderShowcaseSelection(page, [
      {
        brand: { domain: "acme.com", name: "Acme" },
        measured: true,
        outcomes: [
          { key: "conversation", label: "Interested leads", peopleReached: 9 },
          { key: "meeting_booked", label: "Meetings booked", peopleReached: 2 },
        ],
      } as never,
    ]);
    expect(swapped).toContain('data-brand="acme.com"');
    expect(swapped).not.toContain('data-brand="docdinners.com"');
    expect(swapped.indexOf('data-brand="acme.com"')).toBeLessThan(swapped.indexOf('<a class="show-card yours"'));
  });

  it("the proof keeps the indexes a meeting reaches, meetings first; a failed read drops it", () => {
    expect(MEETING_OUTCOMES).toEqual(["meeting_booked", "positive_reply"]);
    expect(meetingIndexes(LIST).map((i) => i.slug)).toEqual(["meeting", "reply"]);
    const proof = meetingProofHtml(LIST);
    expect(proof).toContain('<span class="v">$609.98</span>');
    expect(proof).not.toContain("$10.89");
    expect(meetingProofHtml(null)).toBe("");
    expect(meetingProofHtml({ ...LIST, indexes: [LIST.indexes[1]] })).toBe("");
    const bare = renderAppointmentSettingAgencyPage(null);
    expect(bare).not.toContain('id="data"');
    expect(bare).toContain('id="price"');
  });

  it("the cost table states every agency's own figure and its source", () => {
    const table = costTableHtml();
    for (const a of APPOINTMENT_AGENCIES) {
      expect(table).toContain(a.entryPrice);
      expect(table).toContain(`href="${a.sourceUrl}"`);
      expect(table).toContain(`href="${appointmentVsPath(a)}"`);
    }
    expect(table).toContain("$11,950 per 4 weeks");
    expect(table).toContain("Live in 5 days from our first call.");
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no quoted cost per meeting, no promised count, no channel we do not run", () => {
    for (const html of [page, renderAppointmentAlternativesPage(), ...APPOINTMENT_AGENCIES.map(renderAppointmentVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/per email|per contact|\$[\d.]+ per (meeting|appointment|lead)/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
      expect(copy).not.toMatch(/\bguaranteed? (?:sales )?(meetings|appointments)\b/i);
    }
    const own = text(page.slice(0, page.indexOf("<footer>")));
    expect(own).not.toMatch(/\b(cold call(s|ing)?|linkedin|phone)\b/i);
    expect(APPOINTMENT_FAQ.length).toBeGreaterThanOrEqual(6);
  });
});

describe("the appointment setting agency comparison cluster", () => {
  it("every agency is one already read on its own site, reused as it stands", () => {
    expect(APPOINTMENT_AGENCIES.map((a) => a.slug)).toEqual(["salesroads", "belkins", "saleshive", "callbox"]);
    const homes = [...AGENCIES, ...LEADGEN_AGENCIES];
    for (const a of APPOINTMENT_AGENCIES) {
      expect(homes).toContain(a);
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every agency", () => {
    for (const a of APPOINTMENT_AGENCIES) {
      const html = renderAppointmentVsPage(a);
      expect(html).toContain(`<h1 style="margin-top:18px">distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${appointmentVsPath(a)}">`);
    }
    expect(footerModel(appointmentVsPath(APPOINTMENT_AGENCIES[0])).variant).toBe("agency");
    const alt = renderAppointmentAlternativesPage();
    expect(alt).toContain("<title>Appointment setting agency alternatives: ");
    for (const a of APPOINTMENT_AGENCIES) expect(alt).toContain(`href="${appointmentVsPath(a)}"`);
  });

  it("the routes serve the cluster and 404 an unknown agency", async () => {
    const { GET: vs } = await import("@/app/appointment-setting-agency/vs/[slug]/route");
    const ok = await vs(new Request("https://distribute.you/appointment-setting-agency/vs/salesroads"), { params: Promise.resolve({ slug: "salesroads" }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/appointment-setting-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap and llms.txt list the page and its cluster", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/appointment-setting-agency", ...appointmentClusterPaths()]) expect(urls).toContain(`https://distribute.you${p}`);
    const llms = read("public/llms.txt");
    for (const p of ["/appointment-setting-agency", ...appointmentClusterPaths()]) expect(llms).toContain(`https://distribute.you${p})`);
  });
});
