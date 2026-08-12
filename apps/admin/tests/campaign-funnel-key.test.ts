import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  SALES_FUNNEL_KEYS,
  isSalesFunnelKey,
  salesFunnelLabel,
} from "../src/lib/sales-funnel-keys";

const APP = join(__dirname, "../src/app/(authed)/(dashboard)");
const read = (p: string) => readFileSync(join(APP, p), "utf-8");

const featureNew = read("features/[featureId]/new/page.tsx");
const brandNew = read(
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
);
const campaignDetail = read(
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx",
);
const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf-8");

describe("the sales funnel catalogue", () => {
  it("carries the four funnels in the canonical spelling", () => {
    expect([...SALES_FUNNEL_KEYS]).toEqual([
      "sales_meetings_from_conversation",
      "sales_meetings_from_website",
      "website_purchases",
      "form_magnet",
    ]);
  });

  it("names each funnel, and leaves anything else as it found it", () => {
    expect(salesFunnelLabel("form_magnet")).toBe("Form Magnet");
    expect(salesFunnelLabel("nonesuch")).toBe("nonesuch");
  });

  it("recognises only its own four", () => {
    expect(isSalesFunnelKey("website_purchases")).toBe(true);
    expect(isSalesFunnelKey("visit_signup")).toBe(false);
    expect(isSalesFunnelKey(null)).toBe(false);
  });
});

describe("createCampaign makes the caller answer which funnel it sells", () => {
  it("requires funnelKey rather than leaving it optional", () => {
    const at = api.indexOf("export async function createCampaign");
    expect(api.slice(at, at + 400)).toContain("funnelKey: string | null;");
  });

  it("carries the funnel on the campaign row it reads back", () => {
    expect(api).toContain("funnelKey: string | null;");
  });
});

describe("every staff create path states a funnel, or states none", () => {
  for (const [name, src] of [
    ["the feature-level create", featureNew],
    ["the brand-level create", brandNew],
  ] as const) {
    it(`${name} gates the funnel on the feature being a sales feature`, () => {
      expect(src).toContain("const needsSalesFunnel = isRevenueFeature(");
      expect(src).toContain("funnelKey: needsSalesFunnel ? funnelKey : null,");
    });

    it(`${name} refuses to launch a sales campaign with no funnel picked`, () => {
      expect(src).toContain("Pick the sales funnel this campaign sells.");
      expect(src).toContain("needsSalesFunnel && !funnelKey");
    });

    it(`${name} offers the funnels from the one catalogue`, () => {
      expect(src).toContain("SALES_FUNNEL_KEYS.map((key) =>");
      expect(src).toContain('data-testid="funnel-select"');
    });
  }

  it("a relaunch sells what the campaign it relaunches sells", () => {
    expect(campaignDetail).toContain("funnelKey: campaign.funnelKey ?? null,");
  });

  it("no create path derives a funnel from a goal", () => {
    for (const src of [featureNew, brandNew, campaignDetail]) {
      expect(src).not.toContain("funnelForGoal");
      expect(src).not.toContain("primaryFunnelForGoal");
    }
  });
});
