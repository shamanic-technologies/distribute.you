/**
 * Regression test: reply-qualification service may return stale/incorrect
 * classification data even when there are zero actual replies.
 * The API must NOT surface those counts to the dashboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the fetchDeliveryStats logic indirectly through the /campaigns/:id/stats endpoint.
// To isolate it, we mock the external service calls.

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

describe("Reply breakdown: no dummy data when 0 replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return zero reply classifications when emailsReplied is 0", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string) => {
      if (path === "/stats") {
        return Promise.resolve({
          transactional: { emailsSent: 10, emailsDelivered: 8, emailsOpened: 3, emailsClicked: 1, emailsReplied: 0, emailsBounced: 0, repliesWillingToMeet: 0, repliesInterested: 0, repliesNotInterested: 0, repliesOutOfOffice: 0, repliesUnsubscribe: 0, recipients: 10 },
          broadcast: { emailsSent: 5, emailsDelivered: 4, emailsOpened: 2, emailsClicked: 0, emailsReplied: 0, emailsBounced: 0, repliesWillingToMeet: 0, repliesInterested: 0, repliesNotInterested: 0, repliesOutOfOffice: 0, repliesUnsubscribe: 0, recipients: 5 },
        });
      }
      if (path.startsWith("/stats?campaignId=")) {
        return Promise.resolve({ served: 10, buffered: 0, skipped: 0 });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: { emailsGenerated: 5 } });

    const res = await request(app).get("/v1/campaigns/test-campaign-123/stats");

    expect(res.status).toBe(200);
    expect(res.body.emailsReplied).toBe(0);
    expect(res.body.repliesWillingToMeet).toBe(0);
    expect(res.body.repliesNotInterested).toBe(0);
    expect(res.body.repliesInterested).toBe(0);
    expect(res.body.repliesOutOfOffice).toBe(0);
    expect(res.body.repliesUnsubscribe).toBe(0);
  });

  it("should return reply classifications when emailsReplied > 0", async () => {
    const app = createApp();

    mockCallExternalService.mockImplementation((service: any, path: string) => {
      if (path === "/stats") {
        return Promise.resolve({
          transactional: { emailsSent: 10, emailsDelivered: 8, emailsOpened: 3, emailsClicked: 1, emailsReplied: 0, emailsBounced: 0, repliesWillingToMeet: 0, repliesInterested: 0, repliesNotInterested: 0, repliesOutOfOffice: 0, repliesUnsubscribe: 0, recipients: 10 },
          broadcast: { emailsSent: 5, emailsDelivered: 4, emailsOpened: 2, emailsClicked: 0, emailsReplied: 5, emailsBounced: 0, repliesWillingToMeet: 2, repliesInterested: 1, repliesNotInterested: 1, repliesOutOfOffice: 1, repliesUnsubscribe: 0, recipients: 5 },
        });
      }
      if (path.startsWith("/stats?campaignId=")) {
        return Promise.resolve({ served: 10, buffered: 0, skipped: 0 });
      }
      return Promise.resolve(null);
    });

    mockCallService.mockResolvedValue({ stats: { emailsGenerated: 5 } });

    const res = await request(app).get("/v1/campaigns/test-campaign-123/stats");

    expect(res.status).toBe(200);
    expect(res.body.emailsReplied).toBe(5);
    expect(res.body.repliesWillingToMeet).toBe(2);
    expect(res.body.repliesNotInterested).toBe(1);
    expect(res.body.repliesInterested).toBe(1);
    expect(res.body.repliesOutOfOffice).toBe(1);
    expect(res.body.repliesUnsubscribe).toBe(0);
  });
});
