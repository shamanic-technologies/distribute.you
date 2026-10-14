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

/**
 * The header an assistant guesses first, named only to say it is refused: an
 * org key sent under it lands on the ADMIN path and is answered 401. This is
 * the one file allowed to spell it; the guard checks every other mention says
 * it is not accepted.
 */
export const REJECTED_KEY_HEADER = "X-API-Key";

/** The customer dashboard. */
export const DASHBOARD_URL = "https://dashboard.distribute.you";

/** Where a key is issued. */
export const API_KEYS_URL = `${DASHBOARD_URL}/api-keys`;

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
 * The method skills: the steps our own Copilot follows to organize a request
 * (offers, sales funnels, campaigns, caps, workflows, plays). They are served,
 * read-only and the same for every client, so the docs POINT at them rather
 * than restating them (a restated copy drifts). Static export: no build-time
 * fetch, the routes need a key.
 */
export const SKILLS_LIST_ROUTE = "GET /v1/skills";
export const SKILL_READ_ROUTE = "GET /v1/skills/{slug}";

/** The public per-action prices, the only price list a page points at. */
export const CATALOG_URL = "https://distribute.you/catalog";

/**
 * The model in one paragraph, worded like the skills. Printed on the docs home,
 * /api, /mcp and llms.txt; the skills carry the detail.
 */
export const PRODUCT_MODEL =
  "An organization holds brands; a brand sells offers. A campaign is one sales funnel run for one offer (brand x offer x funnel), started or stopped as a whole. It runs one part per step of the funnel, and those part ids are what stats and runs show. A reactive campaign acts only when its trigger fires (a positive reply, a delay with no answer). Money: each campaign has caps the user states, a max budget and/or a max volume, each with a period (one_off, daily, weekly, monthly), spent from the organization's prepaid balance at the public per-action prices.";

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
 * unprefixed vocabulary. The hosted server exposes the tools below, every one
 * of them prefixed, and that is what a connected client lists back. A reference
 * page naming tools that do not exist is worse than no
 * reference page: an agent reads it, calls a name nothing answers to, and has
 * no way to tell a wrong catalogue from a broken server.
 *
 * The list is checked by connecting a client to the endpoint and reading back
 * what it advertises. When the server grows a tool, it grows here.
 */
export interface McpTool {
  name: string;
  /** The leading sentences of the server's own tool description, verbatim. */
  description: string;
  /** What a reader is deciding between, so the list groups. */
  category: string;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "distribute_status",
    category: "Account",
    description:
      "Check the connection and say who the key belongs to: the user, and every organization the key reaches with its brands.",
  },
  {
    name: "distribute_signup_start",
    category: "Account",
    description:
      "No human needed: request a key with an email, prepay when you need to spend. Step 1 of 2 to open a distribute.you account and get an API key, with no key and no dashboard.",
  },
  {
    name: "distribute_signup_complete",
    category: "Account",
    description:
      "Step 2 of 2: send the 6-digit code emailed by distribute_signup_start and get an API key.",
  },
  {
    name: "distribute_prepay",
    category: "Account",
    description:
      "No human needed: request a key with an email, prepay when you need to spend. Prepay before calls that spend money (a call that needs money and finds none answers 402 payment_required).",
  },
  {
    name: "distribute_prepaid_status",
    category: "Account",
    description:
      "Read the prepaid account: `state` (awaiting_payment: not paid yet; active: ready to spend; card_not_reloadable or auto_topup_off: fix it with distribute_prepay; not_prepaid), `balance_cents`, `paid_cents`, the automatic reload settings and whether the saved card can reload.",
  },
  {
    name: "distribute_list_skills",
    category: "Method",
    description:
      "List the method skills: how to organize a client's request on distribute.you (offers and their documents, sales funnels, campaigns, budgets, workflows, tactics, strategies and plays...), the same skills our own Copilot follows.",
  },
  {
    name: "distribute_read_skill",
    category: "Method",
    description:
      "Read one method skill in full (markdown `content`): the steps, the API operations to call in order and the traps.",
  },
  {
    name: "distribute_list_brands",
    category: "Brands",
    description:
      "List the brands (companies/websites you promote through campaigns) of the targeted organization.",
  },
  {
    name: "distribute_suggest_icp",
    category: "Brands",
    description:
      "Analyze a brand's website and suggest an Ideal Customer Profile (ICP). Use this when the user doesn't know who to target and wants AI-generated targeting suggestions.",
  },
  {
    name: "distribute_list_campaigns",
    category: "Campaigns",
    description:
      "List the campaigns of one brand or organization. Each campaign has a name, a status (`ongoing` = running, `stopped` = paused), a type (`proactive`: it reaches out to new people on its own; `reactive`: it acts when something happens, such as a reply), and its limits: `budget` and `volume` in words (\"Max $10/day\", \"Up to 50 leads handled/week\"), with what the current period used in `maxBudget` and `maxVolume`.",
  },
  {
    name: "distribute_campaign_stats",
    category: "Campaigns",
    description:
      "Get one campaign's results, by the campaign id from distribute_list_campaigns. A campaign runs as one; its results come in `results`, one entry per thing it brings in (`bringsIn`, such as a positive reply or a lead found) with the channel doing it (`channel`).",
  },
  {
    name: "distribute_list_leads",
    category: "Leads",
    description:
      "List the leads (prospects, people we found and contacted) of a brand, newest first, with where each one stands: contacted, sent, delivered, clicked, replied (and how the reply was classified), bounced, unsubscribed, with dates.",
  },
  {
    name: "distribute_list_emails",
    category: "Leads",
    description:
      "List the cold emails we wrote and sent for a brand: for each prospect, the first email and every follow-up (`subject`, then `sequence`: one entry per step with its `bodyText`, its `kind` (first_email or follow_up) and its send `status`: `sent` at `sentAt`, `queued` (goes out in the prospect's business hours) or `stopped` (will not go out: reply, bounce, opt-out, meeting, sequence stopped)), with who it went to (`leadEmail`, lead name, title, company, `leadId`).",
  },
  {
    name: "distribute_get_lead",
    category: "Leads",
    description:
      "Everything about ONE lead in one call: who they are and where they stand (sent, delivered, replied...), the emails we wrote for them (first email and follow-ups, subject and body, each with its send status: sent at sentAt, queued or stopped), and the conversation (every message we sent and every reply they wrote, oldest first).",
  },
  {
    name: "distribute_list_workflows",
    category: "Workflows",
    description:
      "List all available workflows. Includes styled workflows written in the style of industry experts (e.g.",
  },
  {
    name: "distribute_find_api",
    category: "Any API operation",
    description:
      "Find how to do something in distribute.you when no other tool covers it. Searches every operation of the distribute.you API (the same API and the same scope your key has: leads, emails, conversations, campaigns, budgets, offers, audiences, billing, CRM, stats...) by what you want to do, in plain words (\"list the emails sent for my brand\", \"change the daily budget\", \"account balance\").",
  },
  {
    name: "distribute_describe_api",
    category: "Any API operation",
    description:
      "Read one distribute.you API operation in full before calling it: what it does, its path and query parameters (required or not), and the JSON body it takes.",
  },
  {
    name: "distribute_call_api",
    category: "Any API operation",
    description:
      "Call any distribute.you API operation with your key, exactly as the API would answer it (same scope, same refusals).",
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
