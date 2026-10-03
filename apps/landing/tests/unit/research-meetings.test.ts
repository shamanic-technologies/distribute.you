import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { meetingStudies } from "../../scripts/blog-data/meetings.mjs";

const maturity = [
  { legKey: "conversation_to_meeting_booked", durationDays: 0, outcomesRequired: 10 },
  { legKey: "start_to_meeting_booked", durationDays: 0, outcomesRequired: 10 },
];
const window = { from: "2026-04-15", to: "2026-10-03" };
const campaigns = [
  { campaign_id: "cold-a", feature_slug: "sales-cold-email-outreach", leg_key: "start_to_conversation" },
  { campaign_id: "meet-a", feature_slug: "ai-meeting-booking", leg_key: "conversation_to_meeting_booked" },
  { campaign_id: "cold-b", feature_slug: "sales-cold-email-outreach", leg_key: "start_to_conversation" },
];
const spend = [
  { campaign_id: "cold-a", brand_id: "A", feature_slug: "sales-cold-email-outreach", day: "2026-05-02", cents: "50000" },
  { campaign_id: "cold-a", brand_id: "A", feature_slug: "sales-cold-email-outreach", day: "2026-09-02", cents: "40000" },
  // a meeting-booking row with no feature_slug is filed by its campaign
  { campaign_id: "meet-a", brand_id: "A", feature_slug: "", day: "2026-09-20", cents: "1000" },
  // brand B reports no meetings: its spend stays out of the outcome price
  { campaign_id: "cold-b", brand_id: "B", feature_slug: "sales-cold-email-outreach", day: "2026-09-02", cents: "999999" },
  // the read's month, nothing charged yet: drawn as in progress
  { campaign_id: "cold-a", brand_id: "A", feature_slug: "sales-cold-email-outreach", day: "2026-10-01", cents: "0" },
  // before the window
  { campaign_id: "cold-a", brand_id: "A", feature_slug: "sales-cold-email-outreach", day: "2026-04-01", cents: "777777" },
];
const meetings = [
  { conversion_id: "m1", brand_id: "A", received_at: "2026-05-20 10:00:00.000", caused_by_outreach: "true", matched_lead_id: "L1", source: "crm" },
  { conversion_id: "m2", brand_id: "A", received_at: "2026-09-25 10:00:00.000", caused_by_outreach: "true", matched_lead_id: "L2", source: "crm" },
  // booked BEFORE the leg acted on L3: the outcome counts it, the leg does not
  { conversion_id: "m3", brand_id: "A", received_at: "2026-09-21 10:00:00.000", caused_by_outreach: "true", matched_lead_id: "L3", source: "crm" },
  // not ours: booked before the first email
  { conversion_id: "m4", brand_id: "A", received_at: "2026-06-01 10:00:00.000", caused_by_outreach: "false", matched_lead_id: "L4", source: "crm" },
];
const acted = [
  { lead_id: "L2", brand_id: "A", acting_campaign_id: "meet-a", acted_at: "2026-09-22 08:00:00.000" },
  { lead_id: "L3", brand_id: "A", acting_campaign_id: "meet-a", acted_at: "2026-09-22 09:00:00.000" },
];
const input = { meetings, acted, campaigns, spend, maturity, window, costBasis: "user" };

describe("meeting studies", () => {
  it("prices the positive reply to meeting leg on its own spend and the meetings booked after it acted", () => {
    const { studies } = meetingStudies(input);
    const leg = studies.find((s: { id: string }) => s.id === "pilot-cost");
    expect(leg.crew).toBe("pilot");
    expect(leg.result.display).toBe("$10");
    expect(leg.result.sample).toBe("1 meeting · $10 spent · 2 people acted on");
    expect(leg.charts[0].points[0].thin).toBe(true);
    expect(leg.verdict.kind).toBe("noise");
  });

  it("prices the Meeting booked outcome across every leg, on the brands that report meetings only", () => {
    const { studies, outcomes } = meetingStudies(input);
    const all = studies.find((s: { id: string }) => s.id === "meeting-cost");
    expect(all.crew).toBeNull();
    expect(all.outcome).toBe("meeting");
    // A: $500 + $400 + $10 over 3 credited meetings; B and the pre-window row stay out
    expect(all.result.display).toBe("$303");
    expect(all.result.sample).toBe("3 meetings · $910 spent · 1 brand");
    expect(outcomes[0].population).toContain("the 1 brand that reports its booked meetings");
    const cumulative = all.charts[0].cumulative.points;
    expect(cumulative.at(-1).display).toBe("$303");
    // the read's month is in progress, drawn dotted
    expect(cumulative.at(-1).partial).toBe(true);
    expect(all.verdict.kind).toBe("noise");
  });

  it("refuses a leg features-service states no rule for", () => {
    expect(() => meetingStudies({ ...input, maturity: [] })).toThrow(/no rule for leg/);
  });

  it("states the vendor-cost basis is not measured instead of pricing at what clients paid", () => {
    const { studies } = meetingStudies({ ...input, costBasis: "actual" });
    for (const s of studies) {
      expect(s.status).toBe("not_enough_data");
      expect(s.result).toBeNull();
    }
  });
});
