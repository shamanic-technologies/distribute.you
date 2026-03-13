"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, getWorkflowSummary, type Workflow } from "@/lib/api";
import { dagToMermaid } from "@/lib/dag-to-mermaid";
import { WorkflowChat } from "@/components/workflows/workflow-chat";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";

function generateSessionId(): string {
  return crypto.randomUUID();
}

export default function WorkflowViewerPage() {
  const params = useParams();
  const sectionKey = params.sectionKey as string;
  const wfDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === sectionKey);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [sessionId] = useState(generateSessionId);

  const { data: workflowsData, isLoading } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    { enabled: wfDef?.implemented === true }
  );

  // Filter workflows for this section (active only)
  const sectionWorkflows = useMemo(() => {
    if (!workflowsData?.workflows) return [];
    return workflowsData.workflows.filter(
      (wf) => wf.status !== "deprecated" && wf.signatureName === sectionKey
    );
  }, [workflowsData, sectionKey]);

  // Auto-select first workflow
  const activeWorkflow = useMemo<Workflow | null>(() => {
    if (selectedWorkflowId) {
      return sectionWorkflows.find((wf) => wf.id === selectedWorkflowId) ?? null;
    }
    return sectionWorkflows[0] ?? null;
  }, [sectionWorkflows, selectedWorkflowId]);

  const { data: summary } = useAuthQuery(
    ["workflow-summary", activeWorkflow?.id],
    () => getWorkflowSummary(activeWorkflow!.id),
    { enabled: !!activeWorkflow }
  );

  const mermaidChart = useMemo(() => {
    if (!activeWorkflow?.dag) return null;
    return dagToMermaid(activeWorkflow.dag);
  }, [activeWorkflow]);

  const summaryText = useMemo(() => {
    if (!summary) {
      const name = activeWorkflow?.displayName || activeWorkflow?.name || "this workflow";
      return `Here's the workflow diagram for **${name}**.`;
    }
    let text = summary.summary;
    if (summary.steps.length > 0) {
      text += "\n\n**Steps:**\n" + summary.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    }
    return text;
  }, [summary, activeWorkflow]);

  const workflowContext = useMemo(() => {
    if (!activeWorkflow) return {};
    return {
      workflow: {
        name: activeWorkflow.name,
        displayName: activeWorkflow.displayName,
        description: activeWorkflow.description,
        category: activeWorkflow.category,
        channel: activeWorkflow.channel,
        audienceType: activeWorkflow.audienceType,
        requiredProviders: activeWorkflow.requiredProviders,
      },
      dag: activeWorkflow.dag,
      summary: summary ?? null,
      mermaidDiagram: mermaidChart,
    };
  }, [activeWorkflow, summary, mermaidChart]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (sectionWorkflows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows available</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            No active workflows found for {wfDef?.label ?? sectionKey}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with workflow selector */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
          </svg>
          <h1 className="font-display text-lg font-bold text-gray-800">Workflow</h1>
        </div>
        {sectionWorkflows.length > 1 && (
          <select
            value={activeWorkflow?.id ?? ""}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {sectionWorkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.displayName || wf.name}
              </option>
            ))}
          </select>
        )}
        {activeWorkflow && (
          <div className="flex gap-2 ml-auto">
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {activeWorkflow.category}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {activeWorkflow.channel}
            </span>
            {activeWorkflow.dag && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                {activeWorkflow.dag.nodes.length} steps
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chat area */}
      {activeWorkflow && mermaidChart ? (
        <WorkflowChat
          key={activeWorkflow.id}
          initialMermaid={mermaidChart}
          initialSummary={summaryText}
          workflowContext={workflowContext}
          sessionId={sessionId}
        />
      ) : activeWorkflow ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500 text-sm">This workflow has no DAG definition yet.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
