import { StaffOnly } from "@/components/v2/staff-only";
import { RunPage } from "@/components/v2/run-page";

export default function V2RunRoute() {
  return (
    <StaffOnly>
      <RunPage />
    </StaffOnly>
  );
}
