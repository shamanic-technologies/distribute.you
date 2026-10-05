import { describe, expect, it } from "vitest";
import {
  acceptedChannels,
  OfferChannelsSchema,
  parseOrThrow,
  salesPathChannels,
  selectedPathKeys,
  toggleChannel,
  togglePath,
} from "../src/lib/offer-active-sales-paths";

const WE_RUN = ["sales-cold-email-outreach", "ai-meeting-booking", "ai-instant-call"];

describe("offer channels", () => {
  it("never stated reads as the channels we run, stated empty reads as none", () => {
    const never = parseOrThrow(OfferChannelsSchema, { offerId: "o1", stated: false, channelSlugs: null, statedAt: null, statedByUserId: null }, "t");
    expect([...acceptedChannels(never, WE_RUN)]).toEqual(WE_RUN);
    const empty = parseOrThrow(OfferChannelsSchema, { offerId: "o1", stated: true, channelSlugs: [], statedAt: "x", statedByUserId: "u" }, "t");
    expect(acceptedChannels(empty, WE_RUN).size).toBe(0);
  });
  it("lists only the eligible channels, in served order, and skips one served without its flags", () => {
    const list = salesPathChannels([
      { slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", managed: true, salesPathEligible: true, operatedBy: "platform" },
      { slug: "seo-content", name: "SEO Content", managed: false, salesPathEligible: false, operatedBy: "platform" },
      { slug: "meta-ads", name: "Meta Ads", managed: false, salesPathEligible: true, operatedBy: "platform" },
      { slug: "your-team-closing-calls", name: "Your team closing calls", managed: false, salesPathEligible: true, operatedBy: "customer" },
      { slug: "pr-cold-email-outreach", name: "PR" },
      { slug: "broken", salesPathEligible: true },
    ]);
    expect(list.map((c) => c.slug)).toEqual(["sales-cold-email-outreach", "meta-ads", "your-team-closing-calls"]);
    expect(list[2].customerOperated).toBe(true);
    expect(list[1].managed).toBe(false);
  });
  it("a tick sends the full list back", () => {
    expect(toggleChannel(new Set(["a", "b"]), "c", true)).toEqual(["a", "b", "c"]);
    expect(toggleChannel(new Set(["a", "b"]), "a", false)).toEqual(["b"]);
  });
});

describe("ticked sales paths", () => {
  const paths = [
    { combinationKey: "a", roi: 2.7 },
    { combinationKey: "b", roi: 1 },
    { combinationKey: "c", roi: 0.5 },
    { combinationKey: "d", roi: null },
  ];
  it("never stated ticks every path above 1x", () => {
    expect([...selectedPathKeys({ offerId: "o", stated: false, combinationKeys: null, statedAt: null }, paths)]).toEqual(["a"]);
  });
  it("stated wins, even empty", () => {
    expect([...selectedPathKeys({ offerId: "o", stated: true, combinationKeys: ["c"], statedAt: "x" }, paths)]).toEqual(["c"]);
    expect(selectedPathKeys({ offerId: "o", stated: true, combinationKeys: [], statedAt: "x" }, paths).size).toBe(0);
  });
  it("a tick sends the full list back", () => {
    expect(togglePath(new Set(["a"]), "c", true)).toEqual(["a", "c"]);
    expect(togglePath(new Set(["a", "c"]), "a", false)).toEqual(["c"]);
  });
});
