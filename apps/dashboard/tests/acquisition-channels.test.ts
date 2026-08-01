import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ACQUISITION_CHANNELS,
  acquisitionChannelForWorkflowSlug,
  partitionChannelsByAvailability,
  type AcquisitionChannelDef,
} from "../src/lib/acquisition-channels";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/** A second live channel, so the grouping holds on a future fleet too. */
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
    expect(partitionChannelsByAvailability().live.map((c) => c.key)).toEqual(["cold_email"]);
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

});

describe("availability grouping", () => {
  // What we run and what is coming are two different statements, so they are two
  // groups rather than one list with a marker on some of its members.
  it("puts what we run today first, then what is coming", () => {
    const { live, comingSoon } = partitionChannelsByAvailability();
    expect(live.map((c) => c.key)).toEqual(["cold_email"]);
    expect(comingSoon.map((c) => c.key)).not.toContain("cold_email");
    expect(live.length + comingSoon.length).toBe(ACQUISITION_CHANNELS.length);
  });

  it("keeps the catalogue's own order inside each group", () => {
    const { live, comingSoon } = partitionChannelsByAvailability(TWO_LIVE);
    expect(live.map((c) => c.key)).toEqual(["cold_email", "google_ads"]);
    expect(comingSoon.map((c) => c.key)).toEqual(["meta_ads"]);
  });
});

describe("acquisitionChannelForWorkflowSlug", () => {
  // A campaign carries no channel field: the workflow it runs IS the channel,
  // and the product is cold-email-only today.
  it("reads an email workflow as the cold-email channel", () => {
    expect(acquisitionChannelForWorkflowSlug("sales-cold-email-outreach-v3")?.key).toBe(
      "cold_email",
    );
    expect(acquisitionChannelForWorkflowSlug("pr-cold-email-outreach")?.key).toBe("cold_email");
  });

  // A slug we carry no channel for names nothing rather than claiming a channel
  // the catalogue does not have.
  it("answers null for a slug with no catalogue entry", () => {
    expect(acquisitionChannelForWorkflowSlug(null)).toBeNull();
    expect(acquisitionChannelForWorkflowSlug("")).toBeNull();
    expect(acquisitionChannelForWorkflowSlug("google-ads-search")).toBeNull();
  });
});

describe("the card states, it does not ask", () => {
  const card = read("../src/components/settings/brand-acquisition-channels-card.tsx");

  // brand-service stores no channel selection, so a control here would take the
  // answer and persist none of it. A toggle that silently discards a choice is
  // worse than no toggle, so the card says what runs and offers nothing.
  it("has no writer at all", () => {
    expect(card).not.toContain("useMutation");
    expect(card).not.toContain("saveBrand");
    expect(card).not.toContain("updateBrand");
  });

  it("offers no control of any kind", () => {
    expect(card).not.toContain('type="checkbox"');
    expect(card).not.toContain('role="button"');
    expect(card).not.toContain("onClick");
    expect(card).not.toContain("onKeyDown");
    expect(card).not.toContain("useState");
  });

  // GA: every customer reads it, so no beta gate and no badge.
  it("renders its own heading for everyone", () => {
    expect(card).toContain("Acquisition Channels");
    expect(card).not.toContain("useIsBetaUser");
    expect(card).not.toContain("MaturityBadge");
  });

  // Two statements, never one list: what we run, and what is coming.
  it("says which channels run today and which are coming", () => {
    expect(card).toContain("Coming soon");
    expect(card).toContain("Running");
    expect(card).toContain("partitionChannelsByAvailability");
  });

  // Names and copy live once, in the catalogue, so the card cannot drift into a
  // second wording for the same channel.
  it("reads the catalogue rather than restating it", () => {
    expect(card).not.toContain("Google Ads");
    expect(card).not.toContain("LinkedIn Ads");
    expect(card).toContain('from "@/lib/acquisition-channels"');
  });

  // The Campaigns table draws the same mark for the channel a campaign runs on,
  // so the tile is one component rather than two copies of an icon map.
  it("draws its mark through the shared component", () => {
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    expect(card).toContain("<AcquisitionChannelMark def={def}");
    expect(card).not.toContain("OWN_CHANNEL_ICONS");
    expect(mark).toContain("EnvelopeSimpleIcon");
    expect(mark).toContain('weight="duotone"');
    // A provider logo is never tinted: its tile stays white.
    expect(mark).toContain("bg-white");
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
