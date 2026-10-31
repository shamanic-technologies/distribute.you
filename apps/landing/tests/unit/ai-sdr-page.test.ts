import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AI_SDR_FAQ, AI_SDR_TITLE, AI_SDR_DESCRIPTION, renderAiSdrPage } from "../../src/lib/pages/ai-sdr";
import { renderAiSdrAlternativesPage, renderComparePage } from "../../src/lib/compare-page";
import { AI_SDR_SLUGS, aiSdrCompetitors, competitorBySlug, competitorPath } from "../../src/lib/competitors";

/**
 * PAGE-AI-SDR-1029: the Meetings Booked AI Agent page at `/ai-sdr` (keyword "ai sdr"),
 * its vs/alternatives cluster, and the 301s from the old `/compare/<slug>` URLs.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const html = renderAiSdrPage();
const prose = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ");

describe("/ai-sdr targets its keyword", () => {
  it("title, description and H1 say AI SDR", () => {
    expect(AI_SDR_TITLE).toMatch(/^AI SDR:/);
    expect(AI_SDR_TITLE.length).toBeLessThanOrEqual(70);
    expect(AI_SDR_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(AI_SDR_DESCRIPTION).toContain("Revenue made easy.");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/ai-sdr">');
    expect(html).toMatch(/<h1>AI SDR<br>/);
    // The second keyword has its own section and FAQ answer.
    expect(html).toContain("AI appointment setter");
  });

  it("states the why and the AI Agent offer", () => {
    expect(html).toContain("Revenue made easy.");
    expect(html).toContain("0% markup");
    expect(html).not.toContain('<i></i>Team</span>'); // one free plan, no Team tier (owner 2026-10-31)
    expect(html).toContain("https://github.com/distribute-you/gtm-factory");
    expect(html).toContain("Start free");
  });
});

describe("every figure is live", () => {
  it("carries the fleet tokens and the keyed client cards", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    expect(html).toContain("__HOT_LEAD_BAND__");
    expect(html).toContain("<!--action-prices-->");
    // Shaped like the homepage's, so withShowcaseOutcomes reseeds them.
    expect(html).toContain('<div class="showcase-grid" id="live-cards">');
    expect(html).toContain('<a class="show-card yours"');
    expect(html).toContain('data-proof-brand="docdinners.com"');
    expect(html).toContain("data-founder-count");
  });

  it("the route resolves the price list", () => {
    const route = read("src/app/ai-sdr/route.ts");
    expect(route).toContain("withActionPrices(renderAiSdrPage(), prices)");
    expect(route).toContain('fetchPlatformPrices("/ai-sdr")');
  });
});

describe("the signature: the calendar fills while the agent books on WhatsApp", () => {
  it("one calendar (main.js drives the first .cal) with five stages, and the thread", () => {
    expect(html.match(/class="cal"/g)).toHaveLength(1);
    for (const s of [1, 2, 3, 4, 5]) expect(html).toContain(`data-stage="${s}"`);
    // Final state in the HTML; the pre-paint script empties it only when motion is on.
    expect(html).toContain('<div class="cal" data-cal-stage="5"');
    expect(html).toContain('setAttribute("data-cal-stage","1")');
    expect(html).toContain('<div class="wa" role="img"');
    expect(html).toContain("wa-msg booked");
  });

  it("loads its own stylesheet after the homepage agent sheet", () => {
    const a = html.indexOf("/landing/v2/agent.css");
    const b = html.indexOf("/landing/v2/ai-sdr.css");
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(read("public/landing/v2/ai-sdr.css")).toContain(".sdr-stage .wa {");
  });
});

describe("copy rules", () => {
  const copy = prose(html);
  it("no dashes, no agency claim about us, no promised meeting count", () => {
    expect(copy).not.toContain("—");
    expect(copy).not.toContain("–");
    expect(copy).not.toMatch(/distribute\.you is (?:a|an)\b[^.]*\bagency\b|\bour agency\b/i);
    expect(copy).not.toMatch(/\bguaranteed? (?:sales )?meetings\b/i);
    expect(copy).not.toMatch(/\bopen rate/i);
    expect(copy).not.toMatch(/\bNo [a-z]+, no [a-z]+/);
  });

  it("FAQ answers ship as FAQPage JSON-LD, tags stripped", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    expect(faq.mainEntity).toHaveLength(AI_SDR_FAQ.length);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text).not.toMatch(/<a /);
  });
});

describe("the AI SDR cluster", () => {
  it("moves exactly 11x, Artisan, AiSDR and Qualified under /ai-sdr/vs", () => {
    expect([...AI_SDR_SLUGS]).toEqual(["11x", "artisan", "aisdr", "qualified"]);
    expect(aiSdrCompetitors().map((c) => c.slug)).toEqual(["11x", "artisan", "aisdr", "qualified"]);
    for (const c of aiSdrCompetitors()) {
      expect(competitorPath(c)).toBe(`/ai-sdr/vs/${c.slug}`);
      expect(c.verifiedOn).toBe("2026-10-29");
      expect(html).toContain(`href="/ai-sdr/vs/${c.slug}"`);
    }
    expect(competitorPath(competitorBySlug("gojiberry")!)).toBe("/compare/gojiberry");
  });

  it("each vs page is canonical under /ai-sdr and wears the AI SDR breadcrumb", () => {
    for (const c of aiSdrCompetitors()) {
      const page = renderComparePage(c);
      expect(page).toContain(`<link rel="canonical" href="https://distribute.you/ai-sdr/vs/${c.slug}">`);
      expect(page).toContain('"name":"AI SDR","item":"https://distribute.you/ai-sdr"');
      expect(page).toContain('href="/ai-sdr/alternatives"');
      expect(page).toContain("the AI SDR that books your meetings");
    }
  });

  it("the alternatives page lists all four with their source, us first", () => {
    const alt = renderAiSdrAlternativesPage();
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/ai-sdr/alternatives">');
    const ours = alt.indexOf('class="us-row"');
    for (const c of aiSdrCompetitors()) {
      expect(alt.indexOf(`href="/ai-sdr/vs/${c.slug}"`)).toBeGreaterThan(ours);
      expect(alt).toContain(`href="${c.sourceUrl}"`);
    }
    expect(prose(alt)).not.toContain("—");
  });

  it("the old /compare URL answers a 301, never a 404", async () => {
    const { GET } = await import("@/app/compare/[slug]/route");
    for (const slug of AI_SDR_SLUGS) {
      const res = await GET(new Request(`https://distribute.you/compare/${slug}`), { params: Promise.resolve({ slug }) });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`/ai-sdr/vs/${slug}`);
    }
  });

  it("/ai-sdr/vs refuses a competitor outside the cluster", async () => {
    const { GET } = await import("@/app/ai-sdr/vs/[slug]/route");
    const res = await GET(new Request("https://distribute.you/ai-sdr/vs/instantly"), { params: Promise.resolve({ slug: "instantly" }) });
    expect(res.status).toBe(404);
  });
});
