import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function LeadsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <TableSectionSkeleton
        title="Leads"
        description="Every prospect targeted, with company, email and current status."
        columnLabels={["Name", "Email", "Title", "Company", "Industry", "Country", "Status", "Campaign"]}
      />
    </div>
  );
}
