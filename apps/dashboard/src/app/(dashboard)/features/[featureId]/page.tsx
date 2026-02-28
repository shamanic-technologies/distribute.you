"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows } from "@/lib/api";
import { WorkflowCard } from "@/components/workflows/workflow-card";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

function SkeletonWorkflowCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="animate-pulse">
        <div className="flex items-start justify-between mb-2">
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mb-1" />
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="flex gap-1.5">
          <div className="h-5 bg-gray-200 rounded-full w-14" />
          <div className="h-5 bg-gray-200 rounded-full w-12" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
        </div>
      </div>
    </div>
  );
}

export default function FeatureOverviewPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === featureId);

  const { data, isLoading } = useAuthQuery(
    ["workflows"],
    (token) => listWorkflows(token),
    { enabled: featureDef?.implemented === true }
  );

  // Filter workflows that belong to this feature's section key
  const workflows = (data?.workflows ?? []).filter(
    (wf) => wf.name.startsWith(featureId)
  );

  if (!featureDef) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Feature not found</h3>
          <p className="text-gray-600 text-sm">The feature &quot;{featureId}&quot; does not exist.</p>
        </div>
      </div>
    );
  }

  // Coming soon for unimplemented features
  if (!featureDef.implemented) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.label}</h1>
          <p className="text-gray-600">{featureDef.description}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Coming Soon</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            {featureDef.label} is not yet available. We&apos;re working on it and will notify you when it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }

  // Implemented feature — show workflows
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.label}</h1>
        <p className="text-gray-600">{featureDef.description}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonWorkflowCard key={i} />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows yet</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Workflows will appear here once campaigns are created via the distribute tool.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              isSelected={selectedWorkflowId === wf.id}
              onClick={() => setSelectedWorkflowId(wf.id)}
            />
          ))}
        </div>
      )}

      {selectedWorkflowId && (
        <WorkflowDetailPanel
          workflowId={selectedWorkflowId}
          onClose={() => setSelectedWorkflowId(null)}
        />
      )}
    </div>
  );
}
