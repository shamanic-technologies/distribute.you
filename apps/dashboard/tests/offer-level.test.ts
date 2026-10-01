import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { tenantBasePath } from "../src/lib/offer-path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/** The URL shape lives in ONE helper, so inserting a level cannot leave a link behind. */
describe("tenantBasePath", () => {
  it("returns the brand path when no offer is named", () => {
    expect(tenantBasePath("o1", "b1")).toBe("/orgs/o1/brands/b1");
    // The share tree has no offer segment, so `undefined` must stay a first-class
    // answer rather than an error.
    expect(tenantBasePath("o1", "b1", undefined)).toBe("/orgs/o1/brands/b1");
    expect(tenantBasePath("o1", "b1", null)).toBe("/orgs/o1/brands/b1");
  });

  it("nests the offer under the brand", () => {
    expect(tenantBasePath("o1", "b1", "f1")).toBe("/orgs/o1/brands/b1/offers/f1");
  });
});

/**
 * Every offer read is a served field, and every offer-scoped read states ONE
 * narrower grain: features-service 400s an `offerId` stated together with a
 * `campaignId`, because a campaign already belongs to exactly one offer.
 */
describe("the offer readers", () => {
  const api = read("lib/api.ts");

  it("parses each response and throws loudly on a shape mismatch", () => {
    for (const fn of [
      "listBrandOffers",
      "getBrandOffer",
      "createBrandOffer",
      "renameBrandOffer",
      "getBrandOfferMoney",
    ]) {
      expect(api).toContain(`export async function ${fn}(`);
      expect(api).toContain(`[dashboard] ${fn}: invalid response shape`);
    }
  });

  it("persists the offer roots, or every offer surface cold-skeletons", () => {
    const persist = read("lib/persist-cache.ts");
    for (const root of ["brandOffers", "brandOffer", "brandOfferMoney"]) {
      expect(persist).toContain(`"${root}"`);
    }
  });
});
