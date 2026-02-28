import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test for https://github.com/shamanic-technologies/mcpfactory/issues/190
 *
 * chat-service POST /chat requires `appId` in the request body.
 * Without it, the request fails with a 400 validation error.
 */
describe("chat-service appId requirement", () => {
  const useChatPath = path.join(
    __dirname,
    "../src/components/chat/use-chat.ts"
  );

  it("should include appId: 'distribute' in the POST /chat request body", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");
    expect(content).toContain('appId: "distribute"');
  });
});

describe("chat-service auth headers", () => {
  const useChatPath = path.join(
    __dirname,
    "../src/components/chat/use-chat.ts"
  );

  it("should send x-org-id and x-user-id headers to chat-service", () => {
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

describe("chat-service config registration at cold start", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../instrumentation.ts"
  );

  it("should have an instrumentation.ts file", () => {
    expect(fs.existsSync(instrumentationPath)).toBe(true);
  });

  it("should register app config via PUT /apps/mcpfactory/config", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("/apps/mcpfactory/config");
    expect(content).toContain("PUT");
  });

  it("should include the distribute assistant system prompt", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("systemPrompt");
    expect(content).toContain("distribute assistant");
  });

  it("should use X-API-Key auth (not Bearer)", () => {
    const content = fs.readFileSync(instrumentationPath, "utf-8");
    expect(content).toContain("X-API-Key");
    expect(content).not.toContain("Authorization");
  });
});
