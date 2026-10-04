import { describe, expect, it } from "vitest";
import {
  budgetRefusalCopy,
  campaignsOfPaths,
  campaignsQuery,
  OfferCampaignBudgetsSchema,
  parseBudgetText,
} from "../src/lib/offer-campaign-budgets";

const step = (label: string) => ({ label });
const coldEmail = { slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", managed: true, operatedBy: "platform", campaignName: "Jubilation" };
const booking = { slug: "ai-meeting-booking", name: "AI Meeting Booking", managed: true, operatedBy: "platform", campaignName: "Prism" };
const team = { slug: "your-team-closing-calls", name: "Your Team Closing Calls", managed: false, operatedBy: "customer", campaignName: "Rise" };

describe("offer campaigns", () => {
  it("lists each channel x leg once, in path order, without the customer's team", () => {
    const list = campaignsOfPaths([
      {
        legs: [
          { legKey: "start_to_conversation", workedBy: "platform", reactive: false, fromStep: null, toStep: step("Positive reply"), channel: coldEmail },
          { legKey: "conversation_to_meeting_booked", workedBy: "platform", reactive: true, fromStep: step("Positive reply"), toStep: step("Meeting booked"), channel: booking },
          { legKey: "meeting_attended_to_paid_client", workedBy: "human", reactive: true, fromStep: step("Meeting attended"), toStep: step("Paid client"), channel: team },
        ],
      },
      {
        legs: [{ legKey: "start_to_conversation", workedBy: "platform", reactive: false, fromStep: null, toStep: step("Positive reply"), channel: coldEmail }],
      },
    ]);
    expect(list.map((c) => [c.name, c.reactive])).toEqual([
      ["Jubilation", false],
      ["Prism", true],
    ]);
    expect(campaignsQuery(list)).toBe("sales-cold-email-outreach:start_to_conversation,ai-meeting-booking:conversation_to_meeting_booked");
  });
  it("reads a typed amount as billing takes it", () => {
    expect(parseBudgetText("$1,500", "month")).toBe(150000);
    expect(parseBudgetText("99.5", "month")).toBeNull();
    expect(parseBudgetText("3.50", "day")).toBe(350);
    expect(parseBudgetText("0", "day")).toBeNull();
  });
  it("words each refusal from its code and details, never the raw message", () => {
    const usd = (c: number) => `$${(c / 100).toFixed(0)}`;
    expect(budgetRefusalCopy({ code: "below_minimum", minimumCents: 9900, period: "month" }, usd)).toBe("This campaign needs at least $99 a month.");
    expect(budgetRefusalCopy({ code: "reactive_above_cap", capCents: 5000 }, usd)).toContain("At most $50");
    expect(budgetRefusalCopy({ code: "brand_new", error: "raw text" }, usd)).toBe("Could not save this budget. Try again.");
  });
  it("parses billing's view, with a not-set row", () => {
    const v = OfferCampaignBudgetsSchema.parse({
      orgId: "o",
      brandId: "b",
      offerId: "f",
      period: "month",
      items: [
        { featureSlug: "s", legKey: "l", role: "proactive", period: "month", budgetCents: null, managed: true, minimumCents: 9900, capCents: null, budgetable: true, updatedAt: null },
      ],
      plan: null,
      pricing: null,
    });
    expect(v.items[0].budgetCents).toBeNull();
    const daily = OfferCampaignBudgetsSchema.parse({ ...v, period: "day", items: [{ ...v.items[0], period: "day", budgetCents: 330.0000001 }] });
    expect(daily.items[0].budgetCents).toBeCloseTo(330);
  });
});
