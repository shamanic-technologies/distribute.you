import { describe, expect, it } from "vitest";
import {
  acceptedChannels,
  ActivateSalesPathResponseSchema,
  entryHolder,
  OfferActiveSalesPathsSchema,
  OfferChannelsSchema,
  parseOrThrow,
  salesPathChannels,
  takenEntryHolder,
  toggleChannel,
} from "../src/lib/offer-active-sales-paths";

const row = (combinationKey: string, entryChannelSlug: string, entryLegKey: string) => ({
  id: `id-${combinationKey}`,
  offerId: "o1",
  combinationKey,
  entryChannelSlug,
  entryLegKey,
  status: "active",
  activatedAt: "2026-10-04T00:00:00Z",
  activatedByUserId: "u1",
  endedAt: null,
  endedByUserId: null,
  replacedById: null,
});

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

describe("active sales paths", () => {
  const list = parseOrThrow(
    OfferActiveSalesPathsSchema,
    { offerId: "o1", activeSalesPaths: [row("victory", "sales-cold-email-outreach", "start_to_conversation")] },
    "t",
  );
  it("finds the active path holding the same entry, never the path itself", () => {
    const zenith = { combinationKey: "zenith", entryChannelSlug: "sales-cold-email-outreach", entryLegKey: "start_to_conversation" };
    expect(entryHolder(zenith, list.activeSalesPaths)?.combinationKey).toBe("victory");
    expect(entryHolder({ ...zenith, combinationKey: "victory" }, list.activeSalesPaths)).toBeNull();
    expect(entryHolder({ ...zenith, entryLegKey: "start_to_website_visit" }, list.activeSalesPaths)).toBeNull();
    expect(entryHolder({ ...zenith, entryChannelSlug: null }, list.activeSalesPaths)).toBeNull();
  });
  it("reads the holder off a 409 SALES_PATH_ENTRY_TAKEN, and nothing off any other error", () => {
    const holder = row("victory", "sales-cold-email-outreach", "start_to_conversation");
    expect(takenEntryHolder({ status: 409, body: { code: "SALES_PATH_ENTRY_TAKEN", activeSalesPath: holder } })?.combinationKey).toBe("victory");
    expect(takenEntryHolder({ status: 409, body: { code: "SALES_PATH_ENTRY_MISMATCH" } })).toBeNull();
    expect(takenEntryHolder({ status: 500, body: {} })).toBeNull();
    expect(takenEntryHolder(new Error("x"))).toBeNull();
  });
  it("parses an activation answer with or without a replaced path", () => {
    const a = parseOrThrow(
      ActivateSalesPathResponseSchema,
      { activated: true, activeSalesPath: row("zenith", "sales-cold-email-outreach", "start_to_conversation"), replaced: row("victory", "sales-cold-email-outreach", "start_to_conversation") },
      "t",
    );
    expect(a.replaced?.combinationKey).toBe("victory");
    expect(() => parseOrThrow(ActivateSalesPathResponseSchema, { activated: true }, "t")).toThrow();
  });
});
