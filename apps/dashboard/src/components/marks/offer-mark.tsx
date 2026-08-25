"use client";

import { TagIcon } from "@phosphor-icons/react/dist/csr/Tag";

/**
 * The mark an OFFER wears, everywhere it appears.
 *
 * An offer has no domain and no vendor to borrow a logo from — it is ours — so
 * it takes this repo's own-thing treatment: a Phosphor DUOTONE glyph in a
 * tinted tile. Duotone because the tint carries a fill under the stroke in the
 * same `currentColor`, so one text colour drives both layers and the mark fills
 * its tile instead of floating in it.
 *
 * `bg-purple-50` is inside the closed set the `html.dark` remap covers. A
 * colour outside that set paints a bright block on the dark surface and is
 * invisible in the light default, so it ships looking perfect and breaks on the
 * first toggle.
 *
 * A COMPONENT rather than a copy in each surface, for the same reason the
 * acquisition-channel and sales-funnel marks are: the tenant switcher and the
 * top-bar breadcrumb both draw an offer, and two icon definitions is how they
 * come to disagree about what an offer looks like.
 */
export function OfferMark({ size = "md" }: { size?: "sm" | "md" }) {
  const tile = size === "sm" ? "h-[18px] w-[18px]" : "h-5 w-5";
  const glyph = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`tone-tile ${tile} flex flex-shrink-0 items-center justify-center rounded bg-purple-50 text-purple-600`}
    >
      <TagIcon weight="duotone" className={glyph} />
    </span>
  );
}
