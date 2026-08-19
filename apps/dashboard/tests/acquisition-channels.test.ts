import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ACQUISITION_CHANNELS,
  COMING_SOON_CHANNELS,
  acquisitionChannelForFeatureSlug,
} from "../src/lib/acquisition-channels";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("a channel IS a feature slug", () => {
  // There is no second vocabulary for a channel anywhere in the fleet: features-service
  // owns what a feature is, a campaign states which one it runs, and billing funds a
  // (funnel, feature) pair. A local key here would be a fourth name for one thing.
  it("identifies every live channel by its features-service slug", () => {
    expect(ACQUISITION_CHANNELS.map((c) => c.featureSlug)).toEqual([
      "sales-cold-email-outreach",
      "feedback-request-cold-email-outreach",
    ]);
  });

  it("carries no local channel-key vocabulary", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("AcquisitionChannelKey");
    expect(lib).not.toContain("cold_email");
    expect(lib).not.toContain("acquisitionChannelForWorkflowSlug");
  });

  it("names every channel, distinctly, and says what running it means", () => {
    expect(ACQUISITION_CHANNELS.map((c) => c.name)).toEqual([
      "Sales Cold Email Outreach",
      "Feedback Request Cold Email Outreach",
    ]);
    const names = [...ACQUISITION_CHANNELS, ...COMING_SOON_CHANNELS].map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const channel of [...ACQUISITION_CHANNELS, ...COMING_SOON_CHANNELS]) {
      expect(channel.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("what is coming carries no feature slug", () => {
  // A channel we cannot run exists in no service, so inventing the slug it will one
  // day have would put an identifier on screen that nothing can resolve. It is its
  // own list, structurally unable to be funded or resolved from a campaign.
  it("lists what is coming without a feature slug", () => {
    expect(COMING_SOON_CHANNELS.map((c) => c.id)).toEqual([
      "google-ads",
      "meta-ads",
      "linkedin-ads",
      "x-ads",
      "reddit-ads",
      "cold-whatsapp",
      "cold-sms",
    ]);
    for (const channel of COMING_SOON_CHANNELS) {
      expect(channel).not.toHaveProperty("featureSlug");
    }
  });

  it("cannot be resolved as a channel a campaign runs", () => {
    for (const channel of COMING_SOON_CHANNELS) {
      expect(acquisitionChannelForFeatureSlug(channel.id)).toBeNull();
    }
  });
});

describe("marks", () => {
  // A channel on somebody else's platform wears that platform's real logo; one
  // that is ours has no vendor to borrow from, so it carries its own tone.
  it("marks a vendor channel by domain and one of ours by tone", () => {
    for (const channel of [...ACQUISITION_CHANNELS, ...COMING_SOON_CHANNELS]) {
      if (channel.mark.kind === "vendor") {
        expect(channel.mark.domain).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      } else {
        expect(channel.mark.tone.iconBg).toMatch(/^bg-[a-z]+-50$/);
        expect(channel.mark.tone.iconText).toMatch(/^text-[a-z]+-600$/);
      }
    }
    const vendors = COMING_SOON_CHANNELS.filter((c) => c.mark.kind === "vendor");
    expect(vendors.map((c) => c.id)).toEqual([
      "google-ads",
      "meta-ads",
      "linkedin-ads",
      "x-ads",
      "reddit-ads",
      "cold-whatsapp",
    ]);
    // Every channel we RUN is ours, so none of them borrows a vendor logo.
    for (const channel of ACQUISITION_CHANNELS) {
      expect(channel.mark.kind).toBe("own");
    }
  });

  // A tint outside the html.dark remap paints a bright block on the dark
  // surface, and the default theme is light so nobody would notice.
  it("only uses tints the dark remap covers", () => {
    const css = read("../src/app/globals.css");
    for (const channel of [...ACQUISITION_CHANNELS, ...COMING_SOON_CHANNELS]) {
      if (channel.mark.kind !== "own") continue;
      expect(css).toContain(`html.dark .${channel.mark.tone.iconBg}`);
    }
  });

  // The glyph is a token rather than a component, so the catalogue keeps no icon
  // import and stays directly unit-testable. The mark component owns the map.
  it("names its glyph rather than importing one", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("@phosphor-icons");
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    for (const channel of [...ACQUISITION_CHANNELS, ...COMING_SOON_CHANNELS]) {
      if (channel.mark.kind !== "own") continue;
      expect(mark).toContain(`"${channel.mark.glyph}"`);
    }
  });
});

describe("acquisitionChannelForFeatureSlug", () => {
  // The campaign states its own feature slug, so this is a display lookup. The
  // workflow slug used to stand in for it and answered "cold email" for every
  // email workflow whatever its offer, which two cold-email channels break.
  it("resolves a campaign's stated channel", () => {
    expect(acquisitionChannelForFeatureSlug("sales-cold-email-outreach")?.name).toBe(
      "Sales Cold Email Outreach",
    );
    expect(
      acquisitionChannelForFeatureSlug("feedback-request-cold-email-outreach")?.name,
    ).toBe("Feedback Request Cold Email Outreach");
  });

  // A slug we carry no channel for names nothing rather than claiming a channel
  // the catalogue does not have.
  it("answers null for a slug with no catalogue entry", () => {
    expect(acquisitionChannelForFeatureSlug(null)).toBeNull();
    expect(acquisitionChannelForFeatureSlug("")).toBeNull();
    expect(acquisitionChannelForFeatureSlug("pr-cold-email-outreach")).toBeNull();
    // A workflow slug is not a feature slug, and must not resolve as one.
    expect(acquisitionChannelForFeatureSlug("sales-cold-email-outreach-v3")).toBeNull();
  });
});

describe("there is no channels card", () => {
  // The card STATED what runs and persisted nothing, so it collected no answer and
  // lost none when it went. A channel is not chosen anywhere: it is FUNDED on the
  // funnel it feeds, on Offer Settings, and funding a (funnel, channel) pair is
  // what makes it run. The catalogue survives because the campaign surfaces and the
  // funnel budget rows read it for the channel's name and mark.
  it("keeps no settings card of its own", () => {
    expect(
      fs.existsSync(
        path.resolve(__dirname, "../src/components/settings/brand-acquisition-channels-card.tsx"),
      ),
    ).toBe(false);
    for (const rel of [
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/settings/page.tsx",
    ]) {
      expect(read(rel)).not.toContain("BrandAcquisitionChannelsCard");
    }
  });

  // The Campaigns table and the funnel budget rows draw the same mark for a
  // channel, so the tile is one component rather than two copies of an icon map.
  it("draws its mark through the shared component", () => {
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    expect(mark).toContain("EnvelopeSimpleIcon");
    expect(mark).toContain('weight="duotone"');
    // A provider logo is never tinted: its tile stays white.
    expect(mark).toContain("bg-white");
  });
});

describe("a campaign's channel is read, never inferred", () => {
  // Two cold-email channels differ only by their offer, so a guess off the
  // workflow slug cannot tell them apart and never could.
  it("resolves the channel from the campaign's own feature slug", () => {
    for (const rel of [
      "../src/components/campaigns/campaigns-table.tsx",
      "../src/components/campaigns/campaigns-page.tsx",
      "../src/lib/campaign-title.ts",
    ]) {
      const src = read(rel);
      expect(src).not.toContain("acquisitionChannelForWorkflowSlug");
      expect(src).toContain("acquisitionChannelForFeatureSlug");
    }
  });
});

describe("copy", () => {
  it("carries no em-dash", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("—");
  });
});
