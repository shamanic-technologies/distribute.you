"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { listBrandOffers, isOfferArchived, offerArchiveErrorMessage, setBrandOfferArchived } from "@/lib/api";
import { OfferMark } from "@/components/marks/offer-mark";

/** The brand's archived offers. Same key as the offer pages' with-archived read, so no extra request. */
export function useArchivedOffers(brandId: string) {
  const allQ = useAuthQuery(
    ["brandOffers", brandId, "withArchived"],
    () => listBrandOffers(brandId, undefined, { includeArchived: true }),
    { refetchInterval: POLL_INTERVAL, enabled: !!brandId },
  );
  return (allQ.data?.offers ?? []).filter(isOfferArchived);
}

/**
 * The offers the owner ARCHIVED, each with Restore, as a section of Brand Settings (owner
 * 2026-10-22: a brand-wide list does not belong under one offer's page). The switcher keeps
 * the default list, which already leaves them out. Renders nothing while there are none.
 */
export function ArchivedOffers({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const archived = useArchivedOffers(brandId);
  const restore = useMutation({
    mutationFn: (offerId: string) => setBrandOfferArchived(brandId, offerId, false),
    onSuccess: (res) => {
      setError(null);
      queryClient.setQueryData(["brandOffer", brandId, res.offer.offerId], { offer: res.offer });
      queryClient.invalidateQueries({ queryKey: ["brandOffers", brandId] });
    },
    onError: (err) => {
      console.error("[dashboard] offer restore failed", err);
      setError(offerArchiveErrorMessage(err, false));
    },
  });
  if (archived.length === 0) return null;

  return (
    <>
        <table className="w-full text-[13px]">
          <tbody>
            {archived.map((offer) => (
              <tr key={offer.offerId} className="k-row">
                <td className="py-2.5 pl-4 pr-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <OfferMark size="md" imageUrl={offer.imageUrl} />
                    <span className="k-fg2 truncate font-medium">{offer.name}</span>
                  </div>
                </td>
                <td className="k-mono k-fg3 hidden px-3 text-[12px] md:table-cell">
                  {offer.archivedAt ? `Archived ${new Date(offer.archivedAt).toLocaleDateString()}` : "Archived"}
                </td>
                <td className="py-2 pl-3 pr-4 text-right">
                  <button
                    type="button"
                    className="k-btn"
                    disabled={restore.isPending && restore.variables === offer.offerId}
                    onClick={() => restore.mutate(offer.offerId)}
                  >
                    {restore.isPending && restore.variables === offer.offerId ? "Restoring…" : "Restore"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">{error}</div>}
    </>
  );
}
