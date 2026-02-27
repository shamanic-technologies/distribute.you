import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const chatRoutePath = path.join(__dirname, "../../src/routes/chat.ts");
const content = fs.readFileSync(chatRoutePath, "utf-8");

const schemaPath = path.join(__dirname, "../../src/schemas.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

const indexPath = path.join(__dirname, "../../src/index.ts");
const indexContent = fs.readFileSync(indexPath, "utf-8");

describe("Chat proxy routes", () => {
  it("should have PUT /chat/config endpoint", () => {
    expect(content).toContain('"/chat/config"');
    expect(content).toContain("router.put");
  });

  it("should have POST /chat endpoint", () => {
    expect(content).toContain('"/chat"');
    expect(content).toContain("router.post");
  });

  it("should use authenticate, requireOrg, requireUser on config", () => {
    // Extract the config route definition
    const configSection = content.slice(
      content.indexOf('"/chat/config"'),
      content.indexOf('"/chat"', content.indexOf('"/chat/config"') + 20),
    );
    expect(configSection).toContain("authenticate");
    expect(configSection).toContain("requireOrg");
    expect(configSection).toContain("requireUser");
  });

  it("should check req.appId on config and return 403 if missing", () => {
    expect(content).toContain("req.appId");
    expect(content).toContain("403");
    expect(content).toContain("App key authentication required");
  });

  it("should use authenticate, requireOrg, requireUser on chat endpoint", () => {
    expect(content).toContain("authenticate, requireOrg, requireUser");
  });

  it("should use streamExternalService for SSE (not callExternalService) on chat", () => {
    // The chat POST route should use streamExternalService
    expect(content).toContain("streamExternalService");
    // Import should include streamExternalService
    expect(content).toContain("import");
    expect(content).toContain("streamExternalService");
  });

  it("should use callExternalService for config (not streaming)", () => {
    expect(content).toContain("callExternalService");
  });

  it("should proxy config to /apps/{appId}/config on chat-service", () => {
    expect(content).toContain("`/apps/${req.appId}/config`");
    expect(content).toContain("externalServices.chat");
  });

  it("should proxy chat to /chat on chat-service", () => {
    expect(content).toContain('"/chat"');
    expect(content).toContain("externalServices.chat");
  });

  it("should set appId in chat body from req.appId", () => {
    expect(content).toContain("appId: req.appId");
  });

  it("should use buildInternalHeaders for identity forwarding", () => {
    expect(content).toContain("buildInternalHeaders");
    const headerMatches = content.match(/buildInternalHeaders\(req\)/g);
    expect(headerMatches).not.toBeNull();
    expect(headerMatches!.length).toBe(2);
  });

  it("should handle errors after headers sent for SSE", () => {
    expect(content).toContain("res.headersSent");
  });
});

describe("Chat OpenAPI schemas", () => {
  it("should register chat config path", () => {
    expect(schemaContent).toContain('path: "/v1/chat/config"');
    expect(schemaContent).toContain('tags: ["Chat"]');
  });

  it("should register chat SSE path", () => {
    expect(schemaContent).toContain('path: "/v1/chat"');
  });

  it("should define ChatConfigRequestSchema", () => {
    expect(schemaContent).toContain("ChatConfigRequestSchema");
    expect(schemaContent).toContain("systemPrompt");
    expect(schemaContent).toContain("mcpServerUrl");
    expect(schemaContent).toContain("mcpKeyName");
  });

  it("should define ChatMessageRequestSchema", () => {
    expect(schemaContent).toContain("ChatMessageRequestSchema");
    expect(schemaContent).toContain("sessionId");
  });

  it("should describe SSE response content type", () => {
    // The chat endpoint should document text/event-stream
    expect(schemaContent).toContain("text/event-stream");
  });
});

describe("Chat routes are mounted in index.ts", () => {
  it("should import and mount chat routes", () => {
    expect(indexContent).toContain("chatRoutes");
    expect(indexContent).toContain("./routes/chat");
  });
});
