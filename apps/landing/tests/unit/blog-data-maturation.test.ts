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
    // the research block keeps its own rows (one leg each) and filters them on features-service's
    // rule (features-service#1196): the run that served the lead STARTED at least the leg's
    // published duration before the end, read from /public/channels, never re-measured here.
    // Before any cost per email is computed and before any study is cut.
    expect(src).toContain("const researchCutoff = (leg) => maturationCutoff(WINDOW.to, LEG_MATURITY.get(leg).durationDays);");
    const researchFilter = src.indexOf("const mature = researchRows.filter((r) => {");
    expect(researchFilter).toBeGreaterThan(0);
    expect(src.slice(researchFilter, researchFilter + 900)).toContain("if (day >= researchCutoff(r.leg)) { young++; return false; }");
    // the research rows never pass through the articles' measured window
    expect(src).not.toContain("researchRows.filter((r) => isMature(r._sentAt");
    for (const consumer of ["const emailsOfKey = emailsByVersionLeg.get(k);", "reply: researchFor(research.herald)", "visit: researchFor(research.scout)"]) {
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
  it("Herald reads the lead_found_to_conversation leg only, Scout the lead_found_to_website_visit leg's link-carrying emails", () => {
    const legKey = readFileSync(join(__dirname, "../../scripts/blog-data/leg-key.mjs"), "utf8");
    expect(legKey).toContain('export const HERALD_LEG = "lead_found_to_conversation";');
    expect(legKey).toContain('export const SCOUT_LEG = "lead_found_to_website_visit";');
    // a campaign stored before the 2026-10-09 rename is the same leg (both spellings, one identity)
    expect(legKey).toContain("start_to_conversation: HERALD_LEG, start_to_website_visit: SCOUT_LEG");
    expect(src).toContain("c.platform_campaign_id, canonicalLeg(c.leg_key)]");
    expect(src).toContain("const herald = priced.filter((r) => r.leg === HERALD_LEG);");
    // ROI is marginal: a follow-up carries only its own sending, the first email everything bought
    // once per person (owner 2026-10-03: "compare the extra cost to send a followup N versus the extra gain")
    expect(src).toContain("r.cost = send + (r.stepNo === 1 ? (spend - perEmail) / firstOfKey : 0);");
    expect(src).not.toContain("r.cost = spend / emailsByVersionLeg.get(k);");
    // a website visit is a HUMAN click: Scout is the self-send link emails, outcome = visited
    expect(src).toContain("const scoutLinked = scoutAll.filter((r) => r.hasLink);");
    expect(src).toContain('const scout = scoutLinked.filter((r) => r.transport === "smtp").map((r) => ({ ...r, clicked: r.visited }));');
    expect(src).toContain('visited: click ? click.source === "self_send" && Number(click.step) === Number(e.step) : false,');
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
