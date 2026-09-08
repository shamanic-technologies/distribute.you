import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the hand-written "Flash or Pro" article.
 *
 * Three families of rule. The landing's copy rules (no em-dash, the cost is
 * the client's and never ours, no promised meetings, no rate card, no opens).
 * The dataset's coherence (the answer, the charts and the method state the
 * same figures). And the owner's editorial rules from two reviews: no
 * workflow count outside Method, the volume is a round 100,000 with the exact
 * count under Method only, every money figure is a whole dollar, the two
 * outcome charts are symmetric (both cost-per-outcome, lower is better), the
 * tiers are called Flash / Pro / Frontier, the charts are inline SVG, and the
 * hero is a 16:9 illustration whose content sits in a central safe zone
 * because the blog list crops the featured cover to a different ratio than
 * the article page does.
 */

const SLUG = "flash-vs-pro-llm-cold-email";
const DIR = join(__dirname, "..", "..", "content", "blog", SLUG);
const html = readFileSync(join(DIR, "article.html"), "utf8");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as Record<string, unknown>;
const hero = readFileSync(join(DIR, "hero.svg"), "utf8");
const publish = readFileSync(join(__dirname, "..", "..", "scripts", "publish-blog-article.mjs"), "utf8");
const render = readFileSync(join(__dirname, "..", "..", "scripts", "render-blog-hero.mjs"), "utf8");
const slugPage = readFileSync(join(__dirname, "..", "..", "src", "app", "blog", "[slug]", "page.tsx"), "utf8");

const prose = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
const story = html.slice(0, html.indexOf('<h2 id="method">'));
const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

describe("flash-or-pro article: copy rules", () => {
  it("carries no em-dash anywhere (body, meta, hero)", () => {
    expect(html).not.toContain("—");
    expect(JSON.stringify(meta)).not.toContain("—");
    expect(hero).not.toContain("—");
  });

  it("never inverts the cost onto us, never claims a rate card, never promises meetings", () => {
    expect(prose).not.toMatch(/costs? us\b/i);
    expect(prose).not.toMatch(/\bat cost\b/i);
    expect(prose).not.toMatch(/pass-through|no markup/i);
    expect(prose).not.toMatch(/predictable cost|cost you know in advance/i);
    expect(prose).not.toMatch(/guarantee[sd]? (a |any )?(meeting|reply|result)/i);
  });

  it("does not report opens (a deprecated metric)", () => {
    expect(html).not.toMatch(/\bopen rate\b|\bopens\b|\bopened\b/i);
  });

  it("names no invented person and no testimonial", () => {
    expect(html).not.toMatch(/\b(Sara K|Marcus T|Priya N|Tom H|Alex R|Julia M)\b/);
    expect(html).not.toMatch(/testimonial/i);
  });

  it("does not reveal the $400 offer and states the $30 one", () => {
    expect(html).not.toContain("$400");
    expect(html).toContain("first 30 USD");
  });
});

describe("flash-or-pro article: editorial rules", () => {
  it("the tiers are Flash, Pro and Frontier, never cheap and expensive", () => {
    expect(story).toMatch(/<strong>Flash<\/strong>, the cheapest\. <strong>Pro<\/strong>, the middle\. <strong>Frontier<\/strong>, the most expensive\./);
    expect(story).not.toMatch(/cheap tier|expensive tier/i);
    expect(hero).not.toMatch(/CHEAP|EXPENSIVE/);
    expect(hero).toContain("FLASH TIER");
    expect(hero).toContain("PRO TIER");
  });

  it("the method gives examples for every tier", () => {
    const method = html.slice(html.indexOf('<h2 id="method">'));
    expect(method).toMatch(/Flash, the cheapest model of a family \(Gemini Flash, Claude Haiku, DeepSeek V4 Flash/);
    expect(method).toMatch(/Pro, the middle \(Gemini Pro, Claude Opus, DeepSeek V4 Pro/);
    expect(method).toMatch(/Frontier, the most expensive \(Claude Fable, Astra\), not yet run/);
  });

  it("the volume is a round 100,000 in the title, excerpt, story and hero; the exact count lives under Method only", () => {
    expect(String(meta.title)).toContain("100,000");
    expect(String(meta.excerpt)).toContain("100,000");
    expect(story).toContain("100,000 cold emails");
    expect(hero).toContain("100,000 emails sent");
    expect(story).not.toContain("95,661");
    expect(html.slice(html.indexOf('<h2 id="method">'))).toContain("95,661");
  });

  it("no money figure carries cents", () => {
    expect(prose).not.toMatch(/\$\d[\d,]*\.\d/);
    expect(hero).not.toMatch(/\$\d[\d,]*\.\d/);
    for (const svg of svgs) expect(svg).not.toMatch(/\$\d[\d,]*\.\d/);
  });

  it("the workflow count stays out of the title, the excerpt and the story", () => {
    expect(String(meta.title)).not.toMatch(/\d+ workflows?/i);
    expect(String(meta.excerpt)).not.toMatch(/\d+ workflows?/i);
    expect(story).not.toMatch(/\b20 workflows?\b/);
    expect(html.slice(html.indexOf('<h2 id="method">'))).toContain("20 workflows");
  });

  it("the method restricts the scope to sales cold email outreach", () => {
    expect(html).toMatch(/sales cold email outreach only/i);
    expect(html).toMatch(/Journalist outreach, PR pitches/);
  });

  it("the story runs bet, test, twist, rule, why, then the pitch, and every story section is short", () => {
    const ids = [...html.matchAll(/<h2 id="([^"]+)">/g)].map((m) => m[1]);
    expect(ids).toEqual(["the-bet", "the-test", "the-twist", "the-rule", "why", "for-you", "method"]);
    const sections = story.split(/<h2 id="[^"]+">[^<]*<\/h2>/).slice(1);
    for (const section of sections) {
      const words = section.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
      expect(words).toBeLessThan(120);
    }
  });

  it("the two outcome charts are symmetric: both cost per outcome, both lower is better, no except-clause", () => {
    const charts = svgs.filter((s) => /Cost per (website visit|positive reply)/.test(s));
    expect(charts.length).toBe(2);
    for (const chart of charts) {
      expect(chart).toContain("(USD, lower is better)");
      expect(chart).toMatch(/>Flash</);
      expect(chart).toMatch(/>Pro</);
    }
    expect(story).not.toMatch(/\bexcept\b/i);
    expect(story).not.toMatch(/per 1,000 USD/);
  });

  it("the charts are inline SVGs that scale with the column and carry a text alternative", () => {
    const tags = html.match(/<svg[^>]*>/g) ?? [];
    expect(tags.length).toBe(4);
    for (const tag of tags) {
      expect(tag).toContain('viewBox="0 0 800 ');
      expect(tag).toContain('width="100%"');
      expect(tag).toContain('role="img"');
      expect(tag).toContain("aria-label=");
      expect(tag).not.toMatch(/\sheight="/);
    }
  });

  it("the per-workflow table is folded away, not in the main flow", () => {
    expect(html).toMatch(/<details>\s*<summary>Per-workflow data and list prices<\/summary>/);
    expect(html.indexOf("<details>")).toBeLessThan(html.indexOf("<table>"));
  });
});

describe("flash-or-pro article: dataset coherence", () => {
  it("story, charts, hero and method state the same headline figures", () => {
    for (const figure of ["$3", "$18", "$168", "$1,369", "34,506", "57,650", "$6,716"]) {
      expect(html).toContain(figure);
    }
    expect(hero).toContain(">$3<");
    expect(hero).toContain(">$168<");
  });

  it("the ratios in the verdict follow from the chart figures", () => {
    expect(Math.round(18 / 3)).toBe(6);
    expect(Math.round(1369 / 168)).toBe(8);
    expect(story).toContain("Flash buys the click 6x cheaper. Pro buys the reply 8x cheaper.");
  });

  it("the tier email counts add up to the emails sent", () => {
    expect(34_506 + 57_650 + 3_505).toBe(95_661);
    expect(html).toContain("3,505 emails");
  });

  it("every workflow row that states a CPPR has at least two replies", () => {
    const rows = html.match(/<tr><td>[A-Z][a-z]+<\/td><td>(Flash|Pro)<\/td>.*?<\/tr>/g) ?? [];
    expect(rows.length).toBe(20);
    for (const row of rows) {
      const cells = [...row.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);
      const replies = Number(cells[6]);
      const cppr = cells[8];
      if (cppr !== "") expect(replies).toBeGreaterThanOrEqual(2);
    }
  });

  it("names the vendor model that ran and sources every list price", () => {
    for (const model of ["Gemini 3.5 Flash-Lite", "Gemini 3.1 Pro Preview", "DeepSeek V4 Pro", "GLM-5.3", "Kimi K3"]) {
      expect(html).toContain(model);
    }
    for (const source of ["ai.google.dev", "api-docs.deepseek.com", "docs.z.ai", "platform.kimi.ai"]) {
      expect(html).toContain(source);
    }
  });

  it("states the limits rather than hiding them", () => {
    expect(html).toMatch(/<strong>Limits<\/strong>: not a randomised experiment/);
    expect(html).toContain("31 positive replies is a small count");
    expect(html).toMatch(/no confidence intervals/);
  });

  it("carries a schema.org Dataset with the study window", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBe(1);
    const dataset = JSON.parse(blocks[0][1]) as { "@type": string; temporalCoverage: string; url: string };
    expect(dataset["@type"]).toBe("Dataset");
    expect(dataset.temporalCoverage).toBe("2026-04-14/2026-09-08");
    expect(dataset.url).toBe(`https://distribute.you/blog/${SLUG}`);
  });
});

describe("flash-or-pro article: publishing and rendering", () => {
  it("meta.json names the directory slug, a manual source and a cover under public/", () => {
    expect(meta.slug).toBe(SLUG);
    expect(meta.source).toBe("manual");
    expect(meta.coverImagePath).toBe(`/blog/${SLUG}/hero.png`);
    expect(existsSync(join(__dirname, "..", "..", "public", "blog", SLUG, "hero.png"))).toBe(true);
  });

  it("the hero is 16:9 and every text sits inside the central safe zone (x 200..1400)", () => {
    expect(hero).toMatch(/<svg[^>]*\swidth="1600"[^>]*\sheight="900"/);
    expect(render).toContain("16 / 9");
    // Groups translate their children; resolve each <text> x against its group.
    const groups = [...hero.matchAll(/<g transform="translate\((\d+),\d+\)">([\s\S]*?)<\/g>/g)];
    for (const [, dx, body] of groups) {
      for (const [, x, anchor] of body.matchAll(/<text x="(\d+)"[^>]*?(?:text-anchor="(\w+)")?[^>]*>/g)) {
        const abs = Number(dx) + Number(x);
        expect(abs).toBeGreaterThanOrEqual(200);
        expect(abs).toBeLessThanOrEqual(1400);
        void anchor;
      }
    }
    const topLevel = hero.replace(/<g[\s\S]*?<\/g>/g, "");
    for (const [, x] of topLevel.matchAll(/<text x="(\d+)"/g)) {
      expect(Number(x)).toBeGreaterThanOrEqual(200);
      expect(Number(x)).toBeLessThanOrEqual(1400);
    }
  });

  it("the article page clears the sticky nav above its header", () => {
    expect(slugPage).not.toContain("dy-section-tight");
    expect(slugPage).toMatch(/outerClassName="pt-28 pb-4"/);
  });

  it("the publish script upserts on slug and refuses an em-dash", () => {
    expect(publish).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(publish).toContain('meta.source ?? "manual"');
    expect(publish).toContain("carries an em-dash");
  });
});
