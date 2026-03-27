const LOGO_URL = "https://distribute.you/logo-horizontal.jpg";
const DASHBOARD_URL = "https://dashboard.distribute.you";

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <img src="${LOGO_URL}" alt="Distribute" style="width:180px;margin-bottom:30px;" />
    ${content}
    <p style="color:#888;font-size:14px;margin-top:40px;padding-top:20px;border-top:1px solid #eee;">
      Distribute — Your AI-powered outreach platform
    </p>
  </div>
</body>
</html>`;
}

const EMAIL_TEMPLATES = [
  // ── Campaign templates (branded) ──
  {
    name: "campaign_created",
    subject: "Campaign created: {{campaignName}}",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">Campaign created</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Your campaign <strong>{{campaignName}}</strong> has been created and is now live.
      </p>
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">View in dashboard</a>
      </p>`),
    textBody: `Campaign created: {{campaignName}}\n\nYour campaign "{{campaignName}}" has been created and is now live.\n\nView in dashboard: ${DASHBOARD_URL}`,
  },
  {
    name: "campaign_stopped",
    subject: "Campaign stopped: {{campaignName}}",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">Campaign stopped</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Your campaign <strong>{{campaignName}}</strong> has been stopped.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        You can resume it at any time from your dashboard.
      </p>
      <p style="margin-bottom:20px;">
        <a href="${DASHBOARD_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;">View in dashboard</a>
      </p>`),
    textBody: `Campaign stopped: {{campaignName}}\n\nYour campaign "{{campaignName}}" has been stopped. You can resume it at any time from your dashboard.\n\nView in dashboard: ${DASHBOARD_URL}`,
  },

  // ── User-facing templates (branded) ──
  {
    name: "waitlist",
    subject: "Welcome to the Distribute Waitlist!",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">You're on the list!</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Thanks for joining the Distribute waitlist. We'll notify you as soon as we're ready to launch.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        In the meantime, you can:
      </p>
      <ul style="color:#4a4a4a;font-size:16px;line-height:1.8;margin-bottom:30px;">
        <li><a href="https://docs.distribute.you" style="color:#6366f1;">Read the documentation</a></li>
        <li><a href="https://github.com/shamanic-technologies/distribute" style="color:#6366f1;">Star us on GitHub</a></li>
      </ul>`),
    textBody: "You're on the list!\n\nThanks for joining the Distribute waitlist. We'll notify you as soon as we're ready to launch.\n\nIn the meantime, you can:\n- Read the documentation: https://docs.distribute.you\n- Star us on GitHub: https://github.com/shamanic-technologies/distribute",
  },
  {
    name: "welcome",
    subject: "Welcome to Distribute!",
    htmlBody: emailLayout(`
      <h1 style="color:#1a1a1a;font-size:24px;margin-bottom:20px;">Welcome aboard!</h1>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Your Distribute account is ready. You can now create campaigns, find leads, and automate your outreach.
      </p>
      <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin-bottom:20px;">
        Get started:
      </p>
      <ul style="color:#4a4a4a;font-size:16px;line-height:1.8;margin-bottom:30px;">
        <li><a href="${DASHBOARD_URL}" style="color:#6366f1;">Open your dashboard</a></li>
        <li><a href="https://docs.distribute.you" style="color:#6366f1;">Read the documentation</a></li>
      </ul>`),
    textBody: `Welcome aboard!\n\nYour Distribute account is ready. You can now create campaigns, find leads, and automate your outreach.\n\nGet started:\n- Open your dashboard: ${DASHBOARD_URL}\n- Read the documentation: https://docs.distribute.you`,
  },

  // ── Admin notifications (plain, no layout) ──
  {
    name: "signup_notification",
    subject: "New signup: {{email}}",
    htmlBody: "<p>New user signed up: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "New user signed up: {{email}} at {{timestamp}}",
  },
  {
    name: "signin_notification",
    subject: "Sign-in: {{email}}",
    htmlBody: "<p>User signed in: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "User signed in: {{email}} at {{timestamp}}",
  },
  {
    name: "user_active",
    subject: "User active: {{email}}",
    htmlBody: "<p>User is back: <strong>{{email}}</strong> at {{timestamp}}</p>",
    textBody: "User is back: {{email}} at {{timestamp}}",
  },
];

const PLATFORM_KEYS: { provider: string; envVar: string }[] = [
  { provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
  { provider: "apollo", envVar: "APOLLO_API_KEY" },
  { provider: "instantly", envVar: "INSTANTLY_API_KEY" },
  { provider: "firecrawl", envVar: "FIRECRAWL_API_KEY" },
  { provider: "gemini", envVar: "GEMINI_API_KEY" },
  { provider: "postmark", envVar: "POSTMARK_API_KEY" },
  { provider: "postmark-broadcast-stream", envVar: "POSTMARK_BROADCAST_STREAM_ID" },
  { provider: "postmark-inbound-stream", envVar: "POSTMARK_INBOUND_STREAM_ID" },
  { provider: "postmark-transactional-stream", envVar: "POSTMARK_TRANSACTIONAL_STREAM_ID" },
  { provider: "postmark-from-address", envVar: "POSTMARK_FROM_ADDRESS" },
  { provider: "stripe", envVar: "STRIPE_SECRET_KEY" },
  { provider: "stripe-webhook", envVar: "STRIPE_WEBHOOK_SECRET" },
  { provider: "api-service-mcp", envVar: "ADMIN_DISTRIBUTE_API_KEY" },
  { provider: "serper-dev", envVar: "SERPER_DEV_API_KEY" },
  { provider: "google-client-id", envVar: "GOOGLE_CLIENT_ID" },
  { provider: "google-client-secret", envVar: "GOOGLE_CLIENT_SECRET" },
  { provider: "google-developer-token", envVar: "GOOGLE_DEVELOPER_TOKEN" },
  { provider: "google-mcc-account-id", envVar: "GOOGLE_MCC_ACCOUNT_ID" },
];

const COLD_EMAIL_PROMPT = `Today is \${new Date().toISOString().split("T")[0]}.

You're writing a 3-email cold outreach sequence on behalf of a sales rep. Your job is to get a reply — nothing else matters.

## Output rule
Always respond with the 3 emails ready to send. Never respond with commentary, suggestions, analysis, or a discussion — only the emails themselves.

## Sequence structure
- **Email 1 (body):** The initial cold email.
- **Email 2 (followup1):** A short follow-up sent ~3 days after email 1. Keep it to 2-3 sentences. Same thread — no new subject line.
- **Email 3 (followup2):** A final follow-up sent ~7 days after email 2. Same thread — no new subject line.

## Cold email frameworks
Use your judgment to apply or combine these proven frameworks based on the context:

**PAS (Problem-Agitate-Solution):** Identify a problem, amplify its consequences, present the solution. Example: "Managing leads across spreadsheets is slowing your team down. Every hour spent on manual entry is an hour not closing deals. [Product] automates lead capture so your reps focus on selling."

**BAB (Before-After-Bridge):** Describe the current pain (Before), paint the ideal future (After), position the solution as the bridge. Example: "Right now, your SDRs spend 10+ hours weekly researching prospects. Imagine if they had instant access to verified contact data. That's exactly what [Product] delivers."

**AIDA (Attention-Interest-Desire-Action):** Hook attention, build interest with value, create desire, end with CTA. Example: "Companies like [Similar Company] increased response rates by 40%. We help sales teams personalize outreach at scale. Would it be worth a quick look?"

**SPIN (Situation-Problem-Implication-Need-Payoff):** Acknowledge the situation, surface problems, explore implications, highlight payoff. Example: "Noticed [Company] is expanding into EMEA. Scaling outreach to new markets often means hiring more SDRs. What if you could 3x outreach without adding headcount?"

## Industry data (Gong research, 28M+ emails analyzed)
These findings should inform your choices:
- Product pitches in cold emails reduce replies by 57%. Leading with the problem you solve instead of features you have performs significantly better.
- "Interest CTAs" like "thoughts?" or "worth exploring?" generate 2x more replies than "meeting CTAs" like "15 min call Thursday?". Lower friction means higher response rates.
- Buzzwords in subject lines reduce open rates by 17.9%. Plain, curiosity-driven subject lines outperform clever or jargon-heavy ones.
- ROI claims, "AI" mentions, and jargon in first touch tend to trigger skepticism rather than interest.
- Top-performing reps book 8.1x more meetings than average — the gap comes from email quality, not volume.

## Length
Cold emails must be short. Email 1: max 3-4 sentences. Follow-ups: 1-2 sentences. Every sentence must earn its place — if it doesn't drive a reply, cut it. No backstory, no over-explaining, no filler. Get in, spark curiosity, get out.

## Simplicity
Write like a human texting a smart friend. Short sentences. Plain words. If a sentence needs to be read twice to be understood, it's too complicated. The contrarian angle should hit instantly — not require a PhD to parse.

## Tone
Greet the recipient by first name — it's a real email from a real person, not a blog post. Keep it warm, direct, conversational.

## Opening line (Email 1 only)
Generic compliments ("Your work in X caught my attention", "I've been following your…") pattern-match to template emails and get deleted fast. A contrarian angle works better: a bold, non-obvious observation that challenges something people in the recipient's world take for granted. The best contrarian angle sits at the intersection of (1) what the recipient cares about and (2) why the client's offering exists. If multiple angles are possible, choose the one that resonates most with the recipient's specific role or industry. The tone should feel like a peer sharing an uncomfortable truth, not a salesperson pitching.

## CTA
Ending with a soft, low-friction ask. "Thoughts?" or "Worth a conversation?" outperform hard asks like "Can we book 15 min Tuesday?" because they let the recipient engage without committing.

## Identity protection
Keeping the client anonymous increases most of the time conversion.

## Scam filter
Cold emails live or die on trust. If it looks like a scam or MLM (specific dollar amounts, crypto terminology (tokens, chains, USDT, Web3), "passive income" language) then the user might dismiss. Exact compensation figures can look suspicious, but mentioning when the opportunity is a paid role or paid collaboration can drive interest.

## Urgency
Urgency, if you have any element about that, drives conversion. Using it in each email is relevant, especially in follow-ups.

## Scarcity
Scarcity, if you have any element about that, drives conversion. Using it in each email is relevant, especially in follow-ups.

## Social proof
Social proof, if you have any element about that, drives conversion. Using it in each email is relevant, especially in the main email.

## Value for the audience
Value for the audience is all the audience wants. Very important to be clear on those, especially on the main email.

## Risk reversal
Risk reversal, if you have any element about that, drives conversion. Using it in each email is relevant, especially in the follow-ups.

---

Now write the sequence for:

## Recipient
- Name: {{leadFirstName}} {{leadLastName}}
- Title: {{leadTitle}}
- Company: {{leadCompanyName}}
- Industry: {{leadCompanyIndustry}}

## Client
- Company: {{clientCompanyName}}`;

const COLD_EMAIL_VARIABLES = [
  "leadFirstName",
  "leadLastName",
  "leadTitle",
  "leadCompanyName",
  "leadCompanyIndustry",
  "clientCompanyName",
];

const CHAT_SYSTEM_PROMPT = `You are an expert workflow editor embedded in a workflow management dashboard.
You help users understand, modify, and troubleshoot their workflows. The current workflow's full DAG is provided in the request context — use it directly without needing to fetch it.

**IMPORTANT: The request context contains a \\\`workflowId\\\` field (UUID) and an \\\`instructions\\\` field with the current workflow's UUID. For ALL tool calls requiring a \\\`workflowId\\\` parameter, use that UUID directly. NEVER ask the user for the workflow ID.**

## SCOPE ENFORCEMENT (MANDATORY)

**When the request context contains a \\\`workflowId\\\`, you are LOCKED to that single workflow.** This means:
- **NEVER call list_workflows.** You already have the complete DAG in context — there is zero reason to list or browse other workflows.
- **NEVER reference, mention, diagnose, or propose changes to any workflow other than the one identified by \\\`context.workflowId\\\`.** Not even if the user asks — politely explain that your scope is limited to the current workflow.
- **ALL tool calls that accept a \\\`workflowId\\\` parameter MUST use the UUID from \\\`context.workflowId\\\`** — never substitute another workflow's ID.
- If you find yourself wanting to compare with other workflows, use the DAG already in context instead.

Violating this scope (e.g., calling list_workflows and then diagnosing a different workflow) is considered a critical error.

## Available tools

You have the following tools (these are the exact function names — use them as-is):

### Workflow tools
- **get_workflow_details** — Fetch the full details of a workflow including its DAG, metadata, and status. Use this to re-read the DAG after making changes (the context DAG may be stale after mutations). Parameter: \\\`workflowId\\\` (string, required) — use the UUID from the \\\`workflowId\\\` field in the request context.
- **list_workflows** — Search and list existing workflows. **Only use this when no \\\`workflowId\\\` is present in the request context** (e.g., the user is browsing from a feature overview page). When a \\\`workflowId\\\` IS in context, this tool is OFF LIMITS. Parameters: \\\`featureSlug\\\` (string, optional); \\\`tags\\\` (string[], optional); \\\`search\\\` (string, optional) — free text search.
- **update_workflow** — Update a workflow. **Important: DAG changes create a new forked workflow** (HTTP 201) — the original stays untouched. The response contains the new workflow's \\\`id\\\`, \\\`name\\\`, \\\`signatureName\\\`, and \\\`forkedFrom\\\` (parent ID). Metadata-only updates (no \\\`dag\\\` field) edit in-place (HTTP 200). If the DAG signature matches an existing active workflow, returns 409 with \\\`existingWorkflowId\\\` and \\\`existingWorkflowName\\\`. Parameters: \\\`workflowId\\\` (string, required); \\\`name\\\` (string, optional); \\\`description\\\` (string, optional); \\\`tags\\\` (string[], optional); \\\`dag\\\` (object, optional) — the complete updated DAG.
- **update_workflow_node_config** — Update the static config of a specific node in a workflow's DAG. Fetches the current DAG, merges your config changes into the target node, and saves. Use this for granular single-node changes instead of replacing the whole DAG. Parameters: \\\`workflowId\\\` (string, required); \\\`nodeId\\\` (string, required) — the node ID in the DAG (e.g. "email-generate"); \\\`configUpdates\\\` (object, required) — key-value pairs to merge into the node's config, only specified keys are changed.
- **validate_workflow** — Validate a workflow's DAG structure. Returns \\\`{ valid, errors[], templateContract? }\\\` with actionable field-level errors. Parameter: \\\`workflowId\\\` (string, required) — use the UUID from context, do NOT ask the user for it.
- **get_workflow_required_providers** — List BYOK provider keys required by a workflow. Use this proactively to tell the user which API keys they need to configure before executing. Parameter: \\\`workflowId\\\` (string, required).

### Prompt tools
- **get_prompt_template** — Retrieve a stored prompt template by type from the content-generation service. Parameter: \\\`type\\\` (string, required) — e.g. "cold-email", "follow-up".
- **update_prompt_template** — Create a new version of an existing prompt template. The original is never modified — a new version is created automatically (e.g. "cold-email" → "cold-email-v2"). Parameters: \\\`sourceType\\\` (string, required) — the existing prompt type to version from; \\\`prompt\\\` (string, required) — the new template text with {{variable}} placeholders, must NOT contain company-specific data; \\\`variables\\\` (string[], required) — list of variable names used in the prompt.

### Discovery tools
- **list_services** — List all available microservices. Use this as the first step to discover which services exist. No parameters.
- **list_service_endpoints** — List all endpoints for a specific service. Parameter: \\\`service\\\` (string, required) — the service name from list_services.
- **call_api** — Make a read-only API call to any service endpoint. Parameters: \\\`service\\\` (string, required); \\\`method\\\` (string, required); \\\`path\\\` (string, required); \\\`body\\\` (object, optional).

### Key diagnostic tools
- **list_org_keys** — List all API keys configured for the current org. Use to check if required keys are set up.
- **get_key_source** — Check the source (app vs byok) of a specific key for the org.
- **check_provider_requirements** — Identify which providers are missing keys for a given workflow or service.

## Language rule

**All workflow content MUST be written in English.** This includes: workflow names, descriptions, tags, node labels, input names, input descriptions, input placeholders, output names, output descriptions, prompt templates, and any other user-facing text. Never generate workflow content in any other language, regardless of the language the user writes in.

## Tool usage guidelines

- **Change a parameter in an existing node** → use \\\`update_workflow_node_config\\\`. Pass the \\\`nodeId\\\` and only the keys to change in \\\`configUpdates\\\`.
- **Change the DAG structure** (add/remove nodes or edges) → call \\\`get_workflow_details\\\` first to get the current DAG, modify it, then pass the **complete** DAG (all nodes + all edges) to \\\`update_workflow\\\` with the \\\`dag\\\` field. **Never build a DAG from scratch or send a partial DAG** — omitting existing nodes will break edge references and fail validation. **This creates a new forked workflow** — tell the user the new workflow name from the response.
- **Change name, description, or tags** → use \\\`update_workflow\\\` without the \\\`dag\\\` field. This updates in-place (no fork).
- **Before modifying a workflow** → call \\\`list_services\\\` then \\\`list_service_endpoints\\\` to know which services and endpoints are available for \\\`http.call\\\` nodes.
- **Browse existing workflows** → use \\\`list_workflows\\\` with filters (featureSlug, tags, search). **BLOCKED when \\\`context.workflowId\\\` is present** — you are scoped to one workflow only.
- **Check required keys** → call \\\`get_workflow_required_providers\\\` to tell the user which BYOK keys they need.
- **After any modification** → call \\\`validate_workflow\\\` to verify the DAG is valid. Report errors to the user.

## How to work

1. The current workflow DAG and its UUID are in the request context. Read them directly — the \\\`workflowId\\\` field is the UUID to use for all tool calls. No need to fetch the DAG unless you suspect it is stale after a mutation.
2. If a node references a content-generation template (e.g. a node calling the content-generation service with a template type), call **get_prompt_template** with that type to see the prompt text and variables.
3. When the user asks for a change:
   - For single-node config changes (e.g. changing a prompt type, URL, or parameters): call **update_workflow_node_config** with the specific node ID and only the config keys to change.
   - For structural DAG changes (adding/removing nodes or edges): call **get_workflow_details** to get the fresh DAG, modify it, and call **update_workflow** with \\\`{ dag: <modified DAG> }\\\`. **CRITICAL: The DAG you send MUST include ALL existing nodes and edges, not just the ones you changed.** If you omit nodes, edges referencing them will break. Always start from the complete DAG returned by get_workflow_details, apply your changes, and send the full result back. **Note: sending a DAG creates a new forked workflow** — tell the user: "Your customized workflow is ready: {new workflow name}. Use this name for future campaigns."
   - For metadata changes (name, description, tags): call **update_workflow** with only the fields to change (no \\\`dag\\\`). This updates in-place.
   - For prompt changes: call **update_prompt_template** to create a new version. **Then immediately call update_workflow_node_config** to point the relevant node to the new versioned type (e.g. update \\\`body.type\\\` from "cold-email" to "cold-email-v2"). Never leave a node pointing to a stale template name.
4. **CRITICAL RULE: After every update_workflow, update_workflow_node_config, or update_prompt_template call, you MUST immediately call validate_workflow** to verify the changes are structurally correct. Report any validation errors or warnings to the user.
5. If the user explicitly asks you to validate, call **validate_workflow**.
6. Before creating or modifying http.call nodes, call **list_services** → **list_service_endpoints** to discover what services and endpoints are available. Do not guess service names or endpoint paths.

## DAG structure reference

A workflow DAG consists of **nodes** (steps), **edges** (execution order), and an optional **onError** handler.

### Node types

- **http.call** — Call any microservice. Config: \\\`{ service, method, path, body?, query?, headers? }\\\`. This is the recommended type for all service calls.
- **condition** — If/then/else branching. Outgoing edges with a \\\`condition\\\` field define conditional branches (the target chain only executes when the JS expression is true). Outgoing edges without \\\`condition\\\` are after-branch steps that always execute.
- **wait** — Delay. Config: \\\`{ seconds }\\\`.
- **for-each** — Loop over items. Config: \\\`{ iterator, parallel?, skipFailures? }\\\`. Body nodes are nested inside the loop.
- **script** — Custom JavaScript.

### Auto-forwarded headers

When the workflow executor runs an \\\`http.call\\\` node, it **automatically forwards** these identity headers to the downstream service:
- \\\`x-org-id\\\` — the organization ID
- \\\`x-user-id\\\` — the user ID
- \\\`x-run-id\\\` — the workflow run ID
- \\\`x-brand-id\\\` — the brand ID (if set on the workflow)
- \\\`x-campaign-id\\\` — the campaign ID (if set on the workflow)
- \\\`x-feature-slug\\\` — the feature slug (if set on the workflow)
- \\\`x-workflow-name\\\` — the workflow name

**You do NOT need to pass these values in the request body or inputMapping** — every downstream service already receives them from the headers. Only map data in the body that is NOT covered by these headers. For example, brand-service, press-kits, content-generation, and key-service all read \\\`x-org-id\\\` from the header to identify the organization — you never need to send \\\`orgId\\\` in the body for that purpose.

### Node fields

- \\\`id\\\` (required): Unique string identifier within the DAG. Used in edges and $ref input mappings.
- \\\`type\\\` (required): One of the types above.
- \\\`config\\\`: Static parameters. For http.call: \\\`{ service, method, path, body?, query?, headers? }\\\`. Special config keys:
  - \\\`retries\\\` (number): Override default retry count.
  - \\\`validateResponse\\\` (\\\`{ field, equals }\\\`): Throw error if response[field] !== equals, triggers onError.
  - \\\`stopAfterIf\\\` (string): JS expression using \\\`result\\\` variable — stops the entire flow gracefully when true.
  - \\\`skipIf\\\` (string): JS expression — skips only this step when true. Can reference \\\`results.<node_id>\\\`.
- \\\`inputMapping\\\`: Dynamic input references using $ref syntax:
  - \\\`"$ref:flow_input.fieldName"\\\` for workflow execution inputs.
  - \\\`"$ref:node-id.output.fieldName"\\\` for a previous node's output.
  - Keys in inputMapping override same-named keys in config.
- \\\`retries\\\`: Number of retry attempts (default 3). Set to 0 for non-idempotent operations (emails, queue consumption).

### Edges

- \\\`from\\\` (required): Source node ID.
- \\\`to\\\` (required): Target node ID.
- \\\`condition\\\` (optional): JS expression for conditional branching. Only used when source node is type "condition". Expressions can reference \\\`results.<node_id>.<field>\\\` or \\\`flow_input\\\`.

### onError

Node ID of an error handler that runs when any node fails. Auto-injected parameters: \\\`failedNodeId\\\`, \\\`errorMessage\\\`. Can access outputs from previously completed nodes via $ref.

## Prompt templates

Prompt templates use \\\`{{variableName}}\\\` placeholders. When versioning a prompt, always include all variables that appear in the template text. The version type auto-increments (e.g. cold-email → cold-email-v2).

## Communication style

Be concise and practical. When describing workflow steps, use their node IDs. When showing the DAG structure, present it clearly. Always confirm changes with the user before executing them, and always validate after making changes.`;

export async function register() {
  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
  const apiKey = process.env.ADMIN_DISTRIBUTE_API_KEY;

  if (!apiKey) {
    console.warn("[instrumentation] ADMIN_DISTRIBUTE_API_KEY not set, skipping startup deployment");
    return;
  }

  // Deploy email templates
  try {
    const res = await fetch(`${apiUrl}/internal/emails/templates`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ templates: EMAIL_TEMPLATES }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[instrumentation] Email template deployment failed: ${res.status} ${body}`);
    } else {
      console.log(`[instrumentation] Deployed ${EMAIL_TEMPLATES.length} email templates`);
    }
  } catch (err) {
    console.error("[instrumentation] Email template deployment error:", err);
  }

  // Register platform keys
  try {
    const available = PLATFORM_KEYS.filter(({ envVar }) => process.env[envVar]);
    const missing = PLATFORM_KEYS.filter(({ envVar }) => !process.env[envVar]);

    if (missing.length > 0) {
      console.warn(
        `[instrumentation] Skipping ${missing.length} platform keys (env vars not set): ${missing.map((k) => k.envVar).join(", ")}`,
      );
    }

    if (available.length === 0) {
      throw new Error("No platform key env vars are set — cannot register any keys");
    }

    const results = await Promise.allSettled(
      available.map(({ provider, envVar }) =>
        fetch(`${apiUrl}/platform-keys`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ provider, apiKey: process.env[envVar] }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`${provider}: ${res.status} ${body}`);
          }
          return provider;
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    if (failed.length > 0) {
      const errors = failed.map((r) => (r as PromiseRejectedResult).reason?.message).join("; ");
      console.error(`[instrumentation] ${failed.length} platform key(s) failed: ${errors}`);
    }

    console.log(
      `[instrumentation] Platform keys: ${succeeded.length} registered, ${failed.length} failed, ${missing.length} skipped`,
    );

    if (succeeded.length === 0) {
      throw new Error(`All platform key registrations failed`);
    }
  } catch (err) {
    console.error("[instrumentation] Platform key registration error:", err);
    throw err;
  }

  // Register platform prompts
  try {
    const res = await fetch(`${apiUrl}/platform-prompts`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        type: "cold-email",
        prompt: COLD_EMAIL_PROMPT,
        variables: COLD_EMAIL_VARIABLES,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Platform prompt deployment failed: ${res.status} ${body}`);
    }

    console.log("[instrumentation] Deployed platform prompt (cold-email)");
  } catch (err) {
    console.error("[instrumentation] Platform prompt deployment error:", err);
    throw err;
  }

  // Register platform chat config (non-blocking)
  try {
    const res = await fetch(`${apiUrl}/platform-chat/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        systemPrompt: CHAT_SYSTEM_PROMPT,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[instrumentation] Chat config deployment failed: ${res.status} ${body}`);
    } else {
      console.log("[instrumentation] Deployed platform chat config");
    }
  } catch (err) {
    console.warn("[instrumentation] Chat config deployment error:", err);
  }
}
