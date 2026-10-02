import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { likeForLike } from "../../scripts/blog-data/like-for-like.mjs";

/**
 * The article `best-llm-for-cold-email` compares Flash with Pro only on the same client in the
 * same month (like-for-like.mjs, the pooling the Research page prints). Its figures are tokens
 * rendered from the committed snapshot by `render-llm-article.mjs`, so every figure below is
 * recomputed here from that snapshot.
 */
const root = join(__dirname, "../..");
const slug = "best-llm-for-cold-email";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const snapshotText = readFileSync(join(root, "scripts/blog-data/llm/llm.snapshot.json"), "utf8");
const snap = JSON.parse(snapshotText);
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<figcaption[\s\S]*?<\/figcaption>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

type Flat = [number, number, number][];
const pooled = (pairs: Flat[]) =>
  likeForLike(pairs.map((p) => p.map(([emails, outcomes, spend]) => ({ emails, outcomes, spend }))));
const visits = pooled(snap.visit.tier);
const replies = pooled(snap.reply.tier);
const x2 = (n: number) => `${n.toFixed(2)}x`;

describe("the best LLM for cold email article", () => {
  it("holds the verdict to the data: same visits, a cheaper visit, replies unranked", () => {
    expect(visits.rate.lo).toBeLessThan(1);
    expect(visits.rate.hi).toBeGreaterThan(1);
    expect(visits.cost.hi).toBeLessThan(1);
    expect(visits.cost.lo).toBeLessThanOrEqual(0.5);
    expect(visits.cost.hi).toBeGreaterThanOrEqual(0.5);
    expect(replies.a.outcomes).toBeLessThan(5);
  });

  it("states the like-for-like figures from the snapshot", () => {
    expect(prose).toContain(`got ${Math.round(visits.rate.ratio * 100)} website visits for every 100 that Pro models got`);
    expect(prose).toContain(`Each visit cost ${Math.round(visits.cost.ratio * 100)} with Flash for every 100 with Pro`);
    expect(prose).toContain(`${x2(visits.rate.ratio)} (95% interval ${x2(visits.rate.lo)} to ${x2(visits.rate.hi)})`);
    expect(prose).toContain(`Cost per website visit: ${x2(visits.cost.ratio)} (${x2(visits.cost.lo)} to ${x2(visits.cost.hi)})`);
  });

  it("opens on a key-takeaway card with relative effects, before the first section", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`-${Math.round((1 - visits.cost.ratio) * 100)}% cost per website visit`);
    expect(card).toContain(`x${visits.rate.ratio.toFixed(1)}`);
    expect(card).not.toMatch(/\$\d|interval|split test|Mantel/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("draws two symmetric charts, Pro = 100, with the counts under each bar", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(2);
    for (const c of charts) {
      expect(c).toContain(`${visits.a.outcomes.toLocaleString("en-US")} website visits`);
      expect(c).toContain(`${visits.b.outcomes.toLocaleString("en-US")} website visits`);
      expect(c).toMatch(/font-weight="700" fill="#0f172a">100</);
    }
  });

  it("names no reply winner", () => {
    const section = prose.slice(prose.indexOf("Replies: too rare"), prose.indexOf("The rule this points to"));
    expect(section).not.toMatch(/cheapest|wins|\$\d|\d/);
  });

  it("keeps the small print at the bottom, never in the verdict", () => {
    const notes = prose.slice(prose.indexOf(" Notes "));
    expect(notes).toContain("not a split test");
    expect(notes).toContain("Mantel-Haenszel");
    expect(notes).toContain("95% interval");
    expect(notes).toContain("link-scanner clicks");
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("Replies: too rare"));
    expect(answer).not.toMatch(/split test|interval|Mantel/i);
  });

  it("carries no typed figure in the prose sections", () => {
    const body = template.slice(template.indexOf('id="the-question"'), template.indexOf('id="about-us"'));
    expect(body.replace(/\{\{[^}]*\}\}/g, "").replace(/95% interval|for every 100/g, "")).not.toMatch(/\$\d|\d+(\.\d+)?%|\d{2,}/);
  });

  it("names no internal crew, no workflow codename and no customer", () => {
    expect(html + JSON.stringify(meta)).not.toMatch(/herald|scout|pilot|maelstrom|lithium|rampart|permafrost|stratus/i);
    expect(snapshotText).not.toContain("@");
    expect(snapshotText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("carries an SEO title and slug: keyword first, short", () => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title).toMatch(/^Best LLM for Cold Email/);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toMatch(/[–—]/);
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee|meetings? booked/i);
    expect(prose).toContain("what it cost you");
    expect(prose).toContain("From $1/day, first $30 free");
    expect(html).toContain('href="https://distribute.you"');
    expect(html).toContain('href="https://github.com/shamanic-technologies/distribute.you/tree/main/apps/landing/scripts/blog-data/llm"');
    expect(meta.source).toBe("manual");
    expect(new Date(meta.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("keeps every section under 120 words", () => {
    for (const s of template.split(/<h2 /).slice(1)) {
      const words = s.replace(/\{\{[^}]*\}\}/g, "N").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      expect(words, s.slice(0, 40)).toBeLessThan(120);
    }
  });
});
