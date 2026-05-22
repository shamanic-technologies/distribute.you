import { ListSectionSkeleton } from "@/components/report/skeletons";

export default function WorkflowsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <ListSectionSkeleton
        title="Workflows"
        description="Pipelines used to generate emails. Includes the LLM prompts at each step."
      />
    </div>
  );
}
