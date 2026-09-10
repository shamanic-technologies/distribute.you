"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError, createBrandOffer, type Offer } from "@/lib/api";
import { useQueryClient } from "@/lib/use-auth-query";
import { CharCounter } from "@/components/char-counter";
import { OFFER_NAME_RULES, offerWriteErrorMessage } from "@/lib/offer-write";
import { OFFER_NAME_MAX_CHARS, nameCounter, normalizeOfferName } from "@/lib/name-limits";
import { OfferMark } from "@/components/marks/offer-mark";

/**
 * A brand states a NEW thing it sells.
 *
 * One field, because that is the whole of what brand-service takes: a new offer
 * starts with NOTHING — no funnel, no confirmed field — and is independent of
 * every other offer on the brand. So this asks for the name and then hands over
 * to Offer Settings, where the funnels and what the offer promises are stated.
 * Collecting those here would be a second copy of two editors that already exist
 * one click away.
 *
 * It is deliberately NOT the create control the Campaigns page used to carry. A
 * campaign is set up with us and was correctly deleted from that table; an offer
 * is what the brand sells, which only the brand can say. Until now the only way
 * to get one was implicitly, on the first brand-scoped write — so a brand that
 * sold a second thing had nowhere to say so.
 *
 * The name rules are brand-service's (at most 60 characters, no word limit,
 * unique within the brand) and its refusal is the answer — nothing is validated
 * here beyond "you typed something". They are STATED under the field anyway,
 * because a rule a customer only learns by being refused is a rule we made them
 * discover.
 */
export function NewOfferModal({
  brandId,
  offerBasePath,
  onClose,
}: {
  brandId: string;
  /** `/orgs/:orgId/brands/:brandId/offers` — the new offer opens underneath it. */
  offerBasePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: (value: string) => createBrandOffer(brandId, value),
    onSuccess: ({ offer }) => {
      // Seed the list the table reads so the new row is on screen before the poll
      // comes round, rather than invalidating and waiting for a cold brand-service
      // read to answer.
      queryClient.setQueryData(
        ["brandOffers", brandId],
        (prev: { offers: Offer[] } | undefined) =>
          prev ? { offers: [...prev.offers, offer] } : { offers: [offer] },
      );
      queryClient.setQueryData(["brandOffer", brandId, offer.offerId], { offer });
      onClose();
      // Settings, not the offer's Overview: the offer is EMPTY, so its Overview has
      // nothing to state and its funnels are the only thing there is to do next.
      router.push(`${offerBasePath}/${offer.offerId}/settings`);
    },
    onError: (err) => {
      // Loud in the console (status + the whole downstream body), one sentence on
      // screen. The thrown Error's own message is the downstream body verbatim, so
      // it never reaches the screen: the reason travels in the status.
      console.error("[dashboard] createBrandOffer failed", err);
    },
  });

  const trimmed = name.trim();
  // One state behind the counter AND the submit gate, so the button cannot offer
  // a write the number beside it already shows as impossible.
  const counter = nameCounter(name, OFFER_NAME_MAX_CHARS, normalizeOfferName);
  const submittable = trimmed.length > 0 && !counter.over;
  const status = error instanceof ApiError ? error.status : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-offer-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 id="new-offer-title" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <OfferMark size="sm" />
            New offer
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form
          className="px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !isPending) mutate(trimmed);
          }}
        >
          <label htmlFor="new-offer-name" className="block text-xs text-gray-500">
            Name
          </label>
          <input
            id="new-offer-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Starter plan"
            /* No maxLength — the counter shows the overrun as a negative number,
               which a field that silently stops accepting keystrokes cannot. */
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              counter.over
                ? "border-red-300 focus:ring-red-200"
                : "border-gray-200 focus:ring-brand-300"
            }`}
          />
          <div className="mt-1.5 flex items-start gap-3">
            <p className="min-w-0 flex-1 text-xs text-gray-400">
              One thing this brand sells, {OFFER_NAME_RULES}. It gets its own funnels,
              audiences and campaigns, and returns its own number.
            </p>
            <CharCounter
              value={name}
              max={OFFER_NAME_MAX_CHARS}
              normalize={normalizeOfferName}
              className="shrink-0 pt-px"
            />
          </div>

          {error !== null && (
            <p className="mt-4 text-sm text-red-600">{offerWriteErrorMessage(status, "create")}</p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
            >
              Cancel
            </button>
            {/* The in-flight label stays FULL opacity. `disabled:opacity-40` would
                fade the very "Creating..." that signals work, so the button reads
                as dead at the one moment it is busiest. */}
            <button
              type="submit"
              disabled={!submittable || isPending}
              className={`rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 ${
                isPending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"
              }`}
            >
              {isPending ? "Creating..." : "Create offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
