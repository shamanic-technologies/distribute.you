import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const instrumentationPath = path.resolve(__dirname, "../src/instrumentation.ts");
const content = fs.readFileSync(instrumentationPath, "utf-8");

describe("Platform config registration at startup", () => {
  describe("platform keys", () => {
    const expectedKeys = [
      { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
      { provider: "apollo", envVar: "APOLLO_API_KEY" },
      { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
      { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
      { provider: "google", envVar: "GEMINI_API_KEY" },
      { provider: "postmark", envVar: "POSTMARK_API_KEY" },
      { provider: "postmark-broadcast-stream", envVar: "POSTMARK_BROADCAST_STREAM_ID" },
      { provider: "postmark-inbound-stream", envVar: "POSTMARK_INBOUND_STREAM_ID" },
      { provider: "postmark-transactional-stream", envVar: "POSTMARK_TRANSACTIONAL_STREAM_ID" },
      { provider: "postmark-from-address", envVar: "POSTMARK_FROM_ADDRESS" },
      { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
      { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
      { provider: "api-service-mcp", envVar: "ADMIN_DISTRIBUTE_API_KEY" },
      { provider: "serper-dev", envVar: "SERPER_DEV_API_KEY" },
      { provider: "google-client-id", envVar: "GOOGLE_CLIENT_ID" },
      { provider: "google-client-secret", envVar: "GOOGLE_CLIENT_SECRET" },
      { provider: "google-developer-token", envVar: "GOOGLE_DEVELOPER_TOKEN" },
      { provider: "google-mcc-account-id", envVar: "GOOGLE_MCC_ACCOUNT_ID" },
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

    it("should register exactly 24 platform keys", () => {
      const matches = content.match(/provider: "[^"]+", envVar: "[^"]+"/g);
      expect(matches).toHaveLength(24);
    });

    it("should skip missing env vars instead of blocking all registrations", () => {
      expect(content).toContain("Skipping");
      expect(content).toContain("env vars not set");
      expect(content).not.toContain("Missing platform key env vars");
    });

    it("should fail startup only if zero keys can be registered", () => {
      expect(content).toContain("No platform key env vars are set");
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

  describe("platform chat configs", () => {
    it("should call PUT /platform-chat/config via api-service", () => {
      expect(content).toContain("/platform-chat/config");
    });

    it("should register all three chat config keys", () => {
      expect(content).toContain('key: "workflow"');
      expect(content).toContain('key: "press-kit"');
      expect(content).toContain('key: "feature"');
    });

    it("should include the workflow editor system prompt", () => {
      expect(content).toContain("expert workflow editor embedded in a workflow management dashboard");
    });

    it("should include the press kit editor system prompt", () => {
      expect(content).toContain("expert press kit editor embedded in a media kit management dashboard");
    });

    it("should include the feature designer system prompt", () => {
      expect(content).toContain("expert feature designer embedded in a feature management dashboard");
    });

    it("should include allowedTools for each config", () => {
      expect(content).toContain("WORKFLOW_ALLOWED_TOOLS");
      expect(content).toContain("PRESS_KIT_ALLOWED_TOOLS");
      expect(content).toContain("FEATURE_ALLOWED_TOOLS");
    });

    it("should instruct the model to use workflowId from context for all tool calls", () => {
      expect(content).toContain("workflowId");
      expect(content).toContain("NEVER ask the user for the workflow ID");
    });

    it("should not include removed mcpServerUrl or mcpKeyName fields", () => {
      expect(content).not.toContain("mcpServerUrl");
      expect(content).not.toContain("mcpKeyName");
    });

    it("should be non-blocking (warn on failure, not throw)", () => {
      expect(content).toContain("chat config(s) failed");
      expect(content).toContain("console.warn");
    });
  });

  describe("file location", () => {
    it("should be in src/ alongside app/ so Next.js finds it", () => {
      const srcPath = path.resolve(__dirname, "../src/instrumentation.ts");
      expect(fs.existsSync(srcPath)).toBe(true);
    });

    it("should NOT be at the project root (Next.js ignores it there when using src/)", () => {
      const rootPath = path.resolve(__dirname, "../instrumentation.ts");
      expect(fs.existsSync(rootPath)).toBe(false);
    });
  });

  describe("turbo.json passthrough", () => {
    const turboPath = path.resolve(__dirname, "../../../turbo.json");
    const turboContent = fs.readFileSync(turboPath, "utf-8");
    const turboConfig = JSON.parse(turboContent);
    const globalPassThrough: string[] = turboConfig.globalPassThroughEnv ?? [];

    it('should use globalPassThroughEnv: ["*"] so all env vars reach instrumentation', () => {
      expect(globalPassThrough).toContain("*");
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
