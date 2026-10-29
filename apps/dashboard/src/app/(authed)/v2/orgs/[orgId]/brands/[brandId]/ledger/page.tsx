import { StaffOnly } from "@/components/v2/staff-only";
import { V2Ledger } from "@/components/v2/ledger-page";

// The brand's books (FACTORY-P4-PAGES). Its data is served by a staff-only gateway route,
// so <StaffOnly> is the UI gate, not the security boundary.
export default function Page() {
  return (
    <StaffOnly>
      <V2Ledger />
    </StaffOnly>
  );
}
