import { describe, expect, it } from "vitest";
import { campaignsOfOffer, campaignTag, sortCampaigns, type OfferCampaign } from "../src/lib/offer-campaigns";

const step = (label: string, key: string) => ({ key, label });

describe("offer campaigns", () => {
  it("keeps the served campaigns a ticked path uses, run by a channel, with step labels from the paths", () => {
    const served = (o: Partial<Parameters<typeof campaignsOfOffer>[0][number]>) => ({
      channelSlug: "sales-cold-email-outreach", channelName: "Sales Cold Email Outreach", legKey: "start_to_conversation", campaignName: "Jubilation",
      reactive: false, managed: true, operatedBy: "platform", selectedPathCount: 1, roi: 2.48, roiUnavailableReason: null, ...o,
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
        served({ legKey: "start_to_website_visit", campaignName: "Lumen", selectedPathCount: 0, roi: null, roiUnavailableReason: "not_on_a_selected_path" }),
        served({ channelSlug: "your-team-closing-calls", operatedBy: "customer", campaignName: "Rise" }),
      ],
      paths,
      (r) => r,
    );
    expect(list.map((c) => [c.name, c.reactive, c.fromLabel, c.toLabel, c.roi])).toEqual([
      ["Jubilation", false, null, "Positive reply", 2.48],
      ["Prism", true, "Positive reply", "Meeting booked", 2.48],
    ]);
  });
  it("tags a campaign by when it works", () => {
    expect(campaignTag({ reactive: false, fromKey: null, fromLabel: null })).toBe("Daily Proactive");
    expect(campaignTag({ reactive: true, fromKey: "conversation", fromLabel: "Positive reply" })).toBe("Reactive on positive replies");
  });
  it("sorts on first, then proactive, then ROI high to low, unmeasured last", () => {
    const c = (name: string, reactive: boolean, roi: number | null): OfferCampaign => ({
      kind: "outreach", featureSlug: name, legKey: "l", name, channelName: name, managed: true, reactive, fromKey: null, fromLabel: null, fedByLabel: null, toLabel: "x", roi, roiUnavailable: null, providerDomain: null,
    });
    const list = [c("offLow", false, 0.5), c("onReactive", true, 9), c("onProactive", false, 1), c("offNull", false, null), c("offHigh", false, 3)];
    const on = new Set(["onReactive", "onProactive"]);
    expect(sortCampaigns(list, (x) => on.has(x.featureSlug)).map((x) => x.name)).toEqual(["onProactive", "onReactive", "offHigh", "offLow", "offNull"]);
  });
});
