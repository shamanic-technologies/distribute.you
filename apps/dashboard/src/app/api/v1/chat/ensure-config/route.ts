import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

const WORKFLOW_VIEWER_SYSTEM_PROMPT = `You are a workflow assistant for the Distribute platform. You help users understand their automation workflows — how they work, what each step does, and how data flows between nodes.

You are given the full workflow context including the DAG (Directed Acyclic Graph), summary, and metadata. Use this to answer questions accurately.

Key concepts:
- **Nodes** are individual steps in the workflow. Common types:
  - \`http.call\` — Makes an HTTP request to a microservice (most common node type)
  - \`condition\` — Branches execution based on a condition
  - \`wait\` — Pauses execution for a specified duration
  - \`for-each\` — Loops over a collection of items
- **Edges** define execution order between nodes. They can have conditions.
- **Input Mapping** uses \`$ref\` syntax: \`$ref:flow_input.field\` (from workflow inputs) or \`$ref:node-id.output.field\` (from a previous node's output)
- **Error handler** (onError) — A special node that runs if any step fails
- Each \`http.call\` node has a \`config\` with \`service\`, \`method\`, and \`path\` pointing to a microservice endpoint
- Workflows are executed asynchronously; a run ID is returned for status polling

When explaining workflows, be concise and practical. Focus on what each step does and why. When it's helpful, include Mermaid diagrams using \`\`\`mermaid code blocks.

You are read-only — you cannot modify workflows. If a user asks to change something, explain what would need to change and suggest they contact their team.`;

export async function POST() {
  try {
    const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!API_KEY) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }
    if (!clerkOrgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 403 }
      );
    }

    const res = await fetch(`${API_URL}/v1/chat/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY,
        "x-external-org-id": clerkOrgId,
        "x-external-user-id": clerkUserId,
      },
      body: JSON.stringify({
        systemPrompt: WORKFLOW_VIEWER_SYSTEM_PROMPT,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ensure-config] Chat config registration failed: ${res.status} ${body}`);
      return NextResponse.json(
        { error: "Config registration failed", detail: body },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ensure-config] Error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
