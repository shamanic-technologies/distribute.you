import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the hand-written "Cheap LLM or expensive LLM" article.
 *
 * The article is user-facing copy AND a public dataset, so two families of
 * rule apply: the landing's copy rules (no em-dash, the cost is the client's
 * and never ours, no promised meetings, no rate card, no opens) and the
 * dataset's own coherence (the answer, the charts and the method state the
 * same figures). A third family is the owner's editorial rules from the first
 * version's review: the workflow count stays out of the title and the answer,
 * the answer is stated without "except" clauses or a one-reply price, the
 * charts are inline SVG that scale with the column, and the hero is a 16:9
 * illustration because both the blog card and the article page crop the
 * cover to 16:9.
 */

const SLUG = "flash-vs-pro-llm-cold-email";
const DIR = join(__dirname, "..", "..", "content", "blog", SLUG);
const html = readFileSync(join(DIR, "article.html"), "utf8");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as Record<string, unknown>;
const hero = readFileSync(join(DIR, "hero.svg"), "utf8");
const publish = readFileSync(join(__dirname, "..", "..", "scripts", "publish-blog-article.mjs"), "utf8");
const render = readFileSync(join(__dirname, "..", "..", "scripts", "render-blog-hero.mjs"), "utf8");

const prose = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
const answer = html.slice(0, html.indexOf('<h2 id="method">'));

describe("cheap-vs-expensive article: copy rules", () => {
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

describe("cheap-vs-expensive article: editorial rules from the first review", () => {
  it("the title and excerpt lead with emails sent, never with the workflow count", () => {
    expect(String(meta.title)).not.toMatch(/\d+ workflows?/i);
    expect(String(meta.excerpt)).not.toMatch(/\d+ workflows?/i);
    expect(String(meta.excerpt)).toContain("95,661");
  });

  it("the workflow count appears only under Method", () => {
    expect(answer).not.toMatch(/\b20 workflows?\b/);
    const method = html.slice(html.indexOf('<h2 id="method">'));
    expect(method).toContain("20 workflows");
  });

  it("the method restricts the scope to sales cold email outreach", () => {
    expect(html).toMatch(/sales cold email outreach only/i);
    expect(html).toMatch(/Journalist outreach, PR pitches/);
  });

  it("the answer is stated straight: no except-clause, no one-reply price", () => {
    expect(answer).not.toMatch(/\bexcept\b/i);
    expect(answer).not.toMatch(/1,368\.69|1,369/);
    expect(answer).toMatch(/If you want website visits/);
    expect(answer).toMatch(/If you want positive replies/);
  });

  it("the stake is asked before the answer", () => {
    expect(html.indexOf("Pay 7x more per email and convert better")).toBeGreaterThan(-1);
    expect(html.indexOf("Pay 7x more per email")).toBeLessThan(html.indexOf('<h2 id="the-answer">'));
  });

  it("the charts are inline SVGs that scale with the column and carry a text alternative", () => {
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs.length).toBe(4);
    for (const tag of svgs) {
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

describe("cheap-vs-expensive article: dataset coherence", () => {
  it("answer, charts and method state the same headline figures", () => {
    for (const figure of ["3.24", "17.83", "95,661", "34,506", "57,650", "6,715.53"]) {
      expect(html).toContain(figure);
    }
    expect(hero).toContain("$3.24");
    expect(hero).toContain("6.0");
    expect(hero).toContain("95,661");
  });

  it("the tier email counts add up to the emails sent", () => {
    // Cheap 34,506 + expensive 57,650 + not-yet-measurable 3,505.
    expect(34_506 + 57_650 + 3_505).toBe(95_661);
    expect(html).toContain("3,505 emails");
  });

  it("every workflow row that states a CPPR has at least two replies", () => {
    const rows = html.match(/<tr><td>[A-Z][a-z]+<\/td><td>(Cheap|Expensive)<\/td>.*?<\/tr>/g) ?? [];
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
    expect(html).toMatch(/What this is not<\/strong>: a randomised experiment/);
    expect(html).toMatch(/31 positive replies is a small count/);
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

describe("cheap-vs-expensive article: publishing", () => {
  it("meta.json names the directory slug, a manual source and a cover under public/", () => {
    expect(meta.slug).toBe(SLUG);
    expect(meta.source).toBe("manual");
    expect(meta.coverImagePath).toBe(`/blog/${SLUG}/hero.png`);
    expect(existsSync(join(__dirname, "..", "..", "public", "blog", SLUG, "hero.png"))).toBe(true);
  });

  it("the hero is a 16:9 illustration, and the renderer refuses any other shape", () => {
    expect(hero).toMatch(/<svg[^>]*\swidth="1600"[^>]*\sheight="900"/);
    expect(render).toContain("16 / 9");
  });

  it("the publish script upserts on slug and refuses an em-dash", () => {
    expect(publish).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(publish).toContain('meta.source ?? "manual"');
    expect(publish).toContain("carries an em-dash");
  });
});
