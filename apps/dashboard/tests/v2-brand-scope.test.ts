import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { offersOfCampaigns } from "../src/lib/v2/brand-scope";
import { splitDailyBudget } from "../src/lib/v2/budget-split";
import { v2PathForRetired } from "../src/lib/ui-version";
import { picksNewestFirst } from "../src/lib/engine-picks";

const SRC = join(__dirname, "../src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * The v2 dashboard is about the BRAND (owner 2026-11-07, AUDIENCE-PER-OFFER-1107): Offers are a
 * list on Setup > Offers, never a top-level pick. No brand page reads a sidebar-selected offer;
 * a page addressed by an offer id takes its offer from the URL.
 */
describe("the brand is the scope", () => {
  it("lists the offers the brand's campaigns sell, each once; one offer is the brand", () => {
    expect(offersOfCampaigns([{ offerId: "b" }, { offerId: "a" }, { offerId: "b" }, { offerId: null }])).toEqual(["a", "b"]);
    expect(offersOfCampaigns([{ offerId: "a" }, { offerId: "a" }])).toEqual(["a"]);
    expect(offersOfCampaigns([])).toEqual([]);
  });

  it("the daily budget reads the brand's served total, every offer", () => {
    const spendable = {
      runningDailyBudgetCents: 9000,
      campaigns: [
        { campaignId: "a-daily", runningDailyBudgetCents: 3000 },
        { campaignId: "a-event", runningDailyBudgetCents: 1000 },
        { campaignId: "b-daily", runningDailyBudgetCents: 5000 },
      ],
    };
    expect(splitDailyBudget(spendable, (id) => id.endsWith("-event"))).toEqual({ dailyCents: 8000, eventCapCents: 1000 });
    const hook = read("lib/v2/use-daily-budget-split.ts");
    expect(hook).not.toContain("offerId");
  });

  it("joins each offer's Engine picks newest first, undated last", () => {
    const picks = picksNewestFirst([
      { id: 1, pickedAt: "2026-11-01T00:00:00Z" },
      { id: 2, pickedAt: null },
      { id: 3, pickedAt: "2026-11-03T00:00:00Z" },
    ]);
    expect(picks.map((p) => p.id)).toEqual([3, 1, 2]);
  });
});

describe("no v2 brand page reads a sidebar-selected offer", () => {
  const v2 = readdirSync(join(SRC, "components/v2")).filter((f) => /\.tsx?$/.test(f));

  it("the selected-offer module and its cookie are gone, and nothing imports them", () => {
    expect(existsSync(join(SRC, "components/v2/selected-offer.tsx"))).toBe(false);
    expect(existsSync(join(SRC, "lib/v2/selected-offer.ts"))).toBe(false);
    for (const f of v2) {
      const src = read(`components/v2/${f}`);
      expect(src, f).not.toMatch(/useSelectedOffer|SelectedOfferProvider|distribute-offer-/);
    }
  });

  it("money, leads, campaigns and the shell read the brand", () => {
    const data = read("components/v2/data.ts");
    expect(data).toContain("getBrandRevenue(brandId)");
    expect(data).toContain("getBrandRevenueWindow(brandId, days)");
    expect(data).toContain("scope: { brandId }");
    expect(data).not.toContain("getOfferRevenue(");
    expect(read("components/v2/use-campaigns.ts")).not.toContain("scopeOfferId");
    expect(read("components/v2/v2-shell.tsx")).toContain("<BrandScopeProvider brandId={brandId}>");
    expect(read("components/v2/ongoing-campaigns.ts")).toContain('["salesFunnelCampaigns", brandId, "all"]');
  });

  it("an offer-grain-only read is asked for the brand's one offer, never summed across offers", () => {
    const data = read("components/v2/data.ts");
    expect(data).toContain("getOfferCompanyLifecycle(soleOfferId!, brandId)");
    expect(read("components/v2/deals-page.tsx")).toContain(": soleOfferId;");
    expect(read("components/v2/outcomes-page.tsx")).toContain("useBrandScope().soleOfferId");
    expect(read("components/v2/today-page.tsx")).toContain("offerId={scope.soleOfferId}");
  });

  it("the sidebar's tenant menu holds brands and organizations, no offer rows", () => {
    const menus = read("components/v2/sidebar-menus.tsx");
    expect(menus).not.toContain("<MenuLabel>Offers</MenuLabel>");
    expect(menus).not.toContain("V2NewOfferModal");
    expect(menus).toContain("New brand");
    // New offer stays reachable from the Offers page.
    expect(read("components/v2/setup-pages.tsx")).toContain("New offer");
  });
});

describe("the brand Audiences page is gone", () => {
  it("has no route, and old links land on Offers", () => {
    expect(existsSync(join(SRC, "app/(authed)/v2/orgs/[orgId]/brands/[brandId]/audience"))).toBe(false);
    expect(v2PathForRetired("/v2/orgs/o1/brands/b1/audience", "")).toBe("/v2/orgs/o1/brands/b1/offers");
    expect(v2PathForRetired("/v2/orgs/o1/brands/b1/audience/", "?x=1")).toBe("/v2/orgs/o1/brands/b1/offers?x=1");
    expect(v2PathForRetired("/v2/orgs/o1/brands/b1/audiences", "")).toBeNull();
    expect(v2PathForRetired("/v2/orgs/o1/brands/b1/offers/x/targeting", "")).toBeNull();
    expect(read("proxy.ts")).toContain("v2PathForRetired(pathname, req.nextUrl.search)");
  });
});
