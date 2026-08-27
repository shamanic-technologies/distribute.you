import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  CHANNEL_MARKS,
  acquisitionChannelForFeatureSlug,
  acquisitionChannelsFromFeatures,
  channelMarkForSlug,
  type ChannelSource,
} from "../src/lib/acquisition-channels";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

/** What features-service publishes, in the shape it publishes it. */
const FEATURES: ChannelSource[] = [
  {
    slug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    description: "Find leads matching your ICP and email them.",
    displayOrder: 1,
    salesFunnels: ["sales_meetings_from_conversation", "website_purchases"],
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Buy the searches your buyers already run.",
    displayOrder: 20,
    salesFunnels: ["sales_meetings_from_website", "website_purchases", "form_magnet"],
  },
  {
    slug: "cold-call-outreach",
    name: "Cold Call Outreach",
    description: "Reach buyers by phone, one call at a time.",
    displayOrder: 13,
    salesFunnels: ["sales_meetings_from_conversation"],
  },
  {
    slug: "pr-cold-email-outreach",
    name: "PR Cold Email Outreach",
    description: "Pitch journalists.",
    displayOrder: 5,
    salesFunnels: [],
  },
];

describe("the catalogue is READ, never restated", () => {
  // The list used to live here as two hand-written arrays, and it went stale the
  // way a copy always does: the producer sold thirty-three channels while the copy
  // named two and called the rest "coming soon", so a channel live upstream could
  // not be funded at all.
  it("keeps no hand-written list of channels", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("ACQUISITION_CHANNELS");
    expect(lib).not.toContain("COMING_SOON_CHANNELS");
    expect(lib).not.toContain("ComingSoonChannelDef");
    // The names and the copy belong to the producer too, so no channel's own
    // words are written down here. The marks map keys on slugs alone.
    expect(lib).not.toContain("Sales Cold Email Outreach");
    expect(lib).not.toContain("Buy the searches");
  });

  it("takes each channel's name and line of copy off the wire", () => {
    const channels = acquisitionChannelsFromFeatures(FEATURES);
    const ads = channels.find((c) => c.featureSlug === "google-ads");
    expect(ads?.name).toBe("Google Ads");
    expect(ads?.summary).toBe("Buy the searches your buyers already run.");
  });

  it("orders on the producer's own displayOrder", () => {
    expect(acquisitionChannelsFromFeatures(FEATURES).map((c) => c.featureSlug)).toEqual([
      "sales-cold-email-outreach",
      "cold-call-outreach",
      "google-ads",
    ]);
  });
});

describe("what makes a feature a channel", () => {
  // Selling through nothing IS not being a channel, and the producer states it:
  // every feature that is not one (PR, hiring, VC, press kits, expert quotes)
  // answers with an empty list.
  it("drops a feature that sells through no funnel", () => {
    const slugs = acquisitionChannelsFromFeatures(FEATURES).map((c) => c.featureSlug);
    expect(slugs).not.toContain("pr-cold-email-outreach");
  });

  // ABSENT is "we could not ask", which is read as the behaviour that came before
  // the field shipped rather than as a denial. The two are different statements.
  it("keeps a feature that states nothing at all", () => {
    const quiet: ChannelSource[] = [{ slug: "x-ads", name: "X Ads", description: "d" }];
    expect(acquisitionChannelsFromFeatures(quiet).map((c) => c.featureSlug)).toEqual(["x-ads"]);
  });
});

describe("marks", () => {
  // The tile is the ONE thing about a channel this app decides, because nothing
  // upstream states it.
  it("marks a vendor channel by domain and one of ours by tone", () => {
    expect(channelMarkForSlug("google-ads")).toEqual({
      kind: "vendor",
      domain: "ads.google.com",
    });
    const email = channelMarkForSlug("sales-cold-email-outreach");
    expect(email?.kind).toBe("own");
  });

  // A channel published upstream that this app has not drawn is still a channel:
  // it keeps its name, its funnels and its money, and simply draws no tile.
  it("answers null for a channel it has not drawn, without dropping it", () => {
    expect(channelMarkForSlug("cold-call-outreach")).toBeNull();
    const call = acquisitionChannelsFromFeatures(FEATURES).find(
      (c) => c.featureSlug === "cold-call-outreach",
    );
    expect(call).toBeDefined();
    expect(call?.mark).toBeNull();
  });

  it("renders nothing rather than an invented tile", () => {
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    expect(mark).toContain("if (!def.mark) return null;");
  });

  // A tint outside the dark remap paints a bright block on the dark surface, and
  // light mode is the default so nobody sees it until someone toggles.
  it("only uses tints the dark remap covers", () => {
    const css = read("../src/app/globals.css");
    for (const mark of Object.values(CHANNEL_MARKS)) {
      if (mark.kind !== "own") continue;
      expect(css).toContain(`html.dark .${mark.tone.iconBg}`);
    }
  });

  it("names its glyph rather than importing one", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("@phosphor-icons");
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    for (const m of Object.values(CHANNEL_MARKS)) {
      if (m.kind === "own") expect(mark).toContain(`"${m.glyph}"`);
    }
  });
});

describe("acquisitionChannelForFeatureSlug", () => {
  it("resolves a campaign's stated channel", () => {
    const channels = acquisitionChannelsFromFeatures(FEATURES);
    expect(acquisitionChannelForFeatureSlug("google-ads", channels)?.name).toBe("Google Ads");
  });

  it("answers null for a slug the given set does not carry", () => {
    const channels = acquisitionChannelsFromFeatures(FEATURES);
    expect(acquisitionChannelForFeatureSlug("pr-cold-email-outreach", channels)).toBeNull();
    expect(acquisitionChannelForFeatureSlug(null, channels)).toBeNull();
  });

  // Empty is what every surface sees while the features query settles, and each
  // already prints the channel's own words rather than guessing at a tile.
  it("answers null against an unsettled catalogue", () => {
    expect(acquisitionChannelForFeatureSlug("google-ads", [])).toBeNull();
  });
});

describe("there is no channels card", () => {
  // The card STATED what runs and persisted nothing, so it collected no answer and
  // lost none when it went. A channel is not chosen anywhere: it is FUNDED on the
  // funnel it feeds, on Offer Settings, and funding a (funnel, channel) pair is
  // what makes it run.
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

  it("draws its mark through the shared component", () => {
    const mark = read("../src/components/marks/acquisition-channel-mark.tsx");
    expect(mark).toContain("EnvelopeSimpleIcon");
    expect(mark).toContain('weight="duotone"');
    // A provider logo is never tinted: its tile stays white.
    expect(mark).toContain("bg-white");
  });
});

describe("a campaign's channel is read, never inferred", () => {
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

  // The catalogue is a projection of a query already in flight, so naming a
  // campaign costs no request of its own.
  it("projects the features the app already fetches", () => {
    const hook = read("../src/lib/use-acquisition-channels.ts");
    expect(hook).toContain("useFeatures()");
    expect(hook).toContain("acquisitionChannelsFromFeatures");
    expect(hook).not.toContain("useAuthQuery");
  });
});

describe("copy", () => {
  it("carries no em-dash", () => {
    const lib = read("../src/lib/acquisition-channels.ts");
    expect(lib).not.toContain("—");
  });
});

describe("a channel carries the leg it performs and who runs it", () => {
  it("reads both off the feature row's own channel blob", () => {
    const [entry, closer] = acquisitionChannelsFromFeatures([
      {
        slug: "sales-cold-email-outreach",
        name: "Sales Cold Email Outreach",
        description: "",
        displayOrder: 1,
        salesFunnels: ["sales_meetings_from_conversation"],
        acquisitionChannel: {
          operatedBy: "platform",
          stepTransitions: [{ from: null, to: "conversation" }],
        },
      },
      {
        slug: "founder-led-closing",
        name: "Founder Led Closing",
        description: "",
        displayOrder: 2,
        salesFunnels: ["sales_meetings_from_conversation"],
        acquisitionChannel: {
          operatedBy: "customer",
          stepTransitions: [{ from: "meeting_attended", to: "paid_client" }],
        },
      },
    ]);
    expect(entry.operatedBy).toBe("platform");
    expect(entry.legs).toEqual([{ from: null, to: "conversation" }]);
    expect(closer.operatedBy).toBe("customer");
    expect(closer.legs).toEqual([{ from: "meeting_attended", to: "paid_client" }]);
  });

  it("says nothing rather than guessing when the producer states nothing", () => {
    // The field shipped after this reader existed. A row without it is a channel we know
    // less about, never an error and never a fabricated operator.
    const [channel] = acquisitionChannelsFromFeatures([
      { slug: "x", name: "X", description: "", salesFunnels: ["form_magnet"] },
    ]);
    expect(channel.operatedBy).toBeNull();
    expect(channel.legs).toEqual([]);
  });
});
