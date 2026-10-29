import { describe, expect, it } from "vitest";
import { URLS } from "@distribute/content";

describe("URLS.mcp", () => {
  it("points to the docs MCP page (not the 404 api.distribute.you/mcp gateway path)", () => {
    expect(URLS.mcp).toBe("https://distribute.you/docs/mcp");
  });

  it("lives under the apex docs (docs.distribute.you 301s there since SITE-FOUNDATION-1029)", () => {
    expect(URLS.mcp.startsWith(URLS.docs)).toBe(true);
    expect(URLS.docs).toBe("https://distribute.you/docs");
  });
});
