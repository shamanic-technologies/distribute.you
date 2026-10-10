import { describe, expect, it } from "vitest";
import {
  acceptedChannels,
  channelSelectable,
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
      { slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", managed: true, salesPathEligible: true, operatedBy: "platform", shortDescription: "We find your buyers and email them for you." },
      { slug: "seo-content", name: "SEO Content", managed: false, salesPathEligible: false, operatedBy: "platform" },
      { slug: "meta-ads", name: "Meta Ads", managed: false, salesPathEligible: true, operatedBy: "platform" },
      { slug: "your-team-closing-calls", name: "Your team closing calls", managed: false, salesPathEligible: true, operatedBy: "customer" },
      { slug: "pr-cold-email-outreach", name: "PR" },
      { slug: "broken", salesPathEligible: true },
    ]);
    expect(list.map((c) => c.slug)).toEqual(["sales-cold-email-outreach", "meta-ads", "your-team-closing-calls"]);
    expect(list[2].customerOperated).toBe(true);
    expect(list[1].managed).toBe(false);
    expect(list[0].shortDescription).toBe("We find your buyers and email them for you.");
    expect(list[1].shortDescription).toBeNull();
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

describe("staff-activable channels", () => {
  it("LinkedIn Posting ticks only in staff mode; a managed channel always ticks; others never", () => {
    const li = { slug: "organic-linkedin-publishing", managed: false };
    expect(channelSelectable(li, false)).toBe(false);
    expect(channelSelectable(li, true)).toBe(true);
    expect(channelSelectable({ slug: "sales-cold-email-outreach", managed: true }, false)).toBe(true);
    expect(channelSelectable({ slug: "google-ads", managed: false }, true)).toBe(false);
  });

  it("the picker gates the card on the staff-aware rule", async () => {
    const { readFileSync } = await import("node:fs");
    const picker = readFileSync("src/components/v2/offer-channels-picker.tsx", "utf8");
    expect(picker).toContain("channelSelectable(c, staffMode)");
    expect(picker).toContain("contactUs={!selectable}");
  });

  it("the staff Sales path page writes no per-offer channel or ticked path any more (owner 2026-10-10)", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("src/components/v2/offer-sales-path-page.tsx", "utf8");
    for (const gone of ["saveOfferChannels", "saveOfferSelectedSalesPaths", "applyReactiveDefaults", "getOfferChannels", "getOfferSelectedSalesPaths"]) expect(page).not.toContain(gone);
  });
});
