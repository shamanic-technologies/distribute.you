import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;
const REGISTRY_URL = "https://api-registry.distribute.you";

interface DAGNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
}

interface LlmServiceSummary {
  service: string;
  baseUrl: string;
  title?: string;
  description?: string;
  endpoints?: Array<{
    method: string;
    path: string;
    summary: string;
    params?: Array<{ name: string; in: string; required: boolean; type?: string }>;
    bodyFields?: string[];
  }>;
}

interface LlmContextResponse {
  services: LlmServiceSummary[];
}

/**
 * GET /api/workflow-docs/[workflowId]
 *
 * Fetches the workflow's DAG, extracts service names from http.call nodes,
 * then fetches API documentation for those services from the API registry.
 * Returns a compact context object the LLM can use to answer questions.
 */
export async function GET(
  _req: NextRequest,
  segmentData: { params: Promise<{ workflowId: string }> }
) {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();
  if (!clerkUserId || !clerkOrgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const { workflowId } = await segmentData.params;

  // 1. Fetch the workflow to get its DAG
  const wfRes = await fetch(`${API_URL}/v1/workflows/${workflowId}`, {
    headers: {
      "X-API-Key": API_KEY,
      "x-external-org-id": clerkOrgId,
      "x-external-user-id": clerkUserId,
    },
  });

  if (!wfRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch workflow", status: wfRes.status },
      { status: wfRes.status }
    );
  }

  const workflow = await wfRes.json();
  const dag = workflow.dag;

  if (!dag || !dag.nodes) {
    return NextResponse.json({ serviceDocs: [], services: [] });
  }

  // 2. Extract unique service names from http.call nodes
  const serviceNames = new Set<string>();
  for (const node of dag.nodes as DAGNode[]) {
    if (node.type === "http.call" && node.config?.service) {
      serviceNames.add(node.config.service as string);
    }
  }

  if (serviceNames.size === 0) {
    return NextResponse.json({ serviceDocs: [], services: [] });
  }

  // 3. Fetch LLM context from API registry
  const registryRes = await fetch(`${REGISTRY_URL}/llm-context`, {
    headers: { "X-API-Key": API_KEY },
  });

  if (!registryRes.ok) {
    // Fall back to returning just the service names without docs
    return NextResponse.json({
      serviceDocs: [],
      services: [...serviceNames],
      error: "Could not fetch API documentation",
    });
  }

  const llmContext: LlmContextResponse = await registryRes.json();

  // 4. Filter to only the services used in this workflow's DAG
  const relevantDocs = llmContext.services.filter((s) =>
    serviceNames.has(s.service)
  );

  // 5. For each http.call node, annotate which endpoint it calls
  const nodeEndpoints: Array<{
    nodeId: string;
    service: string;
    method: string;
    path: string;
    endpointSummary?: string;
  }> = [];

  for (const node of dag.nodes as DAGNode[]) {
    if (node.type !== "http.call" || !node.config) continue;
    const service = node.config.service as string;
    const method = ((node.config.method as string) || "GET").toUpperCase();
    const path = (node.config.path as string) || "";

    // Find matching endpoint doc
    const svcDoc = relevantDocs.find((s) => s.service === service);
    const endpoint = svcDoc?.endpoints?.find(
      (e) => e.method.toUpperCase() === method && e.path === path
    );

    nodeEndpoints.push({
      nodeId: node.id,
      service,
      method,
      path,
      endpointSummary: endpoint?.summary,
    });
  }

  return NextResponse.json({
    serviceDocs: relevantDocs,
    services: [...serviceNames],
    nodeEndpoints,
  });
}
