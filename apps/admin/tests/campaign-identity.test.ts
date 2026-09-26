import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// A campaign is (offer x leg x channel). campaign-service dropped `funnel_key`
// (campaign-service#519), so no staff surface may ask for, send or read a sales funnel
// on a campaign any more. Tracking: distribute.you#4413.

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const api = read("src/lib/api.ts");
const APP = "src/app/(authed)/(dashboard)";
const featureNew = read(`${APP}/features/[featureId]/new/page.tsx`);
const brandNew = read(`${APP}/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx`);
const campaignDetail = read(`${APP}/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx`);

describe("a campaign is created as (offer x leg x channel)", () => {
  it("createCampaign requires the offer and the leg, and knows no funnel", () => {
    const at = api.indexOf("export async function createCampaign");
    const sig = api.slice(at, api.indexOf("token?: string", at));
    expect(sig).toContain("offerId: string | null;");
    expect(sig).toContain("legKey: string | null;");
    expect(sig).not.toContain("funnelKey");
  });

  it("the campaign row carries offerId + legKey, never funnelKey", () => {
    const at = api.indexOf("export interface Campaign {");
    const body = api.slice(at, api.indexOf("}", at));
    expect(body).toContain("offerId: string | null;");
    expect(body).toContain("legKey: string | null;");
    expect(body).not.toContain("funnelKey");
  });

  for (const [name, src] of [
    ["the feature-level create", featureNew],
    ["the brand-level create", brandNew],
  ] as const) {
    it(`${name} asks for an offer and a leg, never a funnel`, () => {
      expect(src).toContain("<CampaignIdentityPicker identity={identity} />");
      expect(src).not.toContain("funnel-select");
      expect(src).not.toContain("SALES_FUNNEL_KEYS");
      expect(src).toContain("legKey,");
    });

    it(`${name} drops a retired funnelKey from an old checkout blob rather than sending it`, () => {
      expect(src).toContain("const { funnelKey: _retiredFunnelKey, ...current }");
      expect(src).not.toMatch(/funnelKey: (null|needs|funnelKey|testFunnelKey)/);
    });
  }

  it("a relaunch carries the row's own offer and leg, and refuses a legless sales campaign", () => {
    const at = campaignDetail.indexOf("const handleRelaunchSubmit");
    const body = campaignDetail.slice(at, campaignDetail.indexOf("const openRelaunchModal", at));
    expect(body).toContain("offerId: campaign.offerId ?? null,");
    expect(body).toContain("legKey: campaign.legKey ?? null,");
    expect(body).toContain("isRevenueFeature(campaign.featureSlug) && !campaign.legKey");
    expect(body).not.toContain("funnelKey");
  });

  it("no admin source reads funnelKey off a campaign-service campaign row", () => {
    // acquisition-model.ts reads features-service's PUBLIC funnel-keyed economics
    // (`/public/channel-funnel-economics`), not a campaign row; that read migrates in
    // its own wave and is the one exemption.
    const hits = execSync(`git grep -n "\\.funnelKey\\b" -- src ":!src/lib/acquisition-model.ts" || true`, { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    expect(hits).toEqual([]);
  });
});
