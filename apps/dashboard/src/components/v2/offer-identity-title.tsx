"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { OfferMark } from "@/components/marks/offer-mark";
import { CharCounter } from "@/components/char-counter";
import {
  ApiError,
  generateOfferImage,
  getBrandOffer,
  isInsufficientCredit,
  renameBrandOffer,
  type Offer,
} from "@/lib/api";
import { OFFER_NAME_RULES, offerWriteErrorMessage, type OfferWriteKind } from "@/lib/offer-write";
import { OFFER_NAME_MAX_CHARS, nameCounter, normalizeOfferName } from "@/lib/name-limits";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * WHAT AN OFFER IS CALLED, AND WHAT IT LOOKS LIKE, edited where they are read: the
 * offer page's own title.
 *
 * This replaced an "Offer identity" card that restated the title in a form below it.
 * Both values are v2-native, so they follow the inline rule: the name reads as text,
 * a click turns it into its field, blur/Enter saves, Esc drops it. The typed value
 * stays on screen while it saves, and a refusal reopens the field with the text kept.
 *
 * The NAME limit is brand-service's and its 400/409 is the answer (sixty characters,
 * unique within the brand). Only the display is pre-empted: the counter shows the
 * overrun, and a commit past the ceiling is not sent.
 *
 * The MARK regenerates on click (brand-service draws it, chat-service bills the org
 * that asks). A refusal is RENDERED, except a 402: `apiCall` already opened the
 * billing-guard modal, and a red line under it would say the same thing twice.
 */
export function OfferIdentityTitle({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();
  // The offer's own row, on the key the tenant switcher and the archive card share.
  const { data } = useAuthQuery(["brandOffer", brandId, offerId], () => getBrandOffer(brandId, offerId), {
    enabled: !!brandId && !!offerId,
  });
  const offer: Offer | null = data?.offer ?? null;

  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const writeOffer = (next: Offer) => {
    queryClient.setQueryData(["brandOffer", brandId, offerId], { offer: next });
    queryClient.invalidateQueries({ queryKey: ["brandOffers", brandId] });
  };

  const renameMut = useMutation({
    mutationFn: (value: string) => renameBrandOffer(brandId, offerId, value),
    onSuccess: (res) => {
      setPending(null);
      setError(null);
      writeOffer(res.offer);
    },
    onError: (err, value) => {
      setPending(null);
      setText(value);
      setError(refusal(err, "rename"));
    },
  });

  const imageMut = useMutation({
    mutationFn: () => generateOfferImage(brandId, offerId),
    onSuccess: (res) => {
      setError(null);
      writeOffer(res.offer);
    },
    onError: (err) => setError(refusal(err, "generate")),
  });

  const counter = nameCounter(text ?? "", OFFER_NAME_MAX_CHARS, normalizeOfferName);

  const commit = () => {
    if (text === null || !offer) return;
    const trimmed = text.trim();
    if (trimmed.length === 0 || trimmed === offer.name) {
      setText(null);
      setError(null);
      return;
    }
    if (counter.over) return;
    setText(null);
    setError(null);
    setPending(trimmed);
    renameMut.mutate(trimmed);
  };

  const shown = pending ?? offer?.name ?? " ";

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => imageMut.mutate()}
          disabled={!offer || imageMut.isPending}
          aria-label={offer?.imageUrl ? "Regenerate the offer image" : "Generate an offer image"}
          title={offer?.imageUrl ? "Regenerate image" : "Generate image"}
          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] disabled:cursor-wait"
        >
          <OfferMark size="title" imageUrl={offer?.imageUrl} />
          <span
            className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity duration-150 ${
              imageMut.isPending ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {imageMut.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <SparkleIcon weight="fill" className="h-4 w-4" />
            )}
          </span>
        </button>
        {/* ONE box for both states, so the field opens exactly where the text sat:
            same border width, padding and font, and the input is sized by a hidden
            copy of its own value in the same grid cell (the Hormozi card's pattern). */}
        {text !== null ? (
          <>
            <span className={`${NAME_BOX} ${counter.over ? "border-[var(--data-rose)]" : "border-[var(--accent)]"}`}>
              <span className="inline-grid min-w-0">
                <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
                  {text || " "}{" "}
                </span>
                <input
                  autoFocus
                  size={1}
                  aria-label="Offer name"
                  value={text}
                  placeholder={`Offer name, ${OFFER_NAME_RULES}`}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setText(null);
                      setError(null);
                    }
                  }}
                  /* No maxLength: the counter shows the overrun as a negative number. */
                  className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none [font:inherit] [letter-spacing:inherit]"
                />
              </span>
              <PencilSimpleIcon aria-hidden className="invisible h-4 w-4 shrink-0" />
            </span>
            <CharCounter value={text} max={OFFER_NAME_MAX_CHARS} normalize={normalizeOfferName} className="shrink-0" />
          </>
        ) : (
          <button
            type="button"
            disabled={!offer || pending !== null}
            onClick={() => offer && setText(offer.name)}
            className={`${NAME_BOX} k-hover group border-transparent text-left hover:border-[var(--line)]`}
          >
            <span className="truncate">{shown}</span>
            <PencilSimpleIcon className="k-fg3 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        )}
      </span>
      {error && <span className="text-[13px] font-normal leading-[20px] tracking-normal text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

/** The name's box, identical reading and editing, so nothing moves on click. */
const NAME_BOX = "-mx-2 flex min-w-0 items-center gap-2 rounded-[8px] border px-2";

/**
 * A refusal from brand-service, as a sentence, through the module the create modal
 * SHARES. Chosen from the STATUS only: rendering a thrown message is how a JSON blob
 * reaches a customer. `null` = say nothing (a 402 already opened the billing modal).
 */
function refusal(err: unknown, kind: OfferWriteKind): string | null {
  console.error("[dashboard] offer identity write failed", err);
  if (isInsufficientCredit(err)) return null;
  return offerWriteErrorMessage(err instanceof ApiError ? err.status : null, kind);
}
