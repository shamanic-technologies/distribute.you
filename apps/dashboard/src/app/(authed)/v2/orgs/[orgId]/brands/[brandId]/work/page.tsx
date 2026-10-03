import { StaffOnly } from "@/components/v2/staff-only";
import { WorkPage } from "@/components/v2/work-page";

export default function V2WorkRoute() {
  return (
    <StaffOnly>
      <WorkPage />
    </StaffOnly>
  );
}
