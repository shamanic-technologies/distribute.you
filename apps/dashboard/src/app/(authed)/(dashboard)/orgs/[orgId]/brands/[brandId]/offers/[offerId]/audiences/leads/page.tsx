import { EngagedLeadsPage } from "@/components/audiences/engaged-leads-page";
import { LearningToneProvider } from "@/components/learning-tag";

/**
 * An offer's leads read in the brand's PRIMARY, like every other offer-grain
 * surface. Stated on the ROUTE because `EngagedLeadsPage` is shared with the
 * campaign and funnel grains, which keep the tertiary.
 */
export default function AudiencesLeadsPage() {
  return (
    <LearningToneProvider tone="primary">
      <EngagedLeadsPage />
    </LearningToneProvider>
  );
}
