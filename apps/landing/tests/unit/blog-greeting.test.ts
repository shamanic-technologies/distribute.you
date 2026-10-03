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
// the figcaption is the chart's legend (who is counted), not the verdict
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<figcaption[\s\S]*?<\/figcaption>/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

type Row = { bucket: string; emails: number; spend: number; clicks?: number; replies?: number };
const find = (rows: Row[], bucket: string) => {
  const r = rows.find((x) => x.bucket === bucket);
  if (!r) throw new Error(`no ${bucket}`);
  return r;
};
const visitRate = (rows: Row[], b: string) => { const r = find(rows, b); return r.clicks! / r.emails; };
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const total = [...snap.visit.all, ...snap.reply.all].reduce((t: number, r: Row) => t + r.emails, 0);
const none = visitRate(snap.visit.all, "No greeting");
const name = visitRate(snap.visit.all, "First name alone");
const greet = visitRate(snap.visit.all, "Greeting + first name");

describe("the cold email greeting article", () => {
  it("states the visit verdict as rates and lifts from the snapshot", () => {
    expect(prose).toContain("Skipping the greeting got more clicks.");
    expect(prose).toContain(`${pct(none)} of emails with no greeting got one, against ${pct(name)} with the first name alone and ${pct(greet)}`);
    expect(prose).toContain(`+${Math.round((none / name - 1) * 100)}% visits against "Marie,"`);
    expect(prose).toContain(`Against the full "Hi Marie," it reads x${(none / greet).toFixed(1)}, but that gap mostly disappears on the same clients: a signal, not a conclusion`);
    expect(prose).toContain("the gap holds when we compare the two openings on the same clients in the same months");
  });

  it("names no reply winner: the openings made no measurable difference", () => {
    expect(prose).toContain("Replies: the opening made no measurable difference");
    const replies = prose.slice(prose.indexOf("Replies: the opening"), prose.indexOf("The rule this points to"));
    expect(replies).not.toMatch(/cheapest|best|wins|\$\d/);
  });

  it("opens on a key-takeaway card with the lifts, before the first section", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`+${Math.round((none / name - 1) * 100)}% website visits`);
    // the "Hi" + first name gap is only a signal (Research verdicts, 2026-10-02): never in the card
    expect(card).not.toContain(`x${(none / greet).toFixed(1)}`);
    expect(card).toContain("no measurable difference");
    expect(card).not.toMatch(/split test|thin|directional|interval/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("draws one chart, visit rates, every opening a bar with its counts, highest first", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(1);
    const c = charts[0];
    const labels = [...c.matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1]);
    expect([...labels].sort()).toEqual(["First name alone", "Greeting + first name", "No greeting"]);
    for (const r of snap.visit.all as Row[]) expect(c).toContain(`${r.clicks!.toLocaleString("en-US")} website visits`);
    const rates = [...c.matchAll(/font-weight="700" fill="#0f172a">([\d.]+)%</g)].map((m) => Number(m[1]));
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });

  it("keeps the small print at the bottom, never in the verdict", () => {
    const notes = prose.slice(prose.indexOf(" Notes "));
    expect(notes).toContain("not a split test");
    expect(notes).toContain("Flash");
    expect(notes).toContain("95% intervals");
    expect(notes).toContain("link scanner");
    expect(prose.indexOf(" Notes ")).toBeGreaterThan(prose.indexOf("The rule this points to"));
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("The rule this points to"));
    expect(answer).not.toMatch(/split test|directional|thin|interval/i);
  });

  it("carries no typed figure in the prose sections", () => {
    const body = template.slice(template.indexOf('id="the-question"'), template.indexOf('id="about-us"'));
    // "95% intervals" and "per 10,000 emails" are units in the small print, not data
    expect(body.replace(/\{\{[^}]*\}\}/g, "").replace(/95% intervals|per 10,000 emails/g, "")).not.toMatch(/\$\d|\d+(\.\d+)?%|\d{2,}/);
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
    expect(prose).toContain("what it cost you");
    expect(prose).toContain("From $99 a month, 3-day free trial");
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
