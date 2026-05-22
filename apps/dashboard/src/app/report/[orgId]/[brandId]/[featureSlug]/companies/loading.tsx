import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function CompaniesLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <TableSectionSkeleton
        title="Companies"
        description="Unique organizations targeted across the feature's campaigns."
        columnLabels={["Company", "Industry", "Employees", "Location", "Leads", "Links"]}
      />
    </div>
  );
}
