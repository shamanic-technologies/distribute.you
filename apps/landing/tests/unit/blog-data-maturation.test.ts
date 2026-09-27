import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MATURATION_PERCENTILE,
  MEASURE_LOOKBACK_DAYS,
  isMature,
  maturationCutoff,
  maturationNote,
  measureMaturation,
  percentile,
  toMs,
} from "../../scripts/blog-data/maturation.mjs";

// The maturation window: every cost per outcome and every outcome rate leaves out the emails too
// young to have earned their outcome. The window is measured from our own latencies, never guessed.

const DAY = 86_400_000;
const END = "2026-09-12";
const endMs = toMs(`${END} 00:00:00`);
const old = endMs - 60 * DAY; // old enough to be measured
const pair = (sentMs: number, days: number) => ({ sentMs, outcomeMs: sentMs + days * DAY });

describe("the window is measured, not guessed", () => {
  it("is the longer of the two outcome percentiles, rounded up to a day", () => {
    const click = Array.from({ length: 100 }, (_, i) => pair(old, (i + 1) / 10)); // 0.1 .. 10 days
    const reply = Array.from({ length: 20 }, (_, i) => pair(old, i + 1)); // 1 .. 20 days
    const m = measureMaturation({ click, reply }, endMs);
    expect(m.click.pAt).toBe(9.5);
    expect(m.reply.pAt).toBe(19);
    expect(m.days).toBe(19);
    expect(m.percentile).toBe(MATURATION_PERCENTILE);
  });

  it("ignores emails too recent to have shown a long latency", () => {
    const young = endMs - (MEASURE_LOOKBACK_DAYS - 1) * DAY;
    const m = measureMaturation({ click: [pair(old, 3), pair(young, 0.1), pair(young, 0.2)], reply: [pair(old, 5)] }, endMs);
    expect(m.click.sample).toBe(1);
    expect(m.days).toBe(5);
  });

  it("fails loud when nothing is old enough to measure", () => {
    expect(() => measureMaturation({ click: [], reply: [pair(old, 1)] }, endMs)).toThrow();
  });

  it("reads a nearest-rank percentile", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5)).toBe(5);
  });
});

describe("no outcome maths includes an email younger than the window at the window's end", () => {
  it("cuts exactly N days before the end", () => {
    expect(maturationCutoff(END, 12)).toBe("2026-08-31");
  });

  it("counts an email sent the day before the cutoff and drops one sent on it", () => {
    const cutoff = maturationCutoff(END, 12);
    expect(isMature("2026-08-30 23:59:59.999", cutoff)).toBe(true);
    expect(isMature("2026-08-31 00:00:00", cutoff)).toBe(false);
    expect(isMature("2026-09-11 18:00:00", cutoff)).toBe(false);
  });

  it("says so in plain English, with the measured figure", () => {
    const note = maturationNote({ days: 12 }, "2026-08-31");
    expect(note).toBe("Emails sent in the last 12 days are left out (from Aug 31 on): 95 in 100 replies and clicks arrive within 12 days of the email that earned them.");
    expect(note).not.toContain("—");
  });

  it("filters the fact table before any cut, workflow or research block is built", () => {
    const src = readFileSync(join(__dirname, "../../scripts/blog-data/derive.mjs"), "utf8");
    const filter = src.indexOf("if (!isMature(facts[i]._sentAt, maturation.cutoff)) facts.splice(i, 1);");
    expect(filter).toBeGreaterThan(0);
    for (const consumer of ["function cutsFor(", "const linked = facts.filter", "workflows: bestWorkflows(facts)"]) {
      expect(src.indexOf(consumer), consumer).toBeGreaterThan(filter);
    }
    // the research block keeps its own rows (one leg each) and filters them the same way, before
    // any cost per email is computed and before any study is cut
    const researchFilter = src.indexOf("const mature = researchRows.filter((r) => isMature(r._sentAt, maturation.cutoff));");
    expect(researchFilter).toBeGreaterThan(0);
    for (const consumer of ["r.cost = spend / emailsByVersionLeg.get(k);", "reply: researchFor(research.herald)", "visit: researchFor(research.scout)"]) {
      expect(src.indexOf(consumer), consumer).toBeGreaterThan(researchFilter);
    }
    // an outcome after the window's end was not observed in it
    expect(src).toContain("if (r.replied_at && toMs(r.replied_at) >= windowEndMs) continue;");
  });
});

describe("the Research page compares workflow dynasties, never single versions", () => {
  it("groups every workflow study by the dynasty workflow-service records, and fails loud on an unknown version", () => {
    const src = readFileSync(join(__dirname, "../../scripts/blog-data/derive.mjs"), "utf8");
    expect(src).toContain("byWorkflow: cut(rows, (r) => r.dynasty),");
    expect(src).toContain("workflowByMonth: byMonthPer(rows, (r) => r.dynasty),");
    expect(src).toContain("is not in workflows.csv: re-run extract.sh");
    expect(readFileSync(join(__dirname, "../../scripts/blog-data/extract.sh"), "utf8")).toContain("SELECT workflow_slug, workflow_dynasty_slug");
  });
});

describe("the Research page computes every figure over ONE leg of ONE channel", () => {
  const src = readFileSync(join(__dirname, "../../scripts/blog-data/derive.mjs"), "utf8");
  it("Herald reads the start_to_conversation leg only, Scout the start_to_website_visit leg's link-carrying emails", () => {
    expect(src).toContain('const HERALD_LEG = "start_to_conversation";');
    expect(src).toContain('const SCOUT_LEG = "start_to_website_visit";');
    expect(src).toContain("const herald = priced.filter((r) => r.leg === HERALD_LEG);");
    expect(src).toContain("const scout = scoutAll.filter((r) => r.hasLink);");
    // the fleet-wide populations the articles use never feed a study
    expect(src).not.toContain("reply: researchFor(facts)");
    expect(src).not.toContain("visit: researchFor(linked)");
  });
  it("prices a (workflow version, leg) on its own spend, cut at the same day as the emails it divides", () => {
    expect(src).toContain("if (s.day >= maturation.cutoff) continue;");
    expect(src).toContain("const k = `${s.workflow_slug}|${leg}`;");
    const extract = readFileSync(join(__dirname, "../../scripts/blog-data/extract.sh"), "utf8");
    expect(extract).toContain("campaign-legs.csv");
    expect(extract).toContain("spend-legs.csv");
    // every "last runs" list is per leg
    expect((extract.match(/JOIN \(VALUES \$LEGS_VALUES\)/g) || []).length).toBe(3);
  });
});

describe("both articles state the rule", () => {
  for (const slug of ["cost-per-click-cold-email", "flash-vs-pro-llm-cold-email"]) {
    it(`${slug}: in its Method and under every chart`, () => {
      const html = readFileSync(join(__dirname, `../../content/blog/${slug}/article.html`), "utf8");
      expect(html).toContain("<strong>Emails too young to count</strong>");
      // every data chart (a bar per bucket) carries the line; a summary card and the vendors' list prices count no outcome
      const charts = html.split("<figure>").slice(1).map((f) => f.slice(0, f.indexOf("</figure>"))).filter((f) => f.includes('height="26" rx="5"') && !f.includes("list price"));
      expect(charts.length).toBeGreaterThan(0);
      for (const c of charts) expect(c).toMatch(/<figcaption[^>]*>Emails sent in the last \d+ days are left out/);
    });
  }
});
