import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The article `cold-email-follow-up` states the Research page's follow-up study for positive
 * replies (each email of a sequence that asks for a reply, filed under its place in the sequence).
 * The answer is a lift (x2, +67%); counts live in the notes. Its figures are tokens rendered from the committed snapshot by `render-followups-article.mjs`,
 * so every figure below is recomputed here from that snapshot.
 */
const root = join(__dirname, "../..");
const slug = "cold-email-follow-up";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const snapshotText = readFileSync(join(root, "scripts/blog-data/followups/followups.snapshot.json"), "utf8");
const snap = JSON.parse(snapshotText);
// the figcaption is the chart's legend (the waiting rule), not the verdict
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<figcaption[\s\S]*?<\/figcaption>/g, "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

type Step = { bucket: string; emails: number; replies: number; spend: number };
const step = (b: string): Step => {
  const s = snap.steps.find((x: Step) => x.bucket === b);
  if (!s) throw new Error(`no ${b}`);
  return s;
};
const first = step("First email");
const fu1 = step("Follow-up 1");
const fu2 = step("Follow-up 2");
const one = first.replies + fu1.replies;
const two = one + fu2.replies;
const lift1 = Math.round((one / first.replies - 1) * 100);
const lift2 = Math.round((two / one - 1) * 100);
const mult = (two / first.replies).toFixed(1);

describe("the cold email follow-up article", () => {
  it("states the answer as a lift, never as a count or a price", () => {
    expect(prose).toContain("Two follow-ups doubled the positive replies.");
    expect(two).toBeGreaterThanOrEqual(2 * first.replies);
    expect(prose).toContain(`The first follow-up added ${lift1}% to what the first email brought. The second added ${lift2}% more.`);
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("What this data cannot tell you"));
    expect(answer).not.toMatch(/\$\d|\d{2,} (positive replies|emails|people)/);
  });

  it("opens on a key-takeaway card with the multiplier and the two lifts, no volume", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`(x${mult})`);
    expect(card).toContain(`+${lift1}% positive replies`);
    expect(card).toContain(`+${lift2}% more`);
    expect(card.replace(/<[^>]+>/g, " ")).not.toMatch(/\$\d|\d{3,}|split test|\bthin\b|direction/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("weighs the follow-up's extra cost against its extra replies", () => {
    const cost = prose.slice(prose.indexOf("What a follow-up costs you"), prose.indexOf("The rule this points to"));
    expect(cost).toContain("adds almost nothing to the bill");
    expect(cost).toContain(`${lift1}% more positive replies and the second ${lift2}% more`);
  });

  it("draws one chart in sequence order, against the first email alone", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(1);
    const labels = [...charts[0].matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(["First email only", "+ 1 follow-up", "+ 2 follow-ups"]);
    expect(charts[0]).toContain(`x${mult}`);
    expect(charts[0]).toContain(`+${lift1}% over the first email alone`);
    expect(charts[0]).toContain(`+${lift2}% over one follow-up`);
  });

  it("keeps the counts in the notes", () => {
    const notes = prose.slice(prose.indexOf("Notes"), prose.indexOf("About distribute.you"));
    expect(notes).toContain(`${first.replies} after the first email, ${one} with one follow-up, ${two} with two follow-ups`);
    expect(notes).toContain(first.emails.toLocaleString("en-US"));
  });

  it("puts the caveats in the limits, never in the verdict", () => {
    const limits = prose.slice(prose.indexOf("What this data cannot tell you"));
    expect(limits).toContain("a direction, not a precise figure");
    expect(limits).toContain("last email sent before it");
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("What a follow-up costs you"));
    expect(answer).not.toMatch(/split test|directional|direction|thin/i);
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

  it("carries an SEO title and slug: keyword first, short, no email volume", () => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title).toMatch(/^Cold Email Follow-Up/);
    expect(meta.title + meta.excerpt).not.toMatch(/\d+k? emails/i);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee|meetings? booked/i);
    expect(prose).toContain("what it cost you");
    expect(prose).toContain("We match your first $100.");
    expect(html).toContain('href="https://distribute.you"');
    expect(html).toContain('href="https://github.com/shamanic-technologies/distribute.you/tree/main/apps/landing/scripts/blog-data/followups"');
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
