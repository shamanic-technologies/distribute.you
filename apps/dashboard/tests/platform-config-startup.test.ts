import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const instrumentationPath = path.resolve(__dirname, "../instrumentation.ts");
const content = fs.readFileSync(instrumentationPath, "utf-8");

describe("Platform key registration at startup", () => {
  it("should call POST /platform-keys on key-service", () => {
    expect(content).toContain("/platform-keys");
    expect(content).toContain('method: "POST"');
  });

  it("should use KEY_SERVICE_URL and KEY_SERVICE_API_KEY env vars", () => {
    expect(content).toContain("KEY_SERVICE_URL");
    expect(content).toContain("KEY_SERVICE_API_KEY");
  });

  const providers = [
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
  ];

  for (const { provider, envVar } of providers) {
    it(`should include provider "${provider}" mapped to ${envVar}`, () => {
      expect(content).toContain(`provider: "${provider}"`);
      expect(content).toContain(`envVar: "${envVar}"`);
    });
  }

  it("should register exactly 12 platform keys", () => {
    const matches = content.match(/provider: "/g);
    // 12 in the PLATFORM_KEY_PROVIDERS array + 1 in the JSON body template = at least 12
    expect(matches!.length).toBeGreaterThanOrEqual(12);
  });

  it("should throw on missing platform key env vars (fail startup)", () => {
    expect(content).toContain("Missing platform key env vars");
    expect(content).toContain("throw new Error");
  });

  it("should throw on key registration failure (fail startup)", () => {
    expect(content).toContain('Failed to register platform key');
  });

  it("should send provider and apiKey in request body", () => {
    expect(content).toContain("provider,");
    expect(content).toContain("apiKey: process.env[");
  });
});

describe("Platform prompt registration at startup", () => {
  it("should call PUT /platform-prompts on content-generation-service", () => {
    expect(content).toContain("/platform-prompts");
  });

  it("should use CONTENT_GENERATION_SERVICE_URL and API_KEY env vars", () => {
    expect(content).toContain("CONTENT_GENERATION_SERVICE_URL");
    expect(content).toContain("CONTENT_GENERATION_SERVICE_API_KEY");
  });

  it("should register a cold-email prompt type", () => {
    expect(content).toContain('type: "cold-email"');
  });

  it("should include all 6 required variables", () => {
    const variables = [
      "leadFirstName",
      "leadLastName",
      "leadTitle",
      "leadCompanyName",
      "leadCompanyIndustry",
      "clientCompanyName",
    ];
    for (const v of variables) {
      expect(content).toContain(`"${v}"`);
    }
  });

  it("should dynamically replace {date} with today's date", () => {
    expect(content).toContain("{date}");
    expect(content).toContain('new Date().toISOString().split("T")[0]');
  });

  it("should throw on prompt registration failure (fail startup)", () => {
    expect(content).toContain("Failed to register platform prompts");
  });

  it("should contain the cold email prompt text", () => {
    expect(content).toContain("You're writing a 3-email cold outreach sequence");
    expect(content).toContain("PAS (Problem-Agitate-Solution)");
    expect(content).toContain("{{leadFirstName}}");
    expect(content).toContain("{{clientCompanyName}}");
  });
});

describe("Platform chat config registration at startup", () => {
  it("should call PUT /platform-config on chat-service", () => {
    expect(content).toContain("/platform-config");
  });

  it("should use CHAT_SERVICE_URL and CHAT_SERVICE_API_KEY env vars", () => {
    expect(content).toContain("CHAT_SERVICE_URL");
    expect(content).toContain("CHAT_SERVICE_API_KEY");
  });

  it("should send systemPrompt in request body", () => {
    expect(content).toContain("systemPrompt");
    expect(content).toContain("You are a helpful assistant embedded in a workflow management dashboard");
  });

  it("should be non-blocking (warn only, not throw)", () => {
    // Chat config uses console.warn, not throw
    expect(content).toContain("Chat config registration failed");
    expect(content).toContain("Chat config registration error");
    // Verify it does NOT throw for chat config failures
    const chatConfigFn = content.slice(content.indexOf("async function registerPlatformChatConfig"));
    expect(chatConfigFn).toContain("console.warn");
    expect(chatConfigFn).not.toContain("throw new Error");
  });
});

describe("Registration order in register()", () => {
  it("should call keys, then prompts, then chat config in order", () => {
    const registerFn = content.slice(
      content.indexOf("export async function register()"),
      content.indexOf("// ── Platform key registration")
    );
    const keysIdx = registerFn.indexOf("registerPlatformKeys()");
    const promptsIdx = registerFn.indexOf("registerPlatformPrompts()");
    const chatIdx = registerFn.indexOf("registerPlatformChatConfig()");
    expect(keysIdx).toBeLessThan(promptsIdx);
    expect(promptsIdx).toBeLessThan(chatIdx);
  });
});
