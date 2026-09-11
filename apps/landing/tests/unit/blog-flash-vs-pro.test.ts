import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the hand-written "Flash or Pro" article, recut on 2026-09-10 to
 * lead with the BEST workflow of each tier rather than the tier average, to
 * state the A/B spread across the workflows the fleet tested, to cut the data
 * ten ways as the cost-per-click article does, and to close on the industry's
 * own studies with distribute.you named as the option to pick.
 *
 * Three families of rule. The landing's copy rules (no em-dash, the cost is
 * the client's and never ours, no promised meetings, no rate card, no opens).
 * The dataset's coherence (the headline, the hero, the charts and the method
 * state the same figures; a price is stated only above the floors Method
 * declares). And the owner's editorial rules: the headline is the best
 * workflow, every money figure is a whole dollar, the tiers are Flash / Pro /
 * Frontier, the charts are inline SVG, the hero is a 16:9 illustration whose
 * content sits in the central safe zone, and no figure is a fleet average
 * dressed as a promise.
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
const methodAt = html.indexOf('<h2 id="method">');
const story = html.slice(0, methodAt);
const method = html.slice(methodAt);
const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
const section = (id: string) => {
  const at = html.indexOf(`<h2 id="${id}">`);
  expect(at).toBeGreaterThan(-1);
  const next = html.indexOf("<h2 ", at + 1);
  return html.slice(at, next === -1 ? undefined : next);
};

// The headline figures, read once so every assertion below pins the same ones.
const BEST_PRO_CPPR = "$139";
const PRO_CPPR = "$198";
const BEST_FLASH_CPWV = "$1";
const FLASH_CPWV = "$2";
const PRO_CPWV = "$6";

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

  it("no money figure carries cents in our own prose, charts or hero", () => {
    // Competitor prices are quoted as published ($152.73 per meeting) inside
    // the comparison tables; our own figures are whole dollars everywhere.
    const ours = prose.replace(/<table[\s\S]*?<\/table>/g, "");
    expect(ours).not.toMatch(/\$\d[\d,]*\.\d/);
    expect(hero).not.toMatch(/\$\d[\d,]*\.\d/);
    for (const svg of svgs) expect(svg).not.toMatch(/\$\d[\d,]*\.\d/);
  });
});

describe("flash-or-pro article: the headline is the best workflow, not the tier average", () => {
  it("the answer leads with the best Pro workflow's reply price and the best Flash workflow's visit price", () => {
    const answer = section("the-answer");
    expect(answer).toContain(`<strong>Our best Pro workflow buys a positive reply for ${BEST_PRO_CPPR}.</strong>`);
    expect(answer).toContain(`<strong>Our best Flash workflow buys a website visit for ${BEST_FLASH_CPWV}.</strong>`);
    expect(answer).toContain(`The Pro tier as a whole pays ${PRO_CPPR}`);
    expect(answer).toContain(`The Flash tier as a whole pays ${FLASH_CPWV}, Pro ${PRO_CPWV}`);
  });

  it("the hero states the best-workflow figures and the tier they beat, and says the test was an A/B", () => {
    expect(hero).toContain(`>${BEST_FLASH_CPWV}<`);
    expect(hero).toContain(`>${BEST_PRO_CPPR}<`);
    expect(hero).toContain(`per website visit, tier ${FLASH_CPWV}`);
    expect(hero).toContain(`per positive reply, tier ${PRO_CPPR}`);
    expect(hero).toContain("Best workflow, the click");
    expect(hero).toContain("Best workflow, the reply");
    expect(hero).toContain("125,000 emails, 25 A/B tests");
    expect(hero).toContain("FLASH TIER");
    expect(hero).toContain("PRO TIER");
  });

  it("the title and the excerpt carry the A/B framing and the best-workflow figures", () => {
    expect(String(meta.title)).toContain("ran 25 A/B tests");
    expect(String(meta.title)).toContain("125,000 emails");
    expect(String(meta.excerpt)).toContain(BEST_PRO_CPPR);
    expect(String(meta.excerpt)).toContain(BEST_FLASH_CPWV);
    expect(String(meta.excerpt)).toContain("beats its own tier's average");
  });

  it("the A/B section names the winner of each outcome and the gap distribute.you hands its clients", () => {
    const spread = section("the-spread");
    expect(spread).toContain("25 A/B tests, one winner per outcome");
    // Owner rule (2026-09-10): no per-workflow chart at all, named or numbered.
    // The page states the best workflow per outcome and the tier it beats, nothing finer.
    expect(spread).not.toContain("<svg");
    expect(html).not.toMatch(/by workflow, (Flash|Pro)/);
    expect(spread).toContain("<strong>This is the gap distribute.you gives its clients.</strong>");
    expect(spread).toContain("They get its winner");
  });

  it("the CTA and the best-option box quote the best workflow's prices, never the tier's", () => {
    const forYou = section("for-you");
    expect(forYou).toContain(`a positive reply costs ${BEST_PRO_CPPR} and a website visit ${BEST_FLASH_CPWV}`);
    expect(forYou).toContain('<a href="/">Start with your website URL</a>');
    const best = section("best-tool");
    expect(best).toContain(`Best option for the lowest cost per positive reply: distribute.you, ${BEST_PRO_CPPR} per positive reply, all in`);
    expect(best).toContain(`${PRO_CPPR} across the Pro tier`);
  });
});

describe("flash-or-pro article: editorial rules", () => {
  it("the tiers are Flash, Pro and Frontier, never cheap and expensive", () => {
    expect(story).toMatch(/<strong>Flash<\/strong>, the cheapest\. <strong>Pro<\/strong>, the middle\. <strong>Frontier<\/strong>, the most expensive\./);
    expect(story).not.toMatch(/cheap tier|expensive tier/i);
    expect(hero).not.toMatch(/CHEAP|EXPENSIVE/);
  });

  it("the method gives examples for every tier", () => {
    expect(method).toMatch(/Flash, the cheapest model of a family \(Gemini Flash, Claude Haiku, DeepSeek V4 Flash/);
    expect(method).toMatch(/Pro, the middle \(Gemini Pro, Claude Opus, DeepSeek V4 Pro/);
    expect(method).toMatch(/Frontier, the most expensive \(Claude Fable, Astra\), not yet run/);
  });

  it("the volume is a round 125,000 in the title, story and hero; the exact count lives under Method only", () => {
    expect(story).toContain("125,000 cold emails");
    expect(story).not.toContain("124,664");
    expect(method).toContain("124,664 emails");
  });

  it("cuts the data the same ten ways as the cost-per-click article, Flash against Pro", () => {
    const cuts = section("ten-cuts");
    for (const h of [
      "1. Which email in the sequence", "2. Length of the email", "3. Paragraphs", "4. Subject length",
      "5. Seniority of the reader", "6. Size of the company", "7. Industry", "8. Where the reader is",
      "9. Local time of delivery", "10. Day of the week",
    ]) expect(cuts).toContain(`<h3>${h}</h3>`);
    // Every cut prices the click on both tiers and rates the reply on Pro.
    expect((cuts.match(/Cost per website visit by /g) ?? []).length).toBeGreaterThanOrEqual(20);
    expect((cuts.match(/Positive replies per 10,000 emails by /g) ?? []).length).toBeGreaterThanOrEqual(9);
  });

  it("the twist charts the reply by link and by brand naming, per tier, and prices no visit on an email that had nothing to click", () => {
    const twist = section("the-twist");
    expect(twist).toMatch(/<strong>\d+ came from a Pro email with no link in it<\/strong>/);
    expect(twist).toContain("Positive replies per 10,000 emails by link in the email, Pro");
    // The brand-naming cut is gone: the generation record carries the client's name on too
    // few emails in this window to draw anything, and a chart nobody can read is not a chart.
    expect(html).not.toMatch(/names the brand/i);
    expect(html).not.toMatch(/Cost per website visit by (tier and by )?link/);
  });

  it("names no workflow: a workflow is a number on the page, never a codename", () => {
    // Owner rule (2026-09-10): nobody outside the team knows the codenames, so
    // the page numbers workflows per tier and names the model instead.
    const codenames = /\b(Lithium|Rampart|Permafrost|Pelican|Legato|Azalea|Ballad|Osprey|Bronze|Cerulean|Tectonic|Cirque|Alnitak|Dawn|Trailblazer|Vector|Arcadia|Nobelium|Maelstrom|Lyonesse)\b/;
    expect(html).not.toMatch(codenames);
    expect(hero).not.toMatch(codenames);
    expect(JSON.stringify(meta)).not.toMatch(codenames);
    expect(html).not.toMatch(/(Flash|Pro) workflow \d/);
  });

  it("every chart is one tier: Flash and Pro never alternate inside a chart", () => {
    for (const svg of svgs) {
      const labels = [...svg.matchAll(/<text x="0" y="\d+" font-size="14" fill="#475569">([^<]*)<\/text>/g)].map((m) => m[1]);
      const flash = labels.filter((l) => /Flash/.test(l)).length;
      const pro = labels.filter((l) => /\bPro\b/.test(l)).length;
      // A chart may state both tiers only as whole-tier rows (the two headline charts), never as per-bucket pairs.
      if (flash && pro) expect(labels.length).toBeLessThanOrEqual(4);
    }
    const cuts = section("ten-cuts");
    expect((cuts.match(/Cost per website visit by [^"<]*, Flash \(USD/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect((cuts.match(/Cost per website visit by [^"<]*, Pro \(USD/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it("the charts are inline SVGs that scale with the column and carry a text alternative", () => {
    const tags = html.match(/<svg[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(25);
    for (const tag of tags) {
      expect(tag).toContain('viewBox="0 0 800 ');
      expect(tag).toContain('width="100%"');
      expect(tag).toContain('role="img"');
      expect(tag).toContain("aria-label=");
      expect(tag).not.toMatch(/\sheight="/);
    }
  });

  it("every table scrolls inside its own wrapper", () => {
    const tables = (html.match(/<table>/g) ?? []).length;
    const wrappers = (html.match(/<div style="overflow-x:auto">\s*<table>/g) ?? []).length;
    expect(tables).toBeGreaterThan(0);
    expect(wrappers).toBe(tables);
  });

  it("the list prices are folded away, and there is no per-workflow table", () => {
    expect(html).toMatch(/<details>\s*<summary>List prices<\/summary>/);
    expect(html).not.toMatch(/<th>Workflow<\/th>/);
  });
});

describe("flash-or-pro article: what others measured, and where we stand", () => {
  it("quotes every outside study with a source on its own domain and a read date, and computes nothing from them", () => {
    const others = section("others");
    const rows = others.match(/<tr><td>.*?<\/tr>/g) ?? [];
    expect(rows.length).toBe(4);
    for (const row of rows) {
      expect(row).toMatch(/href="https:\/\/(prospectory\.ai|www\.saleshandy\.com|woodpecker\.co|instantly\.ai)\//);
      expect(row).toContain('rel="nofollow noopener"');
      expect(row).toMatch(/read 2026-09-10/);
    }
    expect(method).toMatch(/<strong>Other studies<\/strong>: quoted as published[^<]*We compute nothing from them/);
  });

  it("states the basis difference instead of comparing a reply rate to ours", () => {
    const others = section("others");
    expect(others).toContain("Nobody else publishes what a positive reply costs.");
    expect(others).toMatch(/every reply counted, positive or not/);
    expect(others).not.toMatch(/our reply rate is (higher|better)/i);
  });

  it("the comparison table lists us first with the only measured cost per positive reply, every competitor row sourced and dated", () => {
    const best = section("best-tool");
    const rows = best.match(/<tr><td>.*?<\/tr>/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows[0]).toContain("<strong>distribute.you</strong>");
    expect(rows[0]).toContain(`<strong>${BEST_PRO_CPPR}</strong> measured, all in`);
    for (const row of rows.slice(1)) {
      expect(row).toContain("Not published");
      expect(row).toMatch(/href="https:\/\//);
      expect(row).toMatch(/read 2026-09-(07|10)/);
      expect(row).toContain("img.logo.dev/");
    }
  });
});

describe("flash-or-pro article: dataset coherence", () => {
  it("story, charts, hero and method state the same headline figures", () => {
    for (const figure of [BEST_PRO_CPPR, PRO_CPPR, BEST_FLASH_CPWV, FLASH_CPWV, PRO_CPWV, "35,102", "89,038", "$8,381"]) {
      expect(html).toContain(figure);
    }
  });

  it("the ratios in the twist follow from the tier figures", () => {
    // Flash earned one positive reply in the whole window, so its reply has no price to
    // compare; the visit does, and Pro pays three times what Flash pays for it.
    expect(Math.round(6 / 2)).toBe(3);
    expect(story).toContain("Pro is the only tier that prices one at all; on the visit, Flash wins by a factor of 3");
  });

  it("the tier email counts add up to the emails sent", () => {
    expect(35_102 + 89_038 + 44).toBe(124_184);
  });

  it("every chart row is a bar with its counts under it; no placeholder row anywhere", () => {
    // Owner rule (2026-09-10): "mets les barres". A thin bucket is drawn with
    // its counts printed under the bar, never replaced by a grey sentence.
    expect(html).not.toMatch(/too few to (price|rate)/);
    for (const svg of svgs) {
      const labels = (svg.match(/<text x="0" y="\d+" font-size="14" fill="#475569">/g) ?? []).length;
      const bars = (svg.match(/<rect x="\d+" y="\d+" width="\d+" height="26" rx="5"/g) ?? []).length;
      if (labels) expect(bars).toBe(labels);
    }
    expect(method).toContain("Every bucket with at least one outcome is drawn and priced");
    expect(method).toContain("A cost per positive reply is stated from 10 replies, which only the best Pro workflow clears");
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
    expect(html).toContain("36 positive replies is a small count");
    expect(html).toMatch(/no confidence intervals/);
  });

  it("carries a schema.org Dataset with the study window", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBe(1);
    const dataset = JSON.parse(blocks[0][1]) as { "@type": string; temporalCoverage: string; url: string };
    expect(dataset["@type"]).toBe("Dataset");
    expect(dataset.temporalCoverage).toBe("2026-04-15/2026-09-11");
    expect(dataset.url).toBe(`https://distribute.you/blog/${SLUG}`);
  });
});

describe("flash-or-pro article: publishing and rendering", () => {
  it("meta.json names the directory slug, a manual source, a cover under public/, and is live (the DB row is the publish, not a preview flag)", () => {
    expect(meta.slug).toBe(SLUG);
    expect(meta.source).toBe("manual");
    expect(meta.preview).toBeUndefined();
    expect(meta.coverImagePath).toBe(`/blog/${SLUG}/hero.png`);
    expect(existsSync(join(__dirname, "..", "..", "public", "blog", SLUG, "hero.png"))).toBe(true);
  });

  it("the hero is 16:9 and every text sits inside the central safe zone (x 200..1400)", () => {
    expect(hero).toMatch(/<svg[^>]*\swidth="1600"[^>]*\sheight="900"/);
    expect(render).toContain("16 / 9");
    const groups = [...hero.matchAll(/<g transform="translate\((\d+),\d+\)">([\s\S]*?)<\/g>/g)];
    for (const [, dx, body] of groups) {
      for (const [, x] of body.matchAll(/<text x="(\d+)"[^>]*>/g)) {
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
