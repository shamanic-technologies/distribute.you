import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  campaignTitleParts,
  channelSlugLabel,
  type CampaignTitleRow,
} from "../src/lib/campaign-title";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

/**
 * A campaign was named by campaign-service's stored `name`, written when the
 * campaign was provisioned. That name predates the per-funnel model, so it says
 * nothing about the funnel the campaign runs nor the channel it runs on — the two
 * facts that distinguish one campaign from another under the same brand. The
 * title is composed from those two instead.
 */
const row = (over: Partial<CampaignTitleRow> = {}): CampaignTitleRow => ({
  id: "c1",
  name: "Stored name from provisioning",
  funnelKey: "sales_meetings_from_conversation",
  featureSlug: "sales-cold-email-outreach",
  ...over,
});

describe("campaignTitleParts", () => {
  it("names the funnel it runs and the channel it runs on", () => {
    const parts = campaignTitleParts(row());
    expect(parts.funnel?.key).toBe("reply_meeting");
    expect(parts.channel?.featureSlug).toBe("sales-cold-email-outreach");
    expect(parts.label).toBe("Sales Meeting from Conversation · Sales Cold Email Outreach");
  });

  it("reads the funnel catalogue's own words, both spellings of the key", () => {
    // `normalizeSalesFunnelKey` accepts the old and the new vocabulary ahead of
    // brand-service emitting only the new one, so both must title the same.
    const legacy = campaignTitleParts(row({ funnelKey: "reply_meeting" }));
    expect(legacy.label).toBe(campaignTitleParts(row()).label);
  });

  it("never reads the stored name while either half resolves", () => {
    // Funnel only: a campaign stating no channel still says what it buys.
    expect(campaignTitleParts(row({ featureSlug: null })).label).toBe(
      "Sales Meeting from Conversation",
    );
    // Channel only: a pre-funnel campaign with no goal in hand still says how.
    expect(campaignTitleParts(row({ funnelKey: null })).label).toBe(
      "Sales Cold Email Outreach",
    );
  });

  it("keeps the stored name when NEITHER half resolves", () => {
    // Nothing composed can be said, so the campaign keeps the name it was given
    // rather than rendering an em-dash where its identity should be.
    const parts = campaignTitleParts(row({ funnelKey: null, featureSlug: null }));
    expect(parts.label).toBe("Stored name from provisioning");
    expect(parts.funnel).toBeNull();
    expect(parts.channel).toBeNull();
  });

  // The goal is the retired, lossier vocabulary — two funnels answer to
  // `meetingBooked` — so a chain derived from it is one the campaign never
  // stated. campaign-service persists the funnel on every campaign.
  it("never derives a funnel from a goal", () => {
    const parts = campaignTitleParts(row({ funnelKey: null }));
    expect(parts.funnel).toBeNull();
    expect(parts.funnelLabel).toBeNull();
    // The half simply goes unstated; the channel still names the campaign.
    expect(parts.label).toBe("Sales Cold Email Outreach");
  });

  it("prettifies a feature slug the channel catalogue does not carry", () => {
    const parts = campaignTitleParts(row({ featureSlug: "some-future-channel" }));
    expect(parts.channel).toBeNull();
    expect(parts.channelLabel).toBe("Some Future Channel");
    expect(parts.label).toBe("Sales Meeting from Conversation · Some Future Channel");
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
  const table = read("components/campaigns/campaigns-page.tsx");

  it("draws both marks, from the shared components brand Settings uses", () => {
    expect(title).toContain("<SalesFunnelMark");
    expect(title).toContain("<AcquisitionChannelMark");
    // A second icon map is how two surfaces end up disagreeing about what a
    // funnel or a channel looks like.
    expect(title).not.toContain("FUNNEL_ICONS");
    expect(title).not.toContain("OWN_CHANNEL_ICONS");
  });

  it("pairs each mark with its OWN name, never both marks then both names", () => {
    // Each half renders its mark immediately before its own label, so the funnel
    // tile and the channel logo are never bunched into one two-logo emblem.
    const funnelHalf = title.indexOf("<SalesFunnelMark");
    const funnelWord = title.indexOf("{funnelLabel}");
    const channelHalf = title.indexOf("<AcquisitionChannelMark");
    const channelWord = title.indexOf("{channelLabel}");
    expect(funnelHalf).toBeGreaterThan(-1);
    expect(channelHalf).toBeGreaterThan(-1);
    // funnel mark -> funnel name -> channel mark -> channel name.
    expect(funnelHalf).toBeLessThan(funnelWord);
    expect(funnelWord).toBeLessThan(channelHalf);
    expect(channelHalf).toBeLessThan(channelWord);
    // The joined string is the LAST resort (neither half resolved), never the
    // composed rendering — reading it beside the marks is what bunched them.
    expect(title).toContain("!composed");
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

  it("titles the campaign in the top bar, from the funnel and channel it buys", () => {
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
    // No surface that names a campaign derives its funnel from a goal.
    expect(table).not.toContain("primaryFunnelForGoal");
    expect(title).not.toContain("fallbackGoal");
    expect(context).not.toContain("fallbackGoal");
    expect(overview).not.toContain("fallbackGoal");
  });
});
