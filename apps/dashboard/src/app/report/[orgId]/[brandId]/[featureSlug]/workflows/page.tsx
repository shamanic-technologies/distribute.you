import { Suspense } from "react";
import { SectionCard } from "@/components/report/section-card";
import { CsvDownloadButton, GoogleSheetsButton } from "@/components/report/csv-button";
import { toCsv, type CsvColumn } from "@/components/report/csv";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { WorkflowsTable, type WorkflowRow } from "@/components/report/workflows-table";
import { fetchWorkflows, extractWorkflowPrompts } from "@/lib/report-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface PageProps {
  params: Promise<{ orgId: string; brandId: string; featureSlug: string }>;
}

const WORKFLOW_COLUMNS = ["Workflow", "Version", "Status", "Prompts"];

function humanizeStep(nodeId: string, nodeType: string): string {
  const base = nodeId || nodeType;
  return base
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export default async function WorkflowsPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug } = await params;
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <Suspense
        fallback={
          <TableSectionSkeleton
            title="Workflows"
            description="Pipelines used to generate emails. Includes the LLM prompts at each step."
            columnLabels={WORKFLOW_COLUMNS}
          />
        }
      >
        <WorkflowsSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
      </Suspense>
    </div>
  );
}

async function WorkflowsSection({ orgId, brandId, featureSlug }: { orgId: string; brandId: string; featureSlug: string }) {
  const workflows = await fetchWorkflows(orgId, featureSlug);

  const rows: WorkflowRow[] = workflows.map((w) => ({
    id: w.id,
    name: w.workflowDynastyName,
    version: w.version,
    status: w.status ?? "active",
    description: w.description ?? "",
    prompts: extractWorkflowPrompts(w).map((p) => ({
      step: humanizeStep(p.nodeId, p.nodeType),
      field: p.field,
      value: p.value,
    })),
  }));

  interface FlatPromptRow {
    workflowName: string;
    version: number;
    step: string;
    promptField: string;
    promptValue: string;
  }
  const flatRows: FlatPromptRow[] = [];
  for (const w of rows) {
    if (w.prompts.length === 0) {
      flatRows.push({ workflowName: w.name, version: w.version, step: "", promptField: "", promptValue: "" });
    } else {
      for (const p of w.prompts) {
        flatRows.push({ workflowName: w.name, version: w.version, step: p.step, promptField: p.field, promptValue: p.value });
      }
    }
  }

  const csvColumns: CsvColumn<FlatPromptRow>[] = [
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
      count={rows.length}
      actions={
        <>
          <CsvDownloadButton filename={`workflows-${featureSlug}.csv`} csv={toCsv(flatRows, csvColumns)} isEmpty={flatRows.length === 0} />
          <GoogleSheetsButton />
        </>
      }
    >
      <WorkflowsTable rows={rows} />
    </SectionCard>
  );
}
