import { StaffOnly } from "@/components/v2/staff-only";
import { V2Research } from "@/components/v2/research-page";

// One client view serves the hub and every question; see V2Research.
export default function Page() {
  return (
    <StaffOnly>
      <V2Research />
    </StaffOnly>
  );
}
