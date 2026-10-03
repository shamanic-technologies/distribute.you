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
  it("on Today and Missions, in the top bar and the crew tile", () => {
    const today = read("components/v2/today-page.tsx");
    expect(today).toContain("<CampaignControlsTrigger brandId={brandId} offerId={selectedOfferId ?? undefined} dailyOnly />");
    expect(today).toContain("useDailyBudgetSplit(brandId");
    expect(read("components/v2/missions-page.tsx")).toContain("<CampaignControlsTrigger brandId={brandId} offerId={selectedOfferId ?? undefined} dailyOnly />");
  });
  it("an event mission's figure reads as a cap", () => {
    expect(read("components/v2/mission-page.tsx")).toContain('cap={crewTrigger(mission.leg)?.kind === "event"}');
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
  it("is two columns: the offer on the left, its missions on the right", () => {
    expect(offer).toContain("lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]");
    expect(offer.indexOf("<BrandOfferCard")).toBeLessThan(offer.indexOf("<aside"));
    expect(offer).toContain("<OfferLifetimeRevenue brandId={brandId} offerId={offerId} />");
  });
  it("no longer lists the v1 per-channel toggles", () => {
    expect(offer).not.toContain("<OfferCampaignsCard");
    expect(offer).toContain("initialOfferId={offerId}");
  });
});

describe("one start from nothing", () => {
  it("Add a mission creates through createCampaignForPair", () => {
    expect(read("components/v2/add-mission-modal.tsx")).toContain("await createCampaignForPair({");
  });
});

describe("Mission page", () => {
  const page = read("components/v2/mission-page.tsx");
  it("states the work and what it brought in side by side, each scrolling on its own", () => {
    expect(page).toContain('<div className="mt-6 grid gap-4 lg:grid-cols-2">');
    expect(page.indexOf("The work")).toBeLessThan(page.indexOf("What it brought in</SectionTitle>"));
    expect(page).toContain("lg:max-h-[calc(100svh-340px)]");
    expect(page).toContain("lg:overflow-y-auto");
  });
  it("reads the mission's runs across every stored row it owns", () => {
    expect(page).toContain("useRecentRuns(brandId, runIds, 60)");
    expect(page).toContain("m === mission && cid !== live");
  });
  it("keeps the facts, in a line under the title rather than a side column", () => {
    expect(page).not.toContain("lg:grid-cols-[minmax(0,1fr)_320px]");
    expect(page).toContain('k={isEvent ? "Daily cap" : "Daily budget"}');
  });
});
