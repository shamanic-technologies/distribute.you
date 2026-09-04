import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  legColumnPair,
  legPairIsAvailable,
  legRankMetric,
  type LegColumnPair,
} from "../src/lib/campaign-leg-columns";
import { campaignLegFor, funnelLegs } from "../src/lib/campaign-leg";
import { SALES_FUNNELS, salesFunnelByKey } from "../src/lib/sales-funnels";
import type { ChannelLeg } from "../src/lib/acquisition-channels";

const reply = salesFunnelByKey("reply_meeting");
const visitMeeting = salesFunnelByKey("visit_meeting");
const visitSignup = salesFunnelByKey("visit_signup");
const visitForm = salesFunnelByKey("visit_form");

/** The legs the deployed catalogue states for these channels, verbatim. */
const COLD_EMAIL: ChannelLeg[] = [
  { from: null, to: "conversation" },
  { from: null, to: "website_visit" },
];
const FOUNDER_LED_CLOSING: ChannelLeg[] = [{ from: "meeting_attended", to: "paid_client" }];
const IN_HOUSE_MEETING_BOOKING: ChannelLeg[] = [
  { from: "conversation", to: "meeting_booked" },
  { from: "website_visit", to: "meeting_booked" },
];

describe("legColumnPair — the columns a campaign's OWN arrow earns", () => {
  it("prices cold email on the visit-led form funnel by the VISIT it buys, not the form the customer fills", () => {
    // The reported bug: a `visit_form` campaign performing only the entry leg read
    // "Cost per form submission / Form submissions", an arrow it never runs.
    const leg = campaignLegFor(visitForm, COLD_EMAIL);
    expect(leg?.toKey).toBe("website_visit");
    expect(legColumnPair(leg)).toBe<LegColumnPair>("visit");
    expect(legRankMetric(leg)).toBe("cpc");
  });

  it("prices cold email on the reply funnel by the sales interest", () => {
    const leg = campaignLegFor(reply, COLD_EMAIL);
    expect(legColumnPair(leg)).toBe<LegColumnPair>("reply");
    expect(legRankMetric(leg)).toBe("cppr");
  });

  it("prices a closing team by the paid client it converts into", () => {
    const leg = campaignLegFor(reply, FOUNDER_LED_CLOSING);
    expect(leg?.toKey).toBe("paid_client");
    expect(legColumnPair(leg)).toBe<LegColumnPair>("sale");
    expect(legRankMetric(leg)).toBe("cpsale");
  });

  it("states NO pair for a meeting arrow — features-service serves no per-audience meeting price", () => {
    // Null rather than the arrow before it: lending a campaign a neighbouring arrow's
    // columns is exactly what this module exists to stop.
    const leg = campaignLegFor(reply, IN_HOUSE_MEETING_BOOKING);
    expect(leg?.toKey).toBe("meeting_booked");
    expect(legColumnPair(leg)).toBeNull();
    expect(legRankMetric(leg)).toBeNull();
  });

  it("answers null for a leg it could not place", () => {
    expect(legColumnPair(null)).toBeNull();
    expect(legColumnPair(undefined)).toBeNull();
    expect(legRankMetric(null)).toBeNull();
  });

  it("prices the signup and form arrows of the funnels that have them", () => {
    const signupLeg = funnelLegs(visitSignup).find((l) => l.toKey === "signup");
    expect(legColumnPair(signupLeg)).toBe<LegColumnPair>("signup");
    expect(legRankMetric(signupLeg)).toBe("cps");

    const formLeg = funnelLegs(visitForm).find((l) => l.toKey === "form_filled");
    expect(legColumnPair(formLeg)).toBe<LegColumnPair>("formSubmission");
    expect(legRankMetric(formLeg)).toBe("cpfs");
  });

  it("covers every arrow of every funnel — a step gains a pair or is deliberately absent", () => {
    // The catalogue is closed, so this walks it: a NEW step must decide which column
    // pair prices it (or state that it has none) rather than silently reading as null.
    const priced = new Map<string, LegColumnPair | null>();
    for (const funnel of SALES_FUNNELS) {
      for (const leg of funnelLegs(funnel)) priced.set(leg.toKey, legColumnPair(leg));
    }
    expect(Object.fromEntries(priced)).toEqual({
      conversation: "reply",
      website_visit: "visit",
      meeting_booked: null,
      meeting_attended: null,
      signup: "signup",
      form_filled: "formSubmission",
      paid_client: "sale",
    });
  });

  it("gives one arrow of visit_meeting a pair and leaves its two meeting arrows unpriced", () => {
    const pairs = funnelLegs(visitMeeting).map((l) => legColumnPair(l));
    expect(pairs).toEqual(["visit", null, null, "sale"]);
  });
});

describe("legPairIsAvailable — a pair that can actually carry a number", () => {
  it("needs no tracker for the two measured pairs", () => {
    expect(legPairIsAvailable("reply", false)).toBe(true);
    expect(legPairIsAvailable("visit", false)).toBe(true);
  });

  it("needs the brand's conversion tracker for the three attributed pairs", () => {
    for (const pair of ["signup", "formSubmission", "sale"] as const) {
      expect(legPairIsAvailable(pair, false)).toBe(false);
      expect(legPairIsAvailable(pair, true)).toBe(true);
    }
  });

  it("is false for a leg with no pair, so the caller keeps the funnel-wide gate", () => {
    expect(legPairIsAvailable(null, true)).toBe(false);
  });
});

describe("the module stays alias-free so these are real unit tests", () => {
  it("imports nothing at runtime", () => {
    const src = readFileSync(join(__dirname, "../src/lib/campaign-leg-columns.ts"), "utf8");
    const runtimeImports = src
      .split("\n")
      .filter((line) => line.startsWith("import ") && !line.startsWith("import type "));
    expect(runtimeImports).toEqual([]);
  });
});

describe("the two campaign-scoped surfaces read the leg, not the goal", () => {
  const audiences = readFileSync(
    join(__dirname, "../src/components/audiences/customer-audiences-page.tsx"),
    "utf8",
  );
  const overview = readFileSync(
    join(__dirname, "../src/components/campaigns/campaign-overview-page.tsx"),
    "utf8",
  );

  it("resolves the leg on the Audiences table with the fleet's own precedence", () => {
    // The CALL SITE, not only the lib: a page that never resolves a leg is the feature
    // entirely absent with the module perfectly correct.
    expect(audiences).toContain("statedCampaignLeg(campaignFunnel, campaign?.legKey, legIndex)");
    expect(audiences).toContain("campaignLegFor(campaignFunnel, channel?.legs)");
    expect(audiences).toContain("const legPair = campaignScoped ? legColumnPair(campaignLeg) : null;");
    expect(audiences).toContain("const legScoped = legPairIsAvailable(legPair, trackerSetUp);");
  });

  it("gates every column pair on the leg first and the funnel second", () => {
    for (const [gate, pair] of [
      ["showSignupCols", "signup"],
      ["showFormSubmissionCols", "formSubmission"],
      ["showSaleCols", "sale"],
      ["showReplyCols", "reply"],
      ["showVisitCols", "visit"],
    ] as const) {
      const at = audiences.indexOf(`const ${gate} = legScoped`);
      expect(at, `${gate} must lead with the leg gate`).toBeGreaterThan(-1);
      expect(audiences.slice(at, audiences.indexOf(";", at))).toContain(`legPair === "${pair}"`);
    }
  });

  it("leads the table's sort with the leg's own cost column", () => {
    expect(audiences).toContain("(legScoped ? legRankMetric(campaignLeg) : null) ??");
    expect(audiences).toContain("audienceRankMetric(optimizationGoal, trackerSetUp)");
  });

  it("leads the Top-3 audiences card with the same column the table does", () => {
    expect(overview).toContain("statedCampaignLeg(campaignFunnel, campaign?.legKey, legIndex)");
    expect(overview).toContain("campaignLegFor(campaignFunnel, channel?.legs)");
    expect(overview).toContain(
      "const audienceStatsMetric = legMetric ?? audienceRankMetric(optimizationGoal, trackerSetUp);",
    );
  });
});
