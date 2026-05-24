import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function EmailsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <TableSectionSkeleton
        title="Emails generated"
        description="Every email produced by the workflows, including subject and body."
        columnLabels={["Subject", "To", "Company", "Workflow", "Sent"]}
      />
    </div>
  );
}
