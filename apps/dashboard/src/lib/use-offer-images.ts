"use client";

import { useMemo } from "react";
import { listBrandOffers } from "@/lib/api";
import { offerImageLookup } from "@/lib/offer-image";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * The brand's offers, as an image lookup — for a surface that holds an offer ID and
 * nothing else.
 *
 * See `offer-image.ts` for WHY this exists (lead-service serves an offer as
 * `{offerId, name}` with no image, and one offer wearing two marks on one screen
 * is the coherence bug this repo keeps recording).
 *
 * One brand-wide list read, INCLUDING archived offers (`["brandOffers", brandId,
 * "withArchived"]`, the key the missions list shares): a lead served under an offer the
 * owner has since archived keeps its mark. The switcher's default list leaves archived
 * offers out, so it cannot serve this. Never a per-offer by-id fan-out: a leads table
 * naming forty offers must not be forty requests.
 */
export function useOfferImages(brandId: string | null | undefined) {
  // With archived offers: a lead served under an offer since archived keeps its mark.
  const { data } = useAuthQuery(
    ["brandOffers", brandId ?? "none", "withArchived"],
    () => listBrandOffers(brandId!, undefined, { includeArchived: true }),
    { enabled: !!brandId },
  );
  return useMemo(() => offerImageLookup(data?.offers), [data]);
}
