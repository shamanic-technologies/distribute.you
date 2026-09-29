import { StaffOnly } from "@/components/v2/staff-only";
import { V2WorkflowsPage } from "@/components/v2/workflows-page";

export default function V2WorkflowsRoute() {
  return (
    <StaffOnly>
      <V2WorkflowsPage />
    </StaffOnly>
  );
}
