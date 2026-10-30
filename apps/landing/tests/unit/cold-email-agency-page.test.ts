import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  FLOW_LEADS,
  coldEmailIndexes,
  coldEmailProofHtml,
  parseSendingVolume,
  renderColdEmailAgencyPage,
  sendingStatsHtml,
} from "../../src/lib/pages/cold-email-agency";
import { renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import { renderColdEmailAlternativesPage, renderColdEmailVsPage } from "../../src/lib/pages/cold-email-agency-compare";
import { AGENCIES } from "../../src/lib/agencies";
import { LEADGEN_AGENCIES } from "../../src/lib/lead-generation-agencies";
import { COLD_EMAIL_AGENCIES, coldEmailClusterPaths, coldEmailVsPath } from "../../src/lib/cold-email-agencies";
import { BEST_FOR_PAGES, bestForPath, movedBestForPages } from "../../src/lib/best-for";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { pageAt } from "../../src/lib/site-pages";
import type { IndexList } from "../../src/lib/fleet-indexes";

/**
 * PAGE-COLD-EMAIL-AGENCY-1030: `/cold-email-agency`, its alternatives page, one vs page per
 * agency, and the two "best cold email agency" rankings moved under it. Rendered behaviour (the
 * workflow typing and sending, the step collapsing, sticky story, scrubbed proof line, slider,
 * reduced motion) was checked with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));
vi.mock("@/lib/fleet-indexes", async (orig) => ({
  ...(await orig<typeof import("../../src/lib/fleet-indexes")>()),
  fetchIndexList: vi.fn(async () => null),
}));

const idx = (slug: string, outcome: string, metric: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Cold Email ${slug} Index`,
  channelSlug: "sales-cold-email-outreach",
  channelName: "Sales Cold Email Outreach",
  outcome,
  metric,
  unit: "usd" as const,
  valuePer: "per outcome",
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
    idx("click", "website_visit", "cost_per_outcome", 10.88),
    idx("reply", "positive_reply", "cost_per_outcome", 152.078),
    idx("reply-rate", "positive_reply", "conversion_rate", 0.176, { unit: "percent" }),
    idx("meeting", "meeting_booked", "cost_per_outcome", 609.97),
    idx("engaged", "engaged_lead", "cost_per_outcome", 80.619),
    idx("roi", "revenue", "return_on_spend", 2.04, { unit: "multiple" }),
  ],
};
const CHANNELS = {
  emailDelivery: { sentEmails: 177175, deliveredEmails: 174113, bouncedEmails: 3141, deliveryRatePct: 98.27, basis: "every_email_our_sending_inboxes_sent", unavailableReason: null },
};
const sending = parseSendingVolume(CHANNELS);
const page = renderColdEmailAgencyPage(LIST, sending);
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) =>
  new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40 && !/Revenue made easy|cookies|©/.test(s)));

describe("the Cold Email Agency page", () => {
  it("is live in the catalogue with the agency footer, its sections and its own compare column", () => {
    expect(pageAt("/cold-email-agency")?.buyer).toBe("agency");
    expect(pageAt("/cold-email-agency")?.outcome).toBe("cold-email");
    const f = footerModel("/cold-email-agency");
    expect(f.variant).toBe("agency");
    const compare = f.columns.find((c) => c.title === "Compare agencies");
    expect(compare?.links.map((l) => l.href)).toEqual([
      ...COLD_EMAIL_AGENCIES.map(coldEmailVsPath),
      "/cold-email-agency/alternatives",
      ...BEST_FOR_PAGES.filter((p) => p.home === "/cold-email-agency").map(bestForPath),
    ]);
    const agency = f.columns.find((c) => c.title === "Agency");
    expect(agency?.links.map((l) => l.href)).toContain("/cold-email-agency#sending");
    for (const id of ["how", "sending", "proof", "data", "price", "faq"]) expect(page).toContain(`id="${id}"`);
    expect(navModel("/cold-email-agency").ctas[0].label).toBe("Book a call");
  });

  it("targets the keyword in title, H1 and meta, with its own canonical", () => {
    expect(page).toContain("<title>Cold Email Agency: ");
    expect(page).toMatch(/<h1[^>]*>The cold email agency that books your meetings\.<\/h1>/);
    expect(page).toMatch(/<meta name="description" content="[^"]*A cold email agency that/);
    expect(page).toContain('<link rel="canonical" href="https://distribute.you/cold-email-agency">');
  });

  it("is its own page, never a sibling Agency page with words swapped", () => {
    const own = sentences(page);
    for (const sibling of [renderGtmAgencyPage(LIST, null), renderLeadGenerationAgencyPage(LIST, null)]) {
      const theirs = sentences(sibling);
      const shared = [...own].filter((s) => theirs.has(s));
      // Only the shared call box and the price card's fee lines may repeat.
      expect(shared.length).toBeLessThanOrEqual(6);
    }
  });

  it("states the owner's price, the why line, and books a call on the brand's booking link", () => {
    expect(page).toContain("From $1K/month + 10% of budget");
    expect(page).toContain("Revenue made easy.");
    expect(page).toContain("<h3>Cold Email Agency</h3>");
    expect(page).toContain('data-base="1000" data-share="0.1"');
    expect(page.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(3);
  });

  it("the signature workflow: every step done in the HTML, the email written, and the kit replays it", () => {
    expect(page).toContain('<div class="ce-flow" data-motion="mail-flow" aria-hidden="true">');
    for (const key of ["found", "research", "write", "reply"]) expect(page).toContain(`data-node="${key}" data-status="done"`);
    // Final state: the email is sent and its step collapsed; the draft stays in the DOM for the kit to type.
    expect(page).toContain('<li class="ce-node" data-node="write" data-status="done">');
    expect(page).toContain(`<p class="ce-type" data-type>${FLOW_LEADS[0].body}</p>`);
    expect(page).toContain(`<p class="ce-msg us" data-field="answer">${FLOW_LEADS[0].answer}</p>`);
    expect(page).toContain('<span class="ce-send" data-send>Send</span>');
    // The buyers the loop types come from the page, as JSON the kit reads; never a person's name.
    const json = page.match(/<script type="application\/json" data-leads>([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(json ?? "[]")).toEqual(FLOW_LEADS);
    expect(FLOW_LEADS.length).toBeGreaterThanOrEqual(2);
    for (const fx of ["mail-flow", "sticky-story", "beams", "scrub", "reveal", "count-up"]) expect(page).toContain(`data-motion="${fx}"`);
    expect(page).toContain('href="/landing/v2/cold-email.css?v=');
    expect(page).toContain('href="/landing/v2/agency.css?v=');
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('send.classList.add("is-pressed")');
    expect(kit).toContain('write.classList.add("is-open")');
    expect(kit).toContain('write.classList.remove("is-open")');
    const css = read("public/landing/v2/cold-email.css");
    expect(css).toContain(".ce-node.is-open .ce-body { grid-template-rows: 1fr;");
    // Steps animate only once the kit runs, never on a static first paint.
    expect(css).toContain('.ce-flow.is-playing .ce-node[data-status="done"] .ce-st .d');
  });

  it("our sending: the served count and delivery of every email our inboxes sent; a bad read drops the band", () => {
    expect(sending).toEqual({ sent: 177175, deliveryRatePct: 98.27 });
    const band = sendingStatsHtml(sending);
    expect(band).toContain('<b data-motion="count-up">177,175</b>');
    expect(band).toContain('<b data-motion="count-up">98.3%</b>');
    expect(parseSendingVolume({})).toBeNull();
    expect(parseSendingVolume({ emailDelivery: { ...CHANNELS.emailDelivery, basis: "sequences" } })).toBeNull();
    expect(parseSendingVolume({ emailDelivery: { ...CHANNELS.emailDelivery, unavailableReason: "no_sends" } })).toBeNull();
    expect(parseSendingVolume({ emailDelivery: { ...CHANNELS.emailDelivery, sentEmails: 0 } })).toBeNull();
    const bare = renderColdEmailAgencyPage(null, null);
    expect(bare).not.toContain('class="ce-stats"');
    expect(bare).not.toContain('id="data"');
    expect(bare).toContain('id="sending"');
    expect(bare).toContain('id="price"');
    // Every line about sending gives the infrastructure to us, never to the client.
    expect(text(page)).not.toMatch(/your sending domain|your (own )?inbox(es)? (send|warm)/i);
  });

  it("the client proof cards are keyed for the homepage's live reseed, cold email only", () => {
    const proof = page.slice(page.indexOf('id="proof"'), page.indexOf('id="data"'));
    expect(proof).toContain('<div class="proof-grid">');
    expect(proof.match(/<article class="proof-card rv" data-proof-brand="[a-z0-9.-]+">/g)?.length).toBeGreaterThanOrEqual(2);
    expect(proof).toContain('data-proof-cost-step="conversation"');
    expect(proof).toContain("counting only what our outreach brought in");
  });

  it("the data keeps the cold email indexes a buyer pays for, replies first; a failed read drops it", () => {
    expect(coldEmailIndexes(LIST).map((i) => i.slug)).toEqual(["reply", "meeting", "engaged", "roi"]);
    const proof = coldEmailProofHtml(LIST);
    expect(proof).toContain('<span class="v">$152.08</span>');
    expect(proof).not.toContain("$10.88");
    expect(coldEmailProofHtml(null)).toBe("");
    expect(coldEmailProofHtml({ ...LIST, indexes: [LIST.indexes[1]] })).toBe("");
    const other = { ...LIST, indexes: LIST.indexes.map((i) => ({ ...i, channelSlug: "whatsapp" })) };
    expect(coldEmailIndexes(other)).toEqual([]);
  });

  it("copy keeps the humanizer rules: no dashes, no opens, no per-email price, no framework words", () => {
    for (const html of [page, renderColdEmailAlternativesPage(), ...COLD_EMAIL_AGENCIES.map(renderColdEmailVsPage)]) {
      const copy = text(html.slice(0, html.indexOf("<footer>")));
      expect(copy).not.toMatch(/[—–]/);
      expect(copy).not.toMatch(/open rate|opened/i);
      expect(copy).not.toMatch(/per email|per contact|\$[\d.]+ per (lead|email)/i);
      expect(copy).not.toMatch(/\b(effort|risk)\b/i);
      expect(copy).not.toMatch(/\bagency\b.*\bmarkup\b|pass-through/i);
    }
  });
});

describe("the cold email agency comparison cluster", () => {
  it("every agency figure is read from the agency's own site this month; reused entries are their cluster's own", () => {
    expect(COLD_EMAIL_AGENCIES.length).toBeGreaterThanOrEqual(3);
    expect(COLD_EMAIL_AGENCIES.find((a) => a.slug === "callbox")).toBe(LEADGEN_AGENCIES.find((a) => a.slug === "callbox"));
    expect(COLD_EMAIL_AGENCIES.find((a) => a.slug === "salesroads")).toBe(AGENCIES.find((a) => a.slug === "salesroads"));
    for (const a of COLD_EMAIL_AGENCIES) {
      expect(a.verifiedOn).toMatch(/^2026-10-/);
      // Kept only when a price could be read on their own site.
      expect(a.entryPrice).toMatch(/[$£]\d/);
      for (const f of [a.oneLiner, a.pricing, a.contract, a.channels, a.guarantee, a.claim, ...(a.launch ? [a.launch] : [])]) {
        expect(new URL(f.sourceUrl).protocol).toBe("https:");
        expect(new URL(f.sourceUrl).hostname.replace(/^www\./, "")).toBe(a.domain);
      }
    }
  });

  it("each vs page names both sides and links its source; the alternatives page lists every agency", () => {
    for (const a of COLD_EMAIL_AGENCIES) {
      const html = renderColdEmailVsPage(a);
      expect(html).toContain(`<h1 style="margin-top:18px">distribute.you vs ${a.name}</h1>`);
      expect(html).toContain(`href="${a.sourceUrl}"`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${coldEmailVsPath(a)}">`);
    }
    expect(footerModel(coldEmailVsPath(COLD_EMAIL_AGENCIES[0])).variant).toBe("agency");
    const alt = renderColdEmailAlternativesPage();
    expect(alt).toContain("<title>Cold email agency alternatives: ");
    for (const a of COLD_EMAIL_AGENCIES) expect(alt).toContain(`href="${coldEmailVsPath(a)}"`);
  });

  it("the routes serve the page, the cluster, and 404 an unknown agency", async () => {
    const { GET: vs } = await import("@/app/cold-email-agency/vs/[slug]/route");
    const ok = await vs(new Request("https://distribute.you/cold-email-agency/vs/sopro"), { params: Promise.resolve({ slug: "sopro" }) });
    expect(ok.status).toBe(200);
    const missing = await vs(new Request("https://distribute.you/cold-email-agency/vs/nobody"), { params: Promise.resolve({ slug: "nobody" }) });
    expect(missing.status).toBe(404);
  });

  it("the sitemap lists the page, its cluster and its rankings", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/cold-email-agency", ...coldEmailClusterPaths(), ...movedBestForPages().map((m) => m.to)]) {
      expect(urls).toContain(`https://distribute.you${p}`);
    }
    for (const m of movedBestForPages()) expect(urls).not.toContain(`https://distribute.you${m.from}`);
  });
});

describe("the cold email agency rankings live under the page", () => {
  it("both rankings moved, and each old path 301s to its new one (never a 404)", () => {
    expect(movedBestForPages()).toEqual([
      { from: "/best/cold-email-agency-for-saas-founders", to: "/cold-email-agency/best/cold-email-agency-for-saas-founders" },
      { from: "/best/cold-email-agency-for-solo-founders", to: "/cold-email-agency/best/cold-email-agency-for-solo-founders" },
    ]);
    const cfg = read("next.config.ts");
    for (const m of movedBestForPages()) {
      expect(cfg).toContain(`{ source: "${m.from}", destination: "${m.to}", statusCode: 301, missing: offLab }`);
    }
  });

  it("the new route serves them; the old route no longer does", async () => {
    const { GET: moved } = await import("@/app/cold-email-agency/best/[slug]/route");
    const { GET: old } = await import("@/app/best/[slug]/route");
    for (const m of movedBestForPages()) {
      const slug = m.to.split("/").pop() as string;
      const res = await moved(new Request(`https://distribute.you${m.to}`), { params: Promise.resolve({ slug }) });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`<link rel="canonical" href="https://distribute.you${m.to}">`);
      const gone = await old(new Request(`https://distribute.you${m.from}`), { params: Promise.resolve({ slug }) });
      expect(gone.status).toBe(404);
    }
    const other = BEST_FOR_PAGES.find((p) => !p.home);
    if (other) {
      const res = await moved(new Request("https://distribute.you/x"), { params: Promise.resolve({ slug: other.slug }) });
      expect(res.status).toBe(404);
    }
  });
});
