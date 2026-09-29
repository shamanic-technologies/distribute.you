import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENT_SKILL_URL, AI_RESOURCES, MCP_ENDPOINT_URL, aiSetupPrompt } from "../src/lib/ai-integration";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("the AI setup line", () => {
  it("points the assistant at the skill and asks for a key when it has none", () => {
    const line = aiSetupPrompt(null);
    expect(line).toContain(AGENT_SKILL_URL);
    expect(line).toContain("Ask me for my API key.");
    expect(line).not.toContain("distrib.usr_");
  });

  it("carries a freshly issued key, and nothing that is not one", () => {
    expect(aiSetupPrompt("distrib.usr_abc123")).toContain("My API key is distrib.usr_abc123");
    expect(aiSetupPrompt("not-a-key")).toContain("Ask me for my API key.");
  });

  it("names the skill and MCP URLs the docs app actually serves", () => {
    const skill = read("../docs/src/lib/agent-skill.ts");
    const routes = read("../docs/src/lib/docs-routes.ts");
    expect(skill).toContain('export const SKILL_PATH = "/skill.md"');
    expect(routes).toContain('DOCS_SITE_URL = "https://docs.distribute.you"');
    expect(AGENT_SKILL_URL).toBe("https://docs.distribute.you/skill.md");
    expect(routes).toContain(`MCP_ENDPOINT_URL = "${MCP_ENDPOINT_URL}"`);
  });

  it("links only https destinations, and carries no em-dash", () => {
    for (const r of AI_RESOURCES) expect(r.href).toMatch(/^https:\/\//);
    expect(read("src/lib/ai-integration.ts")).not.toContain("—");
    expect(read("src/components/v2/integrations-ai.tsx")).not.toContain("—");
  });
});

describe("the AI tab", () => {
  const VIEW = read("src/components/v2/integrations-ai.tsx");
  const SETUP = read("src/components/v2/setup-pages.tsx");

  it("is mounted by the Integrations page and is where the nav lands", () => {
    expect(SETUP).toContain("<V2AiIntegrationView orgId={orgId} brandId={brandId} />");
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/integrations/ai/page.tsx")).toContain('view="ai"');
    expect(read("src/components/v2/v2-shell.tsx")).toContain('`${v2Href(orgId, brandId, "integrations")}/ai`');
  });

  it("reuses the API Keys query key and the one key writer", () => {
    expect(VIEW).toContain('["apiKeys"], () => listApiKeys()');
    expect(VIEW).toContain("createApiKey(");
    expect(VIEW).toContain("aiSetupPrompt(newKey)");
  });

  it("is drawn in Keel, never v1 classes, and never renders a raw error", () => {
    expect(VIEW).not.toMatch(/text-gray-|bg-gray-|bg-brand-50|rounded-xl border|InfoTooltip|shadow-2xl/);
    expect(VIEW).not.toContain("err.message");
  });
});
