/**
 * The programmatic surfaces these docs tell a developer to use, spelled once.
 *
 * Every one of these strings is something a person PASTES: a header, a key
 * prefix, an install command, a package name. A page that prints a command is
 * making a claim that the command runs, and rendering the page proves nothing
 * about that, because the consumer is a shell on somebody else's machine. So
 * each value below was checked against the thing that answers for it before it
 * was written here, and the check is named beside it.
 *
 * They live in one module because they were spelled out by hand in 22 files,
 * and the copies went stale together: the docs printed an npx command for an
 * MCP package that has never existed on npm, an admin-path auth header the API
 * does not accept from an org key, and a TypeScript client package that has
 * never existed either. A developer who found the docs by name pasted a
 * command that 404'd, then an auth header the API rejected. That is worse for
 * the audit item this fixes than not being found at all.

 * Every literal these docs retired is pinned as absent by
 * tests/unit/agent-discoverability.test.ts, which is why none of them is
 * spelled out in this file.
 */

import { MCP_ENDPOINT_URL } from "./docs-routes";

/**
 * How the REST API authenticates.
 *
 * Ground truth is the deployed document at api.distribute.you/openapi.json,
 * whose only `securityScheme` is `bearerAuth`: `type: http`, `scheme: bearer`,
 * described as "Use an API key (`distrib.usr_*`) as your Bearer token". The
 * header these docs used to print belongs to api-service's separate ADMIN
 * path; an org key sent that way is answered `401 Invalid admin key`.
 */
export const AUTH_HEADER_NAME = "Authorization";

/** The prefix a real key carries. The short prefix these docs used to print
 * was never issued to anyone. */
export const API_KEY_PREFIX = "distrib.usr_";

/** What a snippet shows in place of a real key. */
export const API_KEY_PLACEHOLDER = `${API_KEY_PREFIX}YOUR_KEY`;

/** The full header line, for prose and for a raw-header code block. */
export const AUTH_HEADER_LINE = `${AUTH_HEADER_NAME}: Bearer ${API_KEY_PLACEHOLDER}`;

/** The same header as a curl flag. */
export const CURL_AUTH_FLAG = `-H "${AUTH_HEADER_LINE}"`;

/** Where a key is issued. */
export const API_KEYS_URL = "https://dashboard.distribute.you/api-keys";

/**
 * The CLI, which is the one npm package this product actually publishes.
 * Verified on the registry: `@distribute.you/cli`, whose binary is named after
 * the product.
 */
export const CLI_PACKAGE = "@distribute.you/cli";
export const CLI_NPM_URL = `https://www.npmjs.com/package/${CLI_PACKAGE}`;
export const CLI_INSTALL_COMMAND = `npx ${CLI_PACKAGE} --help`;

/**
 * The apex hub that names every developer surface on one page.
 *
 * Cross-linked from here because a name search for the product lands on one of
 * the two domains and the reader needs the other.
 */
export const DEVELOPER_HUB_URL = "https://distribute.you/developers";

/**
 * The MCP server is HOSTED and spoken over Streamable HTTP. There is no local
 * stdio server to install: the package these docs used to name does not exist
 * on npm, and the transport an agent connects over is a URL, not a subprocess.
 */
export const MCP_URL = MCP_ENDPOINT_URL;

/** The name a client registers the server under. Becomes part of tool names. */
export const MCP_SERVER_NAME = "distribute";

/**
 * Claude Code registers a remote server with an explicit transport and header.
 */
export const CLAUDE_CODE_MCP_COMMAND = `claude mcp add --transport http ${MCP_SERVER_NAME} ${MCP_URL} --header "${AUTH_HEADER_LINE}"`;

/**
 * A client whose config file takes a URL (Cursor, and any other client that
 * speaks Streamable HTTP natively).
 */
export const MCP_HTTP_CONFIG = `{
  "mcpServers": {
    "${MCP_SERVER_NAME}": {
      "url": "${MCP_URL}",
      "headers": {
        "${AUTH_HEADER_NAME}": "Bearer ${API_KEY_PLACEHOLDER}"
      }
    }
  }
}`;

/**
 * A client that only speaks stdio reaches a remote server through the
 * `mcp-remote` bridge, which IS published (checked on the registry, bin
 * `mcp-remote`). It is not ours, so it is named as what it is.
 */
export const MCP_REMOTE_BRIDGE_PACKAGE = "mcp-remote";
export const MCP_STDIO_BRIDGE_CONFIG = `{
  "mcpServers": {
    "${MCP_SERVER_NAME}": {
      "command": "npx",
      "args": [
        "-y",
        "${MCP_REMOTE_BRIDGE_PACKAGE}",
        "${MCP_URL}",
        "--header",
        "${AUTH_HEADER_NAME}: Bearer ${API_KEY_PLACEHOLDER}"
      ]
    }
  }
}`;

/**
 * A curl against any REST route, for the pages that open with one.
 */
export function curlExample(path: string, extra?: string): string {
  const tail = extra ? ` \\\n  ${extra}` : "";
  return `curl https://api.distribute.you${path} \\\n  ${CURL_AUTH_FLAG}${tail}`;
}

/**
 * The tools the hosted server actually exposes.
 *
 * These docs used to publish a catalogue of thirty-five tools under an
 * unprefixed vocabulary. The hosted server exposes the six below, every one of
 * them prefixed, and that is what a connected client lists back. A reference
 * page naming tools that do not exist is worse than no
 * reference page: an agent reads it, calls a name nothing answers to, and has
 * no way to tell a wrong catalogue from a broken server.
 *
 * The list is checked by connecting a client to the endpoint and reading back
 * what it advertises. When the server grows a tool, it grows here.
 */
export interface McpTool {
  name: string;
  /** Verbatim from the server's own tool description. */
  description: string;
  /** What a reader is deciding between, so the list groups. */
  category: string;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "distribute_status",
    category: "Identity",
    description:
      "Check the distribute.you connection status and configuration. Answers with the user and org the key acts for, so it is the way to tell a working key from a missing header.",
  },
  {
    name: "distribute_list_brands",
    category: "Brands",
    description:
      "List all your brands, the companies and websites you promote through campaigns.",
  },
  {
    name: "distribute_suggest_icp",
    category: "Brands",
    description:
      "Analyze a brand's website and suggest an Ideal Customer Profile. Use it when the user does not know who to target. Returns a description of the ideal customers to aim a campaign at.",
  },
  {
    name: "distribute_list_campaigns",
    category: "Campaigns",
    description:
      "List all your cold email campaigns. Takes an optional status of ongoing, stopped or all.",
  },
  {
    name: "distribute_campaign_stats",
    category: "Campaigns",
    description:
      "Get statistics for one campaign, by campaign id: what it produced and what it cost.",
  },
  {
    name: "distribute_list_workflows",
    category: "Workflows",
    description:
      "List all available workflows, including the ones written in the style of a named industry expert.",
  },
];

/** How many tools the server exposes. Read, never written by hand in prose. */
export const MCP_TOOL_COUNT = MCP_TOOLS.length;

/** The tools grouped for a reference page, in catalogue order. */
export function mcpToolsByCategory(): { name: string; tools: McpTool[] }[] {
  const order: string[] = [];
  const byCategory = new Map<string, McpTool[]>();
  for (const tool of MCP_TOOLS) {
    if (!byCategory.has(tool.category)) {
      byCategory.set(tool.category, []);
      order.push(tool.category);
    }
    byCategory.get(tool.category)!.push(tool);
  }
  return order.map((name) => ({ name, tools: byCategory.get(name)! }));
}
