import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function LeadsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <TableSectionSkeleton
        title="Leads"
        description="Every prospect (company × person) targeted by Sales Cold Email Outreach."
        columnLabels={["Name", "Email", "Title", "Company", "Industry", "Country", "Status"]}
      />
    </div>
  );
}
