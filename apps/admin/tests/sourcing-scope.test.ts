import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { featureSlugsWithSourcing, foldSourcingUnderChannels } from "../src/lib/sourcing-scope";

const BY_CHANNEL = {
  "sales-cold-email-outreach": ["sourcing-apollo-cold-filters", "sourcing-apollo-buying-signals"],
  "feedback-request-cold-email-outreach": ["sourcing-apollo-cold-filters", "sourcing-apollo-buying-signals"],
  "sales-crm-email-outreach": ["sourcing-crm-contacts"],
};
const ORIGINS = new Set(["sourcing-apollo-cold-filters", "sourcing-apollo-buying-signals", "sourcing-crm-contacts"]);
const sum = (xs: { cents: number }[]) => xs.reduce((s, x) => s + x.cents, 0);

describe("featureSlugsWithSourcing", () => {
  it("adds the channel's OWN origins, never another channel's", () => {
    expect(featureSlugsWithSourcing("sales-cold-email-outreach", BY_CHANNEL)).toEqual([
      "sales-cold-email-outreach",
      "sourcing-apollo-buying-signals",
      "sourcing-apollo-cold-filters",
    ]);
    expect(featureSlugsWithSourcing("sales-crm-email-outreach", BY_CHANNEL)).toEqual([
      "sales-crm-email-outreach",
      "sourcing-crm-contacts",
    ]);
  });

  it("a channel that sources nothing reads its own slug only", () => {
    expect(featureSlugsWithSourcing("linkedin-posting", BY_CHANNEL)).toEqual(["linkedin-posting"]);
  });
});

describe("foldSourcingUnderChannels", () => {
  it("folds sourcing under its only channel: channel total = before-relabel total", () => {
    // Before the relabel, all 1000 sat on the outreach slug.
    const after = [
      { featureSlug: "sales-cold-email-outreach", cents: 400 },
      { featureSlug: "sourcing-apollo-cold-filters", cents: 550 },
      { featureSlug: "sourcing-apollo-buying-signals", cents: 50 },
      { featureSlug: null, cents: 7 },
    ];
    const rows = foldSourcingUnderChannels(after, BY_CHANNEL, ORIGINS);
    const cold = rows.find((r) => r.slug === "sales-cold-email-outreach")!;
    expect(cold.cents).toBe(1000);
    expect(cold.ownCents).toBe(400);
    expect(cold.sourcing).toEqual([
      { slug: "sourcing-apollo-cold-filters", cents: 550 },
      { slug: "sourcing-apollo-buying-signals", cents: 50 },
    ]);
    expect(rows).toHaveLength(2);
    expect(sum(rows)).toBe(sum(after));
  });

  it("never puts CRM sourcing under cold email", () => {
    const rows = foldSourcingUnderChannels(
      [
        { featureSlug: "sales-cold-email-outreach", cents: 100 },
        { featureSlug: "sales-crm-email-outreach", cents: 20 },
        { featureSlug: "sourcing-crm-contacts", cents: 5 },
      ],
      BY_CHANNEL,
      ORIGINS,
    );
    expect(rows.find((r) => r.slug === "sales-cold-email-outreach")!.cents).toBe(100);
    expect(rows.find((r) => r.slug === "sales-crm-email-outreach")!.cents).toBe(25);
  });

  it("an origin shared by two of the brand's channels stays its own sourcing row (never guessed)", () => {
    const groups = [
      { featureSlug: "sales-cold-email-outreach", cents: 100 },
      { featureSlug: "feedback-request-cold-email-outreach", cents: 30 },
      { featureSlug: "sourcing-apollo-cold-filters", cents: 70 },
    ];
    const rows = foldSourcingUnderChannels(groups, BY_CHANNEL, ORIGINS);
    const origin = rows.find((r) => r.slug === "sourcing-apollo-cold-filters")!;
    expect(origin.isSourcing).toBe(true);
    expect(origin.cents).toBe(70);
    expect(sum(rows)).toBe(200);
  });

  it("an origin with no channel spend on the brand stays its own sourcing row", () => {
    const rows = foldSourcingUnderChannels([{ featureSlug: "sourcing-crm-contacts", cents: 9 }], BY_CHANNEL, ORIGINS);
    expect(rows).toEqual([{ slug: "sourcing-crm-contacts", cents: 9, ownCents: 9, sourcing: [], isSourcing: true }]);
  });
});

describe("staff cost views count sourcing with its channel (source guards)", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "../src", p), "utf-8");
  const featureDir = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]";

  it("overview + campaigns read the channel's cost with its origins, on one shared key", () => {
    for (const page of [`${featureDir}/overview/page.tsx`, `${featureDir}/campaigns/page.tsx`]) {
      const src = read(page);
      expect(src).toContain("useFeatureCostSlugs(featureSlug)");
      expect(src).toContain('["brandCostBreakdown", { brandId, featureSlugs: costSlugs }]');
      expect(src).toContain("enabled: ");
    }
  });

  it("brand usage folds sourcing rows under their channel", () => {
    const src = read("components/brand-usage.tsx");
    expect(src).toContain("foldSourcingUnderChannels(");
    expect(src).toContain("useSourcingOrigins()");
  });
});
