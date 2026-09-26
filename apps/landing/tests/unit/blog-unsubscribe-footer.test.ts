import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const dir = join(root, "content/blog/cold-email-unsubscribe-link-spam");
const html = readFileSync(join(dir, "article.html"), "utf8");
const template = readFileSync(join(dir, "article.template.html"), "utf8");
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const prose = html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

type Tally = { spam: number; arrived: number; spamPct: number; missing: number };
const facts = JSON.parse(
  execFileSync("node", [join(root, "scripts/blog-data/footer/derive-footer.mjs"), join(root, "scripts/blog-data/footer/placement.snapshot.json")], { encoding: "utf8" }),
) as { visibleLink: Tally; noVisibleLink: Tally; total: Tally & { sent: number }; runs: Record<string, { arms: Record<string, Tally> }> };

describe("the unsubscribe footer article", () => {
  it("states figures derived from the committed snapshot, never typed ones", () => {
    const of = (t: Tally) => `${t.spam} of ${t.arrived}`;
    expect(prose).toContain(`${of(facts.visibleLink)} messages that arrived went to spam (${facts.visibleLink.spamPct}%)`);
    expect(prose).toContain(of(facts.noVisibleLink));
    for (const run of Object.values(facts.runs)) for (const t of Object.values(run.arms)) expect(html).toContain(`${of(t)} in spam`);
    // the template carries no figure of its own in the results sections
    const results = template.slice(template.indexOf('id="the-answer"'), template.indexOf('id="the-rule"'));
    expect(results.replace(/\{\{[^}]*\}\}/g, "")).not.toMatch(/\d+ of \d+|\d+%/);
  });

  it("prints the sample size beside every spam share", () => {
    for (const m of prose.matchAll(/\((\d+)%\)/g)) {
      const before = prose.slice(Math.max(0, m.index! - 80), m.index);
      expect(before, `share at ${m.index}`).toMatch(/\d+ of \d+/);
    }
  });

  it("never presents a link as a legal requirement", () => {
    expect(prose).not.toMatch(/(law|legally|legal) (requires?|mandates?) (an? )?(unsubscribe )?link/i);
    expect(prose).toMatch(/None of the laws below asks for one/);
    expect(prose).toMatch(/not legal advice/i);
  });

  it("keeps the no-footer arm inside the controlled test, not a population", () => {
    expect(prose).not.toMatch(/emails? (we sent|sent) without (a|any) footer (had|got|earned)/i);
    expect(template).not.toMatch(/\beras?\b|\bApril\b|\bJune\b/);
  });

  it("follows the copy rules", () => {
    expect(html).not.toContain("—");
    expect(meta.title + meta.excerpt).not.toContain("—");
    expect(prose).not.toMatch(/\bour cost\b|\bat cost\b|guarantee/i);
    expect(prose).toContain("From $1/day, first $30 free");
    expect(new Date(meta.publishedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("publishes no sending address from the test", () => {
    const snapshot = readFileSync(join(root, "scripts/blog-data/footer/placement.snapshot.json"), "utf8");
    expect(snapshot).not.toContain("@");
    expect(readFileSync(join(root, "scripts/blog-data/footer/read-placement.mjs"), "utf8")).not.toMatch(/[a-z]@[a-z]+\.(com|io|co)/);
  });
});
