import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ACQUISITION_CHANNELS,
  acquisitionChannelByKey,
  canSelectChannel,
  initialSelectedChannelKeys,
  liveAcquisitionChannels,
  partitionChannelsBySelection,
  removeChannelBlockedReason,
  type AcquisitionChannelDef,
  type AcquisitionChannelKey,
} from "../src/lib/acquisition-channels";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/** A second live channel, so the remove guard can be exercised on a future fleet. */
const TWO_LIVE: AcquisitionChannelDef[] = [
  ACQUISITION_CHANNELS[0],
  { ...ACQUISITION_CHANNELS[1], comingSoon: false },
  ACQUISITION_CHANNELS[2],
];

describe("ACQUISITION_CHANNELS definitions", () => {
  it("declares the eight channels, in order, each with its own key", () => {
    expect(ACQUISITION_CHANNELS.map((c) => c.key)).toEqual([
      "cold_email",
      "google_ads",
      "meta_ads",
      "linkedin_ads",
      "x_ads",
      "reddit_ads",
      "cold_whatsapp",
      "cold_sms",
    ]);
  });

  it("names every channel, distinctly, and says what running it means", () => {
    expect(ACQUISITION_CHANNELS.map((c) => c.name)).toEqual([
      "Sales Cold Email Outreach",
      "Google Ads",
      "Meta Ads",
      "LinkedIn Ads",
      "X Ads",
      "Reddit Ads",
      "Sales Cold WhatsApp Outreach",
      "Sales Cold SMS Outreach",
    ]);
    expect(new Set(ACQUISITION_CHANNELS.map((c) => c.name)).size).toBe(
      ACQUISITION_CHANNELS.length,
    );
    for (const channel of ACQUISITION_CHANNELS) {
      expect(channel.summary.length).toBeGreaterThan(0);
    }
  });

  // Cold email is the one channel we run today. The rest state that they are
  // coming rather than offering a choice we cannot honour.
  it("has exactly one live channel today, and it is cold email", () => {
    expect(liveAcquisitionChannels().map((c) => c.key)).toEqual(["cold_email"]);
  });

  // A channel on somebody else's platform wears that platform's real logo; one
  // that is ours has no vendor to borrow from, so it carries its own tone.
  it("marks a vendor channel by domain and one of ours by tone", () => {
    for (const channel of ACQUISITION_CHANNELS) {
      if (channel.mark.kind === "vendor") {
        expect(channel.mark.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      } else {
        expect(channel.mark.tone.iconBg).toMatch(/^bg-[a-z]+-50$/);
        expect(channel.mark.tone.iconText).toMatch(/^text-[a-z]+-600$/);
      }
    }
    const vendors = ACQUISITION_CHANNELS.filter((c) => c.mark.kind === "vendor");
    expect(vendors.map((c) => c.key)).toEqual([
      "google_ads",
      "meta_ads",
      "linkedin_ads",
      "x_ads",
      "reddit_ads",
      "cold_whatsapp",
    ]);
  });

  // A tint outside the html.dark remap paints a bright block on the dark
  // surface, and the default theme is light so nobody would notice.
  it("only uses tints the dark remap covers", () => {
    const css = read("../src/app/globals.css");
    for (const channel of ACQUISITION_CHANNELS) {
      if (channel.mark.kind !== "own") continue;
      expect(css).toContain(`html.dark .${channel.mark.tone.iconBg}`);
    }
  });

  it("throws on an unknown key rather than answering with a default", () => {
    expect(() => acquisitionChannelByKey("nope" as AcquisitionChannelKey)).toThrow(
      /Unknown acquisition channel/,
    );
  });
});

describe("selection model", () => {
  it("opens on the first live channel", () => {
    expect(initialSelectedChannelKeys()).toEqual(["cold_email"]);
    expect(initialSelectedChannelKeys(TWO_LIVE)).toEqual(["cold_email"]);
  });

  it("puts the chosen channels first, then the rest", () => {
    const chosen = new Set<AcquisitionChannelKey>(["meta_ads", "cold_email"]);
    const { selected, unselected } = partitionChannelsBySelection((key) => chosen.has(key));
    expect(selected.map((c) => c.key)).toEqual(["cold_email", "meta_ads"]);
    expect(unselected.map((c) => c.key)).not.toContain("cold_email");
    expect(selected.length + unselected.length).toBe(ACQUISITION_CHANNELS.length);
  });

  it("never lets a coming-soon channel be chosen", () => {
    for (const channel of ACQUISITION_CHANNELS) {
      expect(canSelectChannel(channel)).toBe(!channel.comingSoon);
    }
  });

  // A brand running no channel is a brand we cannot reach anyone for.
  it("refuses to drop the only live channel, and says why", () => {
    const reason = removeChannelBlockedReason("cold_email", ["cold_email"]);
    expect(reason).toBeTruthy();
    expect(reason).toContain("stays on");
  });

  it("allows dropping one live channel once another is running", () => {
    expect(
      removeChannelBlockedReason("cold_email", ["cold_email", "google_ads"], TWO_LIVE),
    ).toBeNull();
  });

  it("does not block a channel that is not selected", () => {
    expect(removeChannelBlockedReason("google_ads", ["cold_email"])).toBeNull();
  });
});

describe("the card writes nothing", () => {
  const card = read("../src/components/settings/brand-acquisition-channels-card.tsx");

  // brand-service stores no channel selection, so a save here would drop most of
  // what the user picked. Same posture as the Sales Funnels card above it.
  it("has no writer at all", () => {
    expect(card).not.toContain("useMutation");
    expect(card).not.toContain("saveBrand");
    expect(card).not.toContain("updateBrand");
    expect(card).toContain("Preview only. Nothing here is saved yet.");
  });

  // Choosing a channel is a decision about how the brand sells, not a tick.
  it("offers no checkbox", () => {
    expect(card).not.toContain('type="checkbox"');
    expect(card).not.toContain("<input type=\"checkbox\"");
  });

  it("renders its own heading, beta-gated, so a non-beta viewer sees nothing", () => {
    expect(card).toContain("useIsBetaUser");
    expect(card).toContain("if (!isBeta) return null;");
    expect(card).toContain("Acquisition Channels");
    expect(card).toContain('<MaturityBadge level="beta" />');
  });

  it("states that a coming-soon channel is coming, and locks it", () => {
    expect(card).toContain("Coming soon");
    expect(card).toContain("canSelectChannel");
  });

  // Names and copy live once, in the catalogue, so the card cannot drift into a
  // second wording for the same channel.
  it("reads the catalogue rather than restating it", () => {
    expect(card).not.toContain("Google Ads");
    expect(card).not.toContain("LinkedIn Ads");
    expect(card).toContain('from "@/lib/acquisition-channels"');
  });

  it("is mounted on brand Settings", () => {
    const page = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
    );
    expect(page).toContain("<BrandAcquisitionChannelsCard />");
  });
});

describe("copy", () => {
  it("carries no em-dash", () => {
    const card = read("../src/components/settings/brand-acquisition-channels-card.tsx");
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(card).not.toContain("—");
    expect(lib).not.toContain("—");
  });
});
