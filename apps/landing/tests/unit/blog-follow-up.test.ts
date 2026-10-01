import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The article `cold-email-follow-up` states the Research page's follow-up study for positive
 * replies (each email of a sequence that asks for a reply, filed under its place in the sequence).
 * Its figures are tokens rendered from the committed snapshot by `render-followups-article.mjs`,
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
const usd = (s: Step) => `$${Math.round(Number((s.spend / s.replies).toFixed(2))).toLocaleString("en-US")}`;
const first = step("First email");
const fu1 = step("Follow-up 1");
const fu2 = step("Follow-up 2");
const sent = [first, fu1, fu2];
const totalReplies = sent.reduce((t, s) => t + s.replies, 0);
const totalEmails = sent.reduce((t, s) => t + s.emails, 0);
const per10k = (n: number) => ((n / first.emails) * 10000).toFixed(1);

describe("the cold email follow-up article", () => {
  it("states the verdict with the rate chart's own first and last bars", () => {
    expect(prose).toContain("Follow-ups doubled the positive replies.");
    expect(totalReplies).toBeGreaterThanOrEqual(2 * first.replies);
    expect(prose).toContain(`brought ${per10k(first.replies)} positive replies per 10,000 people`);
    expect(prose).toContain(`the same people reached ${per10k(totalReplies)}`);
  });

  it("prices each email of the sequence from the snapshot, rising down the sequence", () => {
    expect(prose).toContain(`${usd(first)} for the first email, ${usd(fu1)} for the first follow-up, ${usd(fu2)} for the second`);
  });

  it("opens on a key-takeaway card with the headline figures, before the first section", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`${first.replies} positive replies from the first email, ${totalReplies} after two follow-ups`);
    expect(card).toContain(`${usd(first)} per positive reply`);
    expect(card).not.toMatch(/split test|thin|directional|direction/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("draws two charts in sequence order, every step a bar with its counts", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(2);
    const labels = (c: string) => [...c.matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1]);
    expect(labels(charts[0])).toEqual(["First email only", "+ 1 follow-up", "+ 2 follow-ups"]);
    expect(labels(charts[1])).toEqual(["First email", "Follow-up 1", "Follow-up 2"]);
    for (const s of sent) expect(charts[1]).toContain(`${s.replies} positive replies, ${s.emails.toLocaleString("en-US")} emails`);
    expect(charts[0]).toContain(`${totalReplies} positive replies from ${first.emails.toLocaleString("en-US")} people`);
  });

  it("puts the caveats in the limits, never in the verdict", () => {
    const limits = prose.slice(prose.indexOf("What this data cannot tell you"));
    expect(limits).toContain("a direction, not a precise figure");
    expect(limits).toContain("last email sent before it");
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("The rule this points to"));
    expect(answer).not.toMatch(/split test|directional|direction|thin/i);
  });

  it("carries no typed figure in the prose sections", () => {
    const body = template.slice(template.indexOf('id="the-question"'), template.indexOf('id="about-us"'));
    expect(body.replace(/\{\{[^}]*\}\}/g, "").replace(/per 10,000 people/g, "")).not.toMatch(/\$\d|\d+(\.\d+)?%|\d{2,}/);
  });

  it("names no internal crew, no workflow codename and no customer", () => {
    expect(html + JSON.stringify(meta)).not.toMatch(/herald|scout|pilot|maelstrom|lithium|rampart/i);
    expect(snapshotText).not.toContain("@");
    expect(snapshotText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("carries an SEO title and slug: keyword first, short, round volume at the end", () => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title).toMatch(/^Cold Email Follow-Up/);
    expect(meta.title).toContain(`(${Math.round(totalEmails / 1000)}k Emails)`);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee|meetings? booked/i);
    expect(prose).toContain("what the emails cost you");
    expect(prose).toContain("From $1/day, first $30 free");
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
