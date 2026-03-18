import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const instrumentationPath = path.resolve(__dirname, "../instrumentation.ts");
const content = fs.readFileSync(instrumentationPath, "utf-8");

describe("Platform config registration at startup", () => {
  describe("platform keys", () => {
    const expectedKeys = [
      { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
      { provider: "apollo", envVar: "APOLLO_API_KEY" },
      { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
      { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
      { provider: "gemini", envVar: "GEMINI_API_KEY" },
      { provider: "postmark", envVar: "POSTMARK_API_KEY" },
      { provider: "postmark-broadcast-stream", envVar: "POSTMARK_BROADCAST_STREAM_ID" },
      { provider: "postmark-inbound-stream", envVar: "POSTMARK_INBOUND_STREAM_ID" },
      { provider: "postmark-transactional-stream", envVar: "POSTMARK_TRANSACTIONAL_STREAM_ID" },
      { provider: "postmark-from-address", envVar: "POSTMARK_FROM_ADDRESS" },
      { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
      { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
      { provider: "api-service-mcp", envVar: "ADMIN_DISTRIBUTE_API_KEY" },
    ];

    it("should call POST /platform-keys via api-service", () => {
      expect(content).toContain("/platform-keys");
      expect(content).toContain('method: "POST"');
    });

    for (const { provider, envVar } of expectedKeys) {
      it(`should register ${provider} key from ${envVar}`, () => {
        expect(content).toContain(`provider: "${provider}"`);
        expect(content).toContain(`envVar: "${envVar}"`);
      });
    }

    it("should register exactly 13 platform keys", () => {
      const matches = content.match(/provider: "[^"]+", envVar: "[^"]+"/g);
      expect(matches).toHaveLength(13);
    });

    it("should fail startup if any key env var is missing", () => {
      expect(content).toContain("Missing platform key env vars");
      expect(content).toContain("throw err");
    });
  });

  describe("platform prompts", () => {
    it("should call PUT /platform-prompts via api-service", () => {
      expect(content).toContain("/platform-prompts");
    });

    it("should register the cold-email prompt type", () => {
      expect(content).toContain('type: "cold-email"');
    });

    it("should include all 6 template variables", () => {
      const vars = [
        "leadFirstName",
        "leadLastName",
        "leadTitle",
        "leadCompanyName",
        "leadCompanyIndustry",
        "clientCompanyName",
      ];
      for (const v of vars) {
        expect(content).toContain(`"${v}"`);
      }
    });

    it("should dynamically insert today's date in the prompt", () => {
      expect(content).toContain('toISOString().split("T")[0]');
    });

    it("should fail startup on prompt registration failure", () => {
      expect(content).toContain("Platform prompt deployment failed");
      expect(content).toContain("throw err");
    });
  });

  describe("platform chat config", () => {
    it("should call PUT /platform-chat/config via api-service", () => {
      expect(content).toContain("/platform-chat/config");
    });

    it("should include the workflow editor system prompt", () => {
      expect(content).toContain("expert workflow editor embedded in a workflow management dashboard");
    });

    it("should not include removed mcpServerUrl or mcpKeyName fields", () => {
      expect(content).not.toContain("mcpServerUrl");
      expect(content).not.toContain("mcpKeyName");
    });

    it("should be non-blocking (warn on failure, not throw)", () => {
      expect(content).toContain("Chat config deployment failed");
      expect(content).toContain("console.warn");
    });
  });

  describe("routing", () => {
    it("should route all calls through api-service, not internal services", () => {
      expect(content).not.toContain("KEY_SERVICE_URL");
      expect(content).not.toContain("CONTENT_GENERATION_SERVICE_URL");
      expect(content).not.toContain("CHAT_SERVICE_URL");
    });

    it("should use existing NEXT_PUBLIC_DISTRIBUTE_API_URL and ADMIN_DISTRIBUTE_API_KEY", () => {
      expect(content).toContain("NEXT_PUBLIC_DISTRIBUTE_API_URL");
      expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
    });

    it("should not introduce redundant API_SERVICE_URL/API_SERVICE_API_KEY env vars", () => {
      expect(content).not.toContain("API_SERVICE_URL");
      expect(content).not.toContain("API_SERVICE_API_KEY");
    });

    it("should authenticate all calls with X-API-Key", () => {
      const apiKeyUsages = content.match(/"X-API-Key": apiKey/g);
      expect(apiKeyUsages!.length).toBeGreaterThanOrEqual(4); // emails + keys + prompts + chat
    });
  });
});
