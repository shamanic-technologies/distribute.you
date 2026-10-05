import { StaffOnly } from "@/components/v2/staff-only";
import { AudiencePage } from "@/components/v2/audience-page";

// Staff snapshot of the brand's source lists; see AudiencePage.
export default function Page() {
  return (
    <StaffOnly>
      <AudiencePage />
    </StaffOnly>
  );
}
