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
 * 6. Workflows use {category}-{channel}-{audienceType}-{signatureName} naming.
 *
 * Fix: Use brand-service as source of truth for brands (like dashboard does),
 * use correct field names, only read broadcast stats,
 * use runs-service /v1/stats/public/leaderboard for costs (public, cross-org, string values).
 * Categories parsed from workflow name format via @mcpfactory/content.
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
      { dimensions: { workflowName: "sales-email-cold-outreach-sienna" }, totalCostInUsdCents: "5000.0000", actualCostInUsdCents: "4000.0000", provisionedCostInUsdCents: "1000.0000", cancelledCostInUsdCents: "0", runCount: 10 },
      { dimensions: { workflowName: "sales-email-cold-outreach-darmstadt" }, totalCostInUsdCents: "3000.0000", actualCostInUsdCents: "2000.0000", provisionedCostInUsdCents: "1000.0000", cancelledCostInUsdCents: "0", runCount: 5 },
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
    const siennaWf = res.body.workflows.find((w: any) => w.workflowName === "sales-email-cold-outreach-sienna");
    expect(siennaWf).toBeDefined();
    expect(siennaWf.totalCostUsdCents).toBe(4000); // actualCostInUsdCents parsed from string
    expect(siennaWf.runCount).toBe(10);

    // New format: category parsed from name, signatureName extracted
    expect(siennaWf.category).toBe("sales");
    expect(siennaWf.displayName).toBe("Sienna");
    expect(siennaWf.signatureName).toBe("sienna");
    expect(siennaWf.sectionKey).toBe("sales-email-cold-outreach");

    const darmstadtWf = res.body.workflows.find((w: any) => w.workflowName === "sales-email-cold-outreach-darmstadt");
    expect(darmstadtWf).toBeDefined();
    expect(darmstadtWf.category).toBe("sales");
    expect(darmstadtWf.displayName).toBe("Darmstadt");
    expect(darmstadtWf.signatureName).toBe("darmstadt");

    // availableCategories
    expect(res.body.availableCategories).toContain("sales");

    // Workflow delivery stats distributed proportionally by cost
    // sienna: 4000/6000 = 66.7%, darmstadt: 2000/6000 = 33.3%
    expect(siennaWf.emailsSent).toBe(33); // Math.round(50 * 4000/6000)
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
      { dimensions: { workflowName: "sales-email-cold-outreach-phoenix" }, totalCostInUsdCents: "10000.5000000000", actualCostInUsdCents: "8000.3000000000", provisionedCostInUsdCents: "2000.2000000000", cancelledCostInUsdCents: "0", runCount: 5 },
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
    expect(wf.workflowName).toBe("sales-email-cold-outreach-phoenix");
    expect(wf.runCount).toBe(5);
    expect(wf.category).toBe("sales");
    expect(wf.signatureName).toBe("phoenix");
    expect(wf.displayName).toBe("Phoenix");
  });

  it("should keep workflows with empty workflowName as 'unknown'", async () => {
    const app = createApp();
    const brands = [{ id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" }];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "sales-email-cold-outreach-sienna" }, totalCostInUsdCents: "5000.0000", actualCostInUsdCents: "5000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 10 },
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
    expect(res.body.workflows).toHaveLength(2);
    const sienna = res.body.workflows.find((w: any) => w.workflowName === "sales-email-cold-outreach-sienna");
    expect(sienna).toBeDefined();
    expect(sienna.signatureName).toBe("sienna");
    const unknown = res.body.workflows.find((w: any) => w.workflowName === "unknown");
    expect(unknown).toBeDefined();
    expect(unknown.displayName).toBe("Unknown");
    expect(unknown.category).toBeNull();
    expect(unknown.signatureName).toBeNull();
  });

  it("should return categorySections grouped by sectionKey", async () => {
    const app = createApp();
    const brands = [
      { id: "brand-1", domain: "acme.com", name: "Acme", brandUrl: "https://acme.com" },
    ];
    const workflowGroups: MockRunsGroup[] = [
      { dimensions: { workflowName: "sales-email-cold-outreach-sienna" }, totalCostInUsdCents: "4000.0000", actualCostInUsdCents: "4000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 10 },
      { dimensions: { workflowName: "sales-email-cold-outreach-darmstadt" }, totalCostInUsdCents: "2000.0000", actualCostInUsdCents: "2000.0000", provisionedCostInUsdCents: "0", cancelledCostInUsdCents: "0", runCount: 5 },
    ];

    const mock = setupMocks(brands, [], workflowGroups);
    mockCallExternalService.mockImplementation((_service: any, path: string, opts: any) => {
      const result = mock(_service, path, opts);
      if (result !== null) return result;
      if (path === "/stats") {
        return Promise.resolve(makeGatewayResponse({ emailsSent: 50, emailsDelivered: 47, emailsOpened: 25, emailsClicked: 5, emailsReplied: 8, emailsBounced: 3 }));
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get("/performance/leaderboard");

    expect(res.status).toBe(200);
    expect(res.body.categorySections).toBeDefined();
    // Both workflows share the same sectionKey "sales-email-cold-outreach"
    expect(res.body.categorySections.length).toBe(1);

    const section = res.body.categorySections[0];
    expect(section.sectionKey).toBe("sales-email-cold-outreach");
    expect(section.label).toBe("Sales Cold Email Outreach");
    expect(section.category).toBe("sales");
    expect(section.workflows).toHaveLength(2);
    expect(section.stats.totalCostUsdCents).toBe(6000); // 4000 + 2000

    // Workflows should have signatureName
    const sienna = section.workflows.find((w: any) => w.workflowName === "sales-email-cold-outreach-sienna");
    expect(sienna).toBeDefined();
    expect(sienna.signatureName).toBe("sienna");
    expect(sienna.displayName).toBe("Sienna");
    expect(sienna.sectionKey).toBe("sales-email-cold-outreach");

    const darmstadt = section.workflows.find((w: any) => w.workflowName === "sales-email-cold-outreach-darmstadt");
    expect(darmstadt).toBeDefined();
    expect(darmstadt.signatureName).toBe("darmstadt");

    // Brands included in the section
    expect(section.brands).toHaveLength(1);
  });

  it("should return null category for non-standard workflow names", async () => {
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
    expect(wf.sectionKey).toBeNull();
    expect(wf.signatureName).toBeNull();
    expect(wf.displayName).toBe("Unknown Workflow V1"); // fallback title-case
    // Non-standard workflows should not appear in availableCategories or sections
    expect(res.body.availableCategories).toHaveLength(0);
    expect(res.body.categorySections).toHaveLength(0);
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

  it("should use workflow name parsing from shared content", () => {
    const fs = require("fs");
    const path = require("path");
    const content = fs.readFileSync(
      path.join(__dirname, "../../src/routes/performance.ts"),
      "utf-8"
    );

    expect(content).toContain("getWorkflowCategory");
    expect(content).toContain("getWorkflowDisplayName");
    expect(content).toContain("getSectionKey");
    expect(content).toContain("getSignatureName");
    expect(content).toContain("SECTION_LABELS");
    expect(content).toContain("@mcpfactory/content");
    expect(content).toContain("availableCategories");
  });
});
