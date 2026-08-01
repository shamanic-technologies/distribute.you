import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";

// Same component the dashboard renders. Read-only behaviour comes from the share
// context it is mounted under, not from a second copy of the page.
export default function SharedAudiencesPage() {
  return <CustomerAudiencesPage />;
}
