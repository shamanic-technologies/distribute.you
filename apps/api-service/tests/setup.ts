import { beforeAll, afterAll, vi } from "vitest";

// Mock runs-client (used by brand router)
vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

// Mock fetch for service calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

process.env.API_SERVICE_API_KEY = "test-service-secret";
process.env.KEY_SERVICE_URL = "http://localhost:3001";
process.env.KEY_SERVICE_API_KEY = "test-key-service-api-key";
process.env.LEAD_SERVICE_URL = "http://localhost:3006";
process.env.CAMPAIGN_SERVICE_URL = "http://localhost:3004";
process.env.CAMPAIGN_SERVICE_API_KEY = "test-campaign-service-api-key";
process.env.CLIENT_SERVICE_URL = "http://localhost:3002";
process.env.CLIENT_SERVICE_API_KEY = "test-client-service-api-key";
process.env.EMAIL_GATEWAY_SERVICE_URL = "http://localhost:3009";
process.env.EMAIL_GATEWAY_SERVICE_API_KEY = "test-email-gateway-api-key";
process.env.CHAT_SERVICE_URL = "http://localhost:3021";
process.env.CHAT_SERVICE_API_KEY = "test-chat-service-api-key";
process.env.BILLING_SERVICE_URL = "http://localhost:3020";
process.env.BILLING_SERVICE_API_KEY = "test-billing-service-api-key";

beforeAll(() => console.log("Test suite starting..."));
afterAll(() => console.log("Test suite complete."));
