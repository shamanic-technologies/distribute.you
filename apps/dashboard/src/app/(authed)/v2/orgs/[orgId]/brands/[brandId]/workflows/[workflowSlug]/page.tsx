import { StaffOnly } from "@/components/v2/staff-only";
import { V2WorkflowPage } from "@/components/v2/workflow-page";

export default function V2WorkflowRoute() {
  return (
    <StaffOnly>
      <V2WorkflowPage />
    </StaffOnly>
  );
}
