import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The digest fires on the RETURN, and names what moved it.
 */
describe("the daily digest is news about the return", () => {
  const digest = read("lib/outcome-digest.ts");
  const templates = read("instrumentation.ts");

  it("sends only when the return went UP, on two SERVED points", () => {
    expect(digest).toContain("const roi = roiChangeOn(revenue, targetDay);");
    expect(digest).toContain("if (!roi || roi.today <= roi.previous) return [];");
    // Both figures come off features-service's own per-day curve — a return the
    // browser computed would be a second opinion on a number the dashboard shows.
    expect(digest).toContain("revenue.roiHistory?.daily");
    expect(digest).not.toContain("cumulativePipelineUsd /");
  });

  it("names every kind that landed, not one goal's outcome", () => {
    expect(digest).toContain("const OUTCOME_KINDS:");
    expect(digest).toContain("newOutcomesOnDay(revenue, targetDay)");
    // The retired goal machinery is deleted, not left unused.
    expect(digest).not.toContain("OutcomeGoal");
    expect(digest).not.toContain("fetchBrandGoal");
    expect(digest).not.toContain("optimizationGoal");
  });

  it("badges each person with what THEY did, not one noun for the brand", () => {
    expect(digest).toContain("lead.outcomeNoun");
    expect(digest).toContain("leadOutcomeOnDay(lead, day)?.kind.singular");
  });

  it("headlines the email on the return and what moved it", () => {
    const at = templates.indexOf('name: "daily-outcome-digest"');
    expect(at).toBeGreaterThan(-1);
    // Measured: the template entry runs ~1900 chars from its name field.
    const tpl = templates.slice(at, at + 1900);
    expect(tpl).toContain("{{roiToday}}");
    expect(tpl).toContain("{{roiPrevious}}");
    expect(tpl).toContain("{{newOutcomes}}");
    expect(tpl).not.toContain("{{outcomeLabel}}");
    expect(tpl).not.toContain("{{outcomeCount}}");
  });
});

/**
 * The retired brand goal is read NOWHERE.
 *
 * `org_brands.optimization_goal` is `NOT NULL` with a server default, so it reads
 * "website purchases" for a brand that stated nothing — brand-service's own schema
 * comment says nothing reads it. Any surface that resolved it was naming an outcome
 * the brand may never have chosen.
 */
describe("no surface reads the retired brand goal", () => {
  const SRC_DIR = path.join(__dirname, "../src");

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it("finds zero readers of salesEconomics.optimizationGoal in the whole app", () => {
    const offenders = walk(SRC_DIR).filter((file) =>
      /salesEconomics\??\.optimizationGoal/.test(fs.readFileSync(file, "utf-8")),
    );
    expect(offenders.map((f) => path.relative(SRC_DIR, f))).toEqual([]);
  });

  it("derives a goal from a LEG, never a leg from a goal", () => {
    const steps = read("lib/goal-steps.ts");
    // Lossless direction: every leg lands on exactly one step.
    expect(steps).toContain("export function goalForLeg(");
    expect(steps).not.toContain("legForGoal");
  });

  it("lets a surface state no leg at all, instead of defaulting to one", () => {
    const steps = read("lib/goal-steps.ts");
    // Neither leg nor goal: the Outreach floor, which is true whatever a brand sells.
    expect(steps).toContain("if (leg) return legSteps(leg);");
    expect(steps).toContain("if (goal) return goalSteps(goal);");
    expect(steps).toContain("return [OUTREACH_STEP];");
  });
});
