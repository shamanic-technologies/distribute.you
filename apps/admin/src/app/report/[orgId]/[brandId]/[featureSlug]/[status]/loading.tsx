import { TableSectionSkeleton } from "@/components/report/skeletons";

// Table-shaped skeleton for the read-only press-tracker tabs. Matches the
// PitchStatusView column set so the swap to real data causes no layout shift.
export default function PitchStatusLoading() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <TableSectionSkeleton
        title="Quotes"
        columnLabels={["Publication", "Article", "DR", "Attribution", "Updated"]}
      />
    </div>
  );
}
