import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBrandsByIds,
  getCampaign,
  listCampaigns,
  listCampaignsByBrand,
} from "../src/lib/api";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

interface MockResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): MockResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("campaign brand-url enrichment", () => {
  const calls: { url: string; init?: FetchInit }[] = [];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    calls.length = 0;
    fetchMock = vi.fn(async (input: FetchInput, init?: FetchInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      const pathOnly = url.replace(/^\/api\/v1/, "").replace(/^.*\/v1/, "");
      const handler = routeHandlers[pathOnly] ?? routeHandlers[matchPrefix(pathOnly)];
      if (!handler) throw new Error(`unmocked fetch: ${url}`);
      return handler();
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function matchPrefix(p: string): string {
    if (p.startsWith("/brands/by-ids?")) return "/brands/by-ids?";
    if (p.startsWith("/campaigns?brandId=")) return "/campaigns?brandId=";
    if (p.startsWith("/campaigns/") && !p.endsWith("/stats")) return "/campaigns/:id";
    return p;
  }

  const routeHandlers: Record<string, () => Promise<MockResponse>> = {};

  it("getBrandsByIds skips network when ids is empty", async () => {
    const result = await getBrandsByIds([]);
    expect(result).toEqual({ brands: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getCampaign issues /campaigns/:id then /brands/by-ids and populates brandUrls", async () => {
    routeHandlers["/campaigns/:id"] = async () =>
      jsonResponse({
        campaign: {
          id: "c1",
          name: "Test",
          status: "ongoing",
          workflowSlug: "wf",
          featureSlug: "f",
          brandIds: ["b1", "b2"],
          featureInputs: null,
          maxBudgetDailyUsd: null,
          maxBudgetWeeklyUsd: null,
          maxBudgetMonthlyUsd: null,
          maxBudgetTotalUsd: null,
          endDate: null,
          toResumeAt: null,
          createdAt: "now",
          updatedAt: "now",
        },
      });
    routeHandlers["/brands/by-ids?"] = async () =>
      jsonResponse({
        brands: [
          { id: "b1", url: "https://one.com", name: "One", domain: "one.com", logoUrl: null, createdAt: null, updatedAt: null },
          { id: "b2", url: "https://two.com", name: "Two", domain: "two.com", logoUrl: null, createdAt: null, updatedAt: null },
        ],
      });

    const { campaign } = await getCampaign("c1");

    expect(calls.map((c) => c.url)).toEqual([
      "/api/v1/campaigns/c1",
      "/api/v1/brands/by-ids?ids=b1%2Cb2",
    ]);
    expect(campaign.brandUrls).toEqual(["https://one.com", "https://two.com"]);
  });

  it("listCampaigns dedup-unions brandIds into a single batch call", async () => {
    routeHandlers["/campaigns"] = async () =>
      jsonResponse({
        campaigns: [
          baseRaw("c1", ["b1", "b2"]),
          baseRaw("c2", ["b2", "b3"]),
          baseRaw("c3", []),
        ],
      });
    routeHandlers["/brands/by-ids?"] = async () =>
      jsonResponse({
        brands: [
          brand("b1", "https://one.com"),
          brand("b2", "https://two.com"),
          brand("b3", "https://three.com"),
        ],
      });

    const { campaigns } = await listCampaigns();

    const brandCalls = calls.filter((c) => c.url.includes("/brands/by-ids"));
    expect(brandCalls).toHaveLength(1);
    const sentIds = new URL(brandCalls[0].url, "http://localhost").searchParams.get("ids")!;
    expect(sentIds.split(",").sort()).toEqual(["b1", "b2", "b3"]);

    expect(campaigns[0].brandUrls).toEqual(["https://one.com", "https://two.com"]);
    expect(campaigns[1].brandUrls).toEqual(["https://two.com", "https://three.com"]);
    expect(campaigns[2].brandUrls).toEqual([]);
  });

  it("logs and omits a brand id that is missing from the batch response", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    routeHandlers["/campaigns/:id"] = async () =>
      jsonResponse({ campaign: baseRaw("c1", ["b1", "b-missing"]) });
    routeHandlers["/brands/by-ids?"] = async () =>
      jsonResponse({ brands: [brand("b1", "https://one.com")] });

    const { campaign } = await getCampaign("c1");

    expect(campaign.brandUrls).toEqual(["https://one.com"]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("brand id b-missing missing from /v1/brands/by-ids response"),
    );
  });

  it("skips the batch call entirely when no campaign has brandIds", async () => {
    routeHandlers["/campaigns"] = async () =>
      jsonResponse({ campaigns: [baseRaw("c1", []), baseRaw("c2", [])] });

    const { campaigns } = await listCampaigns();

    expect(calls.some((c) => c.url.includes("/brands/by-ids"))).toBe(false);
    expect(campaigns.every((c) => c.brandUrls.length === 0)).toBe(true);
  });

  it("listCampaignsByBrand enriches via the same batch pipeline", async () => {
    routeHandlers["/campaigns?brandId="] = async () =>
      jsonResponse({ campaigns: [baseRaw("c1", ["b1"])] });
    routeHandlers["/brands/by-ids?"] = async () =>
      jsonResponse({ brands: [brand("b1", "https://one.com")] });

    const { campaigns } = await listCampaignsByBrand("b1");

    expect(campaigns[0].brandUrls).toEqual(["https://one.com"]);
    expect(calls.some((c) => c.url.includes("/brands/by-ids?ids=b1"))).toBe(true);
  });
});

function baseRaw(id: string, brandIds: string[]) {
  return {
    id,
    name: id,
    status: "ongoing",
    workflowSlug: "wf",
    featureSlug: "f",
    brandIds,
    featureInputs: null,
    maxBudgetDailyUsd: null,
    maxBudgetWeeklyUsd: null,
    maxBudgetMonthlyUsd: null,
    maxBudgetTotalUsd: null,
    endDate: null,
    toResumeAt: null,
    createdAt: "now",
    updatedAt: "now",
  };
}

function brand(id: string, url: string) {
  return { id, url, name: id, domain: null, logoUrl: null, createdAt: null, updatedAt: null };
}
