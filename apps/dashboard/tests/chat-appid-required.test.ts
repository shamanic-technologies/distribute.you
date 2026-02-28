import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test for https://github.com/shamanic-technologies/mcpfactory/issues/190
 *
 * chat-service POST /chat requires `appId` in the request body.
 * Without it, the request fails with a 400 validation error.
 */
describe("chat via API service", () => {
  const useChatPath = path.join(
    __dirname,
    "../src/components/chat/use-chat.ts"
  );

  it("should include appId: 'distribute' in the POST /chat request body", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");
    expect(content).toContain('appId: "distribute"');
  });

  it("should route chat through API service (not chat-service directly)", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");
    expect(content).toContain("NEXT_PUBLIC_DISTRIBUTE_API_URL");
    expect(content).toContain("/v1/chat");
    expect(content).not.toContain("CHAT_SERVICE_URL");
    expect(content).not.toContain("chat.distribute.you");
  });

  it("should send x-org-id and x-user-id headers", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");
    expect(content).toContain('"x-org-id"');
    expect(content).toContain('"x-user-id"');
  });

  it("should accept orgId and userId in hook options", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");
    expect(content).toContain("orgId");
    expect(content).toContain("userId");
  });
});

describe("chat widget fetches org/user identity", () => {
  const widgetPath = path.join(
    __dirname,
    "../src/components/chat/chat-widget.tsx"
  );

  it("should call getMe to resolve internal orgId and userId", () => {
    const content = fs.readFileSync(widgetPath, "utf-8");
    expect(content).toContain("getMe");
    expect(content).toContain("orgId");
    expect(content).toContain("userId");
  });
});

describe("chat config registration at cold start (via API service)", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../instrumentation.ts"
  );

  it("should have an instrumentation.ts file", () => {
    expect(fs.existsSync(instrumentationPath)).toBe(true);
  });

  it("should register chat config via PUT /v1/chat/config on API service", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("/v1/chat/config");
    expect(content).toContain("PUT");
  });

  it("should use DISTRIBUTE_API_KEY for auth", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("DISTRIBUTE_API_KEY");
    expect(content).toContain("Authorization");
  });

  it("should NOT reference chat-service directly", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).not.toContain("CHAT_SERVICE_URL");
    expect(content).not.toContain("CHAT_SERVICE_API_KEY");
    expect(content).not.toContain("X-API-Key");
  });

  it("should include the distribute assistant system prompt", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("systemPrompt");
    expect(content).toContain("distribute assistant");
  });
});
