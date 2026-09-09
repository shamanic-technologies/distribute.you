"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, getBrandOffer, renameBrandOffer, type Offer } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { OFFER_NAME_RULES, offerWriteErrorMessage } from "@/lib/offer-write";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";

/**
 * What this offer is called. The only mutable field brand-service has on an offer.
 *
 * It ships with the create control rather than after it, because without it a name
 * typed once is permanent: an offer's name is stated at creation and there was no
 * other surface anywhere that could change it.
 *
 * It sits LAST on the page on purpose. Sales Funnels leads — how the offer is sold
 * is what a reader comes here to fund and change — and a rename is the rare
 * identity edit, which is where every settings page of this shape puts it.
 *
 * The name rules are brand-service's and its refusal is the answer; nothing is
 * pre-empted here beyond "you typed something".
 */
export function OfferNameCard({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();

  // The key the top-bar crumb and the tenant switcher already poll, so naming the
  // offer here costs no request.
  const { data } = useAuthQuery(["brandOffer", brandId, offerId], () =>
    getBrandOffer(brandId, offerId),
  );
  const offer = data?.offer ?? null;

  const [value, setValue] = useState("");
  // A form seeded from a query must RE-SEED when the payload changes, or the first
  // thing to settle — the on-disk snapshot from the previous visit — is what the
  // field keeps forever. Identity, not deep equality: React Query returns the same
  // reference when nothing changed, so an unchanged refetch costs nothing and
  // cannot loop. What outranks the wire is a name the user has EDITED.
  const seededFrom = useRef<Offer | null>(null);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (offer === null || seededFrom.current === offer) return;
    seededFrom.current = offer;
    if (!touched) setValue(offer.name);
  }, [offer, touched]);

  const { mutate, isPending: saving, error, isSuccess } = useMutation({
    mutationFn: (name: string) => renameBrandOffer(brandId, offerId, name),
    onSuccess: ({ offer: renamed }) => {
      // BOTH caches, or one surface keeps the old name until its next poll: the
      // by-id read backs this page and the top-bar crumb, the list backs the
      // Offers table and the tenant switcher's third tier.
      queryClient.setQueryData(["brandOffer", brandId, offerId], { offer: renamed });
      queryClient.setQueryData(
        ["brandOffers", brandId],
        (prev: { offers: Offer[] } | undefined) =>
          prev
            ? { offers: prev.offers.map((o) => (o.offerId === offerId ? renamed : o)) }
            : prev,
      );
      seededFrom.current = renamed;
      setTouched(false);
      setValue(renamed.name);
    },
    onError: (err) => {
      // Loud in the console (status + the whole downstream body), one sentence on
      // screen. The thrown Error's own message is the downstream body verbatim, so
      // it never reaches the screen: the reason travels in the status.
      console.error("[dashboard] renameBrandOffer failed", err);
    },
  });

  const trimmed = value.trim();
  const status = error instanceof ApiError ? error.status : null;
  // A LIVE compare against what is stored, never a sticky edited latch — typing a
  // change and undoing it must disarm Save.
  const dirty = offer !== null && trimmed.length > 0 && trimmed !== offer.name;

  if (offer === null) return null;

  return (
    <section className="mt-10">
      <div className="rounded-xl border border-gray-200 bg-white p-5 md:p-6">
        <h2 className="text-sm font-semibold text-gray-800">Offer name</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          What this proposition is called, {OFFER_NAME_RULES}. It names this offer
          everywhere: the offers table, the top bar and every campaign that sells it.
        </p>

        <div className="mt-3 max-w-sm">
          <input
            value={value}
            onChange={(e) => {
              setTouched(true);
              setValue(e.target.value);
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        {error !== null && (
          <p className="mt-4 text-sm text-red-600">{offerWriteErrorMessage(status, "rename")}</p>
        )}

        <SettingsSaveRow
          dirty={dirty}
          saving={saving}
          saved={isSuccess && !dirty}
          onSave={() => mutate(trimmed)}
        />
      </div>
    </section>
  );
}
