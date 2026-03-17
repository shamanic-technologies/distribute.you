import { streamText, tool, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const NODE_TYPES_REFERENCE = `
## Available DAG Node Types

### http.call (recommended)
Calls any registered microservice by name.
Config:
  - service (string, required): Service name, e.g. "content-generation", "apollo", "email-gateway", "instantly", "lead"
  - method (string): HTTP method — "GET", "POST", "PUT", "DELETE"
  - path (string): Endpoint path, e.g. "/generate", "/enrich"
  - body (object): Request body template. Use $ref syntax for dynamic values.
  - query (object): Query parameters
  - headers (object): Additional headers

### condition
If/then/else branching. The node itself has no config.
Branching is controlled by edges: edges WITH a "condition" field (JS expression) lead to conditional branches. Edges WITHOUT condition from a condition node lead to "after-branch" steps that always execute.
Condition expressions can reference: results.<node-id>.<field> or flow_input.<field>

### wait
Delay execution.
Config:
  - seconds (number): How long to wait

### for-each
Loop over items.
Config:
  - iterator (string): $ref expression pointing to an array, e.g. "$ref:previous-node.output.items"
  - parallel (boolean, optional): Run iterations in parallel
  - skipFailures (boolean, optional): Continue on individual iteration failure

## Input Mapping Syntax
- $ref:flow_input.fieldName — access workflow execution input
- $ref:node-id.output.fieldName — access a previous node's output

## Special Config Keys (any node)
- retries (number): Override default retry count (default: 3)
- validateResponse: { field, equals } — throw error if response[field] !== expected value
- stopAfterIf (string): JS expression; stops the entire flow gracefully if true
- skipIf (string): JS expression; skips only this step if true

## DAG Edges
- from (string): Source node ID
- to (string): Target node ID
- condition (string, optional): JS expression. If present, the target node only executes when the condition is true.

## DAG-level Error Handling
- onError (string): Node ID of an error handler node. Gets access to failedNodeId, errorMessage, and all previous outputs.
`.trim();

function buildSystemPrompt(workflowContext: Record<string, unknown>): string {
  return `You are a workflow assistant for the Distribute platform. You help users understand, analyze, and modify workflow DAGs (Directed Acyclic Graphs) that power automated outreach campaigns.

## Current Workflow Context
${JSON.stringify(workflowContext, null, 2)}

${NODE_TYPES_REFERENCE}

## Your Capabilities
You have tools to:
1. **getWorkflowDetails** — Fetch the full workflow including its DAG from the API
2. **getPrompt** — Fetch a prompt template by type (e.g. "cold-email") to see its content and variables
3. **validateWorkflow** — Validate the current DAG structure and check template contracts
4. **updateWorkflow** — Modify the workflow's DAG, name, description, or tags
5. **versionPrompt** — Create a new version of a prompt template with updated text or variables

## Guidelines
- When the user asks about the workflow, start by using getWorkflowDetails to get the latest state.
- When discussing prompts/templates referenced in DAG nodes, use getPrompt to fetch the actual template.
- After any DAG modification via updateWorkflow, ALWAYS call validateWorkflow to confirm the change is valid.
- When showing the DAG structure, use mermaid diagrams for visualization.
- Explain node configurations and input mappings clearly.
- When modifying the DAG, preserve existing node IDs and input mappings unless explicitly asked to change them.
- Be precise about $ref syntax when explaining or modifying input mappings.

Respond in the same language as the user's message. Be concise but thorough.`;
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  if (!API_KEY) {
    return NextResponse.json(
      { error: "ADMIN_DISTRIBUTE_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  // Build auth headers for API calls (captured in closure for tool execution)
  const apiHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "x-external-org-id": clerkOrgId,
    "x-external-user-id": clerkUserId,
  };
  if (email) apiHeaders["x-email"] = email;
  if (user?.firstName) apiHeaders["x-first-name"] = user.firstName;
  if (user?.lastName) apiHeaders["x-last-name"] = user.lastName;

  async function callApi(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<Record<string, unknown>> {
    const url = `${API_URL}/v1${path}`;
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: apiHeaders,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        error: (data as Record<string, unknown>).error ?? (data as Record<string, unknown>).message ?? "Request failed",
        status: res.status,
      };
    }
    return data as Record<string, unknown>;
  }

  const body = await req.json();
  const { messages, workflowId, workflowContext } = body;

  if (!workflowId) {
    return NextResponse.json(
      { error: "workflowId is required" },
      { status: 400 }
    );
  }

  const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(workflowContext ?? {}),
    messages,
    tools: {
      getWorkflowDetails: tool({
        description:
          "Fetch the full workflow details including its DAG structure from the API. Use this to get the latest state of the workflow.",
        inputSchema: z.object({}),
        execute: async () => {
          return callApi(`/workflows/${workflowId}`);
        },
      }),

      getPrompt: tool({
        description:
          "Fetch a prompt template by its type identifier (e.g. 'cold-email', 'welcome-email'). Returns the prompt text with {{variable}} placeholders and the list of expected variables.",
        inputSchema: z.object({
          type: z
            .string()
            .describe(
              "The prompt type to fetch, e.g. 'cold-email', 'cold-email-v2'"
            ),
        }),
        execute: async ({ type }: { type: string }) => {
          return callApi(`/prompts?type=${encodeURIComponent(type)}`);
        },
      }),

      validateWorkflow: tool({
        description:
          "Validate the current workflow DAG. Returns validation errors and template contract issues (missing variables, unknown template types, etc.). Always call this after modifying the DAG.",
        inputSchema: z.object({}),
        execute: async () => {
          return callApi(`/workflows/${workflowId}/validate`, {
            method: "POST",
          });
        },
      }),

      updateWorkflow: tool({
        description:
          "Update the workflow. Can modify the name, description, tags, and/or the DAG structure. Only include fields you want to change. The DAG must include all nodes and edges (it replaces the entire DAG).",
        inputSchema: z.object({
          name: z
            .string()
            .min(1)
            .optional()
            .describe("New workflow name"),
          description: z
            .string()
            .optional()
            .describe("New workflow description"),
          tags: z
            .array(z.string())
            .optional()
            .describe("New tags for the workflow"),
          dag: z
            .object({
              nodes: z.array(
                z.object({
                  id: z.string(),
                  type: z.string(),
                  config: z.record(z.string(), z.unknown()).optional(),
                  inputMapping: z.record(z.string(), z.string()).optional(),
                  retries: z.number().optional(),
                })
              ),
              edges: z.array(
                z.object({
                  from: z.string(),
                  to: z.string(),
                  condition: z.string().optional(),
                })
              ),
              onError: z.string().optional(),
            })
            .optional()
            .describe(
              "New DAG structure. Must include ALL nodes and edges — this replaces the entire DAG."
            ),
        }),
        execute: async (params: Record<string, unknown>) => {
          return callApi(`/workflows/${workflowId}`, {
            method: "PUT",
            body: params,
          });
        },
      }),

      versionPrompt: tool({
        description:
          "Create a new version of a prompt template. Auto-increments the type name (e.g. 'cold-email' → 'cold-email-v2'). The source prompt is never modified. Use {{variable}} syntax for placeholders.",
        inputSchema: z.object({
          sourceType: z
            .string()
            .describe(
              "The type of the existing prompt to version from, e.g. 'cold-email'"
            ),
          prompt: z
            .string()
            .describe(
              "New prompt template text with {{variable}} placeholders. Must NOT contain company-specific data."
            ),
          variables: z
            .array(z.string())
            .describe(
              "List of variable names used in the prompt template"
            ),
        }),
        execute: async (params: { sourceType: string; prompt: string; variables: string[] }) => {
          return callApi(`/prompts`, {
            method: "PUT",
            body: params,
          });
        },
      }),
    },
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
