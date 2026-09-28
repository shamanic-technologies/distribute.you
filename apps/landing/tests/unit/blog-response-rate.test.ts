import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs module, no types
import { rateP, costP, pText } from "../../scripts/blog-data/naming/naming.mjs";

/**
 * The article `cold-email-response-rate` states the Research page's naming study (does a cold
 * email that asks for a reply do better when it names the client?). Its figures are tokens
 * rendered from the committed snapshot by `render-naming-article.mjs`, with the same module
 * research.mjs uses, so every figure below is recomputed here from that snapshot.
 */
const root = join(__dirname, "../..");
const slug = "cold-email-response-rate";
const dir = join(root, "content/blog", slug);
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const snapshotText = readFileSync(join(root, "scripts/blog-data/naming/naming.snapshot.json"), "utf8");
const snap = JSON.parse(snapshotText);
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

type Side = { emails: number; replies: number; spend: number };
const REPLY = { count: "replies" };
const pct = (s: Side) => `${(Number(((s.replies / s.emails) * 10000).toFixed(2)) / 100).toFixed(2)}%`;
const cpr = (s: Side) => `$${Math.round(Number((s.spend / s.replies).toFixed(2))).toLocaleString("en-US")}`;
const held: Side = snap.held;
const named: Side = snap.named;

describe("the naming-the-client article", () => {
  it("states the winner plainly, with both rates and both prices from the snapshot", () => {
    expect(prose).toContain("Client not named wins, on rate and on cost.");
    expect(prose).toContain(`${pct(held)} of the emails that kept the name back got a positive reply, against ${pct(named)}`);
    expect(prose).toContain(`A positive reply cost you ${cpr(held)} when the client was not named, against ${cpr(named)}`);
  });

  it("opens on a key-takeaway card with the headline figures, before the first section", () => {
    const card = html.slice(html.indexOf("Key takeaway"), html.indexOf('id="the-question"'));
    expect(html.indexOf("Key takeaway")).toBeGreaterThan(-1);
    expect(card).toContain(`${pct(held)} positive reply rate`);
    expect(card).toContain(`${cpr(held)} per positive reply`);
    expect(card).not.toMatch(/\bp =|split test/);
    expect(html).toContain("background:#eff6ff;border:1px solid #bfdbfe");
  });

  it("draws both bars in both charts, each with its counts, the winner first", () => {
    const charts = [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    expect(charts).toHaveLength(2);
    for (const c of charts) {
      const labels = [...c.matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1]);
      expect(labels).toEqual(["Client not named", "Client named"]);
      expect(c).toContain(`${held.replies} positive replies, ${held.emails.toLocaleString("en-US")} emails`);
      expect(c).toContain(`${named.replies} positive replies, ${named.emails.toLocaleString("en-US")} emails`);
    }
  });

  it("puts the p-values and the not-a-split-test caveat in the limits, never in the verdict", () => {
    const limits = prose.slice(prose.indexOf("What this data cannot tell you"));
    expect(limits).toContain("not a split test");
    expect(limits).toContain(`p = ${pText(rateP(held, named, REPLY))}`);
    expect(limits).toContain(`p = ${pText(costP(held, named, REPLY))}`);
    const answer = prose.slice(prose.indexOf("The answer"), prose.indexOf("The rule this points to"));
    expect(answer).not.toMatch(/\bp =|split test|no winner/i);
  });

  it("carries no typed figure outside the card-free prose sections", () => {
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
    expect(meta.title).toMatch(/^Cold Email Response Rate/);
    expect(meta.title).toContain(`(${Math.round((held.emails + named.emails) / 1000)}k Emails)`);
    expect(meta.slug).toBe(slug);
    expect(meta.coverImagePath).toBe(`/blog/${slug}/hero.png`);
  });

  it("follows the copy rules", () => {
    expect(html + meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee|meetings? booked/i);
    expect(prose).toContain("what the emails cost you");
    expect(prose).toContain("From $1/day, first $30 free");
    expect(html).toContain('href="https://distribute.you"');
    expect(html).toContain('href="https://github.com/shamanic-technologies/distribute.you/tree/main/apps/landing/scripts/blog-data/naming"');
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
