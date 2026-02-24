/**
 * Regression test: the emailgen service-client key was using EMAILGENERATION_SERVICE_*
 * env vars, but Railway has CONTENT_GENERATION_SERVICE_*. The mismatch caused the
 * API key to be empty, resulting in 401s that were silently caught, making
 * emailsGenerated always return 0 on the dashboard.
 *
 * Fix: renamed env vars to CONTENT_GENERATION_SERVICE_* to match Railway config.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Content-generation env var naming", () => {
  const savedUrl = process.env.CONTENT_GENERATION_SERVICE_URL;
  const savedKey = process.env.CONTENT_GENERATION_SERVICE_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env
    if (savedUrl !== undefined) process.env.CONTENT_GENERATION_SERVICE_URL = savedUrl;
    else delete process.env.CONTENT_GENERATION_SERVICE_URL;
    if (savedKey !== undefined) process.env.CONTENT_GENERATION_SERVICE_API_KEY = savedKey;
    else delete process.env.CONTENT_GENERATION_SERVICE_API_KEY;
    delete process.env.EMAILGENERATION_SERVICE_URL;
    delete process.env.EMAILGENERATION_SERVICE_API_KEY;
  });

  it("should read emailgen config from CONTENT_GENERATION_SERVICE_* env vars", async () => {
    process.env.CONTENT_GENERATION_SERVICE_URL = "https://content-generation.mcpfactory.org";
    process.env.CONTENT_GENERATION_SERVICE_API_KEY = "test-cg-key";

    const { externalServices } = await import("../../src/lib/service-client.js");

    expect(externalServices.emailgen.url).toBe("https://content-generation.mcpfactory.org");
    expect(externalServices.emailgen.apiKey).toBe("test-cg-key");
  });

  it("should NOT read from old EMAILGENERATION_SERVICE_* env vars", async () => {
    delete process.env.CONTENT_GENERATION_SERVICE_URL;
    delete process.env.CONTENT_GENERATION_SERVICE_API_KEY;
    process.env.EMAILGENERATION_SERVICE_URL = "https://old-url.example.com";
    process.env.EMAILGENERATION_SERVICE_API_KEY = "old-key";

    const { externalServices } = await import("../../src/lib/service-client.js");

    // Should fall back to default, not pick up the old env var
    expect(externalServices.emailgen.url).toBe("https://content-generation.mcpfactory.org");
    expect(externalServices.emailgen.apiKey).toBe("");
  });
});
