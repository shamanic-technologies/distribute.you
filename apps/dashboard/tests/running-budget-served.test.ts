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
 * anything. These guards pin the served read and its persistence.
 */
describe("the running daily budget is read, never rebuilt in the browser", () => {
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
