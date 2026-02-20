/**
 * Regression test: the performance leaderboard had multiple bugs:
 * 1. fetchCombinedDeliveryStats used wrong field names (sent/opened/clicked/replied
 *    instead of emailsSent/emailsOpened/emailsClicked/emailsReplied), so all
 *    delivery stats were always 0.
 * 2. It summed transactional + broadcast stats, but transactional stats are
 *    lifecycle/test emails via Postmark — only broadcast (Instantly) is relevant.
 * 3. buildLeaderboardData relied on /campaigns/list which only returns ongoing
 *    campaigns, so brands was always empty when all campaigns were stopped.
 * 4. Campaign costs came from campaign-service which only lists ongoing campaigns.
 *
 * Fix: Use brand-service as source of truth for brands (like dashboard does),
 * use correct field names, only read broadcast stats,
 * use runs-service /v1/stats/costs for costs (aggregates across all run statuses).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCallExternalService = vi.fn();
const mockCallService = vi.fn();

vi.mock("../../src/lib/service-client.js", () => ({
  callExternalService: (...args: unknown[]) => mockCallExternalService(...args),
  callService: (...args: unknown[]) => mockCallService(...args),
  externalServices: {
    emailSending: { url: "http://mock-email", apiKey: "k" },
    campaign: { url: "http://mock-campaign", apiKey: "k" },
    lead: { url: "http://mock-lead", apiKey: "k" },
    key: { url: "http://mock-key", apiKey: "k" },
    replyQualification: { url: "http://mock-rq", apiKey: "k" },
    scraping: { url: "http://mock-scraping", apiKey: "k" },
    lifecycle: { url: "http://mock-lifecycle", apiKey: "k" },
    brand: { url: "http://mock-brand", apiKey: "k" },
    runs: { url: "http://mock-runs", apiKey: "k" },
  },
  services: {
    emailgen: "http://mock-emailgen",
    client: "http://mock-client",
  },
}));

import express from "express";
import request from "supertest";
import performanceRouter from "../../src/routes/performance.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(performanceRouter);
  return app;
}

const MOCK_MODEL_STATS = {
  stats: [
    { model: "claude-sonnet-4-5", count: 60 },
    { model: "claude-opus-4-5", count: 40 },
  ],
};

function makeGatewayResponse(broadcast: Record<string, number> | null, transactional: Record<string, number> | null = null) {
  return {
    transactional: transactional ?? {
      emailsSent: 100, emailsDelivered: 95, emailsOpened: 50,
      emailsClicked: 10, emailsReplied: 20, emailsBounced: 5,
      repliesWillingToMeet: 0, repliesInterested: 0,
      repliesNotInterested: 0, repliesOutOfOffice: 0,
      repliesUnsubscribe: 0, recipients: 100,
    },
    broadcast,
  };
}

/** Helper: set up mocks for the standard brand-service + runs-service flow */
function setupBrandMocks(brands: Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>, costGroups: Array<{ dimensions: { brandId: string }; actualCostInUsdCents: number }> = []) {
  return (_service: any, path: string, opts: any) => {
    // Brand-service: /clerk-ids
    if (path === "/clerk-ids") {
      return Promise.resolve({ clerk_organization_ids: ["org-1"] });
    }
    // Brand-service: /brands?clerkOrgId=...
    if (path.startsWith("/brands?clerkOrgId=")) {
      return Promise.resolve({ brands });
    }
    // Runs-service: /v1/stats/costs
    if (path.startsWith("/v1/stats/costs")) {
      return Promise.resolve({ groups: costGroups });
    }
    return null; // Will be handled by per-test overrides
  };
}

describe("GET /performance/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return brands from brand-service even when /campaigns/list returns empty", async () => {
    const app = createApp();
    const brands = [
      { id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" },
      { id: "brand-2", domain: "widgets.com", name: "Widgets", brandUrl: "https://widgets.com" },
    ];

    const brandMock = setupBrandMocks(brands);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const brandResult = brandMock(_service, path, opts);
      if (brandResult !== null) return brandResult;

      // Email-gateway stats
      if (path === "/stats") {
        const body = opts?.body || {};
        if (body.brandId === "brand-1") {
          return Promise.resolve(makeGatewayResponse({
            emailsSent: 30, emailsDelivered: 28, emailsOpened: 15,
            emailsClicked: 3, emailsReplied: 5, emailsBounced: 2,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 0, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 30,
          }));
        }
        if (body.brandId === "brand-2") {
          return Promise.resolve(makeGatewayResponse({
            emailsSent: 20, emailsDelivered: 19, emailsOpened: 10,
            emailsClicked: 2, emailsReplied: 3, emailsBounced: 1,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 0, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 20,
          }));
        }
        return Promise.resolve(makeGatewayResponse({
          emailsSent: 50, emailsDelivered: 47, emailsOpened: 25,
          emailsClicked: 5, emailsReplied: 8, emailsBounced: 3,
          repliesWillingToMeet: 0, repliesInterested: 0,
          repliesNotInterested: 0, repliesOutOfOffice: 0,
          repliesUnsubscribe: 0, recipients: 50,
        }));
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue(MOCK_MODEL_STATS);

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    // Brands should come from brand-service, NOT /campaigns/list
    expect(res.body.brands).toHaveLength(2);

    const brand1 = res.body.brands.find((b: any) => b.brandId === "brand-1");
    expect(brand1).toBeDefined();
    expect(brand1.brandDomain).toBe("acme.com");
    expect(brand1.emailsSent).toBe(30);
    expect(brand1.emailsOpened).toBe(15);
    expect(brand1.emailsReplied).toBe(5);

    const brand2 = res.body.brands.find((b: any) => b.brandId === "brand-2");
    expect(brand2).toBeDefined();
    expect(brand2.emailsSent).toBe(20);

    // Model stats should be distributed proportionally
    const sonnet = res.body.models.find((m: any) => m.model === "claude-sonnet-4-5");
    expect(sonnet.emailsSent).toBe(30); // 60% of 50
    const opus = res.body.models.find((m: any) => m.model === "claude-opus-4-5");
    expect(opus.emailsSent).toBe(20); // 40% of 50
  });

  it("should ignore transactional stats entirely", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];

    const brandMock = setupBrandMocks(brands);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const brandResult = brandMock(_service, path, opts);
      if (brandResult !== null) return brandResult;

      if (path === "/stats") {
        return Promise.resolve({
          transactional: {
            emailsSent: 500, emailsDelivered: 490, emailsOpened: 300,
            emailsClicked: 50, emailsReplied: 100, emailsBounced: 10,
          },
          broadcast: {
            emailsSent: 10, emailsDelivered: 9, emailsOpened: 5,
            emailsClicked: 1, emailsReplied: 2, emailsBounced: 1,
          },
        });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: [{ model: "claude-sonnet-4-5", count: 10 }] });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const brand = res.body.brands[0];
    expect(brand.emailsSent).toBe(10);
    expect(brand.emailsOpened).toBe(5);
    expect(brand.emailsReplied).toBe(2);
    expect(brand.emailsSent).not.toBe(500);
    expect(brand.emailsSent).not.toBe(510);
  });

  it("should return zeros when broadcast is null", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "a.com", name: null, brandUrl: "https://a.com" }];

    const brandMock = setupBrandMocks(brands);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const brandResult = brandMock(_service, path, opts);
      if (brandResult !== null) return brandResult;

      if (path === "/stats") {
        return Promise.resolve({
          transactional: { emailsSent: 100, emailsOpened: 50, emailsClicked: 10, emailsReplied: 20, emailsBounced: 5 },
          broadcast: null,
        });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: [{ model: "claude-sonnet-4-5", count: 5 }] });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const brand = res.body.brands[0];
    expect(brand.emailsSent).toBe(0);
    expect(brand.emailsOpened).toBe(0);
    expect(brand.emailsReplied).toBe(0);
  });

  it("should include costs from runs-service /v1/stats/costs", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];
    const costGroups = [
      { dimensions: { brandId: "brand-1" }, actualCostInUsdCents: 8000, totalCostInUsdCents: 10000, runCount: 5 },
    ];

    const brandMock = setupBrandMocks(brands, costGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = brandMock(_service, path, opts);
      if (result !== null) return result;

      if (path === "/stats") {
        return Promise.resolve(makeGatewayResponse({ emailsSent: 10, emailsDelivered: 9, emailsOpened: 5, emailsClicked: 1, emailsReplied: 2, emailsBounced: 0 }));
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: [{ model: "claude-sonnet-4-5", count: 10 }] });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const brand = res.body.brands[0];
    // Uses actualCostInUsdCents (8000), not totalCostInUsdCents (10000)
    expect(brand.totalCostUsdCents).toBe(8000);
  });
});

describe("Regression: performance leaderboard must use broadcast-only stats", () => {
  it("source code should only read broadcast stats, not combine transactional + broadcast", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    expect(content).toContain("fetchBroadcastDeliveryStats");
    expect(content).not.toContain("fetchCombinedDeliveryStats");
    expect(content).toContain("b.emailsSent");
    expect(content).toContain("b.emailsOpened");
    expect(content).toContain("b.emailsClicked");
    expect(content).toContain("b.emailsReplied");
    expect(content).not.toMatch(/[bt]\.sent\b/);
    expect(content).not.toMatch(/[bt]\.opened\b/);
    expect(content).not.toMatch(/[bt]\.clicked\b/);
    expect(content).not.toMatch(/[bt]\.replied\b/);
  });

  it("should use brand-service as data source, not only /campaigns/list", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    expect(content).toContain("fetchAllBrands");
    expect(content).toContain("/clerk-ids");
    expect(content).toContain("/brands?clerkOrgId=");
  });
});
