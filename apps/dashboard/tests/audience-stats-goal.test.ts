import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { goalForOptimizationGoal } from "../src/lib/strategy-model";
import type { BrandOptimizationGoal } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Regression: a `positive_replies` brand saw TWO different costs-per-positive-reply on the
// same screen. Strategy sent `objective=positive_replies` (features resolves it to goal
// `positiveReply`) and got the workflow with the cheapest cost PER REPLY — Dawn, $61.73.
// Audiences + the Overview top-audiences card sent `goal=meetingBooked`, so features ranked
// on cost per BOOKED MEETING and returned Osprey (cheapest per CLICK, $2.22) — whose cost per
// reply is $183.85. Same brand, same moment, 3x apart, both "fleet benchmark".
//
// Cause: `goalForOptimizationGoal` still borrowed "the nearest family" (reply -> meetingBooked,
// visit -> signup) from before features-service shipped the native single-step goals. Its
// sibling `objectiveForOptimizationGoal` had already been migrated off the borrow; this one
// was left behind. features-service's canonical Goal enum carries `positiveReply` and
// `websiteVisit` and `audience-stats` serves both.

describe("goalForOptimizationGoal — the brand's goal reaches audience-stats unchanged", () => {
  it("asks for the reply goal on a positive_replies brand, never meetingBooked", () => {
    expect(goalForOptimizationGoal("positive_replies")).toBe("positiveReply");
  });

  it("asks for the visit goal on a website_visits brand, never signup", () => {
    expect(goalForOptimizationGoal("website_visits")).toBe("websiteVisit");
  });

  it("leaves every already-native goal untouched", () => {
    const expected: Record<BrandOptimizationGoal, string> = {
      signups: "signup",
      sales_meetings: "meetingBooked",
      website_visits: "websiteVisit",
      positive_replies: "positiveReply",
      form_submissions: "formSubmission",
      website_purchase: "websitePurchase",
      sales: "sales",
    };
    for (const [goal, want] of Object.entries(expected)) {
      expect(goalForOptimizationGoal(goal as BrandOptimizationGoal)).toBe(want);
    }
  });
});

describe("one mapping, no inline copies", () => {
  // Three surfaces used to inline their own ternary. Two of them were 2-branch only
  // (`isVisitDrivenGoal(g) ? "signup" : "meetingBooked"`), so a sales / form_submissions /
  // website_purchase brand already asked for the wrong goal there too.
  // The brand Overview is NOT in this list any more: its Top-audiences card names
  // neither a funnel nor a goal, which features-service v0.129.0 treats as the
  // brand-level read (every audience priced through the best-returning funnel the
  // brand declared, sorted on return). A brand runs several funnels at once, so there
  // is no goal to derive there — guarded in `brand-overview-roi-focus.test.ts`.
  // These two still resolve one, as the fallback for a campaign that predates the
  // funnel model and for the funnel-scoped cost columns.
  const sites = [
    "../src/components/campaigns/campaign-overview-page.tsx",
    "../src/components/audiences/customer-audiences-page.tsx",
  ];

  for (const rel of sites) {
    it(`${rel.split("/").pop()} derives the goal from the shared helper`, () => {
      const src = read(rel);
      expect(src).toContain("goalForOptimizationGoal(optimizationGoal)");
      expect(src).not.toMatch(/isVisitDrivenGoal\(optimizationGoal\)\s*\?\s*"signup"/);
    });
  }
});

describe("column + sort gates follow the goal FAMILY, not one literal", () => {
  it("the Audiences reply columns stay for a positiveReply brand", () => {
    // showMeetingCols === "meetingBooked" alone would HIDE the Positive replies + CPPR
    // columns the moment the goal stops being meetingBooked — on the very brand whose goal
    // IS positive replies.
    const src = read("../src/components/audiences/customer-audiences-page.tsx");
    const line = src.split("\n").find((l) => l.includes("const showMeetingCols"));
    expect(line).toBeDefined();
    expect(line).toContain("positiveReply");
  });

  // The brand Overview is NOT here: its Top-audiences card passes no `metric` at all.
  // The card ranks on the served return and its second line is the row's own cost per
  // paying client — goal-free, and the same figure the Audiences table's `$ CAC` shows.
  // A CAMPAIGN still picks a column, correctly: it sells one funnel.
  for (const rel of [
    "../src/components/campaigns/campaign-overview-page.tsx",
  ]) {
    it(`${rel.split("/").pop()} picks the card's column from the shared helper`, () => {
      const src = read(rel);
      const line = src.split("\n").find((l) => l.includes("const audienceStatsMetric"));
      expect(line).toBeDefined();
      expect(line).toContain("audienceRankMetric(optimizationGoal, trackerSetUp)");
      expect(line).not.toContain('=== "signup"');
    });
  }
});

describe("the wire schema accepts the two native goals", () => {
  it("api.ts declares them on the type and the zod union", () => {
    const src = read("../src/lib/api.ts");
    expect(src).toContain('| "positiveReply"');
    expect(src).toContain('| "websiteVisit"');
    expect(src).toContain('z.literal("positiveReply")');
    expect(src).toContain('z.literal("websiteVisit")');
  });
});
