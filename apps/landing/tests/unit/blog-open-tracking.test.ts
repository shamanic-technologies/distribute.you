import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const dir = join(root, "content/blog/cold-email-open-tracking-pixel");
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

type Side = { count: number; of: number; pct: number };
type Cmp = { on: Side; off: Side; liftPct: number; p: string };
const facts = JSON.parse(
  execFileSync("node", [join(root, "scripts/blog-data/pixel/derive-pixel.mjs"), join(root, "scripts/blog-data/pixel/pixel.snapshot.json")], { encoding: "utf8" }),
) as { replied: Cmp; repliedDelivered: Cmp; positive: Cmp; total: { emails: number; emailsRounded: number } };

const pct = (s: Side) => `${s.pct.toFixed(2)}%`;
const signed = (n: number) => (n > 0 ? `+${n}%` : `${n}%`);

describe("the open-tracking article", () => {
  it("states the headline figures derived from the committed snapshot", () => {
    expect(prose).toContain(`${pct(facts.replied.off)} of people replied, against ${pct(facts.replied.on)} with it: ${signed(facts.replied.liftPct)} replies`);
    expect(prose).toContain(signed(facts.repliedDelivered.liftPct));
    expect(meta.title).toContain(facts.total.emailsRounded.toLocaleString("en-US"));
  });

  it("carries no typed figure in the results sections", () => {
    const results = template.slice(template.indexOf('id="the-answer"'), template.indexOf('id="why"'));
    expect(results.replace(/\{\{[^}]*\}\}/g, "")).not.toMatch(/\d+(\.\d+)?%|\d+ of \d+/);
  });

  it("states that the comparison is not a controlled test, with its p-values", () => {
    expect(prose).toMatch(/not a controlled test/i);
    expect(prose).toContain(`p = ${facts.replied.p}`);
    expect(prose).toContain(`p = ${facts.positive.p}`);
  });

  it("compares two arms only, pixel on and pixel off", () => {
    expect(prose).not.toMatch(/self-send/i);
    const labels = [...html.matchAll(/font-size="14" fill="#475569">([^<]+)</g)].map((m) => m[1]);
    expect(new Set(labels)).toEqual(new Set(["Open tracking on", "Open tracking off"]));
  });

  it("follows the copy rules", () => {
    expect(html).not.toContain("—");
    expect(meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee/i);
    expect(prose).toContain("From $1/day, first $30 free");
    expect(meta.source).toBe("manual");
    expect(new Date(meta.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("keeps every section under 120 words", () => {
    const sections = template.split(/<h2 /).slice(1);
    for (const s of sections) {
      const words = s.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<table[\s\S]*?<\/table>/g, "").replace(/\{\{[^}]*\}\}/g, "N").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      expect(words, s.slice(0, 40)).toBeLessThan(120);
    }
  });

  it("publishes no address, lead or campaign id in the snapshot", () => {
    const snapshot = readFileSync(join(root, "scripts/blog-data/pixel/pixel.snapshot.json"), "utf8");
    expect(snapshot).not.toContain("@");
    expect(snapshot).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
