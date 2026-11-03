import { describe, expect, it } from "vitest";
import { campaignsOfOffer, campaignTag, sortCampaigns, type OfferCampaign } from "../src/lib/offer-campaigns";
import { SERVED_STEPS } from "./fixtures/served-steps";

const step = (label: string, key: string) => ({ key, label });

describe("offer campaigns", () => {
  it("keeps the served campaigns a ticked path uses, run by a channel, with step labels from the paths", () => {
    const served = (o: Partial<Parameters<typeof campaignsOfOffer>[0][number]>) => ({
      channelSlug: "sales-cold-email-outreach", channelName: "Sales Cold Email Outreach", legKey: "start_to_conversation", campaignName: "Jubilation",
      reactive: false, managed: true, operatedBy: "platform", selectedPathCount: 1, ...o,
    });
    const paths = [
      {
        legs: [
          { legKey: "start_to_conversation", fromStep: null, toStep: step("Positive reply", "conversation") },
          { legKey: "conversation_to_meeting_booked", fromStep: step("Positive reply", "conversation"), toStep: step("Meeting booked", "meeting_booked") },
        ],
      },
    ];
    const list = campaignsOfOffer(
      [
        served({}),
        served({ channelSlug: "ai-meeting-booking", channelName: "AI Meeting Booking", legKey: "conversation_to_meeting_booked", campaignName: "Prism", reactive: true }),
        served({ legKey: "start_to_website_visit", campaignName: "Lumen", selectedPathCount: 0 }),
        served({ channelSlug: "your-team-closing-calls", operatedBy: "customer", campaignName: "Rise" }),
      ],
      paths,
    );
    expect(list.map((c) => [c.name, c.reactive, c.fromLabel, c.toLabel])).toEqual([
      ["Jubilation", false, null, "Positive reply"],
      ["Prism", true, "Positive reply", "Meeting booked"],
    ]);
  });
  it("tags a campaign by when it works", () => {
    expect(campaignTag({ reactive: false, fromKey: null, fromLabel: null }, SERVED_STEPS)).toBe("Daily Proactive");
    expect(campaignTag({ reactive: true, fromKey: "conversation", fromLabel: "Positive reply" }, SERVED_STEPS)).toBe("Reactive on positive replies");
  });
  it("sorts on first, then proactive, else keeps the served order", () => {
    const c = (name: string, reactive: boolean): OfferCampaign => ({
      kind: "outreach", featureSlug: name, legKey: "l", name, channelName: name, managed: true, reactive, fromKey: null, fromLabel: null, fedByLabel: null, toLabel: "x", providerDomain: null,
    });
    const list = [c("offLow", false), c("onReactive", true), c("onProactive", false), c("offNull", false), c("offHigh", false)];
    const on = new Set(["onReactive", "onProactive"]);
    expect(sortCampaigns(list, (x) => on.has(x.featureSlug)).map((x) => x.name)).toEqual(["onProactive", "onReactive", "offLow", "offNull", "offHigh"]);
  });
});
