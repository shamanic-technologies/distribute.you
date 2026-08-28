import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

/**
 * What a brand may spend today is a SERVED field, not a browser join.
 *
 * It is the join of a campaign's status (campaign-service) to its ceiling (billing), and this app
 * used to make it here: fetch the campaign list, fetch the per-funnel budgets, pair them up, add up
 * what was running. That is a money figure computed in the browser — the thing this repo does not
 * do — and it was unreachable from features-service, so the staff console's MRR kept reading
 * billing's status-blind total while the customer dashboard read a corrected one.
 *
 * campaign-service serves both figures now, decomposed per offer and per campaign, so nothing sums
 * anything. These guards pin that the hook reads it rather than rebuilding it.
 */
describe("the running daily budget is read, never rebuilt in the browser", () => {
  const hook = src("lib/use-running-daily-budget.ts");

  it("reads the served spendable-budget endpoint", () => {
    expect(hook).toContain("getBrandSpendableBudget");
    expect(hook).toContain('["brandSpendableBudget", brandId]');
  });

  it("does not re-derive the figure from the campaign list and the funnel budgets", () => {
    // The two reads the old join paired up, and the pure helper that paired them.
    expect(hook).not.toContain("listCampaignsByBrand");
    expect(hook).not.toContain("getBrandFunnelBudgets");
    expect(hook).not.toContain("buildControlRows");
    expect(hook).not.toContain("scopeTotalCents");
  });

  it("narrows to an offer by SELECTING the offer's own served total", () => {
    // `offers` carries each offer's own running figure, so the offer case is a lookup — never a
    // sum of the campaigns under it, which is what the old browser join did.
    expect(hook).toContain("data.offers.find((o) => o.offerId === offerId)");
    expect(hook).not.toContain("data.offers.filter");
    expect(hook).not.toContain("data.offers\n");
  });

  // A FUNNEL is the one grain the producer does not total: it decomposes by offer and by campaign,
  // and a funnel is neither. So this case adds up the campaign rows it already served — the only
  // sum in the file, and it is a sum of SERVED per-campaign figures rather than a re-derivation of
  // the join above (no campaign list, no budget map, no status pairing).
  it("sums the funnel's own campaigns, because no served total exists at that grain", () => {
    expect(hook).toContain("normalizeSalesFunnelKey");
    expect(hook).toContain("data.campaigns");
    expect(hook).toContain("reduce((sum, c) => sum + c.runningDailyBudgetCents, 0)");
  });

  // billing keys a ceiling on (funnel x channel x offer), so a funnel with no offer beside it spans
  // every offer selling it — and would print a sibling offer's money under this one's name.
  it("narrows the funnel sum to the offer when one is given", () => {
    const at = hook.indexOf("wantedFunnel");
    expect(at).toBeGreaterThan(-1);
    expect(hook.slice(at, at + 700)).toContain("offerId ? c.offerId === offerId : true");
  });

  it("reports null — not zero — while the read is unresolved or failed", () => {
    // "We could not measure this" and "this brand spends nothing" are different statements, and the
    // callers render a dash for the first.
    expect(hook).toContain("data === undefined\n      ? null");
    expect(hook).toContain("spendableQ.isError");
  });

  it("is persisted, or the money on the header cold-skeletons every visit", () => {
    expect(src("lib/persist-cache.ts")).toContain('"brandSpendableBudget"');
  });

  it("fails loud on a shape mismatch rather than parsing a money figure to nothing", () => {
    const api = src("lib/api.ts");
    const at = api.indexOf("export async function getBrandSpendableBudget");
    expect(at).toBeGreaterThan(-1);
    // 900 chars covers the function body (measured); the throw is its last statement.
    const body = api.slice(at, at + 900);
    expect(body).toContain("/brands/${brandId}/spendable-budget");
    expect(body).toContain("safeParse");
    expect(body).toContain("invalid response shape");
  });
});
