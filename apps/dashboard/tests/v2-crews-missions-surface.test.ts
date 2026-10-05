import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

describe("Crew page", () => {
  const page = read("components/v2/crew-page.tsx");
  it("keeps Add a crew for staff only", () => {
    expect(page).toContain("{staffMode && (\n            <Link");
    expect(page).toContain("{settled && staffMode && (");
  });
  it("states each crew by its trigger, and offers a mission on an idle one", () => {
    expect(page).toContain("<CrewTriggerTag trigger={crew.trigger}");
    expect(page).toContain("+ Add a mission");
    expect(page).toContain("<AddMissionModal");
  });
  it("states the DAILY budget, with event crews' caps beside it and never added", () => {
    expect(page).toContain("useDailyBudgetSplit(brandId");
    expect(page).not.toContain("useRunningDailyBudgetCents");
  });
});

describe("the daily budget excludes event crews", () => {
  // Today states no daily budget since its crew tile became Delivered (2026-10-03).
  it("on Today and Missions, in the top bar", () => {
    const today = read("components/v2/today-page.tsx");
    expect(today).toContain("<CampaignControlsTrigger brandId={brandId} offerId={selectedOfferId ?? undefined} dailyOnly />");
    expect(read("components/v2/missions-page.tsx")).toContain("<CampaignControlsTrigger brandId={brandId} offerId={selectedOfferId ?? undefined} dailyOnly />");
  });
  it("an event mission's figure reads as a cap", () => {
    expect(read("components/v2/campaign-page.tsx")).toContain('cap={crewTrigger(mission.leg)?.kind === "event"}');
    expect(read("components/v2/missions-table.tsx")).toContain('cap={crewTrigger(m.leg)?.kind === "event"}');
  });
});

describe("Missions page", () => {
  it("says plainly that a mission can be added", () => {
    const page = read("components/v2/missions-page.tsx");
    expect(page).toContain('className="k-btn-accent"');
    expect(page).toContain("+ Add a mission");
    expect(page).toContain("<AddMissionModal");
  });
});

describe("Offer page", () => {
  const page = read("components/v2/setup-pages.tsx");
  const offer = page.slice(page.indexOf("export function V2OfferPage("), page.indexOf("/** Who an offer is sold to"));
  it("is one column: the missions list left the page, the offer's own cards stay", () => {
    expect(offer).not.toContain("<aside");
    expect(offer).not.toContain("<AddMissionModal");
    expect(offer).toContain("<OfferLifetimeRevenue brandId={brandId} offerId={offerId} />");
    expect(offer).toContain("<BrandOfferCard brandId={brandId} offerId={offerId} />");
  });
  it("no longer lists the v1 per-channel toggles", () => {
    expect(offer).not.toContain("<OfferCampaignsCard");
  });
});

describe("one start from nothing", () => {
  it("Add a mission creates through createCampaignForPair", () => {
    expect(read("components/v2/add-mission-modal.tsx")).toContain("await createCampaignForPair({");
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
  it("Settings is the channel page's settings plus the campaign's daily budget (owner 2026-10-05)", () => {
    expect(page).toContain("<ColdEmailChannelSettings brandId={brandId} offerId={offerId} channelSlug={c.featureSlug} />");
    expect(page).toContain("<CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={id} />");
    expect(page).not.toContain("<BrandOfferCard");
  });
});
