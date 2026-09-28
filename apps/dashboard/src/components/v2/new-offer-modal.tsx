"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ApiError, createBrandOffer, type Offer } from "@/lib/api";
import { useQueryClient } from "@/lib/use-auth-query";
import { OFFER_NAME_RULES, offerWriteErrorMessage } from "@/lib/offer-write";
import { OFFER_NAME_MAX_CHARS, nameCounter, normalizeOfferName } from "@/lib/name-limits";
import { v2OfferHref } from "@/lib/v2/routes";
import { OfferMark } from "@/components/marks/offer-mark";

/**
 * A brand states a NEW thing it sells, in the v2 frame.
 *
 * The same write as v1's `NewOfferModal` (`createBrandOffer`), the same cache seeding
 * (`["brandOffers", brandId]` and `["brandOffer", brandId, offerId]`), the same refusal
 * copy (`offerWriteErrorMessage`, a sentence per STATUS, never the downstream body) and
 * the same counter rule (`nameCounter`). Only the markup is Keel's: a `k-popover`
 * portalled to `#v2-portal` (the sidebar drawer is transformed, which traps `fixed`),
 * Esc closes it, and the new offer opens on its v2 page, where its missions and what it
 * promises are stated.
 */
export function V2NewOfferModal({ brandId, orgId, onClose }: { brandId: string; orgId: string; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: (value: string) => createBrandOffer(brandId, value),
    onSuccess: ({ offer }) => {
      queryClient.setQueryData(["brandOffers", brandId], (prev: { offers: Offer[] } | undefined) =>
        prev ? { offers: [...prev.offers, offer] } : { offers: [offer] },
      );
      queryClient.setQueryData(["brandOffer", brandId, offer.offerId], { offer });
      onClose();
      router.push(v2OfferHref(orgId, brandId, offer.offerId));
    },
    onError: (err) => {
      console.error("[dashboard v2] createBrandOffer failed", err);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  const trimmed = name.trim();
  // One state behind the counter AND the submit gate, so the button cannot offer a
  // write the number beside it already shows as impossible.
  const counter = nameCounter(name, OFFER_NAME_MAX_CHARS, normalizeOfferName);
  const submittable = trimmed.length > 0 && !counter.over;
  const status = error instanceof ApiError ? error.status : null;

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-new-offer-title"
        className="k-popover flex w-full max-w-[440px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <OfferMark size="sm" />
          <span id="v2-new-offer-title" className="k-label">
            New offer
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>

        <form
          className="px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !isPending) mutate(trimmed);
          }}
        >
          <label htmlFor="v2-new-offer-name" className="k-label block">
            Name
          </label>
          <input
            id="v2-new-offer-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Starter plan"
            aria-invalid={counter.over}
            className={`k-input mt-1.5 w-full px-2.5 ${counter.over ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
          />
          <div className="mt-1.5 flex items-start gap-3">
            <p className="k-fg3 min-w-0 flex-1 text-[12px] leading-[18px]">
              One thing this brand sells, {OFFER_NAME_RULES}. It gets its own missions and targeting, and returns its own number.
            </p>
            {counter.reveal && (
              <span
                aria-live="polite"
                className={`shrink-0 pt-px text-[12px] tabular-nums ${
                  counter.tone === "over" ? "font-medium text-[var(--data-rose)]" : counter.tone === "close" ? "text-[var(--data-amber)]" : "k-fg3"
                }`}
              >
                {counter.remaining}
              </span>
            )}
          </div>

          {error !== null && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {offerWriteErrorMessage(status, "create")}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isPending} className="k-btn-ghost">
              Cancel
            </button>
            {/* The in-flight label stays full opacity, so "Creating..." reads as work. */}
            <button
              type="submit"
              disabled={!submittable || isPending}
              className={`k-btn-accent ${isPending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
            >
              {isPending ? "Creating..." : "Create offer"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}
