import { StaffOnly } from "@/components/v2/staff-only";
import { MissionsPage } from "@/components/v2/missions-page";

export default function V2MissionsRoute() {
  return (
    <StaffOnly>
      <MissionsPage />
    </StaffOnly>
  );
}
