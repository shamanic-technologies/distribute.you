import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { acquisitionChannelsFromFeatures, channelSourcesFromCatalogue, withRetiredChannels } from "../src/lib/acquisition-channels";

/**
 * P5.1 (owner 2026-10-31): the channel list is the SERVED catalogue's (`GET /public/channels`), never the seeded
 * features list, which missed every channel declared since (Threads posts, Organic Market read "not in the catalogue"
 * with no mark on the campaign page's Results table).
 */
const CATALOGUE = [
  {
    slug: "threads-post",
    name: "Threads posts",
    description: "Publishes threads every day.",
    icon: "threads-logo",
    displayOrder: 10004,
    channelType: "earned",
    operatedBy: "platform",
    stepTransitions: [{ from: null, to: { key: "post_published" } }],
  },
  {
    slug: "organic-market",
    name: "Organic Market",
    description: "Readers click through.",
    icon: "users-three",
    displayOrder: 10005,
    channelType: "earned",
    operatedBy: "customer",
    stepTransitions: [{ from: { key: "post_published" }, to: { key: "website_visit" } }],
  },
  { slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach", description: "", icon: "envelope", displayOrder: 1, channelType: "outbound", operatedBy: "platform", stepTransitions: [] },
  { slug: "investor-outreach", name: "Investors", description: "", icon: "x", displayOrder: 2, channelType: "fundraising", stepTransitions: [] },
  { slug: "no-name" },
];

describe("the channel list read from the served catalogue", () => {
  const list = acquisitionChannelsFromFeatures(channelSourcesFromCatalogue(CATALOGUE));
  it("lists every served selling channel, declared ones included, in the served order; non-selling and nameless left out", () => {
    expect(list.map((c) => c.featureSlug)).toEqual(["sales-cold-email-outreach", "threads-post", "organic-market"]);
  });
  it("carries the served name, icon, operator and legs", () => {
    expect(list.find((c) => c.featureSlug === "threads-post")).toMatchObject({ name: "Threads posts", servedIcon: "threads-logo", operatedBy: "platform", legs: [{ from: null, to: "post_published" }] });
    expect(list.find((c) => c.featureSlug === "organic-market")).toMatchObject({ servedIcon: "users-three", legs: [{ from: "post_published", to: "website_visit" }] });
  });
  it("the hook reads the shared public catalogue query, never the features list", () => {
    const hook = readFileSync(join(__dirname, "../src/lib/use-acquisition-channels.ts"), "utf8");
    expect(hook).toContain('useAuthQuery(["publicCatalogue"], () => getPublicCatalogue(), pollOptions)');
    expect(hook).toContain("channelSourcesFromCatalogue(data.channels)");
    expect(hook).not.toContain("useFeatures");
  });
  it("a channel with no tile of ours wears its served icon", () => {
    const mark = readFileSync(join(__dirname, "../src/components/marks/acquisition-channel-mark.tsx"), "utf8");
    expect(mark).toContain("<CatalogueMark icon={def.servedIcon}");
  });
});

describe("a RETIRED channel (features-service retiredChannels) describes its past campaigns, never offered", () => {
  const live = acquisitionChannelsFromFeatures(channelSourcesFromCatalogue(CATALOGUE));
  const retired = acquisitionChannelsFromFeatures(
    channelSourcesFromCatalogue([
      { slug: "pr-expert-quote-opportunities", name: "PR Expert Quote Opportunities", description: "", icon: "tray", channelType: "earned", operatedBy: "platform", stepTransitions: [] },
      { slug: "threads-post", name: "Old Threads", icon: "x", channelType: "earned", stepTransitions: [] },
    ]),
  );
  const all = withRetiredChannels(live, retired);
  it("is named and iconed, marked retired, after the live ones; a slug also live reads live", () => {
    expect(all.find((c) => c.featureSlug === "pr-expert-quote-opportunities")).toMatchObject({ name: "PR Expert Quote Opportunities", servedIcon: "tray", retired: true });
    expect(all.filter((c) => c.featureSlug === "threads-post")).toEqual([expect.objectContaining({ name: "Threads posts" })]);
    expect(all.find((c) => c.featureSlug === "threads-post")!.retired).toBeUndefined();
  });
  it("never becomes a control (on/off, budget)", () => {
    const controls = readFileSync(join(__dirname, "../src/lib/campaign-controls.ts"), "utf8");
    expect(controls).toContain("if (def === null || def.retired) return false;");
  });
});

