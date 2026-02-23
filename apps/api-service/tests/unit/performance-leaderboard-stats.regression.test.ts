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
 * 5. Switched to runs-service public leaderboard endpoint with string cost values.
 * 6. Added workflow category filtering using shared content mapping.
 *
 * Fix: Use brand-service as source of truth for brands (like dashboard does),
 * use correct field names, only read broadcast stats,
 * use runs-service /v1/stats/public/leaderboard for costs (public, cross-org, string values).
 * Categories come from @mcpfactory/content workflow definitions (prefix matching).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCallExternalService = vi.fn();

vi.mock("../../src/lib/service-client.js", () => ({
  callExternalService: (...args: unknown[]) => mockCallExternalService(...args),
  externalServices: {
    emailgen: { url: "http://mock-emailgen", apiKey: "k" },
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

/** Runs-service public leaderboard returns costs as strings */
interface MockRunsGroup {
  dimensions: Record<string, string>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

/** Helper: set up mocks for brand-service + runs-service public leaderboard */
function setupMocks(
  brands: Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>,
  brandCostGroups: MockRunsGroup[] = [],
  workflowGroups: MockRunsGroup[] = [],
) {
  return (_service: any, path: string, opts: any) => {
    // Brand-service: /clerk-ids
    if (path === "/clerk-ids") {
      return Promise.resolve({ clerk_organization_ids: ["org-1"] });
    }
    // Brand-service: /brands?clerkOrgId=...
    if (path.startsWith("/brands?clerkOrgId=")) {
      return Promise.resolve({ brands });
    }
    // Runs-service: /v1/stats/public/leaderboard
    if (path.startsWith("/v1/stats/public/leaderboard")) {
      if (path.includes("groupBy=brandId")) {
        return Promise.resolve({ groups: brandCostGroups });
      }
      if (path.includes("groupBy=workflowName")) {
        return Promise.resolve({ groups: workflowGroups });
      }
      return Promise.resolve({ groups: [] });
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

  it("should return brands from brand-service with workflow stats from runs-service", async () => {
    const app = createApp();
    const brands = [
      { id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" },
      { id: "brand-2", domain: "widgets.com", name: "Widgets", brandUrl: "https://widgets.com" },
    ];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "sales-cold-email-v1" }, totalCostInUsdCents: "5000.0000", actualCostInUsdCents: "4000.0000", provisionedCostInUsdCents: "1000.0000", cancelledCostInUsdCents: "0", runCount: 10 },
      { dimensions: { workflowName: "journalist-outreach-v1" }, totalCostInUsdCents: "3000.0000", actualCostInUsdCents: "2000.0000", provisionedCostInUsdCents: "1000.0000", cancelledCostInUsdCents: "0", runCount: 5 },
    ];

    const mock = setupMocks(brands, [], workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;

      // Email-gateway stats
      if (path === "/stats") {
        const body = opts?.body || {};
        if (body.brandId === "brand-1") {
          return Promise.resolve(makeGatewayResponse({
            emailsSent: 30, emailsDelivered: 28, emailsOpened: 15,
            emailsClicked: 3, emailsReplied: 5, emailsBounced: 2,
          }));
        }
        if (body.brandId === "brand-2") {
          return Promise.resolve(makeGatewayResponse({
            emailsSent: 20, emailsDelivered: 19, emailsOpened: 10,
            emailsClicked: 2, emailsReplied: 3, emailsBounced: 1,
          }));
        }
        return Promise.resolve(makeGatewayResponse({
          emailsSent: 50, emailsDelivered: 47, emailsOpened: 25,
          emailsClicked: 5, emailsReplied: 8, emailsBounced: 3,
        }));
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    // Brands should come from brand-service
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

    // Workflows should come from runs-service public endpoint
    expect(res.body.workflows).toHaveLength(2);
    const salesWf = res.body.workflows.find((w: any) => w.workflowName === "sales-cold-email-v1");
    expect(salesWf).toBeDefined();
    expect(salesWf.totalCostUsdCents).toBe(4000); // actualCostInUsdCents parsed from string
    expect(salesWf.runCount).toBe(10);

    // Workflow category and display name from shared content mapping
    expect(salesWf.category).toBe("sales");
    expect(salesWf.displayName).toBe("Sales Cold Email");

    const journalistWf = res.body.workflows.find((w: any) => w.workflowName === "journalist-outreach-v1");
    expect(journalistWf).toBeDefined();
    expect(journalistWf.category).toBe("pr");
    expect(journalistWf.displayName).toBe("Journalist Outreach");

    // availableCategories should list both categories
    expect(res.body.availableCategories).toContain("sales");
    expect(res.body.availableCategories).toContain("pr");

    // Workflow delivery stats distributed proportionally by cost
    // sales: 4000/6000 = 66.7%, journalist: 2000/6000 = 33.3%
    expect(salesWf.emailsSent).toBe(33); // Math.round(50 * 4000/6000)
  });

  it("should ignore transactional stats entirely", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];

    const mock = setupMocks(brands);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;

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

    const mock = setupMocks(brands);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;

      if (path === "/stats") {
        return Promise.resolve({
          transactional: { emailsSent: 100, emailsOpened: 50, emailsClicked: 10, emailsReplied: 20, emailsBounced: 5 },
          broadcast: null,
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const brand = res.body.brands[0];
    expect(brand.emailsSent).toBe(0);
    expect(brand.emailsOpened).toBe(0);
    expect(brand.emailsReplied).toBe(0);
  });

  it("should parseFloat string cost values from runs-service public leaderboard", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];
    const brandCostGroups: MockRunsGroup[] = [
      { dimensions: { brandId: "brand-1" }, totalCostInUsdCents: "10000.5000000000", actualCostInUsdCents: "8000.3000000000", provisionedCostInUsdCents: "2000.2000000000", cancelledCostInUsdCents: "0", runCount: 5 },
    ];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "cold-email-v1" }, totalCostInUsdCents: "10000.5000000000", actualCostInUsdCents: "8000.3000000000", provisionedCostInUsdCents: "2000.2000000000", cancelledCostInUsdCents: "0", runCount: 5 },
    ];

    const mock = setupMocks(brands, brandCostGroups, workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;

      if (path === "/stats") {
        return Promise.resolve(makeGatewayResponse({ emailsSent: 10, emailsDelivered: 9, emailsOpened: 5, emailsClicked: 1, emailsReplied: 2, emailsBounced: 0 }));
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const brand = res.body.brands[0];
    // parseFloat("8000.3000000000") → 8000.3, Math.round → 8000
    expect(brand.totalCostUsdCents).toBe(8000);

    const wf = res.body.workflows[0];
    expect(wf.totalCostUsdCents).toBe(8000);
    expect(wf.workflowName).toBe("cold-email-v1");
    expect(wf.runCount).toBe(5);
    // "cold-email-v1" matches the "cold-email" pattern → category "sales"
    expect(wf.category).toBe("sales");
    expect(wf.displayName).toBe("Cold Email");
  });

  it("should exclude workflows with null/empty workflowName from leaderboard", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];
    const workflowGroups: MockRunsGroup[] = [
      // Valid workflow
      { dimensions: { workflowName: "cold-email-outreach" }, totalCostInUsdCents: "5000.0000", actualCostInUsdCents: "5000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 10 },
      // NULL workflow name (should be excluded)
      { dimensions: { workflowName: "" }, totalCostInUsdCents: "9000.0000", actualCostInUsdCents: "9000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 100 },
    ];

    const mock = setupMocks(brands, [], workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;
      if (path === "/stats") return Promise.resolve(makeGatewayResponse({ emailsSent: 10, emailsDelivered: 9, emailsOpened: 5, emailsClicked: 1, emailsReplied: 2, emailsBounced: 0 }));
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    // Only the valid workflow should appear
    expect(res.body.workflows).toHaveLength(1);
    expect(res.body.workflows[0].workflowName).toBe("cold-email-outreach");
    expect(res.body.workflows[0].displayName).toBe("Cold Email Outreach");
    expect(res.body.workflows[0].category).toBe("sales");
    // "unknown" should never appear
    expect(res.body.workflows.find((w: any) => w.workflowName === "unknown")).toBeUndefined();
  });

  it("should return categorySections grouped by workflow category", async () => {
    const app = createApp();
    const brands = [
      { id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" },
    ];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "sales-cold-email-v1" }, totalCostInUsdCents: "4000.0000", actualCostInUsdCents: "4000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 10 },
      { dimensions: { workflowName: "journalist-outreach-v1" }, totalCostInUsdCents: "2000.0000", actualCostInUsdCents: "2000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 5 },
    ];

    const mock = setupMocks(brands, [], workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;
      if (path === "/stats") {
        const body = opts?.body || {};
        if (body.brandId) {
          return Promise.resolve(makeGatewayResponse({ emailsSent: 50, emailsDelivered: 47, emailsOpened: 25, emailsClicked: 5, emailsReplied: 8, emailsBounced: 3 }));
        }
        return Promise.resolve(makeGatewayResponse({ emailsSent: 50, emailsDelivered: 47, emailsOpened: 25, emailsClicked: 5, emailsReplied: 8, emailsBounced: 3 }));
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    expect(res.body.categorySections).toBeDefined();
    expect(res.body.categorySections.length).toBe(2);

    const salesSection = res.body.categorySections.find((s: any) => s.category === "sales");
    expect(salesSection).toBeDefined();
    expect(salesSection.label).toBe("Sales Cold Email Outreach");
    expect(salesSection.workflows).toHaveLength(1);
    expect(salesSection.workflows[0].workflowName).toBe("sales-cold-email-v1");
    expect(salesSection.stats).toBeDefined();
    expect(salesSection.stats.totalCostUsdCents).toBe(4000);
    // Brands are included in all sections for now
    expect(salesSection.brands).toHaveLength(1);

    const prSection = res.body.categorySections.find((s: any) => s.category === "pr");
    expect(prSection).toBeDefined();
    expect(prSection.label).toBe("PR & Media Outreach");
    expect(prSection.workflows).toHaveLength(1);
  });

  it("should return null category for unknown workflow names", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "unknown-workflow-v1" }, totalCostInUsdCents: "1000.0000", actualCostInUsdCents: "1000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 2 },
    ];

    const mock = setupMocks(brands, [], workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;
      if (path === "/stats") return Promise.resolve(makeGatewayResponse(null));
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    const wf = res.body.workflows[0];
    expect(wf.category).toBeNull();
    expect(wf.displayName).toBe("Unknown Workflow V1"); // fallback title-case
    // Unknown categories should not appear in availableCategories
    expect(res.body.availableCategories).toHaveLength(0);
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

  it("should use brand-service and runs-service public leaderboard", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    expect(content).toContain("fetchAllBrands");
    expect(content).toContain("/clerk-ids");
    expect(content).toContain("/brands?clerkOrgId=");
    expect(content).toContain("/v1/stats/public/leaderboard");
    expect(content).toContain("parseFloat");
  });

  it("should filter out null/empty workflowName groups to prevent 'unknown' entries", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    // Source must filter before mapping, not default to "unknown"
    expect(content).toContain(".filter((g) => g.dimensions.workflowName)");
    expect(content).not.toContain('|| "unknown"');
  });

  it("should use workflow category mapping from shared content", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    expect(content).toContain("getWorkflowCategory");
    expect(content).toContain("getWorkflowDisplayName");
    expect(content).toContain("@mcpfactory/content");
    expect(content).toContain("availableCategories");
  });
});
