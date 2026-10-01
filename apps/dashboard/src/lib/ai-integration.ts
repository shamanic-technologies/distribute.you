/**
 * The "connect your AI" line on the Integrations page, and the links beside it.
 *
 * The line is the whole feature: a customer copies ONE sentence into whatever
 * assistant they use (Claude Code, Cursor, Codex, OpenClaw, Conductor...) and
 * the assistant fetches the skill, installs it where its harness keeps skills,
 * connects the MCP server or the REST API, and checks the key. Everything
 * harness-specific lives in that skill, so this page never has to learn a new
 * client.
 *
 * The skill is generated and served by the docs app (`apps/docs`,
 * `src/lib/agent-skill.ts`, at `/skill.md`); the URL and the MCP endpoint are
 * restated here because the two apps share no module, and a guard pins them
 * equal to the docs app's own constants.
 *
 * Alias-free, so it carries real unit tests.
 */

export const AGENT_SKILL_URL = "https://docs.distribute.you/skill.md";
export const MCP_ENDPOINT_URL = "https://mcp.distribute.you/mcp";

/** A key the dashboard just issued. Shown once, so the line can carry it. */
export const API_KEY_PREFIX = "distrib.usr_";

/**
 * The sentence the customer pastes. With a key it is ready to go; without one
 * it tells the assistant to ask for it, which keeps a secret out of the
 * clipboard for somebody who only wanted to look.
 */
export function aiSetupPrompt(key: string | null): string {
  const base = `Read ${AGENT_SKILL_URL} and follow it to connect distribute.you to this workspace: save it as a skill, connect the MCP server, then check the connection.`;
  if (key && key.startsWith(API_KEY_PREFIX)) return `${base} My API key is ${key}`;
  return `${base} Ask me for my API key.`;
}

/** Every other door an assistant or a developer can use, in reading order. */
export const AI_RESOURCES: { label: string; href: string; note: string }[] = [
  { label: "Agent skill", href: AGENT_SKILL_URL, note: "What your AI reads: setup for every harness and the usual questions." },
  { label: "MCP installation", href: "https://docs.distribute.you/mcp/installation/", note: "Claude Code, Cursor, Claude Desktop and any MCP client." },
  { label: "API reference", href: "https://docs.distribute.you/api/", note: "Brands, campaigns, leads, emails, billing." },
  { label: "OpenAPI document", href: "https://api.distribute.you/openapi.json", note: "Every REST route, in one file." },
  { label: "API explorer", href: "https://api.distribute.you/docs", note: "The same routes, with a request builder." },
  { label: "Command line", href: "https://www.npmjs.com/package/@distribute.you/cli", note: "npx @distribute.you/cli --help" },
  { label: "llms.txt", href: "https://docs.distribute.you/llms.txt", note: "Every documentation page, one line each." },
];
