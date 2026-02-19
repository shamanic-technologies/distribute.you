/**
 * Regression test: the performance leaderboard was showing wrong stats because:
 * 1. fetchCombinedDeliveryStats used wrong field names (sent/opened/clicked/replied
 *    instead of emailsSent/emailsOpened/emailsClicked/emailsReplied), so all
 *    delivery stats were always 0.
 * 2. It summed transactional + broadcast stats, but transactional stats are
 *    lifecycle/test emails via Postmark — only broadcast (Instantly) is relevant.
 *
 * Fix: renamed to fetchBroadcastDeliveryStats, use correct field names from
 * the email-gateway API, and only read broadcast stats (matching dashboard pattern).
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

const MOCK_CAMPAIGNS = {
  campaigns: [
    { id: "c1", brandId: "brand-1", brandUrl: "https://acme.com", brandDomain: "acme.com", brandName: "Acme" },
    { id: "c2", brandId: "brand-2", brandUrl: "https://widgets.com", brandDomain: "widgets.com", brandName: "Widgets" },
  ],
};

const MOCK_BUDGET = {
  results: {
    c1: { totalCostInUsdCents: "5000" },
    c2: { totalCostInUsdCents: "3000" },
  },
};

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

describe("GET /performance/leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return correct broadcast-only delivery stats with proper field names", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      if (path === "/campaigns/list") return Promise.resolve(MOCK_CAMPAIGNS);
      if (path === "/campaigns/batch-budget-usage") return Promise.resolve(MOCK_BUDGET);
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
        // Aggregate call (no brandId) — returns total broadcast stats
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

    mockCallService.mockImplementation((_url: string, path: string) => {
      if (path === "/stats/by-model") return Promise.resolve(MOCK_MODEL_STATS);
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);

    // Brand stats should use broadcast only
    const brand1 = res.body.brands.find((b: any) => b.brandId === "brand-1");
    expect(brand1.emailsSent).toBe(30);
    expect(brand1.emailsOpened).toBe(15);
    expect(brand1.emailsReplied).toBe(5);
    // Must NOT include transactional (100 sent)
    expect(brand1.emailsSent).not.toBe(130); // not 100+30

    const brand2 = res.body.brands.find((b: any) => b.brandId === "brand-2");
    expect(brand2.emailsSent).toBe(20);
    expect(brand2.emailsOpened).toBe(10);
    expect(brand2.emailsReplied).toBe(3);

    // Model stats should be distributed proportionally from broadcast aggregate
    const sonnet = res.body.models.find((m: any) => m.model === "claude-sonnet-4-5");
    const opus = res.body.models.find((m: any) => m.model === "claude-opus-4-5");
    // sonnet: 60/100 = 60% of 50 sent = 30
    expect(sonnet.emailsSent).toBe(30);
    // opus: 40/100 = 40% of 50 sent = 20
    expect(opus.emailsSent).toBe(20);

    // Rates should be computed
    expect(brand1.openRate).toBeGreaterThan(0);
    expect(brand1.replyRate).toBeGreaterThan(0);
  });

  it("should ignore transactional stats entirely", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((_service: any, path: string) => {
      if (path === "/campaigns/list") {
        return Promise.resolve({
          campaigns: [{ id: "c1", brandId: "brand-1", brandUrl: "https://acme.com", brandDomain: "acme.com", brandName: null }],
        });
      }
      if (path === "/campaigns/batch-budget-usage") {
        return Promise.resolve({ results: { c1: { totalCostInUsdCents: "1000" } } });
      }
      if (path === "/stats") {
        return Promise.resolve({
          transactional: {
            emailsSent: 500, emailsDelivered: 490, emailsOpened: 300,
            emailsClicked: 50, emailsReplied: 100, emailsBounced: 10,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 0, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 500,
          },
          broadcast: {
            emailsSent: 10, emailsDelivered: 9, emailsOpened: 5,
            emailsClicked: 1, emailsReplied: 2, emailsBounced: 1,
            repliesWillingToMeet: 0, repliesInterested: 0,
            repliesNotInterested: 0, repliesOutOfOffice: 0,
            repliesUnsubscribe: 0, recipients: 10,
          },
        });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: [{ model: "claude-sonnet-4-5", count: 10 }] });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);

    const brand = res.body.brands[0];
    // Only broadcast stats (10 sent, 5 opened, 2 replied)
    expect(brand.emailsSent).toBe(10);
    expect(brand.emailsOpened).toBe(5);
    expect(brand.emailsReplied).toBe(2);
    // NOT transactional values
    expect(brand.emailsSent).not.toBe(500);
    expect(brand.emailsSent).not.toBe(510); // not combined
  });

  it("should return zeros when broadcast is null", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((_service: any, path: string) => {
      if (path === "/campaigns/list") {
        return Promise.resolve({
          campaigns: [{ id: "c1", brandId: "brand-1", brandUrl: "https://a.com", brandDomain: "a.com", brandName: null }],
        });
      }
      if (path === "/campaigns/batch-budget-usage") {
        return Promise.resolve({ results: { c1: { totalCostInUsdCents: "1000" } } });
      }
      if (path === "/stats") {
        return Promise.resolve({
          transactional: { emailsSent: 100, emailsDelivered: 95, emailsOpened: 50, emailsClicked: 10, emailsReplied: 20, emailsBounced: 5, recipients: 100 },
          broadcast: null,
        });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: [{ model: "claude-sonnet-4-5", count: 5 }] });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);

    const brand = res.body.brands[0];
    // Broadcast is null => should be zeros
    expect(brand.emailsSent).toBe(0);
    expect(brand.emailsOpened).toBe(0);
    expect(brand.emailsReplied).toBe(0);
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

    // Should use broadcast-only function
    expect(content).toContain("fetchBroadcastDeliveryStats");
    expect(content).not.toContain("fetchCombinedDeliveryStats");
    // Should document broadcast-only approach
    expect(content).toContain("broadcast");
    // Should use correct email-gateway field names
    expect(content).toContain("b.emailsSent");
    expect(content).toContain("b.emailsOpened");
    expect(content).toContain("b.emailsClicked");
    expect(content).toContain("b.emailsReplied");
    // Should NOT use wrong field names
    expect(content).not.toMatch(/[bt]\.sent\b/);
    expect(content).not.toMatch(/[bt]\.opened\b/);
    expect(content).not.toMatch(/[bt]\.clicked\b/);
    expect(content).not.toMatch(/[bt]\.replied\b/);
  });
});
