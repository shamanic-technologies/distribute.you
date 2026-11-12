/**
 * MON-PAGE-SPEED-2-1112: the Companies page, a Company page and the search palette read features-service's
 * paged company list (`GET /brands/:brandId/companies`) and one company by its key, never the revenue body's
 * whole `organizations[]` (7.1 MB on our own brand). Each page is its own cached query, under the cap.
 */
import { describe, expect, it } from "vitest";
import {
  COMPANIES_PAGE_SIZE,
  companiesPageQuery,
  nextCompaniesOffset,
  parseBrandCompaniesPage,
  parseBrandCompany,
} from "../src/lib/brand-companies";
import { MAX_PERSISTED_ENTRY_BYTES, isPersistableQueryKey } from "../src/lib/persist-cache";

const row = (n: number) => ({
  organizationKey: `org:${n}`,
  companyKey: `c${n}.com`,
  orgId: String(n),
  orgName: `Company number ${n} with a long enough name`,
  orgDomain: `c${n}.com`,
  topPerson: { firstName: "Gina", lastName: "Yaritz", photoUrl: "https://media.licdn.com/dms/image/v2/C4E03AQFEXptz7-l56g/profile-displayphoto-shrink_200_200/0/1516862169218?e=2147483647&v=beta&t=xLHG5RejvT4P5HJsaVKjDIeT3QDRwb92G4KASBjKaTA" },
  peopleCount: 2,
  tags: ["delivered", "visit"],
  expectedRevenueUsd: 0.8097165991902834,
  mostAdvancedDate: "2026-05-17T00:07:47.522Z",
  lifecycle: { key: "contacted", rank: 1, label: "Contacted" },
});
const RUNGS = [{ key: "contacted", rank: 1, label: "Contacted", organizationCount: 11000 }];
const page = (offset: number, n: number, total: number) => ({
  brandId: "b1", sort: "value", q: null, rung: null, offset, limit: COMPANIES_PAGE_SIZE, total, organizationCount: total, rungs: RUNGS,
  companies: Array.from({ length: n }, (_, i) => row(offset + i)),
});

describe("brand companies reader", () => {
  it("asks one page, net, in the page's order, search and rung", () => {
    expect(companiesPageQuery({ sort: "value", q: null, rung: null }, 0)).toBe("pricing=net&sort=value&offset=0&limit=60");
    expect(companiesPageQuery({ sort: "name", q: "acme corp", rung: "engaged" }, 120, 5000)).toBe(
      "pricing=net&sort=name&offset=120&limit=5000&q=acme+corp&rung=engaged",
    );
  });

  it("parses the served page and knows the next offset", () => {
    const first = parseBrandCompaniesPage(page(0, 60, 130), "test");
    expect(first.companies[0].lifecycle?.key).toBe("contacted");
    expect(nextCompaniesOffset(first)).toBe(60);
    expect(nextCompaniesOffset(parseBrandCompaniesPage(page(120, 10, 130), "test"))).toBeUndefined();
    expect(nextCompaniesOffset(parseBrandCompaniesPage(page(0, 0, 0), "test"))).toBeUndefined();
  });

  it("refuses a body without the rows' rung (fail loud)", () => {
    const bad = page(0, 1, 1);
    delete (bad.companies[0] as Partial<ReturnType<typeof row>>).lifecycle;
    expect(() => parseBrandCompaniesPage(bad, "test")).toThrow();
    expect(() => parseBrandCompany({ brandId: "b1", position: 1 }, "test")).toThrow();
  });

  it("a page fits the persisted cache many times over, and both roots persist", () => {
    expect(JSON.stringify(page(0, 60, 11345)).length).toBeLessThan(MAX_PERSISTED_ENTRY_BYTES / 20);
    expect(isPersistableQueryKey(["brandCompanies", "b1", "value", "", "", 0])).toBe(true);
    expect(isPersistableQueryKey(["brandCompany", "b1", "c1.com"])).toBe(true);
  });
});
