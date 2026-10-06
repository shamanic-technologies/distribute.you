import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The article `cold-email-cost-per-positive-reply` states the Research page's two average-cost
 * studies (what a positive reply cost, what a website visit cost), copied from research.json into a
 * committed snapshot by `derive-cost.mjs` and rendered by `render-cost-article.mjs`. Every figure
 * below is read back from that snapshot, so a typed figure in the prose fails here.
 */
const root = join(__dirname, "../..");
const slug = "cold-email-cost-per-positive-reply";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const snapshotText = readFileSync(join(root, "scripts/blog-data/cost/cost.snapshot.json"), "utf8");
const snap = JSON.parse(snapshotText);
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<figcaption[\s\S]*?<\/figcaption>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const dollars = (v: number) => `$${Math.round(v)}`;

describe("the cold email cost per positive reply article", () => {
  it("answers with the average cost per positive reply, the website visit second", () => {
    expect(prose).toContain(`A positive reply cost ${snap.reply.average.display} on average.`);
    expect(prose).toContain(`a website visit cost about ${dollars(snap.visit.average.value)}`);
    expect(prose.indexOf("The answer")).toBeLessThan(prose.indexOf("What a website visit cost"));
  });

  it("opens on a key-takeaway card with the two prices and no email count", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(card).toContain(`${snap.reply.average.display} per positive reply`);
    expect(card).toContain(`About ${dollars(snap.visit.average.value)} per website visit`);
    expect(card.replace(/<[^>]+>/g, " ")).not.toMatch(/\d{1,3},\d{3}|emails sent|interval/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("only reads a conclusion, and quotes the snapshot's own interval", () => {
    expect(snap.reply.interval.lo).toBeLessThan(snap.reply.average.value);
    expect(snap.reply.interval.hi).toBeGreaterThan(snap.reply.average.value);
    expect(prose).toContain(`between ${dollars(snap.reply.interval.lo)} and ${dollars(snap.reply.interval.hi)} per positive reply (95% interval)`);
  });

  it("draws the running average and the months, each paragraph quoting only what its chart prints", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(2);
    const values = (svg: string) => [...svg.matchAll(/font-size="16" font-weight="700" fill="#0f172a">([^<]+)</g)].map((m) => m[1]);
    expect(values(charts[0])).toEqual(snap.reply.running.map((p: { display: string }) => p.display));
    expect(values(charts[1])).toEqual(snap.reply.months.map((p: { display: string }) => p.display));
    const answer = prose.slice(prose.indexOf("The running average read"), prose.indexOf("Month by month"));
    for (const price of answer.match(/\$\d+/g) ?? []) expect(values(charts[0])).toContain(price);
    const months = prose.slice(prose.indexOf("Single months swing"), prose.indexOf("What a website visit cost"));
    for (const price of months.match(/\$\d+/g) ?? []) expect(values(charts[1])).toContain(price);
  });

  it("draws no month after the cutoff's month, and that month dotted as in progress", () => {
    const cutoffMonth = snap.cutoff.slice(5, 7);
    const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const series of [snap.reply.months, snap.reply.running]) {
      const last = series.at(-1);
      expect(SHORT.indexOf(last.label) + 1).toBe(Number(cutoffMonth));
      expect(last.partial).toBe(snap.cutoff.slice(8, 10) !== "01");
      expect(series.slice(0, -1).every((p: { partial: boolean }) => !p.partial)).toBe(true);
    }
    const charts = [...html.matchAll(/<figure>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    for (const fig of charts) {
      expect(fig.match(/stroke-dasharray/g) ?? []).toHaveLength(1);
      expect(fig).toContain("A dotted bar is a month still in progress");
    }
  });

  it("keeps the counts in the notes", () => {
    const notes = prose.slice(prose.indexOf("Notes"), prose.indexOf("About distribute.you"));
    expect(notes).toContain(`${snap.reply.outcomes} from ${snap.reply.emails.toLocaleString("en-US")} cold emails`);
    expect(notes).toContain(`${snap.visit.outcomes} from ${snap.visit.emails.toLocaleString("en-US")} cold emails`);
    const body = prose.slice(0, prose.indexOf("What this data cannot tell you"));
    expect(body).not.toMatch(/\d{1,3},\d{3}/);
  });

  it("carries no typed figure in the template", () => {
    const body = template.slice(template.indexOf('id="the-question"'), template.indexOf('id="about-us"'));
    expect(body.replace(/\{\{[^}]*\}\}/g, "").replace(/95% interval/g, "")).not.toMatch(/\$\d|\d+(\.\d+)?%|\d{2,}/);
  });

  it("names no internal crew, no workflow codename and no customer", () => {
    expect(html + JSON.stringify(meta)).not.toMatch(/herald|scout|pilot|maelstrom|lithium|rampart/i);
    expect(snapshotText).not.toContain("@");
    expect(snapshotText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("carries an SEO title and slug: keyword first, short, no email volume", () => {
    expect(meta.title.length).toBeLessThanOrEqual(60);
    expect(meta.title).toMatch(/^Cold Email Cost per Positive Reply/);
    expect(meta.title + meta.excerpt).not.toMatch(/\d+k? emails/i);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toMatch(/[—–]/);
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|pass-through|no markup|guarantee|meetings? booked|predictable|\bopens?\b/i);
    expect(prose).toContain("what it cost you");
    expect(prose).toContain("We match your first $100.");
    expect(html).toContain('href="https://distribute.you"');
    expect(html).toContain('href="https://github.com/shamanic-technologies/distribute.you/tree/main/apps/landing/scripts/blog-data/cost"');
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
