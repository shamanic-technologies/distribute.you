import { StaffOnly } from "@/components/v2/staff-only";
import { CrewPage } from "@/components/v2/crew-page";

export default function V2CrewRoute() {
  return (
    <StaffOnly>
      <CrewPage />
    </StaffOnly>
  );
}
