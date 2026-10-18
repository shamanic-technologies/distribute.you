import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("the daily budget excludes event campaigns", () => {
  // Today states no daily budget since its runs tile became Delivered (2026-10-03).
  it("Today carries no campaign on/off switch: cancelling lives in Billing (owner 2026-10-05)", () => {
    expect(read("components/v2/today-page.tsx")).not.toContain("CampaignControlsTrigger");
  });
  it("a campaign page states its funnel campaign's caps, never a per-campaign daily figure", () => {
    const page = read("components/v2/campaign-page.tsx");
    expect(page).toContain("useFunnelCapsWords(brandId, partOfId)");
    expect(page).not.toContain("fmtDailyBudgetUsd");
  });
});

// The legacy `/missions` URLs (old links and onboarding emails) redirect onto Campaigns.
const LEGACY = "app/(authed)/v2/orgs/[orgId]/brands/[brandId]/" + ["miss", "ions"].join("");
describe("legacy URLs", () => {
  it("the old list and campaign URLs land on Campaigns (owner 2026-10-05)", () => {
    expect(read(`${LEGACY}/page.tsx`)).toContain("/campaigns`");
    expect(read(`${LEGACY}/[campaignId]/page.tsx`)).toContain("/campaigns/${encodeURIComponent(campaignId)}`");
    expect(read(`${LEGACY}/[campaignId]/audiences/page.tsx`)).toContain("?tab=targeting`");
    expect(read(`${LEGACY}/[campaignId]/settings/page.tsx`)).toContain("?tab=settings`");
    expect(read(`${LEGACY}/[campaignId]/workflows/page.tsx`)).toContain("?tab=workflows`");
  });
});

describe("Offer page", () => {
  const page = read("components/v2/setup-pages.tsx");
  const offer = page.slice(page.indexOf("export function V2OfferPage("), page.indexOf("/** Who an offer is sold to"));
  it("is one column: the campaigns list left the page, the offer's own cards stay", () => {
    expect(offer).not.toContain("<aside");
    expect(offer).toContain("<OfferLifetimeRevenue brandId={brandId} offerId={offerId} />");
    expect(offer).toContain("<BrandOfferCard orgId={orgId} brandId={brandId} offerId={offerId} />");
  });
  it("no longer lists the v1 per-channel toggles", () => {
    expect(offer).not.toContain("<OfferCampaignsCard");
  });
});

describe("Campaign page (owner 2026-10-05)", () => {
  const page = read("components/v2/campaign-page.tsx");
  it("is the channel page's anatomy narrowed to one campaign", () => {
    expect(page).toContain("<LegSteps");
    expect(page).toContain('<PeoplePage bucket="positive_reply" campaignId={id} />');
    expect(page).toContain('<PeoplePage bucket="contacted" campaignId={id} />');
    expect(page).toContain("<V2AudiencesTable campaignId={id} offerId={offerId} />");
  });
  it("reads where people stand on the campaign, never the brand", () => {
    expect(page).toContain("getLeadBucketCounts({ campaignId }, {})");
  });
  it("Settings is the channel page's settings; the money is the funnel campaign's caps (owner 2026-10-10)", () => {
    expect(page).toContain("<ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={c.featureSlug} />");
    expect(page).not.toContain("<CampaignSettingsCard");
    expect(page).not.toContain("<BrandOfferCard");
  });
});
