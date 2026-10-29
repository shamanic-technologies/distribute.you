import { StaffOnly } from "@/components/v2/staff-only";
import { V2TeamWork } from "@/components/v2/team-work-page";

// Done by your team (FACTORY-P4-PAGES): staff only for now.
export default function Page() {
  return (
    <StaffOnly>
      <V2TeamWork />
    </StaffOnly>
  );
}
