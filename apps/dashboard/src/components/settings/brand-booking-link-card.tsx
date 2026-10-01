"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getOfferEconomics,
  listBrandOffers,
  saveOfferBookingUrl,
  type Offer,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";

// The page a prospect books a meeting on. The AI meeting-booking channel reads it
// to offer two open slots in the prospect's own time zone.
//
// brand-service stores it per OFFER (`brand_offers.booking_url`), because two
// propositions of one brand can be sold by two different people. It is edited
// here, on Brand Settings, because that is where a customer looks for it; the
// storage grain is the producer's and this card only writes it. One field per
// offer, the offer's name shown only when the brand sells several.
//
// The input used to sit on a settings card retired in #4433 while the value
// survived in brand-service, so it stayed readable and unwritable.

/** What the booking link is for, stated once for this card and its v2 host. */
export const BOOKING_LINK_BLURB =
  "When a prospect replies with interest, our AI replies right away and offers two open slots from this page, in the prospect's own time zone. We read Calendly, GoHighLevel and Google appointment schedules.";

/** brand-service writes the sentence; `err.message` is the whole downstream body verbatim. */
function saveErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    const body = (err as { body?: { error?: string } }).body;
    if (status === 400) return body?.error ?? "That link is not a valid web address.";
    if (status === 403) return "You do not have access to this brand.";
    if (status === 404) return "This offer no longer exists.";
  }
  return "Could not save the link. Try again in a moment.";
}

/** A pasted `calendly.com/x` is a link; the producer requires the scheme, so add it. */
function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** `bare` drops the explanation, for a host that states it beside the form. */
export function BrandBookingLinkCard({ brandId, bare = false }: { brandId: string; bare?: boolean }) {
  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId));
  const offers = offersQ.data?.offers ?? [];

  return (
    <div className="p-5">
      {!bare && <p className="mb-4 text-sm text-gray-600">{BOOKING_LINK_BLURB}</p>}
      {offersQ.isPending && !offersQ.isError ? (
        <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />
      ) : offersQ.isError ? (
        <p className="text-sm text-gray-600">We could not read this brand&apos;s offers. Try again in a moment.</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-gray-500">This brand has no offer yet, so there is nothing to book.</p>
      ) : (
        <div className="space-y-6">
          {offers.map((offer) => (
            <OfferBookingRow
              key={offer.offerId}
              brandId={brandId}
              offer={offer}
              showName={offers.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferBookingRow({
  brandId,
  offer,
  showName,
}: {
  brandId: string;
  offer: Offer;
  showName: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["offerEconomics", brandId, offer.offerId];
  const { data, isPending, isError } = useAuthQuery(key, () => getOfferEconomics(brandId, offer.offerId));

  const savedUrl = data?.bookingUrl ?? "";
  const [value, setValue] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // Re-seed on a different payload unless the customer is typing: the first
  // payload to settle is the on-disk one, and a once-per-mount latch would keep it.
  const seededFrom = useRef<object | null>(null);
  const touched = useRef(false);
  useEffect(() => {
    if (data === undefined) return;
    if (seededFrom.current !== null && touched.current) return;
    seededFrom.current = data;
    setValue(data.bookingUrl ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (next: string) => saveOfferBookingUrl(brandId, offer.offerId, normalizeUrl(next)),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      touched.current = false;
      setValue(next.bookingUrl ?? "");
      setJustSaved(true);
    },
    onError: (err) => console.error("[dashboard] saveOfferBookingUrl failed", err),
  });

  const dirty = (normalizeUrl(value) ?? "") !== savedUrl;
  const inputId = `booking-link-${offer.offerId}`;

  if (isPending && !isError) {
    return <div className="h-10 w-full max-w-sm animate-pulse rounded-lg bg-gray-100" />;
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-800">
        {showName ? offer.name : "Booking link"}
      </label>
      <input
        id={inputId}
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => {
          touched.current = true;
          setJustSaved(false);
          setValue(e.target.value);
        }}
        placeholder="https://calendly.com/you/30min"
        className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      {isError && (
        <p className="mt-2 text-sm text-gray-600">We could not read the current link. Nothing was changed.</p>
      )}
      {!dirty && !savedUrl && !justSaved && !isError && (
        <p className="mt-1.5 text-xs text-gray-500">
          No link set yet.
        </p>
      )}
      {save.isError && <p className="mt-2 text-sm text-red-600">{saveErrorMessage(save.error)}</p>}
      <SettingsSaveRow
        dirty={dirty}
        saving={save.isPending}
        saved={justSaved && !dirty}
        onSave={() => save.mutate(value)}
      />
    </div>
  );
}
