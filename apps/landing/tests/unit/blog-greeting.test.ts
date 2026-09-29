import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The article `cold-email-greeting` states the Research page's two opening studies (how the first
 * email opens, priced per website visit and per positive reply). Its figures are tokens rendered
 * from the committed snapshot by `render-greeting-article.mjs`, so every figure below is
 * recomputed here from that snapshot.
 */
const root = join(__dirname, "../..");
const slug = "cold-email-greeting";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const snapshotText = readFileSync(join(root, "scripts/blog-data/greeting/greeting.snapshot.json"), "utf8");
const snap = JSON.parse(snapshotText);
// the figcaption is the chart's legend (what "thin" means), not the verdict
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<figcaption[\s\S]*?<\/figcaption>/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

type Row = { bucket: string; emails: number; spend: number; clicks?: number; replies?: number };
const find = (rows: Row[], bucket: string) => {
  const r = rows.find((x) => x.bucket === bucket);
  if (!r) throw new Error(`no ${bucket}`);
  return r;
};
const usd = (spend: number, n: number) => `$${Math.round(Number((spend / n).toFixed(2))).toLocaleString("en-US")}`;
const visit = (b: string) => { const r = find(snap.visit.all, b); return usd(r.spend, r.clicks!); };
const reply = (b: string) => { const r = find(snap.reply.all, b); return usd(r.spend, r.replies!); };
const total = [...snap.visit.all, ...snap.reply.all].reduce((t: number, r: Row) => t + r.emails, 0);

describe("the cold email greeting article", () => {
  it("states the verdict with both winners' prices from the snapshot", () => {
    expect(prose).toContain("The greeting that gets the click is not the one that gets the reply.");
    expect(prose).toContain(`a visit cost you ${visit("No greeting")} with no greeting`);
    expect(prose).toContain(`a positive reply cost you ${reply("Greeting + first name")}`);
  });

  it("opens on a key-takeaway card with the headline figures, before the first section", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`${visit("No greeting")} per website visit`);
    expect(card).toContain(`${reply("Greeting + first name")} per positive reply`);
    expect(card).not.toMatch(/split test|thin|directional/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("draws one chart per outcome, every bucket a bar with its counts, cheapest first", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(2);
    for (const [c, leg, count, noun] of [
      [charts[0], snap.visit, "clicks", "website visits"],
      [charts[1], snap.reply, "replies", "positive replies"],
    ] as const) {
      const labels = [...c.matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1].replace(" (thin)", ""));
      expect(labels.sort()).toEqual(["First name alone", "Greeting + first name", "No greeting"]);
      for (const r of leg.all as Row[]) expect(c).toContain(`${(r[count] as number).toLocaleString("en-US")} ${noun}`);
      const prices = [...c.matchAll(/font-weight="700" fill="#0f172a">\$([\d,]+)</g)].map((m) => Number(m[1].replace(/,/g, "")));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it("puts the caveats in the limits, never in the verdict", () => {
    const limits = prose.slice(prose.indexOf("What this data cannot tell you"));
    expect(limits).toContain("not a split test");
    expect(limits).toContain("directional");
    expect(limits).toContain("Flash");
    expect(limits).toContain("too few to call");
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("The rule this points to"));
    expect(answer).not.toMatch(/split test|directional|thin/i);
  });

  it("carries no typed figure in the prose sections", () => {
    const body = template.slice(template.indexOf('id="the-question"'), template.indexOf('id="about-us"'));
    expect(body.replace(/\{\{[^}]*\}\}/g, "")).not.toMatch(/\$\d|\d+(\.\d+)?%|\d{2,}/);
  });

  it("names no internal crew, no workflow codename and no customer", () => {
    expect(html + JSON.stringify(meta)).not.toMatch(/herald|scout|pilot|maelstrom|lithium|rampart/i);
    expect(snapshotText).not.toContain("@");
    expect(snapshotText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("carries an SEO title and slug: keyword first, short, round volume at the end", () => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title).toMatch(/^Cold Email Greeting/);
    expect(meta.title).toContain(`(${Math.round(total / 1000)}k Emails)`);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee|meetings? booked/i);
    expect(prose).toContain("what the emails cost you");
    expect(prose).toContain("From $1/day, first $30 free");
    expect(html).toContain('href="https://distribute.you"');
    expect(html).toContain('href="https://github.com/shamanic-technologies/distribute.you/tree/main/apps/landing/scripts/blog-data/greeting"');
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
