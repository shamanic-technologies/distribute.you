import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { docsMarkdownPath, docsPagePath, isDocsPagePath } from "@/lib/docs/docs-markdown";
import { MCP_TOOLS, MCP_TOOL_COUNT } from "@/lib/docs/developer-surfaces";

const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8");

describe("docs pages answer markdown on Accept: text/markdown (CLIENT-FRICTION-DOCS-1103)", () => {
  it("treats the four pages an agent reads as docs pages, and the files as files", () => {
    for (const p of ["/docs", "/docs/", "/docs/mcp", "/docs/api", "/docs/quickstart", "/docs/mcp/tools"]) {
      expect(isDocsPagePath(p)).toBe(true);
    }
    for (const p of ["/docs/skill.md", "/docs/llms.txt", "/docs/og-image.png", "/docsx", "/catalog"]) {
      expect(isDocsPagePath(p)).toBe(false);
    }
  });

  it("maps a page to the internal route and back", () => {
    expect(docsMarkdownPath("/docs")).toBe("/docs-markdown");
    expect(docsMarkdownPath("/docs/mcp/")).toBe("/docs-markdown/mcp");
    expect(docsPagePath(undefined)).toBe("/docs");
    expect(docsPagePath(["mcp", "tools"])).toBe("/docs/mcp/tools");
  });

  it("is wired in the proxy, which also closes the internal route to direct requests", () => {
    const src = read("src/proxy.ts");
    expect(src).toContain("isDocsPagePath(pathname)");
    expect(src).toContain("pathname.startsWith(DOCS_MARKDOWN_PREFIX)");
    expect(src.indexOf("pathname.startsWith(DOCS_MARKDOWN_PREFIX)")).toBeLessThan(src.indexOf("isDocsPagePath(pathname)"));
  });
});

describe("the tool count printed for agents is the catalogue's", () => {
  it("docs/llms.txt states the live count and names every tool", () => {
    const llms = read("public/docs/llms.txt");
    expect(llms).toContain(`exactly ${MCP_TOOL_COUNT} tools`);
    expect(llms).toContain(`Streamable HTTP, ${MCP_TOOL_COUNT} tools`);
    for (const tool of MCP_TOOLS) expect(llms).toContain(tool.name);
  });

  it("the apex llms.txt lists every tool", () => {
    const llms = read("public/llms.txt");
    for (const tool of MCP_TOOLS) expect(llms).toContain(`\`${tool.name}\``);
  });
});

describe("llms.txt does not turn away inbound WhatsApp replies", () => {
  it("says the AI answers consumers who write first, and keeps cold outreach to businesses", () => {
    const llms = read("public/llms.txt");
    expect(llms).not.toContain("The buyer is a consumer");
    expect(llms).toContain("consumers included");
    expect(llms).toContain("contacts businesses only");
  });
});
