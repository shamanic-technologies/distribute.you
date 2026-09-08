import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the hand-written "Flash or Pro" article.
 *
 * The article is user-facing copy AND a public dataset, so two families of
 * rule apply: the landing's copy rules (no em-dash, the cost is the client's
 * and never ours, no promised meetings, no rate card, no opens) and the
 * dataset's own coherence (the headline figures in the summary are the same
 * ones in the tables, and the hero states the same two numbers).
 */

const SLUG = "flash-vs-pro-llm-cold-email";
const DIR = join(__dirname, "..", "..", "content", "blog", SLUG);
const html = readFileSync(join(DIR, "article.html"), "utf8");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as Record<string, unknown>;
const hero = readFileSync(join(DIR, "hero.svg"), "utf8");
const publish = readFileSync(join(__dirname, "..", "..", "scripts", "publish-blog-article.mjs"), "utf8");

describe("flash-vs-pro article: copy rules", () => {
  it("carries no em-dash anywhere (body, meta, hero)", () => {
    expect(html).not.toContain("—");
    expect(JSON.stringify(meta)).not.toContain("—");
    expect(hero).not.toContain("—");
  });

  it("never inverts the cost onto us, never claims a rate card, never promises meetings", () => {
    const prose = html.replace(/<script[\s\S]*?<\/script>/g, "");
    expect(prose).not.toMatch(/costs? us\b/i);
    expect(prose).not.toMatch(/\bat cost\b/i);
    expect(prose).not.toMatch(/pass-through|no markup/i);
    expect(prose).not.toMatch(/predictable cost|cost you know in advance/i);
    expect(prose).not.toMatch(/guarantee[sd]? (a |any )?(meeting|reply|result)/i);
  });

  it("does not report opens (a deprecated metric)", () => {
    expect(html).not.toMatch(/\bopen rate\b|\bopens\b|\bopened\b/i);
  });

  it("names no invented person", () => {
    expect(html).not.toMatch(/\b(Sara K|Marcus T|Priya N|Tom H|Alex R|Julia M)\b/);
    expect(html).not.toMatch(/testimonial/i);
  });

  it("does not reveal the $400 offer and states the $30 one", () => {
    expect(html).not.toContain("$400");
    expect(html).toContain("first 30 USD");
  });
});

describe("flash-vs-pro article: dataset coherence", () => {
  it("summary, tier table and hero state the same headline figures", () => {
    for (const figure of ["3.24", "17.83", "167.89", "1,368.69", "4,868.84", "6,715.53"]) {
      expect(html).toContain(figure);
    }
    expect(hero).toContain("$3.24");
    expect(hero).toContain("$17.83");
    expect(hero).toContain("6,715");
  });

  it("outcome counts in the summary match the tier table totals", () => {
    // 423 + 273 + 2 visits, 1 + 29 + 1 replies.
    expect(html).toContain("<td>All</td><td>20</td><td>6,715.53</td><td>698</td><td>31</td>");
    expect(html).toContain("423 visits");
    expect(html).toContain("29 positive replies");
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

  it("names the vendor model that ran behind every alias and sources every list price", () => {
    for (const model of ["Gemini 3.5 Flash-Lite", "Gemini 3.1 Pro Preview", "DeepSeek V4 Pro", "GLM-5.3", "Kimi K3"]) {
      expect(html).toContain(model);
    }
    for (const source of ["ai.google.dev", "api-docs.deepseek.com", "docs.z.ai", "platform.kimi.ai"]) {
      expect(html).toContain(source);
    }
  });

  it("states the sample-size limit rather than hiding it", () => {
    expect(html).toMatch(/<h2 id="limitations">/);
    expect(html).toContain("31 positive replies in total");
    expect(html).toMatch(/No inferential statistics/);
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

describe("flash-vs-pro article: publishing", () => {
  it("meta.json names the directory slug, a manual source and a cover under public/", () => {
    expect(meta.slug).toBe(SLUG);
    expect(meta.source).toBe("manual");
    expect(meta.coverImagePath).toBe(`/blog/${SLUG}/hero.png`);
    expect(existsSync(join(__dirname, "..", "..", "public", "blog", SLUG, "hero.png"))).toBe(true);
  });

  it("the publish script upserts on slug and refuses an em-dash", () => {
    expect(publish).toContain("ON CONFLICT (slug) DO UPDATE");
    expect(publish).toContain('meta.source ?? "manual"');
    expect(publish).toContain("carries an em-dash");
  });
});
