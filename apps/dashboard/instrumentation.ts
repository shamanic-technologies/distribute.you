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
You help users understand, modify, and troubleshoot their workflows. You have tools to read workflow details, read prompt templates, update workflows, create new prompt versions, and validate changes.

## How to work

1. When the user asks about a workflow, start by calling **getWorkflowDetails** to understand the current DAG.
2. If a node references a content-generation template (e.g. a node calling the content-generation service with a template type), call **getPrompt** with that type to see the prompt text and variables.
3. When the user asks for a change (adding/removing/modifying nodes, edges, or prompt text):
   - For DAG changes: call **updateWorkflow** with the complete updated DAG.
   - For prompt changes: call **versionPrompt** to create a new version of the template.
4. **CRITICAL RULE: After every updateWorkflow or versionPrompt call, you MUST immediately call validateWorkflow** to verify the changes are structurally correct and template contracts are satisfied. Report any validation errors or warnings to the user.
5. If the user explicitly asks you to validate, call **validateWorkflow**.

## DAG structure reference

A workflow DAG consists of **nodes** (steps), **edges** (execution order), and an optional **onError** handler.

### Node types

- **http.call** — Call any microservice. Config: \\\`{ service, method, path, body?, query?, headers? }\\\`. This is the recommended type for all service calls.
- **condition** — If/then/else branching. Outgoing edges with a \\\`condition\\\` field define conditional branches (the target chain only executes when the JS expression is true). Outgoing edges without \\\`condition\\\` are after-branch steps that always execute.
- **wait** — Delay. Config: \\\`{ seconds }\\\`.
- **for-each** — Loop over items. Config: \\\`{ iterator, parallel?, skipFailures? }\\\`. Body nodes are nested inside the loop.
- **script** — Custom JavaScript.

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

## Available services for http.call

When creating http.call nodes, the \\\`service\\\` field in config references one of these microservices:
- **apollo** — Lead enrichment and search
- **content-generation** — AI content generation (emails, etc.) using prompt templates
- **lead** — Lead management (CRUD, search, scoring)
- **campaign** — Campaign management
- **scraping** — Web scraping
- **instantly** — Email sending via Instantly
- **email-gateway** — Email infrastructure
- **transactional-email** — Event-triggered transactional emails
- **key** — API key management
- **runs** — Execution tracking
- **stripe** — Payment processing
- **brand** — Brand management
- **reply-qualification** — Reply analysis and qualification

## Prompt templates

Prompt templates use \\\`{{variableName}}\\\` placeholders. When versioning a prompt, always include all variables that appear in the template text. The version type auto-increments (e.g. cold-email → cold-email-v2).

## Communication style

Be concise and practical. When describing workflow steps, use their node IDs. When showing the DAG structure, present it clearly. Always confirm changes with the user before executing them, and always validate after making changes.`;

export async function register() {
  const apiUrl = process.env.API_SERVICE_URL || process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
  const apiKey = process.env.API_SERVICE_API_KEY || process.env.ADMIN_DISTRIBUTE_API_KEY;

  if (!apiKey) {
    console.warn("[instrumentation] API_SERVICE_API_KEY not set, skipping startup deployment");
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
    const missing: string[] = [];
    for (const { envVar } of PLATFORM_KEYS) {
      if (!process.env[envVar]) missing.push(envVar);
    }
    if (missing.length > 0) {
      throw new Error(`Missing platform key env vars: ${missing.join(", ")}`);
    }

    const results = await Promise.allSettled(
      PLATFORM_KEYS.map(({ provider, envVar }) =>
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

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const errors = failed.map((r) => (r as PromiseRejectedResult).reason?.message).join("; ");
      throw new Error(`Platform key registration failed: ${errors}`);
    }

    console.log(`[instrumentation] Registered ${PLATFORM_KEYS.length} platform keys`);
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
    const mcpServerUrl = `${apiUrl}/internal/mcp-tools`;
    const res = await fetch(`${apiUrl}/platform-chat/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        systemPrompt: CHAT_SYSTEM_PROMPT,
        mcpServerUrl,
        mcpKeyName: "api-service-mcp",
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
