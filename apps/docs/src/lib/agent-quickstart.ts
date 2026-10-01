/**
 * The block an AI assistant must read before its first call, printed at the top
 * of the home page, /api, /mcp, the agent skill and llms.txt.
 *
 * It exists because an assistant handed a real key (2026-10-01) guessed the
 * auth header, said there was no dashboard, quoted a tool count from nowhere,
 * and told the human the key "belonged to a user, not a brand" when it was
 * reading another organization. Since 2026-10-01 a key is the USER's across
 * every org they belong to (api-service #1073), so the block also says how to
 * name the org a call acts in and what each refusal code asks for. Each line
 * below answers one of those guesses
 * before it is made, and every value is read from developer-surfaces so the
 * block cannot drift from what the pages paste.
 *
 * The reporting paragraph is the owner's rule for any output a human reads:
 * the outcomes the customer pays for first, failures last, no zero hidden.
 *
 * llms.txt is a static file, so it carries a byte-equal copy of
 * `agentQuickstartMarkdown()`; tests/unit/agent-quickstart.test.ts pins it.
 */

import {
  API_KEYS_URL,
  API_KEY_PREFIX,
  AUTH_HEADER_LINE,
  DASHBOARD_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
  REJECTED_KEY_HEADER,
} from "./developer-surfaces";

export const API_BASE_URL = "https://api.distribute.you/v1";

/** The who-am-I route. Its served shape grows; the block names no field. */
export const WHO_AM_I_ROUTE = "GET /v1/me";

/** One fact an agent needs, as a label and the sentence that states it. */
export interface QuickstartLine {
  label: string;
  text: string;
}

export const AGENT_QUICKSTART_LINES: QuickstartLine[] = [
  { label: "Base URL", text: `\`${API_BASE_URL}\`` },
  {
    label: "Auth",
    text: `\`${AUTH_HEADER_LINE}\` on every REST and MCP call. The \`${REJECTED_KEY_HEADER}\` header is NOT accepted for user keys: it answers 401.`,
  },
  {
    label: "First call",
    text: `\`${WHO_AM_I_ROUTE}\` (or the \`distribute_status\` MCP tool). It needs no brand or organization named, and lists every organization the key can act in, each with its brands. Tell the human which organizations and brands you see before anything else.`,
  },
  {
    label: "Scope",
    text: "One key is one user, across every organization that user belongs to. Membership is checked on each call, so leaving an organization removes it from the key. A key never belongs to a brand, and it carries no staff powers.",
  },
  {
    label: "Name a brand on each call",
    text: "Each call acts in ONE organization. Name a brand: `?brandId=`, the `x-brand-id` header, `brandId` (or `brandIds`) in a JSON body, or `/v1/brands/{id}` in the path. When a brand sits in several of your organizations, add `?orgId=` (or the `x-org-id` header). Calls about no brand name the organization with `orgId`. A user in exactly one organization can name nothing. Routes keyed only by a campaign id need `brandId` or `orgId` too when the user is in several organizations.",
  },
  {
    label: "Targeting errors",
    text: "Every refusal carries `code`, `message` and `fix`. `400 org_target_required`: you named nothing and belong to several organizations; pick one from the `organizations` list in the body (or from `GET /v1/me`) and send its `brandId` or `orgId`. `400 brand_in_several_orgs`: add `orgId`. `400 brands_span_orgs`: the brands are in different organizations; make one call per organization. `403 org_not_member`: that organization is not one of yours; use an id from `GET /v1/me`. `403 no_organization`: the user belongs to no organization; ask the human to create or join one in the dashboard. `404 org_not_found` or `brand_not_found`: the id is wrong; read `GET /v1/me` again. `503 membership_unavailable`: retry, keep the same key.",
  },
  {
    label: "Key refused",
    text: `A 401 means the key was mistyped, revoked or not sent. Show the human the error as served and ask for a new key from ${API_KEYS_URL}. Keys start with \`${API_KEY_PREFIX}\`.`,
  },
  { label: "Dashboard", text: `${DASHBOARD_URL} (API keys sit in the account menu, under API Keys).` },
  {
    label: "MCP server",
    text: `\`${MCP_URL}\`, exactly ${MCP_TOOL_COUNT} tools: ${MCP_TOOLS.map((t) => `\`${t.name}\``).join(", ")}. Everything else goes through the REST API.`,
  },
];

export const REPORTING_TITLE = "How to report results to a human";

export const REPORTING_RULE =
  "Lead with what the customer pays for: meetings booked and positive replies, then money earned or return when the API serves it, then the delivery rate (\"98% delivered\", not \"531 sent, 518 delivered\"). Volume sent and cost come next. Failures such as bounces and errors go last, in a details line. Never hide a number: 0 positive replies is said plainly.";

export const AGENT_QUICKSTART_TITLE = "Agent quickstart";

/** The whole block as markdown, for skill.md, llms.txt and "Copy for LLM". */
export function agentQuickstartMarkdown(): string {
  const lines = AGENT_QUICKSTART_LINES.map((l) => `- **${l.label}**: ${l.text}`).join("\n");
  return `## ${AGENT_QUICKSTART_TITLE}

${lines}

### ${REPORTING_TITLE}

${REPORTING_RULE}
`;
}
