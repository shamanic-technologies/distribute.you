"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { listBrandOffers, isOfferArchived, offerArchiveErrorMessage, setBrandOfferArchived } from "@/lib/api";
import { OfferMark } from "@/components/marks/offer-mark";
import { SectionTitle } from "@/components/v2/ui";

/**
 * The offers the owner ARCHIVED, each with Restore, under the selected offer's page (there
 * is no list of offers since 2026-10-03). Reads the with-archived list; the switcher keeps
 * the default list, which already leaves them out. Renders nothing while there are none.
 */
export function ArchivedOffers({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const allQ = useAuthQuery(
    ["brandOffers", brandId, "withArchived"],
    () => listBrandOffers(brandId, undefined, { includeArchived: true }),
    { refetchInterval: POLL_INTERVAL },
  );
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
  const archived = (allQ.data?.offers ?? []).filter(isOfferArchived);
  if (archived.length === 0) return null;

  return (
    <div className="mt-10">
      <SectionTitle count={archived.length} right={<span>Hidden from the offer switcher</span>}>
        Archived
      </SectionTitle>
      <div className="k-card overflow-hidden">
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
        <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
          {error ?? "Archived offers keep their missions and figures. Archive an offer from its Settings."}
        </div>
      </div>
    </div>
  );
}
