import { beforeAll, afterAll, vi } from "vitest";

// Mock Clerk
vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn().mockResolvedValue({
    sub: "user_test123",
    org_id: "org_test456",
  }),
}));

// Mock runs-client (used by brand router)
vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

// Mock fetch for service calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

process.env.CLERK_SECRET_KEY = "test_clerk_secret_key";
process.env.API_SERVICE_API_KEY = "test-service-secret";
process.env.KEY_SERVICE_URL = "http://localhost:3001";
process.env.KEY_SERVICE_API_KEY = "test-key-service-api-key";
process.env.LEAD_SERVICE_URL = "http://localhost:3006";
process.env.CAMPAIGN_SERVICE_URL = "http://localhost:3004";
process.env.CAMPAIGN_SERVICE_API_KEY = "test-campaign-service-api-key";
process.env.CLIENT_SERVICE_URL = "http://localhost:3002";
process.env.EMAIL_SENDING_SERVICE_URL = "http://localhost:3009";
process.env.EMAIL_SENDING_SERVICE_API_KEY = "test-email-sending-api-key";

beforeAll(() => console.log("Test suite starting..."));
afterAll(() => console.log("Test suite complete."));
