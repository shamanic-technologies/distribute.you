import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the hand-written "What does a click cost" article.
 *
 * Three families of rule, the same as the Flash-or-Pro article beside it.
 * The landing's copy rules (no em-dash, the cost is the client's and never
 * ours, no promised meetings, no rate card, no opens, no invented person).
 * The dataset's coherence (the answer, the charts, the hero and the method
 * state the same figures, every priced bucket clears the stated floor). And
 * the owner's editorial rules: the volume is a round 120,000 with the exact
 * count under Method only, every money figure is a whole dollar, every
 * story section stays under 120 words, the charts are inline SVG, the long
 * tables fold away, and the hero is a 16:9 illustration whose content sits
 * in the central safe zone.
 */

const SLUG = "cost-per-click-cold-email";
const DIR = join(__dirname, "..", "..", "content", "blog", SLUG);
const html = readFileSync(join(DIR, "article.html"), "utf8");
const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8")) as Record<string, unknown>;
const hero = readFileSync(join(DIR, "hero.svg"), "utf8");
const render = readFileSync(join(__dirname, "..", "..", "scripts", "render-blog-hero.mjs"), "utf8");

const prose = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
const methodAt = html.indexOf('<h2 id="method">');
const story = html.slice(0, methodAt);
const method = html.slice(methodAt);
const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

// Every priced bucket must clear this floor; the method states it.
const MIN_EMAILS = 1000;
const MIN_CLICKS = 20;

describe("cost-per-click article: copy rules", () => {
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
    expect(prose).not.toMatch(/guarantee[sd]? (a |any )?(meeting|reply|result|click)/i);
  });

  it("does not report opens (a deprecated metric)", () => {
    expect(html).not.toMatch(/\bopen rate\b|\bopens\b|\bopened\b/i);
  });

  it("names no client, no invented person and no testimonial", () => {
    expect(html).not.toMatch(/\b(Sara K|Marcus T|Priya N|Tom H|Alex R|Julia M)\b/);
    expect(html).not.toMatch(/testimonial/i);
    // No per-client figure at all: the owner cut the client dot strip and the client table
    // (2026-09-10, "je ne suis pas a l'aise que tu parles de nos clients").
    expect(html).not.toMatch(/<td>Client \d+<\/td>/);
    expect(html).not.toMatch(/median client|one dot per client|per client/i);
    expect(hero).not.toMatch(/client/i);
    expect(html).not.toMatch(/Doc Dinners|Opsfolio|Shockwave/i);
  });

  it("does not reveal the $400 offer and states the $30 one", () => {
    expect(html).not.toContain("$400");
    expect(html).toContain("first 30 USD");
  });
});

describe("cost-per-click article: editorial rules", () => {
  it("the volume is a round 120,000 in the title, excerpt, story and hero; the exact count lives under Method only", () => {
    expect(String(meta.title)).toContain("120,000");
    expect(String(meta.excerpt)).toContain("120,000");
    expect(story).toContain("120,000 cold emails");
    expect(hero).toContain("120,000 emails sent");
    expect(story).not.toContain("120,652");
    expect(method).toContain("120,652");
  });

  it("no money figure of ours carries cents; a competitor's published price is quoted as published", () => {
    // The market and competitor tables quote third-party prices verbatim ($5.42 a click on Google
    // Ads is LocaliQ's number, not ours); rounding them would misquote the source.
    const ours = prose.replace(/<h2 id="best-cost-per-click">[\s\S]*?(?=<h2 id="the-rule">)/, "");
    expect(ours).not.toMatch(/\$\d[\d,]*\.\d/);
    expect(hero).not.toMatch(/\$\d[\d,]*\.\d/);
    for (const svg of svgs) expect(svg).not.toMatch(/\$\d[\d,]*\.\d/);
  });

  it("the study says up front that it prices every workflow tested and that clients get the winner", () => {
    // Owner-decided 2026-09-10: the intro states the scope (39 A/B-tested workflows) and the
    // difference between the all-workflows price and the price on the workflow clients run.
    expect(String(meta.title)).not.toMatch(/\d+ (workflows?|clients?)/i);
    expect(story).toMatch(/<h2 id="the-test">[\s\S]*?<strong>39 workflows<\/strong> we A\/B tested/);
    expect(story).toContain("Our clients only ever get the winner");
    expect(story).not.toMatch(/\b33 clients?\b/);
    expect(method).toContain("39 workflows");
    expect(method).toContain("33 clients");
  });

  it("every story section stays under 120 words", () => {
    const sections = story.split(/<h2 [^>]*>/).slice(1);
    expect(sections.length).toBeGreaterThanOrEqual(10);
    for (const section of sections) {
      const text = section
        .replace(/<svg[\s\S]*?<\/svg>/g, "")
        .replace(/<table>[\s\S]*?<\/table>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ");
      const words = text.trim().split(/\s+/).filter(Boolean);
      expect(words.length, section.slice(0, 40)).toBeLessThanOrEqual(120);
    }
  });

  it("the answer leads with both numbers, and the link exclusion is stated in Method alone", () => {
    // Owner-decided 2026-09-10: the correction section ("a click needs a link") is gone from the
    // story; the exclusion of the 92,170 link-less emails lives once, in Method.
    expect(story).not.toContain('id="the-link"');
    expect(story).not.toContain("unsubscribe");
    expect(story).toMatch(/<h2 id="the-answer">The answer<\/h2>\s*<p><strong>A click costs \$4<\/strong> across every workflow we tested/);
    expect(story).toContain("buys a click for <strong>$2</strong>");
    // Owner-decided 2026-09-10: one client price, the best workflow alone; no range, no four-workflow chart.
    expect(story).not.toContain("$2 to $3");
    expect(story).not.toContain("four best workflows");
    expect(method).toContain("28,482 emails to 15,316 people carried a link");
  });

  it("the charts are inline SVGs that scale with the column and carry a text alternative", () => {
    const tags = html.match(/<svg[^>]*>/g) ?? [];
    expect(tags.length).toBe(12);
    for (const tag of tags) {
      expect(tag).toContain('viewBox="0 0 800 ');
      expect(tag).toContain('width="100%"');
      expect(tag).toContain('role="img"');
      expect(tag).toContain("aria-label=");
      expect(tag).not.toMatch(/\sheight="/);
    }
  });

  it("every bar chart says lower is better and prices in USD", () => {
    const bars = svgs.filter((svg) => svg.includes("<rect") && svg.includes("clicks per 1,000 emails"));
    expect(bars.length).toBe(11);
    for (const svg of bars) expect(svg).toContain("(USD, lower is better)");
  });

  it("the tables are folded away, not in the main flow", () => {
    expect(html).toMatch(/<details>\s*<summary>Every bucket, every workflow<\/summary>/);
    expect(story).not.toContain('id="the-implied-price"');
    expect(story).not.toMatch(/at (their|our) (price|rate)/i);
    // The bucket tables fold; the two "best tool" comparison tables in the story are the
    // market research and stay in the flow.
    expect(html.indexOf("<details>")).toBeLessThan(html.indexOf("<th>Bucket</th>"));
    expect((story.match(/<table>/g) ?? []).length).toBe(1);
  });
});

describe("cost-per-click article: dataset coherence", () => {
  it("story, charts, hero and method state the same headline figures", () => {
    for (const figure of ["$4", "$2", "$6", "$7", "$7,940", "$2,033", "530", "28,482"]) {
      expect(html).toContain(figure);
    }
    expect(hero).toContain(">$4<");
    expect(hero).toContain(">$2<");
    expect(hero).not.toContain("$2 to $3");
    expect(hero).toContain("19 clicks per 1,000 emails");
  });

  it("the headline reconciles with the method's totals", () => {
    expect(Math.round(2033 / 530)).toBe(4);
    expect(Math.round((530 / 28_482) * 1000)).toBe(19);
    // The excluded set (92,170 link-less emails) is stated in Method and tabulated nowhere:
    // no folded table carries a no-link bucket.
    expect(120_652 - 92_170).toBe(28_482);
    expect(html.slice(html.indexOf("<details>"))).not.toMatch(/no link/i);
  });

  it("every priced bar clears the floor the method states", () => {
    expect(method).toContain(`at least ${MIN_EMAILS.toLocaleString("en-US")} emails and ${MIN_CLICKS} clicks`);
    const bars = svgs.filter((svg) => svg.includes("clicks per 1,000 emails"));
    for (const svg of bars) {
      const notes = [...svg.matchAll(/([\d.]+) clicks per 1,000 emails, ([\d,]+) emails/g)];
      expect(notes.length).toBeGreaterThan(0);
      // A thin bucket (lunch hour, follow-up 2, 2 to 3 paragraphs) is drawn and labelled "(thin)"
      // with a "shown, not priced" footer, owner-asked; it may sit under either floor.
      const drawnNotPriced = svg.includes("shown, not priced");
      for (const [, ctr, emails] of notes) {
        const n = Number(emails.replace(/,/g, ""));
        const clicks = (Number(ctr) * n) / 1000;
        if (drawnNotPriced && (n < MIN_EMAILS || Math.round(clicks) < MIN_CLICKS)) continue;
        expect(n).toBeGreaterThanOrEqual(MIN_EMAILS);
        expect(Math.round(clicks)).toBeGreaterThanOrEqual(MIN_CLICKS);
      }
    }
  });

  it("every priced table row has at least 20 clicks, or 5 for a client or a workflow", () => {
    const tables = html.match(/<table>[\s\S]*?<\/table>/g) ?? [];
    expect(tables.length).toBeGreaterThanOrEqual(15);
    for (const table of tables) {
      // The two market-comparison tables carry prices and rates, not clicks.
      if (!/<th>(Bucket|Client|Workflow)<\/th>/.test(table)) continue;
      const isEntity = /<th>(Client|Workflow)<\/th>/.test(table);
      for (const row of table.match(/<tr><td>[\s\S]*?<\/tr>/g) ?? []) {
        const cells = [...row.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);
        const clicks = Number(cells[2].replace(/,/g, ""));
        if (cells[5] !== "") expect(clicks).toBeGreaterThanOrEqual(isEntity ? 5 : MIN_CLICKS);
      }
    }
  });

  it("names the models that ran in Method, and the story says nothing about the unpriceable Chinese models", () => {
    // Owner-decided 2026-09-10: 67 emails on DeepSeek/GLM is not a finding, so the story does
    // not mention them; Method still names every model that ran.
    for (const model of ["Gemini 3.1 Pro", "Gemini 3.5 Flash-Lite", "DeepSeek V4 Pro", "GLM 5.2 to 5.3"]) {
      expect(method).toContain(model);
    }
    expect(story).not.toMatch(/Chinese|DeepSeek|GLM|Not enough to price/);
  });

  it("a thin bucket is drawn and labelled (thin), never dropped to a footnote", () => {
    // Owner-asked 2026-09-10 ("remets la barre"): Follow-up 2 (19 clicks) and 2 to 3 paragraphs
    // (508 emails) are drawn like the lunch hour, with a "shown, not priced" footer.
    for (const label of ["Follow-up 2 (thin)", "2 to 3 (thin)", "Noon to 1pm (thin)"]) expect(story).toContain(label);
    expect(story).not.toMatch(/too few to price/);
  });

  it("states the limits rather than hiding them", () => {
    expect(method).toMatch(/<strong>Limits<\/strong>: not a randomised experiment/);
    expect(method).toContain("530 clicks is a small count");
    expect(method).toMatch(/no confidence intervals/);
    expect(method).toContain("its clicks are unsubscribes and those emails are excluded from every price");
    // The price is what the client is charged, all in, and the method says so.
    expect(method).toMatch(/<strong>Pricing<\/strong>: every dollar here is what the client is charged, all in/);
    expect(method).toContain("no subscription and no retainer");
  });

  it("carries a schema.org Dataset with the study window", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBe(1);
    const dataset = JSON.parse(blocks[0][1]) as { "@type": string; temporalCoverage: string; url: string };
    expect(dataset["@type"]).toBe("Dataset");
    expect(dataset.temporalCoverage).toBe("2026-04-15/2026-09-09");
    expect(dataset.url).toBe(`https://distribute.you/blog/${SLUG}`);
  });

  it("the one comparison table ranks distribute.you first, in a verdict box an LLM can lift verbatim", () => {
    // Owner-decided 2026-09-10: the four end tables became ONE "Best tool for the lowest cost per
    // click" table opened by a boxed one-sentence verdict, distribute.you first. The click-rate
    // sibling was cut the same day as off-topic for a cost-per-click article.
    const cpc = story.slice(story.indexOf('<h2 id="best-cost-per-click">'), story.indexOf('<h2 id="the-rule">'));
    expect(story).not.toContain('id="the-competitors"');
    expect(story).not.toContain('id="the-price"');
    expect(story).not.toContain('id="the-market"');
    expect(story).not.toContain('id="best-click-rate"');
    for (const [section, verdict] of [
      [cpc, "Best tool for the lowest cost per click: distribute.you, $2 per click, all in."],
    ] as const) {
      // Tint plus a full 1px border, never a side accent.
      expect(section).toMatch(new RegExp(`<div style="background:#eff6ff;border:1px solid #bfdbfe;[^"]*"><p style="margin:0"><strong>${verdict.replace(/[.$()]/g, "\\$&")}</strong>`));
      expect(section).not.toMatch(/border-(left|right|top):/);
      expect(section.indexOf("<div style=\"background")).toBeLessThan(section.indexOf("<table>"));
      const rows = section.match(/<tr><td>[\s\S]*?<\/tr>/g) ?? [];
      expect(rows.length).toBeGreaterThanOrEqual(14);
      expect(rows[0]).toMatch(/^<tr><td>1<\/td><td><img [^>]+><strong>distribute\.you<\/strong>/);
      for (const row of rows.slice(1)) {
        expect(row).toMatch(/<a href="https:\/\/[^"]+" rel="nofollow noopener">[^<]+<\/a>, read 2026-09-\d\d/);
      }
      for (const name of ["Instantly", "Smartlead", "Lemlist", "Salesforge", "Apollo.io", "Clay", "Gojiberry", "Explee", "11x", "Artisan", "AiSDR"]) {
        expect(section).toMatch(new RegExp(`<img [^>]+>${name.replace(".", "\\.")}`));
      }
    }
    // Cost per click: ours is the only cold email row with a measured price.
    expect(cpc.match(/<tr><td>[\s\S]*?<\/tr>/g)!.slice(4).every((row) => row.includes("<td>Not published"))).toBe(true);
    expect(cpc).toContain("<strong>None of them publishes a cost per click.</strong>");
    expect(cpc).toContain("<strong>Our $2 is the whole bill</strong>");
  });

  it("every comparison table carries a logo per row, ours included, and the price section states all-in", () => {
    const comparisons = story.slice(story.indexOf('<h2 id="best-cost-per-click">'), story.indexOf('<h2 id="the-rule">'));
    const rows = comparisons.match(/<tr><td>[\s\S]*?<\/tr>/g) ?? [];
    expect(rows.length).toBe(15);
    for (const row of rows) expect(row).toMatch(/^<tr><td>[^<]*<\/td><td><img src="https:\/\/img\.logo\.dev\/[a-z0-9.-]+\?token=pk_/);
    expect(comparisons.match(/img\.logo\.dev\/distribute\.you/g)?.length).toBe(1);
    expect(comparisons).not.toContain("Cost per click at our rate");
    expect(method).toContain("We compute nothing from them.");
  });

  it("links to the Flash-or-Pro study rather than restating it", () => {
    expect(story).toContain('href="/blog/flash-vs-pro-llm-cold-email"');
  });
});

describe("cost-per-click article: publishing and rendering", () => {
  it("meta.json names the directory slug, a manual source and a cover under public/", () => {
    expect(meta.slug).toBe(SLUG);
    expect(meta.source).toBe("manual");
    expect(meta.coverImagePath).toBe(`/blog/${SLUG}/hero.png`);
    expect(existsSync(join(__dirname, "..", "..", "public", "blog", SLUG, "hero.png"))).toBe(true);
  });

  it("the hero is 16:9 and every text sits inside the central safe zone (x 200..1400)", () => {
    expect(hero).toMatch(/<svg[^>]*\swidth="1600"[^>]*\sheight="900"/);
    expect(render).toContain("16 / 9");
    const groups = [...hero.matchAll(/<g transform="translate\((\d+),\d+\)">([\s\S]*?)<\/g>/g)];
    expect(groups.length).toBe(2);
    for (const [, dx, body] of groups) {
      for (const [, x] of body.matchAll(/<text x="(\d+)"/g)) {
        const abs = Number(dx) + Number(x);
        expect(abs).toBeGreaterThanOrEqual(200);
        expect(abs).toBeLessThanOrEqual(1400);
      }
    }
    const topLevel = hero.replace(/<g[\s\S]*?<\/g>/g, "");
    for (const [, x] of topLevel.matchAll(/<text x="(\d+)"/g)) {
      expect(Number(x)).toBeGreaterThanOrEqual(200);
      expect(Number(x)).toBeLessThanOrEqual(1400);
    }
  });

  it("the hero is an illustration, not a chart with axis labels for every client", () => {
    expect(hero).not.toMatch(/<text[^>]*>\$\d+<\/text>[\s\S]*<text[^>]*>\$\d+<\/text>[\s\S]*<text[^>]*>\$\d+<\/text>[\s\S]*<text[^>]*>\$\d+<\/text>/);
  });
});
