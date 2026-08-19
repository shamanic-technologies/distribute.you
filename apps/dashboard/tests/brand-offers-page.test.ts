import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("the brand has an Offers page of its own", () => {
  it("has a route at the brand level, not under an offer", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/page.tsx",
        ),
      ),
    ).toBe(true);
  });

  // It is to the brand what Campaigns is to an offer: the Overview carries the
  // table under its chart, this gives it a page. ONE component serves both, or a
  // row reads one way here and another one click over.
  it("renders the same table the Overview does, not a copy of it", () => {
    expect(read("src/components/offers/offers-page.tsx")).toContain("OffersTable");
    expect(
      read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"),
    ).toContain("OffersTable");
  });

  it("sits directly under Overview in the brand sidebar", () => {
    const sidebar = read("src/components/context-sidebar.tsx");
    const body = sidebar.slice(sidebar.indexOf("function BrandLevelSidebar"), sidebar.indexOf("function BrandLevelSidebar") + 3000);
    const overviewAt = body.indexOf('id: "overview"');
    const offersAt = body.indexOf('id: "brand-offers"');
    const leadsAt = body.indexOf('id: "brand-leads"');
    expect(overviewAt).toBeGreaterThan(-1);
    expect(offersAt).toBeGreaterThan(overviewAt);
    expect(leadsAt).toBeGreaterThan(offersAt);
  });

  // The money a header tile would carry is already stated on the Overview this
  // page sits beside. Printing it twice invites the two to disagree.
  it("carries no money tile of its own", () => {
    const page = read("src/components/offers/offers-page.tsx");
    expect(page).not.toContain("getFeatureRevenue");
    expect(page).not.toContain("totalPipelineUsd");
  });
});
