"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getWorkflow, getWorkflowSummary } from "@/lib/api";
import { dagToMermaid } from "@/lib/dag-to-mermaid";
import { WorkflowChat } from "@/components/workflows/workflow-chat";

function generateSessionId(): string {
  return crypto.randomUUID();
}

export default function WorkflowViewerPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;
  const [sessionId] = useState(generateSessionId);

  const { data: workflow, isLoading } = useAuthQuery(
    ["workflow", workflowId],
    () => getWorkflow(workflowId),
  );

  const { data: summary } = useAuthQuery(
    ["workflow-summary", workflowId],
    () => getWorkflowSummary(workflowId),
    { enabled: !!workflow }
  );

  const mermaidChart = useMemo(() => {
    if (!workflow?.dag) return null;
    return dagToMermaid(workflow.dag);
  }, [workflow]);

  const summaryText = useMemo(() => {
    if (!summary) {
      const name = workflow?.displayName || workflow?.name || "this workflow";
      return `Here's the workflow diagram for **${name}**.`;
    }
    let text = summary.summary;
    if (summary.steps.length > 0) {
      text += "\n\n**Steps:**\n" + summary.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
    }
    return text;
  }, [summary, workflow]);

  const workflowContext = useMemo(() => {
    if (!workflow) return {};
    return {
      workflow: {
        name: workflow.name,
        displayName: workflow.displayName,
        description: workflow.description,
        category: workflow.category,
        channel: workflow.channel,
        audienceType: workflow.audienceType,
        requiredProviders: workflow.requiredProviders,
      },
      dag: workflow.dag,
      summary: summary ?? null,
      mermaidDiagram: mermaidChart,
    };
  }, [workflow, summary, mermaidChart]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Workflow not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
          </svg>
          <h1 className="font-display text-lg font-bold text-gray-800">
            {workflow.displayName || workflow.name}
          </h1>
        </div>
        <div className="flex gap-2 ml-auto">
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            {workflow.category}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
            {workflow.channel}
          </span>
          {workflow.dag && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
              {workflow.dag.nodes.length} steps
            </span>
          )}
        </div>
      </div>

      {/* Chat area */}
      {mermaidChart ? (
        <WorkflowChat
          initialMermaid={mermaidChart}
          initialSummary={summaryText}
          workflowContext={workflowContext}
          sessionId={sessionId}
          providers={workflow.requiredProviders}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500 text-sm">This workflow has no DAG definition yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
