/**
 * Regression test: the email-sending service was renamed to email-gateway.
 * The env vars must use EMAIL_GATEWAY_SERVICE_* so the stats fetch resolves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Email gateway env var naming", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should read emailSending config from EMAIL_GATEWAY_SERVICE_* env vars", async () => {
    process.env.EMAIL_GATEWAY_SERVICE_URL = "https://email-gateway.mcpfactory.org";
    process.env.EMAIL_GATEWAY_SERVICE_API_KEY = "test-gw-key";

    const { externalServices } = await import("../../src/lib/service-client.js");

    expect(externalServices.emailSending.url).toBe("https://email-gateway.mcpfactory.org");
    expect(externalServices.emailSending.apiKey).toBe("test-gw-key");
  });

  it("should NOT read from old EMAIL_SENDING_SERVICE_* env vars", async () => {
    delete process.env.EMAIL_GATEWAY_SERVICE_URL;
    delete process.env.EMAIL_GATEWAY_SERVICE_API_KEY;
    process.env.EMAIL_SENDING_SERVICE_URL = "https://old-url.example.com";
    process.env.EMAIL_SENDING_SERVICE_API_KEY = "old-key";

    const { externalServices } = await import("../../src/lib/service-client.js");

    // Should fall back to default, not pick up the old env var
    expect(externalServices.emailSending.url).toBe("http://localhost:3009");
    expect(externalServices.emailSending.apiKey).toBe("");

    // cleanup
    delete process.env.EMAIL_SENDING_SERVICE_URL;
    delete process.env.EMAIL_SENDING_SERVICE_API_KEY;
  });
});
