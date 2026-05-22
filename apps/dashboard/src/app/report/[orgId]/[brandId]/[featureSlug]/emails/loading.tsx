import { ListSectionSkeleton } from "@/components/report/skeletons";

export default function EmailsLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <ListSectionSkeleton
        title="Emails generated"
        description="Every email produced by the workflows, including subject and body."
      />
    </div>
  );
}
