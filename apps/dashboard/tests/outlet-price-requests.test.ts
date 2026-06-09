import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { markOutletPriceRequestsOngoing } from "../src/lib/outlet-price-requests";
import { requestOutletPurchasePrices } from "../src/lib/api";
import type { OutletListResponse } from "../src/lib/api";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const searchBarPath = path.resolve(__dirname, "../src/components/entity-search-bar.tsx");
const originalFetch = globalThis.fetch;

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

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

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

  it("surfaces HTML proxy responses as ApiError instead of a JSON parse crash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>Dashboard shell</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(requestOutletPurchasePrices(["outlet-1"])).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      body: {
        error: "Non-JSON API response",
        endpoint: "/outlets/price-requests",
        contentType: "text/html; charset=utf-8",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/outlets/price-requests",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ outletIds: ["outlet-1"] }),
      }),
    );
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

    it(`${level} page keeps toolbar purchase-price requests fire-and-forget but scopes detail errors to the selected outlet`, () => {
      expect(content).toContain('setPurchasePriceRequestScope("page")');
      expect(content).not.toContain('purchasePriceRequestScope === "page"');
      expect(content).toContain("purchasePriceRequestScope === selectedOutlet.id");
    });

    it(`${level} page writes successful request results into the outlet list cache`, () => {
      expect(content).toContain("markOutletPriceRequestsOngoing(prev, result.results)");
      expect(content).toContain("queryClient.setQueryData<OutletListResponse>");
      expect(content).toContain("invalidateQueries({ queryKey: outletsQueryKey })");
    });
  }
});

describe("outlet pages wire the Get Domain Ratings control", () => {
  const api = fs.readFileSync(apiPath, "utf-8");

  it("posts a batch of domains to the gateway DR compute endpoint", () => {
    expect(api).toContain("export async function computeDomainDrStatuses");
    expect(api).toContain('"/orgs/domains/dr-compute"');
    expect(api).toContain("body: { domains }");
  });

  for (const [level, pagePath] of Object.entries(outletPages)) {
    const content = fs.readFileSync(pagePath, "utf-8");

    it(`${level} page renders the button beside search and uses missing current-page domains`, () => {
      expect(content).toContain("computeDomainDrStatuses");
      expect(content).toContain("currentPageDomainsMissingDr");
      expect(content).toContain("paginatedOutlets.pageItems");
      expect(content).toContain(".filter((domain) => !drMap.has(domain))");
      expect(content).toContain("Get Domain Ratings");
    });

    it(`${level} page keeps both toolbar buttons search-height aligned`, () => {
      expect(content).toContain("fetchPageDomainRatingsMutation");
      expect(content).toContain("h-10 shrink-0 rounded-lg border border-brand-200");
    });

    it(`${level} page writes fetched DR results into the DR cache`, () => {
      expect(content).toContain("queryClient.setQueryData<DomainDrStatus[]>(domainDrQueryKey");
      expect(content).toContain("invalidateQueries({ queryKey: domainDrQueryKey })");
    });

    it(`${level} page does not render page-level DR batch errors`, () => {
      expect(content).not.toContain("fetchPageDomainRatingsMutation.isError");
    });
  }
});

describe("outlet pages wire the Get Monthly Visits control", () => {
  const api = fs.readFileSync(apiPath, "utf-8");

  it("posts a batch of domains to the gateway traffic compute endpoint", () => {
    expect(api).toContain("export async function computeDomainTrafficHistories");
    expect(api).toContain('"/orgs/domains/traffic-compute"');
    expect(api).toContain("body: { domains }");
  });

  it("reads cached traffic histories for many domains", () => {
    expect(api).toContain("export async function getDomainTrafficHistories");
    expect(api).toContain("`/orgs/domains/traffic-history?");
  });

  for (const [level, pagePath] of Object.entries(outletPages)) {
    const content = fs.readFileSync(pagePath, "utf-8");

    it(`${level} page renders the button beside search and uses missing current-page traffic domains`, () => {
      expect(content).toContain("computeDomainTrafficHistories");
      expect(content).toContain("currentPageDomainsMissingTraffic");
      expect(content).toContain("paginatedOutlets.pageItems");
      expect(content).toContain(".filter((domain) => !trafficMap.has(domain))");
      expect(content).toContain("Get Monthly Visits");
    });

    it(`${level} page shows or fetches monthly visits in the detail panel`, () => {
      expect(content).toContain("Monthly Visits");
      expect(content).toContain("formatMonthlyVisits(monthlyVisits)");
      expect(content).toContain("onFetchMonthlyVisits");
      expect(content).toContain("fetchMonthlyVisitsMutation.mutate(normalizeDomain(selectedOutlet.outletDomain))");
    });

    it(`${level} page writes fetched traffic results into the traffic cache`, () => {
      expect(content).toContain("queryClient.setQueryData<DomainTrafficHistory[]>(domainTrafficQueryKey");
      expect(content).toContain("invalidateQueries({ queryKey: domainTrafficQueryKey })");
    });

    it(`${level} page does not render page-level monthly-visits batch errors`, () => {
      expect(content).not.toContain("fetchPageMonthlyVisitsMutation.isError");
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
