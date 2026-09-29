import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SKILL_URL, SKILL_USE_CASES, agentSkillMarkdown } from "@/lib/agent-skill";
import {
  AUTH_HEADER_LINE,
  CLAUDE_CODE_MCP_COMMAND,
  MCP_TOOLS,
  MCP_URL,
} from "@/lib/developer-surfaces";

const md = agentSkillMarkdown();

describe("the agent skill", () => {
  it("is served at a stable URL on the docs host", () => {
    expect(SKILL_URL).toBe("https://docs.distribute.you/skill.md");
  });

  it("opens with skill frontmatter a harness can load", () => {
    expect(md.startsWith("---\nname: distribute-you\ndescription: ")).toBe(true);
  });

  it("reads every pasted value from developer-surfaces", () => {
    expect(md).toContain(MCP_URL);
    expect(md).toContain(AUTH_HEADER_LINE);
    expect(md).toContain(CLAUDE_CODE_MCP_COMMAND);
    for (const t of MCP_TOOLS) expect(md).toContain(t.name);
  });

  it("says plainly that OAuth-only connectors cannot add the server", () => {
    expect(md).toMatch(/only accept OAuth/);
  });

  it("asks before anything that spends or changes what runs", () => {
    for (const u of SKILL_USE_CASES.filter((u) => u.spends)) {
      const line = md.split("\n").find((l) => l.includes(u.ask))!;
      expect(line).toContain("Ask the user before calling");
    }
  });

  it("names only routes of the deployed REST contract shape", () => {
    for (const u of SKILL_USE_CASES) {
      for (const r of u.routes) expect(r).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/v1\//);
    }
  });

  it("keeps the key out of the saved skill and carries no em-dash", () => {
    expect(md).toContain("keep the key OUT of it");
    expect(md).not.toContain("—");
  });

  it("is listed in llms.txt and served by a static route", () => {
    expect(readFileSync(join(__dirname, "../../public/llms.txt"), "utf8")).toContain(SKILL_URL);
    const route = readFileSync(join(__dirname, "../../src/app/skill.md/route.ts"), "utf8");
    expect(route).toContain('export const dynamic = "force-static"');
    expect(route).toContain("agentSkillMarkdown()");
  });
});
