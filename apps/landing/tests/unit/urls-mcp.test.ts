import { describe, expect, it } from "vitest";
import { URLS } from "@distribute/content";

describe("URLS.mcp", () => {
  it("points to docs MCP page (not the 404 api.distribute.you/mcp gateway path)", () => {
    expect(URLS.mcp).toBe("https://docs.distribute.you/mcp");
  });

  it("uses the docs subdomain", () => {
    expect(URLS.mcp.startsWith("https://docs.distribute.you")).toBe(true);
  });
});
