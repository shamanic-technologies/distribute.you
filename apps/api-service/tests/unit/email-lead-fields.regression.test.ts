/**
 * Regression test: emailgen service now populates dedicated lead columns
 * (lead_first_name, lead_last_name, lead_title, lead_company, lead_industry,
 * client_company_name) from variables during generation.
 * The API passes these through to the dashboard for the email preview page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCallExternalService = vi.fn();
const mockCallService = vi.fn();
const mockBuildInternalHeaders = vi.fn(() => ({}));
const mockGetRunsBatch = vi.fn();

vi.mock("../../src/lib/service-client.js", () => ({
  callExternalService: (...args: unknown[]) => mockCallExternalService(...args),
  callService: (...args: unknown[]) => mockCallService(...args),
  externalServices: {
    emailgen: { url: "http://mock-emailgen", apiKey: "k" },
    emailSending: { url: "http://mock-email", apiKey: "k" },
    replyQualification: { url: "http://mock-rq", apiKey: "k" },
    lead: { url: "http://mock-lead", apiKey: "k" },
    campaign: { url: "http://mock-campaign", apiKey: "k" },
    key: { url: "http://mock-key", apiKey: "k" },
    scraping: { url: "http://mock-scraping", apiKey: "k" },
    lifecycle: { url: "http://mock-lifecycle", apiKey: "k" },
  },
  services: {
    client: "http://mock-client",
  },
}));

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: (_req: any, _res: any, next: any) => {
    _req.userId = "user1";
    _req.orgId = "org1";
    next();
  },
  requireOrg: (_req: any, _res: any, next: any) => next(),
  requireUser: (_req: any, _res: any, next: any) => next(),
  AuthenticatedRequest: {},
}));

vi.mock("../../src/lib/internal-headers.js", () => ({
  buildInternalHeaders: (...args: unknown[]) => mockBuildInternalHeaders(...args),
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: (...args: unknown[]) => mockGetRunsBatch(...args),
}));

import express from "express";
import request from "supertest";
import campaignsRouter from "../../src/routes/campaigns.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1", campaignsRouter);
  return app;
}

describe("Email lead fields: passed through from emailgen dedicated columns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return lead fields from emailgen dedicated columns", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string) => {
      if (service.url === "http://mock-emailgen" && path.startsWith("/generations")) {
        return Promise.resolve({
          generations: [
            {
              id: "gen-1",
              subject: "Test Email",
              bodyHtml: "<p>Hello</p>",
              bodyText: "Hello",
              leadFirstName: "Thomas",
              leadLastName: "Bailey",
              leadTitle: "Outreach Director",
              leadCompany: "ECMC",
              leadIndustry: "financial services",
              clientCompanyName: "Sortes",
              generationRunId: null,
              createdAt: "2026-02-18T00:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve(null);
    });

    mockGetRunsBatch.mockResolvedValue(new Map());

    const res = await request(app).get("/v1/campaigns/test-campaign-123/emails");

    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(1);

    const email = res.body.emails[0];
    expect(email.leadFirstName).toBe("Thomas");
    expect(email.leadLastName).toBe("Bailey");
    expect(email.leadTitle).toBe("Outreach Director");
    expect(email.leadCompany).toBe("ECMC");
    expect(email.leadIndustry).toBe("financial services");
    expect(email.clientCompanyName).toBe("Sortes");
  });

  it("should return empty emails array when no generations exist", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string) => {
      if (service.url === "http://mock-emailgen" && path.startsWith("/generations")) {
        return Promise.resolve({ generations: [] });
      }
      return Promise.resolve(null);
    });
    mockGetRunsBatch.mockResolvedValue(new Map());

    const res = await request(app).get("/v1/campaigns/test-campaign-456/emails");

    expect(res.status).toBe(200);
    expect(res.body.emails).toEqual([]);
  });
});
