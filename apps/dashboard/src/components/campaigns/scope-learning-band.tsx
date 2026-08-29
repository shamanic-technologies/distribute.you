"use client";

import { LearningProgressCallout } from "@/components/campaigns/learning-progress-callout";
import { useScopeLearningLead } from "@/lib/use-scope-learning-lead";

/**
 * The learning band for whatever scope a page IS — brand, offer, funnel or campaign.
 *
 * The band itself states one campaign's countdown; this is what decides WHICH campaign
 * and hands it every figure, through the one derivation in `use-scope-learning-lead`.
 * A page renders this and nothing else: four call sites assembling the price, the spend,
 * the ceiling and the settling tail by hand is how one campaign came to state two
 * different dates two clicks apart.
 *
 * It renders NOTHING when the scope is measured, when nothing in it is running, or when
 * any input is missing — a date nobody can stand behind is worse than no date, and the
 * `Learning` tags on the surfaces underneath already say the figures are being withheld.
 */
export function ScopeLearningBand({
  brandId,
  featureSlug,
  offerId,
  funnelKey,
  campaignId,
}: {
  brandId: string;
  featureSlug: string;
  /** Narrow to one offer's campaigns. Absent at brand grain. */
  offerId?: string;
  /** Narrow to one funnel's campaigns. Absent above the funnel. */
  funnelKey?: string | null;
  /** Narrow to ONE campaign — its own page, where the band speaks for it alone. */
  campaignId?: string;
}) {
  const lead = useScopeLearningLead(brandId, featureSlug, { offerId, funnelKey, campaignId });
  if (!lead) return null;
  return (
    <LearningProgressCallout
      brandId={brandId}
      offerId={offerId}
      campaignId={lead.campaign.id}
      outcomeUnitCostUsd={lead.outcomeUnitCostUsd}
      spentUsd={lead.spentUsd}
      dailyBudgetUsd={lead.dailyBudgetUsd}
      settlingDays={lead.settlingDays}
      settlingDaysElapsed={lead.settlingDaysElapsed}
    />
  );
}
