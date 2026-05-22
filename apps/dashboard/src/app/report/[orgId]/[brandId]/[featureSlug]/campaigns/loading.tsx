import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function CampaignsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <TableSectionSkeleton
        title="Campaigns"
        description="Outreach programs running on this feature."
        columnLabels={["Campaign", "Status", "Workflow", "Budget", "Leads", "Emails", "Created"]}
      />
    </div>
  );
}
