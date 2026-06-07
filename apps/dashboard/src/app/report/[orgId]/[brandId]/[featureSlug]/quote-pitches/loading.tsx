import { TableSectionSkeleton } from "@/components/report/skeletons";

export default function QuotePitchesLoading() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <TableSectionSkeleton
        title="Pitches"
        description="Drafted and submitted pitches for journalist quote requests."
        columnLabels={["Status", "Pitch", "Delivery", "Submitted", "Article"]}
      />
    </div>
  );
}
