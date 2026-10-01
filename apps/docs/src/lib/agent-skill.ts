/**
 * The agent skill: one markdown file an AI assistant reads to learn how to use
 * distribute.you, installs where its harness keeps skills, and follows to
 * connect itself. Served at SKILL_URL.
 *
 * It is the far end of one pasted line. A customer copies "read <this URL> and
 * set distribute.you up for me" out of the dashboard into whatever assistant
 * they use, so this file is written for that assistant, not for a person: it
 * says what to do, in order, and when to stop and ask.
 *
 * Every value a reader would paste (the MCP URL, the auth header, the configs,
 * the CLI) is READ from developer-surfaces, never retyped here, for the reason
 * that module exists: twenty-two hand copies once went stale together.
 *
 * Two limits are stated rather than hidden, because an assistant that tries
 * the impossible wastes the customer's afternoon:
 * - the hosted MCP server authenticates with a Bearer key and has no OAuth, so
 *   a client that only accepts OAuth connectors (claude.ai in the browser,
 *   ChatGPT) cannot add it; those use the REST API through whatever tool runs
 *   code for them;
 * - the MCP server exposes a handful of read tools, so anything that changes
 *   something goes through the REST API.
 */

import {
  API_KEYS_URL,
  API_KEY_PREFIX,
  AUTH_HEADER_LINE,
  CLAUDE_CODE_MCP_COMMAND,
  CLI_INSTALL_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_HTTP_CONFIG,
  MCP_REMOTE_BRIDGE_PACKAGE,
  MCP_SERVER_NAME,
  MCP_STDIO_BRIDGE_CONFIG,
  MCP_TOOLS,
  MCP_URL,
  curlExample,
} from "./developer-surfaces";
import { DOCS_SITE_URL, OPENAPI_DOCUMENT_URL, OPENAPI_EXPLORER_URL } from "./docs-routes";
import { agentQuickstartMarkdown } from "./agent-quickstart";

/** Where the skill is served. The dashboard's pasted line names this URL. */
export const SKILL_PATH = "/skill.md";
export const SKILL_URL = `${DOCS_SITE_URL}${SKILL_PATH}`;

/** The folder name a harness stores the skill under. Never the bare verb. */
export const SKILL_NAME = "distribute-you";

/** The API's own plain-language map of every service, written for a model. */
export const LLM_CONTEXT_URL = "https://api.distribute.you/v1/platform/llm-context";

/** The Codex config block for the stdio bridge, in the TOML Codex reads. */
const CODEX_BRIDGE_CONFIG = `[mcp_servers.${MCP_SERVER_NAME}]
command = "npx"
args = ["-y", "${MCP_REMOTE_BRIDGE_PACKAGE}", "${MCP_URL}", "--header", "${AUTH_HEADER_LINE}"]`;

/**
 * One use case: what the customer asks, and the routes that answer it. Every
 * route below is a path of the deployed openapi.json; the parameters are not
 * repeated here, the assistant reads them there.
 */
export interface SkillUseCase {
  ask: string;
  routes: string[];
  /** True when the call spends the customer's credit or changes what runs. */
  spends?: boolean;
  docs?: string;
}

export const SKILL_USE_CASES: SkillUseCase[] = [
  {
    ask: "Which account and organization is this key for?",
    routes: ["GET /v1/me"],
  },
  {
    ask: "List my brands, or read one",
    routes: ["GET /v1/brands", "GET /v1/brands/{id}"],
    docs: "/api/brands/",
  },
  {
    ask: "What does a brand sell (its offers)?",
    routes: ["GET /v1/features/brands/{brandId}/offers"],
  },
  {
    ask: "How much did it make, and what did it cost?",
    routes: ["GET /v1/brands/{brandId}/revenue", "GET /v1/offers/{offerId}/outcomes"],
  },
  {
    ask: "List campaigns and read their results",
    routes: ["GET /v1/campaigns", "GET /v1/campaigns/{id}", "GET /v1/campaigns/{id}/stats"],
    docs: "/api/campaigns/",
  },
  {
    ask: "Pause or restart a campaign",
    routes: ["PATCH /v1/campaigns/{id}", "POST /v1/campaigns/{id}/stop"],
    spends: true,
    docs: "/api/campaigns/",
  },
  {
    ask: "Read or change the daily budget",
    routes: [
      "GET /v1/brands/{brandId}/campaign-budgets",
      "PUT /v1/brands/{brandId}/campaign-budget",
      "GET /v1/brands/{brandId}/spendable-budget",
    ],
    spends: true,
  },
  {
    ask: "Who are we targeting (audiences)?",
    routes: ["GET /v1/orgs/audiences", "GET /v1/orgs/audiences/{id}", "PATCH /v1/orgs/audiences/{id}/status"],
  },
  {
    ask: "Suggest who a brand should target",
    routes: ["POST /v1/brands/{id}/icp/suggest", "POST /v1/orgs/audiences/suggest"],
    spends: true,
  },
  {
    ask: "Who did we contact, and who answered?",
    routes: ["GET /v1/leads", "GET /v1/leads/stats", "GET /v1/leads/{id}/history", "GET /v1/conversations"],
    docs: "/api/leads/",
  },
  {
    ask: "Read the emails we wrote",
    routes: ["GET /v1/emails", "GET /v1/campaigns/{id}/emails"],
    docs: "/api/emails/",
  },
  {
    ask: "Mark what happened with a lead (a won deal, an opt-out)",
    routes: ["POST /v1/leads/{id}/step-statements", "POST /v1/emails/opt-outs"],
    spends: true,
  },
  {
    ask: "How much credit is left, and what was paid?",
    routes: ["GET /v1/billing/accounts/balance", "GET /v1/billing/payments"],
    docs: "/api/billing/",
  },
];

function useCaseBlock(u: SkillUseCase): string {
  const routes = u.routes.map((r) => `\`${r}\``).join(", ");
  const docs = u.docs ? ` Docs: ${DOCS_SITE_URL}${u.docs}` : "";
  const spends = u.spends ? " **Ask the user before calling: this changes what runs or spends credit.**" : "";
  return `- **${u.ask}**: ${routes}.${spends}${docs}`;
}

/** The whole skill, as served. Pure, so it carries real unit tests. */
export function agentSkillMarkdown(): string {
  const tools = MCP_TOOLS.map((t) => `- \`${t.name}\`: ${t.description}`).join("\n");
  const useCases = SKILL_USE_CASES.map(useCaseBlock).join("\n");
  return `---
name: ${SKILL_NAME}
description: Use distribute.you, the cold email agency that finds buyers, writes and sends the emails, and forwards the interested replies. Use when the user asks about their distribute.you brands, offers, campaigns, audiences, leads, replies, results, costs, budget or credit, or wants to change any of them.
---

# distribute.you

${agentQuickstartMarkdown()}
distribute.you is a cold email agency run as software. A customer gives it a website and a daily budget; it finds the people to write to, writes the emails, sends them from its own domains, reads the replies and forwards the interested ones. The customer pays the budget they set and nothing else.

You are the customer's assistant. This file tells you how to connect to their account and what you can do there.

## 1. Set up (do this once, in order)

1. **Get the API key.** It starts with \`${API_KEY_PREFIX}\`. If the user pasted one, use it. If not, ask for it, and tell them where it is issued: ${API_KEYS_URL}. Treat it like a password: it can read and change everything in their organization. Never print it back in full, never commit it to a repository.
2. **Save this skill** where your harness keeps skills or standing instructions, so the next session knows it:
   - Claude Code, Conductor: \`~/.claude/skills/${SKILL_NAME}/SKILL.md\`
   - Codex: \`~/.codex/skills/${SKILL_NAME}/SKILL.md\`
   - Cursor: \`.cursor/rules/${SKILL_NAME}.mdc\`
   - anything else (OpenClaw, custom agents): the file your harness reads at start, often \`AGENTS.md\`
   Save the file as served, and keep the key OUT of it.
3. **Connect the MCP server** at \`${MCP_URL}\` (Streamable HTTP, header \`${AUTH_HEADER_LINE}\`). Pick your harness:
   - **Claude Code, Conductor**:
     \`\`\`
     ${CLAUDE_CODE_MCP_COMMAND}
     \`\`\`
   - **Cursor, and any client whose config takes a URL** (\`~/.cursor/mcp.json\`):
     \`\`\`json
${indent(MCP_HTTP_CONFIG, 5)}
     \`\`\`
   - **Codex** (\`~/.codex/config.toml\`, through the \`${MCP_REMOTE_BRIDGE_PACKAGE}\` bridge):
     \`\`\`toml
${indent(CODEX_BRIDGE_CONFIG, 5)}
     \`\`\`
   - **Claude Desktop, OpenClaw, and any client that only runs local servers**, through the same bridge:
     \`\`\`json
${indent(MCP_STDIO_BRIDGE_CONFIG, 5)}
     \`\`\`
   - **claude.ai in the browser, ChatGPT**: their connectors only accept OAuth, which this server does not offer yet. Skip MCP and use the REST API below through your code tool.
   Replace \`${API_KEY_PREFIX}YOUR_KEY\` with the real key. The client may need a restart to see the new server.
4. **Check it works**: call the \`distribute_status\` tool, or
   \`\`\`
${indent(curlExample("/v1/me"), 3)}
   \`\`\`
   It answers with the user and organization the key acts for. Tell the user which organization you are connected to.

## 2. What the MCP server can do

It reads. Its tools:

${tools}

Anything else, including every change, goes through the REST API.

## 3. The REST API

Base URL \`https://api.distribute.you\`, one header on every call: \`${AUTH_HEADER_LINE}\`.

- The full contract, every route and its parameters: ${OPENAPI_DOCUMENT_URL} (read a route's parameters there before calling it; do not guess them).
- The same, browsable: ${OPENAPI_EXPLORER_URL}
- A plain-language map of every service, written for a model: ${LLM_CONTEXT_URL}
- A command line client: \`${CLI_INSTALL_COMMAND}\`

How the account is organized: an **organization** holds **brands** (one per company it sells for); a brand sells **offers**; each offer is reached through **campaigns**, each campaign targeting **audiences** and producing **leads** we write to. Money is a daily budget per campaign.

## 4. What the user usually asks, and the routes that answer it

${useCases}

## 5. Rules

- Read before you write. Answer from the account's own data, never from assumptions.
- Anything that spends credit, starts or stops a campaign, or changes a budget: say exactly what you are about to do and wait for the user's yes.
- A number you report comes from the API's answer as served. Do not recompute a cost or a return yourself. The one ratio you may state is the delivery rate (delivered out of sent) when the answer does not carry it.
- Report results in the order of "How to report results to a human" above: meetings and positive replies first, failures last, no zero hidden.
- If a call fails, show the user the error the API returned. Do not retry a write blindly.

## More

- Documentation: ${DOCS_SITE_URL}
- Every developer surface on one page: ${DEVELOPER_HUB_URL}
- Your dashboard: https://dashboard.distribute.you
`;
}

function indent(block: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}
