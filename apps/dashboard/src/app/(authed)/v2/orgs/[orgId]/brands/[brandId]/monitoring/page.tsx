import { StaffOnly } from "@/components/v2/staff-only";
import { V2Monitoring } from "@/components/v2/monitoring-page";

// One client view serves the hub and every page; see V2Monitoring. Its data is served by
// staff-only gateway routes, so <StaffOnly> is the UI gate, not the security boundary.
export default function Page() {
  return (
    <StaffOnly>
      <V2Monitoring />
    </StaffOnly>
  );
}
