"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getBrandOffer,
  isOfferArchived,
  offerArchiveErrorMessage,
  setBrandOfferArchived,
} from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * RETIRE AN OFFER the brand no longer sells (or created by mistake), or bring it back.
 *
 * Archiving hides the offer from the offer switcher and the default Offers list. It
 * deletes nothing: its missions, audiences and figures stay, and Restore puts it back.
 * brand-service refuses the archive while a campaign on the offer is still running,
 * and that refusal is rendered as a sentence (`offerArchiveErrorMessage`).
 *
 * Reads the same by-id key as `OfferIdentityTitle`, so it costs no request.
 */
export function OfferArchiveCard({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data } = useAuthQuery(
    ["brandOffer", brandId, offerId],
    () => getBrandOffer(brandId, offerId),
    { enabled: !!brandId && !!offerId },
  );
  const offer = data?.offer ?? null;
  const archived = offer ? isOfferArchived(offer) : false;

  const mut = useMutation({
    mutationFn: (next: boolean) => setBrandOfferArchived(brandId, offerId, next),
    onSuccess: (res) => {
      setError(null);
      queryClient.setQueryData(["brandOffer", brandId, offerId], { offer: res.offer });
      queryClient.invalidateQueries({ queryKey: ["brandOffers", brandId] });
    },
    onError: (err, next) => {
      console.error("[dashboard] offer archive write failed", err);
      setError(offerArchiveErrorMessage(err, next));
    },
  });

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
      <h2 className="text-sm font-semibold text-gray-800">
        {archived ? "This offer is archived" : "Archive this offer"}
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">
        {archived
          ? "It is hidden from your offer switcher and your Offers list. Its missions, audiences and figures are all kept."
          : "Stop showing an offer you no longer sell. Nothing is deleted, and you can restore it at any time."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => mut.mutate(!archived)}
          disabled={!offer || mut.isPending}
          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mut.isPending ? (archived ? "Restoring…" : "Archiving…") : archived ? "Restore offer" : "Archive offer"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
