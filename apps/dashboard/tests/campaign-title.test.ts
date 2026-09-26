import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  campaignTitleParts,
  channelSlugLabel,
  type CampaignTitleRow,
} from "../src/lib/campaign-title";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";
import { legCatalogueFromWire } from "../src/lib/legs";

/** The channels the environment publishes, as the catalogue builds them. */
const CHANNELS = acquisitionChannelsFromFeatures([
  {
    slug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    description: "We email your buyers from our own domains, on your behalf.",
    displayOrder: 1,
    acquisitionChannel: { operatedBy: "platform", stepTransitions: [{ from: null, to: "conversation" }] },
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Buy the searches your buyers already run.",
    displayOrder: 20,
    acquisitionChannel: { operatedBy: "platform", stepTransitions: [{ from: null, to: "website_visit" }] },
  },
]);

/** The leg catalogue, built from a published body. */
const CATALOGUE = legCatalogueFromWire({
  steps: [
    { key: "conversation", label: "Positive reply" },
    { key: "meeting_booked", label: "Meeting booked" },
  ],
  legs: [
    { legKey: "start_to_conversation", fromStep: null, toStep: { key: "conversation" } },
    {
      legKey: "conversation_to_meeting_booked",
      fromStep: { key: "conversation" },
      toStep: { key: "meeting_booked" },
    },
  ],
});

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

/**
 * A campaign was named by campaign-service's stored `name`, written when the
 * campaign was provisioned. That name says nothing about the LEG the campaign buys
 * nor the channel it buys through, the two facts that distinguish one campaign from
 * another under the same offer. The title is composed from those two instead.
 */
const row = (over: Partial<CampaignTitleRow> = {}): CampaignTitleRow => ({
  id: "c1",
  name: "Stored name from provisioning",
  legKey: "start_to_conversation",
  featureSlug: "sales-cold-email-outreach",
  ...over,
});

describe("campaignTitleParts", () => {
  it("names the leg it buys and the channel it buys through", () => {
    const parts = campaignTitleParts(row(), CHANNELS, CATALOGUE);
    expect(parts.leg?.legKey).toBe("start_to_conversation");
    expect(parts.channel?.featureSlug).toBe("sales-cold-email-outreach");
    expect(parts.label).toBe("Positive reply · Sales Cold Email Outreach");
  });

  it("names an internal leg by the two steps it connects", () => {
    const parts = campaignTitleParts(
      row({ legKey: "conversation_to_meeting_booked" }),
      CHANNELS,
      CATALOGUE,
    );
    expect(parts.legLabel).toBe("Positive reply → Meeting booked");
  });

  it("never reads the stored name while either half resolves", () => {
    // Leg only: a campaign stating no channel still says what it buys.
    expect(campaignTitleParts(row({ featureSlug: null }), CHANNELS, CATALOGUE).label).toBe(
      "Positive reply",
    );
    // Channel only: a campaign stating no leg still says how.
    expect(campaignTitleParts(row({ legKey: null }), CHANNELS, CATALOGUE).label).toBe(
      "Sales Cold Email Outreach",
    );
  });

  it("keeps the stored name when NEITHER half resolves", () => {
    // Nothing composed can be said, so the campaign keeps the name it was given
    // rather than rendering a dash where its identity should be.
    const parts = campaignTitleParts(row({ legKey: null, featureSlug: null }), CHANNELS, CATALOGUE);
    expect(parts.label).toBe("Stored name from provisioning");
    expect(parts.leg).toBeNull();
    expect(parts.channel).toBeNull();
  });

  it("looks a leg up, never parses its key, so an unknown key names nothing", () => {
    const parts = campaignTitleParts(row({ legKey: "some_future_leg" }), CHANNELS, CATALOGUE);
    expect(parts.leg).toBeNull();
    expect(parts.legLabel).toBeNull();
    expect(parts.label).toBe("Sales Cold Email Outreach");
  });

  it("prettifies a feature slug the channel catalogue does not carry", () => {
    const parts = campaignTitleParts(row({ featureSlug: "some-future-channel" }), CHANNELS, CATALOGUE);
    expect(parts.channel).toBeNull();
    expect(parts.channelLabel).toBe("Some Future Channel");
    expect(parts.label).toBe("Positive reply · Some Future Channel");
  });

  it("channelSlugLabel says nothing for a campaign stating no channel", () => {
    expect(channelSlugLabel(null)).toBe("—");
  });

  it("exports no goal-derived vocabulary at all", async () => {
    const mod = await import("../src/lib/campaign-title");
    expect("GOAL_SHORT" in mod).toBe(false);
  });
});

describe("the surfaces that name a campaign", () => {
  const overview = read("components/campaigns/campaign-overview-page.tsx");
  const context = read("components/header-page-context.tsx");
  const title = read("components/campaigns/campaign-title.tsx");
  const identity = read("components/campaigns/campaign-identity.tsx");
  const table = read("components/campaigns/campaigns-page.tsx");

  it("renders the shared identity rather than a second copy of it", () => {
    // The bar states the SAME identity the Campaigns table and the budget modal
    // state — same order, same words, same "Via". Only the stacking differs, so
    // the layout lives in one module and this is a window onto it. A second copy
    // is how a campaign comes to read one way in a row and another way in the
    // bar above it.
    expect(title).toContain("<CampaignIdentityInline");
    expect(title).not.toContain("<SalesFunnelMark");
    expect(title).not.toContain("<AcquisitionChannelMark");
    expect(title).not.toContain("FUNNEL_ICONS");
    expect(title).not.toContain("OWN_CHANNEL_ICONS");
  });

  it("pairs each mark with its OWN name, never both marks then both names", () => {
    // Each half renders its mark immediately before its own label, so the leg tile
    // and the channel logo are never bunched into one two-logo emblem.
    const inline = identity.slice(identity.indexOf("export function CampaignIdentityInline("));
    const legHalf = inline.indexOf("<LegMark");
    const legWord = inline.indexOf(`<span className="truncate">{leg.label}</span>`);
    const channelHalf = inline.indexOf("<AcquisitionChannelMark");
    const channelWord = inline.indexOf("{channel.label}");
    expect(legHalf).toBeGreaterThan(-1);
    expect(channelHalf).toBeGreaterThan(-1);
    // leg mark -> leg name -> channel mark -> channel name.
    expect(legHalf).toBeLessThan(legWord);
    expect(legWord).toBeLessThan(channelHalf);
    expect(channelHalf).toBeLessThan(channelWord);
    // The stored name is the LAST resort (neither half resolved), never the
    // composed rendering — reading it beside the marks is what bunched them.
    expect(inline).toContain("fallbackLabel");
  });

  it("says the same two halves in the same order at both layouts", () => {
    // Stacked in a row, inline in the bar. What must NOT differ is the
    // vocabulary: the leg leads because it is what the campaign buys, the
    // channel follows behind "Via" because it is where it buys it.
    const stacked = identity.slice(
      identity.indexOf("export function CampaignIdentity("),
      identity.indexOf("export function CampaignIdentityInline("),
    );
    const inline = identity.slice(identity.indexOf("export function CampaignIdentityInline("));
    for (const half of [stacked, inline]) {
      expect(half.indexOf("<LegMark")).toBeGreaterThan(-1);
      expect(half.indexOf("<LegMark")).toBeLessThan(half.indexOf("<AcquisitionChannelMark"));
      expect(half).toContain(">Via<");
    }
    // The separator is gone: it made peers of two halves that are not peers.
    expect(title).not.toContain("·");
    expect(identity).not.toContain("·");
  });

  it("states the campaign name ONCE per screen, in the top bar and not on the page", () => {
    // The bar already names the open campaign, with both marks, off the same
    // query this page polls — an h1 repeating it printed one statement twice a
    // few pixels apart. The sidebar's Campaigns entry carries any badge.
    expect(overview).not.toContain("<MaturityBadge");
    expect(overview).not.toContain("maturity-badge");
    expect(overview).not.toContain("CampaignHeader");
    expect(overview).not.toContain("<CampaignTitle");
    expect(overview).not.toContain("campaigns/campaign-title");
  });

  it("titles the campaign in the top bar, from the leg and channel it buys", () => {
    expect(context).toContain("<CampaignTitle");
    // The stored name is stale by construction — the bar never reads it.
    expect(context).not.toContain("campaign?.name");
  });

  it("keeps ONE definition of the channel and outcome words", () => {
    // The table's two columns and the title read the same helpers, so a campaign
    // cannot read as one thing in a row and another in the page it opens.
    expect(table).toContain('from "@/lib/campaign-title"');
    expect(table).not.toContain("function channelLabel(");
    expect(table).not.toContain("GOAL_SHORT");
    // No surface that names a campaign derives what it buys from a goal.
    expect(title).not.toContain("fallbackGoal");
    expect(context).not.toContain("fallbackGoal");
    expect(overview).not.toContain("fallbackGoal");
  });
});
