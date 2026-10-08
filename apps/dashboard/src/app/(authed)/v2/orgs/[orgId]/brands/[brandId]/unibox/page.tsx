import { StaffOnly } from "@/components/v2/staff-only";
import { UniboxPage } from "@/components/v2/unibox-page";

// Records > Unibox: every conversation of the brand in one place, staff mode only.
export default function V2UniboxRoute() {
  return (
    <StaffOnly>
      <UniboxPage />
    </StaffOnly>
  );
}
