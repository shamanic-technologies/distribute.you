"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getWorkflow, getWorkflowSummary, getFeature } from "@/lib/api";
import { WorkflowOverview } from "@/components/workflows/workflow-overview";
import { WorkflowChat } from "@/components/workflows/workflow-chat";
import { workflowDisplayName } from "@/lib/workflow-display-name";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

/* ─── Sidebar skeleton (inline, shown while workflow data loads) ─────── */

function SidebarSkeleton() {
  return (
    <>
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
            <div className="flex gap-1.5">
              <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
              <div className="h-5 w-12 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-5 space-y-3">
        <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-full animate-pulse" />
        <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-5/6 animate-pulse" />
        <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
      </div>
    </>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function WorkflowViewerPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const workflowId = params.workflowId as string;
  const featureSlug = params.featureSlug as string;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasNavigatedRef = useRef(false);

  const handleWorkflowUpgraded = useCallback((newWorkflowId: string) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    // Migrate chat session + messages so conversation continues on the forked workflow
    try {
      const session = localStorage.getItem(`workflow-chat-session:${workflowId}`);
      const msgs = localStorage.getItem(`workflow-chat-msgs:${workflowId}`);
      if (session) localStorage.setItem(`workflow-chat-session:${newWorkflowId}`, session);
      if (msgs) localStorage.setItem(`workflow-chat-msgs:${newWorkflowId}`, msgs);
    } catch { /* ignore storage errors */ }
    router.replace(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${newWorkflowId}`);
  }, [router, orgId, brandId, featureSlug, workflowId]);

  const { data: workflow, isLoading } = useAuthQuery(
    ["workflow", workflowId],
    () => getWorkflow(workflowId),
    { refetchInterval: 3000 },
  );

  // Auto-navigate when the workflow is forked (upgradedTo appears)
  useEffect(() => {
    if (workflow?.upgradedTo) {
      handleWorkflowUpgraded(workflow.upgradedTo);
    }
  }, [workflow?.upgradedTo, handleWorkflowUpgraded]);

  const { data: summary } = useAuthQuery(
    ["workflow-summary", workflowId],
    () => getWorkflowSummary(workflowId),
  );

  const { data: featureData } = useAuthQuery(
    ["feature", featureSlug],
    () => getFeature(featureSlug),
  );

  const workflowContext = useMemo(() => {
    if (!workflow) return {};

    const feature = featureData?.feature ?? null;

    return {
      type: "workflow-viewer",
      workflowId: workflow.id,
      workflow: {
        name: workflow.name,
        displayName: workflow.displayName,
        description: workflow.description,
        featureSlug: workflow.featureSlug,
        requiredProviders: workflow.requiredProviders,
      },
      dag: workflow.dag,
      summary: summary ?? null,
      feature: feature ? {
        slug: feature.slug,
        name: feature.name,
        description: feature.description,
        inputs: feature.inputs.map((inp) => ({
          key: inp.key,
          label: inp.label,
          type: inp.type,
          description: inp.description,
          extractKey: inp.extractKey,
        })),
        outputs: feature.outputs.map((out) => ({
          key: out.key,
          displayOrder: out.displayOrder,
        })),
      } : null,
      instructions: [
        "You are a workflow assistant for the distribute.you platform.",
        "",
        "== CURRENT WORKFLOW ==",
        `Name: ${workflow.displayName || workflow.name}`,
        `UUID: ${workflow.id}`,
        `For ALL tool calls requiring a workflowId parameter, use exactly: ${workflow.id}`,
        "Never ask the user for the workflow ID — you already have it above.",
        "",
        "All questions about 'the workflow', 'this workflow', or 'it' refer to THIS specific workflow — do NOT ask which workflow the user means, and do NOT list other workflows unless explicitly asked.",
        "You have access to the COMPLETE workflow DAG and the feature definition it implements.",
        "",
        "== DAG FORMAT ==",
        "The DAG (Directed Acyclic Graph) defines the execution pipeline:",
        "- dag.nodes[]: each node has { id, type, config, inputMapping, retries }",
        "- dag.edges[]: each edge has { from, to, condition? } defining execution order",
        "- Node types: 'http.call' (API call), 'transform' (data mapping), 'condition' (branching)",
        "- inputMapping uses '$ref:' syntax to reference outputs from previous nodes, e.g. '$ref:node-id.fieldName'",
        "- config contains the node's parameters (url, method, headers, body for http.call nodes)",
        "",
        "== FEATURE → WORKFLOW PIPELINE ==",
        "Each feature defines inputs with an 'extractKey' field. The pipeline works as follows:",
        "1. Brand-service extract-fields uses extractKeys to pull data from the brand profile",
        "2. The prefill endpoint (POST /features/{slug}/prefill) reads extractKeys, calls brand-service, and returns an object keyed by input.key",
        "3. The prefilled values become the workflow's initial inputs",
        "Example: if a feature input has key='industry' and extractKey='industry', prefill returns { industry: '...' }",
        "",
        "== READING MORE DETAILS ==",
        "If you need more information about any service's API:",
        "1. Use list_services to see all available services",
        "2. Use list_service_endpoints(service) to see endpoints for a specific service",
        "3. Use get_endpoint_details(service, method, path) to get full request/response schemas",
        "4. Use call_api(service, method, path, body) to make read-only API calls",
        "Do NOT call APIs that create, update, or delete data.",
        "",
        "== SCOPE (STRICT) ==",
        "Your scope is EXCLUSIVELY this workflow (UUID above). You MUST NOT read, modify, or interact with any other workflow, even if the user asks you to.",
        "If the user asks you to change other workflows, politely decline and explain that your scope is limited to the current workflow only.",
        "You can help the user understand, diagnose, and propose modifications to THIS workflow.",
        "You CANNOT execute workflows or make write calls to services from this chat.",
        "When proposing DAG changes, show the complete modified DAG so the user can review it.",
      ].join("\n"),
    };
  }, [workflow, summary, featureData]);

  // Show "not found" only after loading finishes with no data
  if (!isLoading && !workflow) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Workflow not found</h3>
        </div>
      </div>
    );
  }

  // Always render the full layout immediately — skeletons fill in while data loads
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop: side panel with workflow details */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        {workflow ? (
          <>
            <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-[15px] font-bold text-gray-900 dark:text-gray-100 truncate">
                    {workflowDisplayName(workflow)}
                  </h1>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate mt-0.5">{workflow.name}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <WorkflowOverview
                summary={summary ?? null}
                providers={workflow.requiredProviders}
                description={workflow.description}
              />
            </div>
          </>
        ) : (
          <SidebarSkeleton />
        )}
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: collapsible workflow details header */}
        <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
          {workflow ? (
            <>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
                    </svg>
                  </div>
                  <h1 className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {workflowDisplayName(workflow)}
                  </h1>
                </div>
                <ChevronDownIcon
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {detailsOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04] bg-gray-50/30 dark:bg-white/[0.02]">
                  <div className="pt-3">
                    <WorkflowOverview
                      summary={summary ?? null}
                      providers={workflow.requiredProviders}
                      description={workflow.description}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded w-40 animate-pulse" />
            </div>
          )}
        </div>

        {/* Chat — render immediately; it handles its own loading state */}
        <WorkflowChat workflowId={workflowId} workflowContext={workflowContext} onWorkflowUpgraded={handleWorkflowUpgraded} />
      </div>
    </div>
  );
}
