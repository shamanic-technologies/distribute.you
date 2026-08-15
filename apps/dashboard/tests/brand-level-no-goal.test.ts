import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { leadTabsForFunnels } from "../src/lib/goal-steps";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * At brand level there is no goal.
 *
 * The brand goal is a RETIRED brand-service column — `NOT NULL` with a server default,
 * so it reads "website purchases" for a brand that stated nothing — and it cannot tell
 * the two meeting funnels apart either, since both echo `meetingBooked`. What a brand
 * actually sells through is the funnels its live campaigns run, and what it is judged
 * on is the return.
 */
describe("Leads tabs come from the active campaigns' funnels", () => {
  it("unions the funnels, most advanced first, with Outreach always last", () => {
    const both = leadTabsForFunnels(["reply_meeting", "visit_signup"]);
    expect(both.engagement).toEqual(["positive-replies", "clicks", "outreach"]);
    // Each funnel contributes the outcome its own chain terminates in — a booked
    // meeting for reply_meeting, a signup for visit_signup — most advanced first.
    expect(both.outcomes).toEqual(["meetings", "signups"]);
  });

  it("gives a brand with no live campaign the one tab that is always true", () => {
    // Every lead we contacted is in Outreach whatever the funnel, so this is the
    // honest floor rather than an empty page.
    expect(leadTabsForFunnels([])).toEqual({ engagement: ["outreach"], outcomes: [] });
  });

  it("dedupes two funnels that share a step", () => {
    const meetings = leadTabsForFunnels(["visit_meeting", "visit_signup"]);
    expect(meetings.engagement).toEqual(["clicks", "outreach"]);
    expect(meetings.outcomes).toEqual(["meetings", "signups"]);
  });

  it("orders the union the same way whichever order the funnels arrive in", () => {
    // A page whose tab order depended on which campaign was created first would look
    // different to two brands running the same funnels.
    expect(leadTabsForFunnels(["visit_signup", "reply_meeting"])).toEqual(
      leadTabsForFunnels(["reply_meeting", "visit_signup"]),
    );
  });

  it("reads the live campaigns, and no goal, on the Leads page", () => {
    const page = read("components/audiences/engaged-leads-page.tsx");
    expect(page).toContain("useCampaignRows(brandId, featureSlug)");
    expect(page).toContain("leadTabsForFunnels(activeFunnelKeys)");
    // The retired goal is gone from this surface entirely.
    expect(page).not.toContain("optimizationGoal");
    expect(page).not.toContain("leadTabsFor(goal");
    expect(page).not.toContain("getBrandSalesEconomics");
  });
});

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
 * comment says nothing reads it. Any surface that resolved it was naming a chain the
 * brand may never have declared.
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

  it("derives a goal from a FUNNEL, never a funnel from a goal", () => {
    const funnels = read("lib/sales-funnels.ts");
    // Lossless direction: every funnel terminates in exactly one outcome. The reverse
    // is lossy — `sales_meetings` covers both meeting chains — and stays banned.
    expect(funnels).toContain("export function goalForFunnelKey(");
    expect(read("lib/campaign-funnel.ts")).not.toContain("primaryFunnelForGoal");
  });

  it("lets a surface state no chain at all, instead of defaulting to one", () => {
    const steps = read("lib/goal-steps.ts");
    // Neither funnel nor goal → the Outreach floor, which is true whatever a brand sells.
    expect(steps).toContain("if (funnelKey) return funnelSteps(funnelKey);");
    expect(steps).toContain("if (goal) return goalSteps(goal);");
    expect(steps).toContain("return [OUTREACH_STEP];");
  });
});
