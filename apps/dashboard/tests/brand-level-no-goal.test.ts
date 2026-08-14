import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { funnelLeadTabs } from "../src/lib/funnel-lead-tabs";

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
    const both = funnelLeadTabs(["reply_meeting", "visit_signup"]);
    expect(both.engagement).toEqual(["positive-replies", "clicks", "outreach"]);
    // reply_meeting terminates in a booked meeting, visit_signup in a signup then a
    // sale — so all three belong, most advanced first.
    expect(both.outcomes).toEqual(["sales", "meetings", "signups"]);
  });

  it("gives a brand with no live campaign the one tab that is always true", () => {
    // Every lead we contacted is in Outreach whatever the funnel, so this is the
    // honest floor rather than an empty page.
    expect(funnelLeadTabs([])).toEqual({ engagement: ["outreach"], outcomes: [] });
  });

  it("dedupes two funnels that share a step", () => {
    const meetings = funnelLeadTabs(["visit_meeting", "visit_signup"]);
    expect(meetings.engagement).toEqual(["clicks", "outreach"]);
    expect(meetings.outcomes).toEqual(["sales", "meetings", "signups"]);
  });

  it("orders the union the same way whichever order the funnels arrive in", () => {
    // A page whose tab order depended on which campaign was created first would look
    // different to two brands running the same funnels.
    expect(funnelLeadTabs(["visit_signup", "reply_meeting"])).toEqual(
      funnelLeadTabs(["reply_meeting", "visit_signup"]),
    );
  });

  it("reads the live campaigns, and no goal, on the Leads page", () => {
    const page = read("components/audiences/engaged-leads-page.tsx");
    expect(page).toContain("useCampaignRows(brandId, featureSlug)");
    expect(page).toContain("funnelLeadTabs(activeFunnelKeys)");
    // The retired goal is gone from this surface entirely.
    expect(page).not.toContain("optimizationGoal");
    expect(page).not.toContain("goalLeadTabs");
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
