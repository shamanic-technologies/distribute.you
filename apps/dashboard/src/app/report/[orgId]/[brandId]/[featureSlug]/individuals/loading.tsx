import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function IndividualsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <TableSectionSkeleton
        title="Individuals"
        description="Every person enriched and queued for outreach."
        columnLabels={["Name", "Email", "Title", "Seniority", "Department", "Company", "Location", "Links"]}
      />
    </div>
  );
}
