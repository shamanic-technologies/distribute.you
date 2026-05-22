import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";

export const revalidate = 30;

import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { ListSectionSkeleton } from "@/components/report/skeletons";
import { fetchWorkflows, extractWorkflowPrompts } from "@/lib/report-api";
import type { Workflow } from "@/lib/api";

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

interface WorkflowFlatRow {
  workflowName: string;
  version: number;
  step: string;
  promptField: string;
  promptValue: string;
}

export default async function WorkflowsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <ListSectionSkeleton
            title="Workflows"
            description="Pipelines used to generate emails. Includes the LLM prompts at each step."
          />
        }
      >
        <WorkflowsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

function humanizeStep(nodeId: string, nodeType: string): string {
  // Workflow node IDs look like "brand-extract", "draft-email". Make them
  // readable: "Brand extract", "Draft email". Fallback to node type.
  const base = nodeId || nodeType;
  return base
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

async function WorkflowsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const workflows = await fetchWorkflows(orgId, featureSlug);

  const flatRows: WorkflowFlatRow[] = [];
  for (const w of workflows) {
    const prompts = extractWorkflowPrompts(w);
    if (prompts.length === 0) {
      flatRows.push({
        workflowName: w.workflowDynastyName,
        version: w.version,
        step: "",
        promptField: "",
        promptValue: "",
      });
      continue;
    }
    for (const p of prompts) {
      flatRows.push({
        workflowName: w.workflowDynastyName,
        version: w.version,
        step: humanizeStep(p.nodeId, p.nodeType),
        promptField: p.field,
        promptValue: p.value,
      });
    }
  }

  const csvColumns: CsvColumn<WorkflowFlatRow>[] = [
    { label: "Workflow", value: (r) => r.workflowName },
    { label: "Version", value: (r) => r.version },
    { label: "Step", value: (r) => r.step },
    { label: "Prompt field", value: (r) => r.promptField },
    { label: "Prompt value", value: (r) => r.promptValue },
  ];

  return (
    <SectionCard
      title="Workflows"
      description="Pipelines used to generate emails. Includes the LLM prompts at each step."
      count={workflows.length}
      actions={
        <>
          <CsvDownloadButton filename={`workflows-${featureSlug}.csv`} csv={toCsv(flatRows, csvColumns)} isEmpty={flatRows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
    >
      {workflows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">No workflows available for this feature.</div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {workflows.map((w) => (
            <WorkflowItem key={w.id} workflow={w} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function WorkflowItem({ workflow }: { workflow: Workflow }) {
  const prompts = extractWorkflowPrompts(workflow);
  return (
    <li className="px-5 py-4">
      <div className="flex items-baseline justify-between gap-4 mb-1 flex-wrap">
        <div className="font-medium text-gray-900">{workflow.workflowDynastyName}</div>
        <div className="text-xs text-gray-400">v{workflow.version}</div>
      </div>
      {workflow.description && <p className="text-xs text-gray-500 mb-2">{workflow.description}</p>}
      {prompts.length === 0 ? (
        <div className="text-xs text-gray-400 italic">No prompt configuration exposed.</div>
      ) : (
        <details className="mt-2">
          <summary className="text-xs text-brand-600 cursor-pointer hover:underline">
            View {prompts.length} prompt{prompts.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-3">
            {prompts.map((p, i) => (
              <div key={`${p.nodeId}-${p.field}-${i}`} className="bg-gray-50 border border-gray-100 rounded p-3">
                <div className="text-xs text-gray-500 mb-1">
                  <span className="font-medium text-gray-700">{humanizeStep(p.nodeId, p.nodeType)}</span>
                  <span className="text-gray-400"> · {p.field}</span>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{p.value}</pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </li>
  );
}
