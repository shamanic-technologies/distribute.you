import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards for the generated "Flash or Pro" article, recut on 2026-10-02 to lead
 * with the TIER result (Flash buys a visit cheaper than Pro, a conclusion; the
 * reply gap is noise), to crown no workflow (the cheapest of 23, each run for
 * its own clients, is partly luck) and to drop the "A/B" wording (they were
 * never split tests). It still cuts the data ten ways as the cost-per-click
 * article does, and closes on the industry's own studies.
 *
 * Three families of rule. The landing's copy rules (no em-dash, the cost is
 * the client's and never ours, no promised meetings, no rate card, no opens).
 * The dataset's coherence (the headline, the hero, the charts and the method
 * state the same figures; a price is stated only above the floors Method
 * declares). And the owner's editorial rules: the headline is the tier
 * result, no workflow is crowned, every money figure is a whole dollar, the tiers are Flash / Pro /
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

// The headline figures, read once off the two answer charts (the producing artifact) so
// every assertion below pins the same ones and none rots on a re-render.
const tierChart = (title: string) => {
  const svg = svgs.find((one) => one.includes(`aria-label="${title} (USD, lower is better): Flash `));
  const m = /: Flash (\$[\d,]+), Pro (\$[\d,]+)"/.exec(svg ?? "");
  return { svg: svg ?? "", flash: m?.[1] ?? "MISSING", pro: m?.[2] ?? "MISSING" };
};
const VISIT = tierChart("Cost per website visit");
const REPLY = tierChart("Cost per positive reply");
const PRO_CPPR = REPLY.pro;
const FLASH_CPPR = REPLY.flash;
const FLASH_CPWV = VISIT.flash;
const PRO_CPWV = VISIT.pro;
const CROWNED = /best (Pro|Flash) workflow|winning workflow\b[^.<]*\$\d|workflow that won|its winner/i;

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
    // Scoped to the COPY: the folded appendix prices a bucket's spend, and a derived
    // figure that happens to read $400 is a number, never the retired welcome offer.
    const copy = prose.replace(/<table>[\s\S]*?<\/table>/g, "");
    expect(copy).not.toContain("$400");
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

describe("flash-or-pro article: the headline is the tier result, and no workflow is crowned", () => {
  it("the answer leads with the Flash visit conclusion and calls the reply gap noise, charting the two tiers only", () => {
    const answer = section("the-answer");
    for (const v of [PRO_CPPR, FLASH_CPPR, FLASH_CPWV, PRO_CPWV]) expect(v).not.toBe("MISSING");
    expect(answer).toContain("<strong>Flash buys a website visit cheaper than Pro.</strong>");
    expect(answer).toContain(`The Flash tier pays ${FLASH_CPWV} per visit, Pro ${PRO_CPWV}`);
    expect(answer).toMatch(/same clients in the same months: a conclusion\./);
    expect(answer).toContain("<strong>On positive replies, nothing is settled.</strong>");
    expect(answer).toContain(`The Pro tier pays ${PRO_CPPR}; Flash pays ${FLASH_CPPR}`);
    expect(answer).toMatch(/: noise\./);
    expect(answer).not.toMatch(CROWNED);
    // The two answer charts draw the two tiers and nothing else: no best-workflow row.
    const charts = answer.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    expect(charts.length).toBe(2);
    for (const svg of charts) {
      const labels = [...svg.matchAll(/<text x="0" y="\d+" font-size="14" fill="#475569">([^<]*)<\/text>/g)].map((m) => m[1]);
      expect(labels).toEqual(["Flash", "Pro"]);
    }
  });

  it("the hero states the tier figures, the reply as not settled, and no best-workflow price", () => {
    expect(hero).toContain(`>${FLASH_CPWV}<`);
    expect(hero).toContain(`per website visit, Pro pays ${PRO_CPWV}`);
    expect(hero).toContain(">Not settled<");
    expect(hero).toContain("125,000 emails");
    expect(hero).toContain("FLASH TIER");
    expect(hero).toContain("PRO TIER");
    expect(hero).not.toContain(">$94<");
    expect(hero).not.toContain(">$1<");
    expect(hero).not.toMatch(/best workflow/i);
  });

  it("nothing calls it an A/B test: not the title, the excerpt, the hero or the page", () => {
    // Owner-decided 2026-10-02: each workflow ran for its own clients, so none was a split test.
    for (const surface of [html, JSON.stringify(meta), hero]) expect(surface).not.toMatch(/A\/B/);
    expect(String(meta.title)).toContain("Flash vs Pro");
    expect(String(meta.title)).toMatch(/125k Emails|125,000 emails/);
    expect(String(meta.excerpt)).toContain("Flash bought a website visit cheaper than Pro");
    expect(String(meta.excerpt)).toContain("nothing is settled");
    expect(String(meta.excerpt)).not.toMatch(CROWNED);
    expect(String(meta.excerpt)).not.toContain("$94");
  });

  it("the workflow section crowns no workflow and calls the gap between workflows noise", () => {
    const spread = section("the-spread");
    expect(spread).toContain("why we crown none");
    expect(spread).toContain("So we name no winning workflow: noise.");
    // Owner rule (2026-09-10): no per-workflow chart at all, named or numbered.
    expect(spread).not.toContain("<svg");
    expect(html).not.toMatch(/by workflow, (Flash|Pro)/);
    expect(html).not.toMatch(CROWNED);
    expect(html).not.toContain("This is the gap distribute.you gives its clients");
  });

  it("the CTA and the best-option box quote the tier prices, never a best workflow's", () => {
    const forYou = section("for-you");
    expect(forYou).toContain(`a positive reply cost ${PRO_CPPR} on the Pro tier and a website visit ${FLASH_CPWV} on the Flash tier`);
    expect(forYou).toContain('<a href="/">Start with your website URL</a>');
    const best = section("best-tool");
    expect(best).toContain(`Best option for the lowest cost per positive reply: distribute.you, ${PRO_CPPR} per positive reply, all in, across the Pro tier`);
    expect(forYou + best).not.toMatch(CROWNED);
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
    expect(story).not.toContain("125,117");
    expect(method).toContain("125,117 emails");
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

  it("the twist charts the reply by link on Pro, calls the gap noise, and prices no visit on an email that had nothing to click", () => {
    const twist = section("the-twist");
    // Owner-decided 2026-10-02: the link gap does not clear chance, so it is stated as noise.
    expect(twist).toContain("close, not settled");
    expect(twist).toContain("noise for now");
    expect(twist).not.toMatch(/\b\d+ (of|came from)/);
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

  it("the comparison table lists us first with the Pro tier's measured cost per positive reply, every competitor row sourced and dated", () => {
    const best = section("best-tool");
    const rows = best.match(/<tr><td>.*?<\/tr>/g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows[0]).toContain("<strong>distribute.you</strong>");
    expect(rows[0]).toContain(`<strong>${PRO_CPPR}</strong> measured, all in, across the Pro tier`);
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
    for (const figure of [PRO_CPPR, FLASH_CPPR, FLASH_CPWV, PRO_CPWV, "33,521", "77,195", "$6,683"]) {
      expect(html).toContain(figure);
    }
  });

  it("the twist reads the tier gap off the charts, never as a multiple they do not print", () => {
    // A chart prices each tier; it does not print the ratio between them, so neither does
    // the prose.
    // The answer quotes each tier's price exactly as its chart prints it.
    const answer = section("the-answer");
    expect(answer).toContain(`The Flash tier pays ${FLASH_CPWV} per visit, Pro ${PRO_CPWV}`);
    expect(answer).toContain(`The Pro tier pays ${PRO_CPPR}; Flash pays ${FLASH_CPPR}`);
    expect(story).not.toMatch(/factor of \d|\d+x (rarer|cheaper|more)/);
  });

  it("the two tier counts sit inside the window's total", () => {
    // The remainder is the Frontier tier plus the emails whose generation record names no
    // model; neither is charted, so neither is stated anywhere but here.
    expect(33_521 + 77_195).toBeLessThan(111_202);
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
    // The bucket floor and the bar a workflow must clear to be CROWNED are different questions,
    // and the Method states both: a bucket is a reading, a crowned workflow is a claim.
    expect(method).toContain("is a thin read and is labelled (thin)");
    expect(method).toContain("Crowning a workflow is the stricter question");
    expect(method).toContain("We name no winning workflow");
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
    expect(html).toContain("34 positive replies is a small count");
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
