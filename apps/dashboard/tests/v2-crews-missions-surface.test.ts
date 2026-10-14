import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "../src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("Crew page", () => {
  const page = read("components/v2/crew-page.tsx");
  it("keeps Add a crew for staff only", () => {
    expect(page).toContain("{staffMode && (\n            <Link");
    expect(page).toContain("{settled && staffMode && (");
  });
  it("states each crew by its trigger, and offers a campaign on an idle one", () => {
    expect(page).toContain("<CrewTriggerTag trigger={crew.trigger}");
    expect(page).toContain("+ Create a campaign");
    expect(page).not.toContain("<AddMissionModal");
  });
  it("states the DAILY budget, with event crews' caps beside it and never added", () => {
    expect(page).toContain("useDailyBudgetSplit(brandId");
    expect(page).not.toContain("useRunningDailyBudgetCents");
  });
});

describe("the daily budget excludes event crews", () => {
  // Today states no daily budget since its crew tile became Delivered (2026-10-03).
  it("Today carries no campaign on/off switch: cancelling lives in Billing (owner 2026-10-05)", () => {
    expect(read("components/v2/today-page.tsx")).not.toContain("CampaignControlsTrigger");
  });
  it("a campaign page states its funnel campaign's caps, never a per-campaign daily figure", () => {
    const page = read("components/v2/campaign-page.tsx");
    expect(page).toContain("useFunnelCapsWords(brandId, partOfId)");
    expect(page).not.toContain("fmtDailyBudgetUsd");
  });
});

describe("Missions page", () => {
  it("is deleted: old links land on Campaigns (owner 2026-10-05)", () => {
    expect(existsSync(join(SRC, "components/v2/missions-page.tsx"))).toBe(false);
    expect(read("app/(authed)/v2/orgs/[orgId]/brands/[brandId]/missions/page.tsx")).toContain("/campaigns`");
  });
});

describe("Offer page", () => {
  const page = read("components/v2/setup-pages.tsx");
  const offer = page.slice(page.indexOf("export function V2OfferPage("), page.indexOf("/** Who an offer is sold to"));
  it("is one column: the missions list left the page, the offer's own cards stay", () => {
    expect(offer).not.toContain("<aside");
    expect(offer).not.toContain("<AddMissionModal");
    expect(offer).toContain("<OfferLifetimeRevenue brandId={brandId} offerId={offerId} />");
    expect(offer).toContain("<BrandOfferCard orgId={orgId} brandId={brandId} offerId={offerId} />");
  });
  it("no longer lists the v1 per-channel toggles", () => {
    expect(offer).not.toContain("<OfferCampaignsCard");
  });
});

describe("one start from nothing", () => {
  it("the per-pipe Add a mission modal is gone: the Copilot creates a sales funnel campaign", () => {
    expect(existsSync(join(SRC, "components/v2/add-mission-modal.tsx"))).toBe(false);
  });
});

describe("Campaign page (replaced the mission page, owner 2026-10-05)", () => {
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
