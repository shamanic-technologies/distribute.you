import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { agentQuickstartMarkdown, AGENT_QUICKSTART_TITLE } from "@/lib/agent-quickstart";
import { agentSkillMarkdown } from "@/lib/agent-skill";
import {
  AUTH_HEADER_LINE,
  DASHBOARD_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  REJECTED_KEY_HEADER,
} from "@/lib/developer-surfaces";

const APP = join(__dirname, "../../src/app");
const md = agentQuickstartMarkdown();

describe("the agent quickstart", () => {
  it("states the header, the refused header, who-am-I, the scope, the dashboard and the exact tool count", () => {
    expect(md).toContain(AUTH_HEADER_LINE);
    expect(md).toContain(`\`${REJECTED_KEY_HEADER}\` header is NOT accepted`);
    expect(md).toContain("GET /v1/me");
    expect(md).toContain("One key is one user in one organization");
    expect(md).toContain("never belongs to a brand");
    expect(md).toContain(DASHBOARD_URL);
    expect(MCP_TOOL_COUNT).toBe(MCP_TOOLS.length);
    expect(md).toContain(`exactly ${MCP_TOOL_COUNT} tools`);
  });

  it("tells an agent to lead with outcomes, put failures last and never hide a zero", () => {
    expect(md).toContain("How to report results to a human");
    const order = ["meetings booked and positive replies", "delivery rate", "Failures", "go last", "0 positive replies"];
    const at = order.map((w) => md.indexOf(w));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("carries no em-dash", () => {
    expect(md).not.toContain("—");
  });

  it("opens skill.md, right under its title", () => {
    const skill = agentSkillMarkdown();
    expect(skill.indexOf(md)).toBeGreaterThan(0);
    expect(skill.indexOf(md)).toBeLessThan(skill.indexOf("## 1. Set up"));
  });

  it("is in llms.txt byte for byte, above every page list", () => {
    const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");
    expect(llms).toContain(md);
    expect(llms.indexOf(md)).toBeLessThan(llms.indexOf("## Machine-readable entry points"));
  });

  it.each(["page.tsx", "api/page.tsx", "mcp/page.tsx"])("tops %s and its Copy for LLM text", (file) => {
    const src = readFileSync(join(APP, file), "utf8");
    const at = src.indexOf("<AgentQuickstart />");
    expect(at).toBeGreaterThan(src.indexOf("<CopyForLLM"));
    // Above the page's own intro paragraph: the first thing under the title.
    expect(at).toBeLessThan(src.indexOf('<p className="text-base'));
    expect(src).toContain("${agentQuickstartMarkdown()}");
  });

  it("titles the block the same everywhere", () => {
    expect(md.startsWith(`## ${AGENT_QUICKSTART_TITLE}\n`)).toBe(true);
  });
});
