import { CampaignsPage } from "@/components/campaigns/campaigns-page";
import { LearningToneProvider } from "@/components/learning-tag";

/**
 * An offer's campaigns, one line per campaign. The way into every campaign page now
 * that the level between offer and campaign is gone (the offer Overview's outcome rows are the other).
 * Offer grain reads in the brand's PRIMARY, like its siblings.
 */
export default function OfferCampaignsRoute() {
  return (
    <LearningToneProvider tone="primary">
      <CampaignsPage />
    </LearningToneProvider>
  );
}
