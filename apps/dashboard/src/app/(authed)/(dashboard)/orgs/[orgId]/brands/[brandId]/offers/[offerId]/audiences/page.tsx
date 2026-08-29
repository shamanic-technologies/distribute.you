import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";
import { LearningToneProvider } from "@/components/learning-tag";

/**
 * An offer's audiences read in the brand's PRIMARY, like every other offer-grain
 * surface. Stated on the ROUTE because `CustomerAudiencesPage` is shared with the
 * campaign and funnel grains, which keep the tertiary.
 */
export default function AudiencesPage() {
  return (
    <LearningToneProvider tone="primary">
      <CustomerAudiencesPage />
    </LearningToneProvider>
  );
}
