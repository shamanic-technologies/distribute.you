import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { channelSlugLabel } from "../src/lib/campaign-title";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("campaign-title", () => {
  it("channelSlugLabel says nothing for a campaign stating no channel", () => {
    expect(channelSlugLabel(null)).toBe("—");
  });

  it("exports no goal-derived vocabulary at all", async () => {
    const mod = await import("../src/lib/campaign-title");
    expect("GOAL_SHORT" in mod).toBe(false);
  });
});

describe("the surfaces that name a campaign", () => {
  const identity = read("components/campaigns/campaign-identity.tsx");

  it("says the leg first, then the channel behind \"Via\"", () => {
    // The vocabulary: the leg leads because it is what the campaign buys, the
    // channel follows behind "Via" because it is where it buys it.
    const stacked = identity.slice(identity.indexOf("export function CampaignIdentity("));
    expect(stacked.indexOf("<LegMark")).toBeGreaterThan(-1);
    expect(stacked.indexOf("<LegMark")).toBeLessThan(stacked.indexOf("<AcquisitionChannelMark"));
    expect(stacked).toContain(">Via<");
    // The separator is gone: it made peers of two halves that are not peers.
    expect(identity).not.toContain("·");
  });
});
