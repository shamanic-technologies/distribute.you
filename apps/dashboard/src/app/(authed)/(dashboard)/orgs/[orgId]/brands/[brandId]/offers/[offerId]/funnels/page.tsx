import { OfferFunnelsPage } from "@/components/funnels/offer-funnels-page";
import { LearningToneProvider } from "@/components/learning-tag";

/**
 * An offer's funnels read in the brand's PRIMARY, like every other offer-grain
 * surface. Stated on the ROUTE for consistency with its siblings, so one grain is
 * declared in one place rather than half in a route and half in a component.
 */
export default function OfferFunnelsRoute() {
  return (
    <LearningToneProvider tone="primary">
      <OfferFunnelsPage />
    </LearningToneProvider>
  );
}
