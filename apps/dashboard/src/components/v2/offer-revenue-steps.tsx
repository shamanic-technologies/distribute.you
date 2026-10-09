"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPath, saveOfferSalesPath } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import {
  SALES_PATH_CHANNEL_SLUGS,
  legKeysOfStored,
  offeredFromCatalogue,
  salesPathLegsWire,
  type SalesPathSelection,
} from "@/lib/offer-sales-path";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { OfferSalesPath } from "@/components/v2/offer-sales-path";

/**
 * The offer's Revenue Steps tab (owner 2026-10-07, moved off the Outbound page): the legs
 * and the steps they are built from, ticked per offer in brand-service over
 * features-service's catalogue. Every tick is saved at once; the tab holds what was just
 * ticked until brand-service answers, then shows its answer.
 */
export function OfferRevenueSteps({ brandId, offerId }: { brandId: string; offerId: string }) {
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  const qc = useQueryClient();

  const q = useAuthQuery(["offerSalesPath", brandId, offerId], () => getOfferSalesPath(brandId, offerId), {
    enabled: !!offerId,
  });
  const [draft, setDraft] = useState<SalesPathSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const served = useMemo<SalesPathSelection | null>(
    () => (q.data ? { steps: new Set(q.data.steps ?? []), legs: legKeysOfStored(q.data.legs) } : null),
    [q.data],
  );
  useEffect(() => setDraft(null), [served]);

  const channelNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const slug of SALES_PATH_CHANNEL_SLUGS) {
      names.set(slug, channels.find((c) => c.featureSlug === slug)?.name ?? slug);
    }
    return names;
  }, [channels]);

  const offered = useMemo(() => offeredFromCatalogue(catalogue, SALES_PATH_CHANNEL_SLUGS), [catalogue]);

  const onChange = (next: SalesPathSelection) => {
    setDraft(next);
    setError(null);
    Promise.resolve()
      .then(() => saveOfferSalesPath(brandId, offerId, [...next.steps], salesPathLegsWire(next.legs, offered.channelsByLeg, offered.legs)))
      .then((saved) => {
        qc.setQueryData(["offerSalesPath", brandId, offerId], saved);
        // A prefix: re-reads every sales paths read of this offer (the Outbound page).
        return qc.invalidateQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
      })
      .catch((err) => {
        console.error("[offer-revenue-steps] save failed", err);
        setDraft(null);
        setError("Could not save this change. Try again.");
      });
  };

  const selection = draft ?? served;
  const settled = q.isFetchedAfterMount || q.data !== undefined;

  return (
    <>
      {error && <p className="mb-4 text-[13px] text-[var(--data-rose)]">{error}</p>}
      {!settled || catalogue.legs.size === 0 ? (
        <div className="space-y-2">
          <Shimmer className="h-12 rounded-[10px]" />
          <Shimmer className="h-12 rounded-[10px]" />
          <Shimmer className="h-12 rounded-[10px]" />
        </div>
      ) : q.isError && !selection ? (
        <EmptyNote>Could not read this offer&apos;s revenue steps.</EmptyNote>
      ) : (
        <OfferSalesPath
          catalogue={catalogue}
          channelNames={channelNames}
          selection={selection ?? { steps: new Set(), legs: new Set() }}
          onChange={onChange}
          legsFirst
        />
      )}
    </>
  );
}
