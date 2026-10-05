import { describe, expect, it } from "vitest";
import { campaignsOfPaths, campaignTag, sortCampaigns, type OfferCampaign } from "../src/lib/offer-campaigns";

const step = (label: string, key: string) => ({ key, label });
const coldEmail = { slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", managed: true, operatedBy: "platform", campaignName: "Jubilation" };
const booking = { slug: "ai-meeting-booking", name: "AI Meeting Booking", managed: true, operatedBy: "platform", campaignName: "Prism" };
const team = { slug: "your-team-closing-calls", name: "Your Team Closing Calls", managed: false, operatedBy: "customer", campaignName: "Rise" };

describe("offer campaigns", () => {
  it("lists each channel x leg once, in path order, without the customer's team", () => {
    const list = campaignsOfPaths([
      {
        legs: [
          { legKey: "start_to_conversation", workedBy: "platform", reactive: false, fromStep: null, toStep: step("Positive reply", "conversation"), channel: coldEmail },
          { legKey: "conversation_to_meeting_booked", workedBy: "platform", reactive: true, fromStep: step("Positive reply", "conversation"), toStep: step("Meeting booked", "meeting_booked"), channel: booking },
          { legKey: "meeting_attended_to_paid_client", workedBy: "human", reactive: true, fromStep: step("Meeting attended", "meeting_attended"), toStep: step("Paid client", "paid_client"), channel: team },
        ],
      },
      { legs: [{ legKey: "start_to_conversation", workedBy: "platform", reactive: false, fromStep: null, toStep: step("Positive reply", "conversation"), channel: coldEmail }] },
    ]);
    expect(list.map((c) => [c.name, c.reactive])).toEqual([
      ["Jubilation", false],
      ["Prism", true],
    ]);
  });
  it("tags a campaign by when it works", () => {
    expect(campaignTag({ reactive: false, fromKey: null, fromLabel: null })).toBe("Daily Proactive");
    expect(campaignTag({ reactive: true, fromKey: "conversation", fromLabel: "Positive reply" })).toBe("Reactive on positive replies");
  });
  it("sorts on first, then proactive, then ROI high to low, unmeasured last", () => {
    const c = (name: string, reactive: boolean, roi: number | null): OfferCampaign => ({
      featureSlug: name, legKey: "l", name, channelName: name, managed: true, reactive, fromKey: null, fromLabel: null, toLabel: "x", roi, roiUnavailable: null,
    });
    const list = [c("offLow", false, 0.5), c("onReactive", true, 9), c("onProactive", false, 1), c("offNull", false, null), c("offHigh", false, 3)];
    const on = new Set(["onReactive", "onProactive"]);
    expect(sortCampaigns(list, (x) => on.has(x.featureSlug)).map((x) => x.name)).toEqual(["onProactive", "onReactive", "offHigh", "offLow", "offNull"]);
  });
});
