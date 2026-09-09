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
 * The read is byte-equal to the one the tenant switcher already makes on every
 * brand page (`["brandOffers", brandId]`, `enabled: !!brandId`), so it dedupes to
 * NO request — the lookup is free. Never a per-offer by-id fan-out: a leads table
 * naming forty offers must not be forty requests.
 */
export function useOfferImages(brandId: string | null | undefined) {
  const { data } = useAuthQuery(
    ["brandOffers", brandId ?? "none"],
    () => listBrandOffers(brandId!),
    { enabled: !!brandId },
  );
  return useMemo(() => offerImageLookup(data?.offers), [data]);
}
