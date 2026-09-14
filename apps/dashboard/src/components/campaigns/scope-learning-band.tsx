"use client";

import { LearningProgressCallout } from "@/components/campaigns/learning-progress-callout";
import type { LearningPhase } from "@/lib/revenue-view";

/**
 * The learning band for whatever scope a page IS — brand, offer, funnel or campaign.
 *
 * It takes the verdict as a PROP, off the page's OWN revenue read, rather than making a
 * read of its own. That is the point rather than a convenience: the band and the figures
 * beside it then come from ONE payload, so they cannot state different things about the
 * same scope. The previous shape assembled the countdown in the browser from three
 * services, and that is how one campaign came to read `13 days` on its own page and
 * `27 days` one click up — same spend, same ceiling, same price, two call sites passing
 * different inputs.
 *
 * Which campaign the countdown speaks for is features-service's answer too
 * (`learningPhase.campaignId`, the leading LIVE campaign), so nothing here ranks,
 * filters or picks.
 *
 * Renders NOTHING when there is no verdict to state: a read that carries none (the
 * lensed body, the lean groups, a cold payload), a scope that is priced, or one the
 * producer says it cannot measure. The `Learning` tags on the surfaces underneath
 * already say the figures are being withheld.
 */
export function ScopeLearningBand({
  phase,
  brandId,
  offerId,
}: {
  /** The scope's verdict, off this page's revenue body. Null = this read carries none. */
  phase: LearningPhase | null | undefined;
  brandId: string;
  /** Scope the budget modal to one offer. Absent at brand grain. */
  offerId?: string;
}) {
  if (!phase) return null;
  return <LearningProgressCallout phase={phase} brandId={brandId} offerId={offerId} />;
}
