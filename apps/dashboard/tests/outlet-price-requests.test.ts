import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { markOutletPriceRequestsOngoing } from "../src/lib/outlet-price-requests";
import type { OutletListResponse } from "../src/lib/api";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const searchBarPath = path.resolve(__dirname, "../src/components/entity-search-bar.tsx");

const outletPages = {
  brand: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
  ),
  feature: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/outlets/page.tsx",
  ),
  campaign: path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/outlets/page.tsx",
  ),
};

describe("outlet purchase price request API", () => {
  const api = fs.readFileSync(apiPath, "utf-8");

  it("posts current-page outlet ids to the gateway price request endpoint", () => {
    expect(api).toContain("export async function requestOutletPurchasePrices");
    expect(api).toContain('"/outlets/price-requests"');
    expect(api).toContain("body: { outletIds }");
  });

  it("types the backend-derived price request status on listed outlets", () => {
    expect(api).toContain('priceRequestStatus: "ongoing" | "received" | null');
  });
});

describe("outlet purchase price request cache update", () => {
  it("marks only successful requested outlets as ongoing", () => {
    const previous = {
      outlets: [
        { id: "outlet-1", priceRequestStatus: null },
        { id: "outlet-2", priceRequestStatus: null },
      ],
      total: 2,
    } as unknown as OutletListResponse;

    const next = markOutletPriceRequestsOngoing(previous, [
      { outletId: "outlet-1", status: "ongoing" },
      { outletId: "outlet-2", status: "error", error: "No editorial email" },
    ]);

    expect(next?.outlets.map((outlet) => outlet.priceRequestStatus)).toEqual(["ongoing", null]);
  });
});

describe("outlet pages wire the Ask Purchase Price control", () => {
  for (const [level, pagePath] of Object.entries(outletPages)) {
    const content = fs.readFileSync(pagePath, "utf-8");

    it(`${level} page renders the button beside search and uses the current page ids`, () => {
      expect(content).toContain("requestOutletPurchasePrices");
      expect(content).toContain("Ask Purchase Price");
      expect(content).toContain("paginatedOutlets.pageItems.map((outlet) => outlet.id)");
      expect(content).toContain("className=\"\"");
    });

    it(`${level} page shows the in-progress status in the detail panel`, () => {
      expect(content).toContain('outlet.priceRequestStatus === "ongoing"');
      expect(content).toContain("Purchase price request in progress");
    });

    it(`${level} page lets the detail panel request one missing purchase price`, () => {
      expect(content).toContain("onRequestPurchasePrice");
      expect(content).toContain("requestPurchasePricesMutation.mutate([selectedOutlet.id])");
      expect(content).toContain('outlet.priceRequestStatus !== "ongoing"');
      expect(content).toContain('isRequestingPurchasePrice ? "Requesting..." : "Ask Purchase Price"');
    });

    it(`${level} page scopes purchase-price errors to page batch or selected outlet`, () => {
      expect(content).toContain('purchasePriceRequestScope === "page"');
      expect(content).toContain("purchasePriceRequestScope === selectedOutlet.id");
    });

    it(`${level} page writes successful request results into the outlet list cache`, () => {
      expect(content).toContain("markOutletPriceRequestsOngoing(prev, result.results)");
      expect(content).toContain("queryClient.setQueryData<OutletListResponse>");
      expect(content).toContain("invalidateQueries({ queryKey: outletsQueryKey })");
    });
  }
});

describe("EntitySearchBar spacing", () => {
  it("keeps the existing bottom margin by default but lets toolbar rows override it", () => {
    const content = fs.readFileSync(searchBarPath, "utf-8");
    expect(content).toContain('className = "mb-4"');
    expect(content).toContain("className={`relative ${className}`}");
  });
});
