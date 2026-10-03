import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  pickSelectedOffer,
  readSelectedOfferCookie,
  selectedOfferCookie,
  selectedOfferCookieName,
} from "../src/lib/v2/selected-offer";
import { splitDailyBudget } from "../src/lib/v2/budget-split";

const SRC = join(__dirname, "../src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * The v2 dashboard is about ONE offer, picked in the sidebar's switcher (owner
 * 2026-10-03). No page states a brand-wide total, on purpose.
 */
describe("which offer the dashboard reads", () => {
  const offers = [{ offerId: "a" }, { offerId: "b" }];

  it("the URL's offer wins, then the stored pick while it is live, then the first offer", () => {
    expect(pickSelectedOffer(offers, { fromUrl: "z", stored: "b" })).toBe("z");
    expect(pickSelectedOffer(offers, { fromUrl: null, stored: "b" })).toBe("b");
    expect(pickSelectedOffer(offers, { fromUrl: null, stored: "gone" })).toBe("a");
    expect(pickSelectedOffer(offers, { fromUrl: null, stored: null })).toBe("a");
    expect(pickSelectedOffer([], { fromUrl: null, stored: "b" })).toBeNull();
  });

  it("remembers the pick per brand in a cookie it can read back", () => {
    const set = selectedOfferCookie("brand-1", "offer x");
    expect(set.startsWith(`${selectedOfferCookieName("brand-1")}=`)).toBe(true);
    const jar = `other=1; ${set.split(";")[0]}; distribute-offer-brand-2=y`;
    expect(readSelectedOfferCookie(jar, "brand-1")).toBe("offer x");
    expect(readSelectedOfferCookie(jar, "brand-2")).toBe("y");
    expect(readSelectedOfferCookie(jar, "brand-3")).toBeNull();
  });
});

describe("the daily budget, narrowed to one offer", () => {
  const spendable = {
    runningDailyBudgetCents: 9000,
    campaigns: [
      { campaignId: "a-daily", runningDailyBudgetCents: 3000 },
      { campaignId: "a-event", runningDailyBudgetCents: 1000 },
      { campaignId: "b-daily", runningDailyBudgetCents: 5000 },
    ],
  };
  const isEvent = (id: string) => id.endsWith("-event");

  it("adds only the offer's own daily campaigns, and states its event caps beside them", () => {
    expect(splitDailyBudget(spendable, isEvent, (id) => id.startsWith("a-"))).toEqual({ dailyCents: 3000, eventCapCents: 1000 });
    expect(splitDailyBudget(spendable, isEvent, (id) => id.startsWith("b-"))).toEqual({ dailyCents: 5000, eventCapCents: 0 });
  });

  it("is unchanged without a scope", () => {
    expect(splitDailyBudget(spendable, isEvent)).toEqual({ dailyCents: 8000, eventCapCents: 1000 });
  });
});

describe("every v2 brand read is the selected offer's", () => {
  const v2 = readdirSync(join(SRC, "components/v2")).filter((f) => /\.tsx?$/.test(f));

  it("no v2 file reads the brand-wide money or a brand-wide lead scope", () => {
    for (const f of v2) {
      const src = read(`components/v2/${f}`);
      expect(src, f).not.toContain("getBrandRevenue(");
      expect(src, f).not.toMatch(/listLeadsPage\(\s*\{ brandId \}/);
      expect(src, f).not.toMatch(/fetchLeadsCsv\(\s*\{ brandId \}/);
    }
  });

  it("money, leads, missions, runs and budget all take the provider's offer", () => {
    const data = read("components/v2/data.ts");
    expect(data).toContain("getOfferRevenue(offerId!, brandId)");
    expect(data).toContain("scope: offerId ? { brandId, offerId } : { brandId }");
    expect(read("components/v2/use-missions.ts")).toContain("scopeOfferId && c.offerId !== scopeOfferId");
    expect(read("lib/v2/use-daily-budget-split.ts")).toContain("(id) => offerById.get(id) === offerId");
    expect(read("components/v2/v2-shell.tsx")).toContain("<SelectedOfferProvider brandId={brandId}>");
  });

  it("the switcher lists the brand's offers under Brand, with New offer", () => {
    const menus = read("components/v2/sidebar-menus.tsx");
    const at = menus.indexOf("<MenuLabel>Offers</MenuLabel>");
    expect(at).toBeGreaterThan(menus.indexOf("New brand"));
    expect(at).toBeLessThan(menus.indexOf("<MenuLabel>Organizations</MenuLabel>"));
    expect(menus).toContain("selected.select(o.offerId)");
    expect(menus).toContain("<V2NewOfferModal");
  });

  it("the gateway sends the offer beside the brand on a lead read", () => {
    expect(readFileSync(join(SRC, "lib/api.ts"), "utf8")).toContain(
      "`brandId=${encodeURIComponent(scope.brandId)}&offerId=${encodeURIComponent(scope.offerId)}`",
    );
  });
});
