import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function WorkflowsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <TableSectionSkeleton
        title="Workflows"
        description="Pipelines actually used for this brand, with cost-per-positive-reply for A/B comparison."
        columnLabels={["Workflow", "Version", "Status", "Emails sent", "Positive replies", "CAC / reply"]}
      />
    </div>
  );
}
