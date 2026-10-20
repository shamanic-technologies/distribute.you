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
 * - a newly added MCP server loads only after the client restarts, so the
 *   assistant installs it for the NEXT session and keeps working in this one
 *   through the REST API, never asking the human to restart (owner 2026-10-21);
 * - the hosted MCP server takes a Bearer key and has no OAuth, so a browser
 *   connector (claude.ai, ChatGPT) cannot carry an existing key; it connects
 *   with no authentication and opens the account with the signup tools, which
 *   bind the key to that connection.
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
    ask: "How should I organize a new ask (an offer, a campaign, its caps)?",
    routes: ["GET /v1/skills", "GET /v1/skills/{slug}"],
  },
  {
    ask: "Which organizations and brands can this key act in?",
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
    routes: ["GET /v1/sales-funnel-campaigns", "GET /v1/sales-funnel-campaigns/{id}", "GET /v1/campaigns/{partId}/stats"],
    docs: "/api/campaigns/",
  },
  {
    ask: "Pause or restart a campaign",
    routes: ["PATCH /v1/sales-funnel-campaigns/{id}"],
    spends: true,
    docs: "/api/campaigns/",
  },
  {
    ask: "Read or change a campaign's caps (max budget, max volume)",
    routes: [
      "GET /v1/brands/{brandId}/offers/{offerId}/sales-funnels/{salesFunnelId}/caps",
      "PUT /v1/brands/{brandId}/offers/{offerId}/sales-funnels/{salesFunnelId}/caps",
    ],
    spends: true,
    docs: "/api/campaigns/",
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
description: Use distribute.you, which finds buyers, writes and sends the cold emails, and forwards the interested replies. Use when the user asks about their distribute.you brands, offers, campaigns, audiences, leads, replies, results, costs, caps or credit, or wants to change any of them.
---

# distribute.you

${agentQuickstartMarkdown()}
distribute.you runs cold email for a brand: it finds the people to write to, writes the emails, sends them from its own domains, reads the replies and forwards the interested ones. Each campaign runs within caps the customer sets (a max budget and/or a max volume, each with a period), and the work is paid from a prepaid balance at the public per-action prices on ${CATALOG_URL}.

The method our own Copilot follows is served as skills: \`GET /v1/skills\` (or the \`distribute_list_skills\` tool), then \`GET /v1/skills/index\` (\`distribute_read_skill\`) and every skill whose description matches the ask. Read them before organizing anything new (an offer, a campaign, its caps).

You are the customer's assistant. This file tells you how to connect to their account and what you can do there.

## 1. Set up (do this once, in order)

1. **Get the API key.** It starts with \`${API_KEY_PREFIX}\`. If the user pasted one, use it. If they have no account yet, open one yourself: \`POST https://api.distribute.you/v1/agent-signups/start\` with their email and phone (ask for them), then \`POST /v1/agent-signups/complete\` with the 6-digit code they forward; the answer carries the key. Otherwise ask for it, and tell them where it is issued: ${API_KEYS_URL}. Treat it like a password: it acts as them, and can read and change everything in every organization they belong to. Never print it back in full, never commit it to a repository.
2. **Save this skill** where your harness keeps skills or standing instructions, so the next session knows it:
   - Claude Code, Conductor: \`~/.claude/skills/${SKILL_NAME}/SKILL.md\`
   - Codex: \`~/.codex/skills/${SKILL_NAME}/SKILL.md\`
   - Cursor: \`.cursor/rules/${SKILL_NAME}.mdc\`
   - anything else (OpenClaw, custom agents): the file your harness reads at start, often \`AGENTS.md\`
   Save the file as served, and keep the key OUT of it.
3. **Install the MCP server for the next sessions** at \`${MCP_URL}\` (Streamable HTTP, header \`${AUTH_HEADER_LINE}\`). A newly added server loads only after the client restarts: do not ask the user to restart. Keep going in THIS session with the REST API (section 3) and the same key; the MCP tools take over from the next session. Pick your harness:
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
   - **claude.ai in the browser, ChatGPT**: these cannot run commands and their connectors cannot carry a key. Walk the user through adding \`${MCP_URL}\` as a custom connector with no authentication (claude.ai: Settings, Connectors, Add custom connector; ChatGPT: turn on Developer mode in its settings, then add a connector). In that connection, \`distribute_signup_start\` then \`distribute_signup_complete\` open the account, and the key stays bound to it. A user who already has a key uses the REST API through your code tool instead.
   Replace \`${API_KEY_PREFIX}YOUR_KEY\` with the real key.
4. **Check it works**: call the \`distribute_status\` tool when its tools are loaded, else
   \`\`\`
${indent(curlExample("/v1/me"), 3)}
   \`\`\`
   It answers with the user the key acts as and every organization they belong to, each with its brands. Tell the user which organizations and brands you see, then name a brand (\`brandId\`) on each call that follows.

${sendEmailMarkdown()}
## 2. What the MCP server can do

Its tools read your account, and \`distribute_call_api\` calls any REST operation, changes included:

${tools}

Until the tools are loaded (the session where you added the server), call the REST API directly.

## 3. The REST API

Base URL \`https://api.distribute.you\`, one header on every call: \`${AUTH_HEADER_LINE}\`.

- The full contract, every route and its parameters: ${OPENAPI_DOCUMENT_URL} (read a route's parameters there before calling it; do not guess them).
- The same, browsable: ${OPENAPI_EXPLORER_URL}
- A plain-language map of every service, written for a model: ${LLM_CONTEXT_URL}
- A command line client: \`${CLI_INSTALL_COMMAND}\`

How the account is organized: an **organization** holds **brands** (one per company it sells for); a brand sells **offers**; each offer is reached through **campaigns**, each campaign targeting **audiences** and producing **leads** we write to. A campaign is one sales funnel run for one offer, started or stopped as a whole. Money: each campaign has caps (a max budget and/or a max volume, each with a period), spent from the organization's prepaid balance.

## 4. What the user usually asks, and the routes that answer it

${useCases}

## 5. Rules

- Read before you write. Answer from the account's own data, never from assumptions.
- Anything that spends credit, starts or stops a campaign, or changes a cap: say exactly what you are about to do and wait for the user's yes.
- A number you report comes from the API's answer as served. Do not recompute a cost or a return yourself. The one ratio you may state is the delivery rate (delivered out of sent) when the answer does not carry it.
- Report results in the order of "How to report results to a human" above: meetings and positive replies first, failures last, no zero hidden.
- If a call fails, show the user the error the API returned. Do not retry a write blindly.

## More

- Documentation: ${DOCS_SITE_URL}
- Every developer surface on one page: ${DEVELOPER_HUB_URL}
- Your dashboard: https://dashboard.distribute.you
`;
}

/** The public price list the email-sent price is read from. */
export const CATALOG_URL = "https://distribute.you/catalog";

/** The trigger that sends an email the customer wrote, word for word. */
export const EMAIL_PUSH_TRIGGER = "email_pushed_via_api";

/**
 * "Send this email I wrote to me@x.com": the one write a customer who writes
 * their own emails needs first. Every route and field below is a field of the
 * deployed openapi (POST /v1/trigger-events, the email-signature routes, the
 * trigger-events read), checked against it when this section was written.
 */
function sendEmailMarkdown(): string {
  const body = `{
  "triggerId": "${EMAIL_PUSH_TRIGGER}",
  "brandId": "BRAND_ID",
  "offerId": "OFFER_ID",
  "person": { "email": "me@example.com", "name": "Sam", "timezone": "Europe/London" },
  "item": { "subject": "Hiring in Leeds?", "bodyText": "Hi Sam,\\nI saw you are hiring..." },
  "idempotencyKey": "test-email-1"
}`;
  const send = curlExample(
    "/v1/trigger-events",
    `-H "Content-Type: application/json" \\\n  -d '${body.replace(/\n/g, "\n  ")}'`,
  );
  return `## Send an email you wrote

Use this when the user wrote the email themselves and wants it sent as written (for a test, send it to their own address first).

1. **Find the brand and offer.** \`GET /v1/me\` gives the \`brandId\`; \`GET /v1/features/brands/{brandId}/offers\` gives the \`offerId\`. A call naming a \`brandId\` acts in that brand's organization; on a call with no brand (the balance) and a key that reaches several organizations, add \`orgId\` to the query. The email is sent by a running campaign of that offer that holds an email-sending part: in \`GET /v1/sales-funnel-campaigns?brandId=...\`, look for a campaign (any name) on that \`offerId\` with a unit whose \`featureSlug\` is \`email-sending\` and \`status\` is \`ongoing\`. If there is none, tell the user to start one from the dashboard before going on.
2. **Say what you will send** (to whom, subject, body) and wait for the user's yes: it spends credit.
3. **Send it** with \`POST /v1/trigger-events\`:
   \`\`\`
${indent(send, 3)}
   \`\`\`
   - \`person.email\` is the recipient (required). \`person.timezone\` is an IANA name such as \`Europe/London\`, so the email lands in their business hours; leave it out and we infer it (a +44 \`person.phone\` means London). An offset like \`GMT+1\` is refused.
   - \`item.subject\` plus \`item.bodyText\` (plain text, \`\\n\` between lines) or \`item.bodyHtml\`, at least one body. It is sent word for word, from our own domains and inboxes, with a signature added below it.
   - \`idempotencyKey\` makes a retry safe: the same key returns the first event (\`replayed: true\`) and sends nothing twice. Use a new key per email.
   - \`dueAt\` (ISO date-time) sends it later instead of now.
4. **Read the answer** (201). \`event.outcome\` is \`ran\` when the campaign took the email, or \`skipped\` with a reason (\`no_campaign\`: no running email-sending campaign on that offer; \`unfunded\`: no credit or budget left). \`pending\` means the person is still being filed: read it again in a few minutes. Keep \`event.detail.triggered[].runId\`: it is how you read the cost. \`event.leadId\` can be null: find the person by email instead (below). A 400 names the field that is wrong; nothing was recorded.
5. **Expect a short wait.** \`ran\` means the email is queued, not sent yet: it usually goes out within about 10 minutes, in the recipient's business hours.

**What gets sent.** Before sending, we check the address (BounceVerify). A \`valid\` address is sent at the public email-sent price on ${CATALOG_URL}; \`catch-all\` costs 2x and \`unknown\` 3x that price. An \`invalid\` or \`risky\` address is never sent.

**Was it delivered?**
- \`GET /v1/offers/{offerId}/trigger-events?brandId=...\`: the latest pushes, newest first, each with its outcome.
- \`GET /v1/leads?brandId=...&q=me@example.com\` finds the person: the row carries \`sent\`, \`delivered\`, \`bounced\` and \`firstSentAt\`. Use the row's \`id\` (not its \`leadId\`) for \`GET /v1/leads/{id}/history?brandId=...\`: it lists, in order, the email as sent (sender address, subject, body as you wrote it) and a \`delivery\` event once it is delivered, then any reply.
- Delivered means the recipient's mail server accepted it; it does not say the email was opened. \`GET /v1/emails\` lists the emails we write, not the ones you pushed: do not look for yours there.

**What did it cost?** \`GET /v1/runs/{runId}\` (the \`runId\` you kept) answers \`totalCostInUsdCents\` for this one email and its cost lines: the address check, then the send, priced at its BounceVerify tier (a \`costName\` ending in \`-catch-all\` was charged as catch-all). A line stays \`provisioned\` until the email is sent, then becomes \`actual\`; a \`cancelled\` line is not charged. \`GET /v1/billing/accounts/balance\` is the whole organization's credit, so it also moves with other work. Report figures as the API serves them.

**The signature.** Every email ends with a signature. By default it is the sending mailbox's name, then ours. To use the user's own:
- \`GET /v1/email-signature?brandId=...\` reads it (\`signature: null\` means the default).
- \`PUT /v1/email-signature\` with \`{"brandId": "...", "signature": "Jane Doe\\nHead of Sales, Acme\\nacme.com"}\` sets it: plain text, \`\\n\` between lines, at most 12 lines and 1,000 characters, no \`--\` line (it is added for you).
- The text may use \`{first_name}\`, \`{last_name}\`, \`{full_name}\` and \`{sender_email}\`. Each email fills them with the mailbox that sends it. We rotate mailboxes, so the signed name always matches the From name. Example: \`"{first_name} {last_name}\\nAcme"\` signs \`Jane Doe\` when jane@acme.com sends. Any other \`{...}\` is refused with a 400.
- \`DELETE /v1/email-signature?brandId=...\` goes back to the default.
A new signature applies to new email threads only; a thread keeps the one it started with.

`;
}

function indent(block: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}
