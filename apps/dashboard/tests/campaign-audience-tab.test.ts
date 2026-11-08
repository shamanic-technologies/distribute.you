import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Owner 2026-11-08 (AUDIENCE-PER-OFFER-1107): a campaign sells one offer, built for one audience.
// Its Targeting tab is that audience's text, edited on the offer: never the old per-audience
// figures table with a list per source.
describe("campaign Targeting tab = the offer's one audience", () => {
  for (const file of ["src/components/v2/funnel-campaigns.tsx", "src/components/v2/campaign-page-next.tsx"]) {
    it(`${file} renders CampaignAudience on Targeting`, () => {
      const src = read(file);
      expect(src).toContain("<CampaignAudience orgId={orgId} brandId={campaign.brandId} offerId={campaign.offerId} />");
      expect(src).not.toContain("V2AudiencesTable");
    });
  }

  it("Targeting no longer waits on a cold email part", () => {
    expect(read("src/components/v2/funnel-campaigns.tsx")).toContain('{ key: "targeting", label: "Targeting", needsColdEmail: false }');
  });

  it("the tab reads the offer's audience and links to the offer to edit it", () => {
    const src = read("src/components/v2/campaign-audience.tsx");
    expect(src).toContain('["audiences", brandId, "active", offerId]');
    expect(src).toContain("v2OfferHref(orgId, brandId, offerId)");
  });
});
