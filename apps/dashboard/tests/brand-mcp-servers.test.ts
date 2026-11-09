import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BrandMcpServersResponseSchema, serverStateLine, isConnected } from "../src/lib/v2/brand-mcp-servers";

// BRAND-MCP-1109 (owner 2026-11-09): a brand plugs the MCP servers our conversation AI
// uses when it writes to its leads and clients, tagged Public beta, on Integrations.
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const connected = {
  id: "s1", brandId: "b1", name: "distribute.you MCP", url: "https://mcp.distribute.you/mcp",
  hasAuthorization: true, status: "connected", error: null, toolCount: 28,
  toolNames: ["distribute_status"], checkedAt: "2026-11-09T09:00:00Z", createdAt: "2026-11-09T09:00:00Z",
};

describe("brand MCP servers reader", () => {
  it("parses chat-service's list and never carries the secret", () => {
    const parsed = BrandMcpServersResponseSchema.parse({ servers: [{ ...connected, authorization: "Bearer x" }] });
    expect(parsed.servers[0]).not.toHaveProperty("authorization");
    expect(parsed.servers[0].hasAuthorization).toBe(true);
  });

  it("states the connect state in words", () => {
    expect(isConnected(connected)).toBe(true);
    expect(serverStateLine(connected)).toBe("Connected · 28 tools");
    expect(serverStateLine({ ...connected, toolCount: 1 })).toBe("Connected · 1 tool");
    expect(serverStateLine({ ...connected, status: "error", error: "the server answered 401" })).toBe("Not connected: the server answered 401");
  });
});

describe("Integrations > Tools for our AI", () => {
  it("sits on the Accounts and AI view with its Public beta tag", () => {
    const src = read("src/components/v2/setup-pages.tsx");
    const at = src.indexOf("Tools for our AI");
    expect(at).toBeGreaterThan(src.indexOf("<V2AiIntegrationView"));
    expect(src.slice(at, at + 400)).toContain("Public beta");
    expect(src.slice(at, at + 600)).toContain("<BrandMcpServersView brandId={brandId} />");
  });

  it("links the risk paragraph of the terms and never prints the producer's error body", () => {
    const src = read("src/components/v2/integrations-brand-mcp.tsx");
    expect(src).toContain("https://distribute.you/terms#brand-mcp-servers");
    expect(src).not.toContain("err.message");
    expect(src).toContain('type="password"');
  });
});
