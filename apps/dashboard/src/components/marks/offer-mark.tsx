"use client";

import { useEffect, useState } from "react";
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
 *
 * ── The generated image ──────────────────────────────────────────────────────
 *
 * A brand selling several propositions could not tell them apart at a glance:
 * every offer wore this same tag. So an offer now carries an image it can
 * regenerate (brand-service owns it, chat-service generates it, and the org
 * that asks pays for it), on the same visual template as the audience avatars —
 * flat vector, bold single solid background seeded on the row's own id — so the
 * two read as one product rather than two.
 *
 * The glyph is the FALLBACK, not the legacy: an offer created today has no
 * image, and a hotlink that fails to decode has none either. Both keep the tag
 * rather than an empty square, which is why `imageUrl` is optional at every call
 * site — a surface that cannot resolve the offer's own row (the leads table
 * reads lead-service's `{offerId, name}`, which carries no image) passes
 * nothing and is unchanged.
 */
export function OfferMark({
  size = "md",
  imageUrl,
}: {
  /** `lg` (64px) is the CHOOSING size: every surface that names an offer draws
   *  the mark at 18-20px, which is too small to tell two generated images apart
   *  while you are deciding whether to keep one. Offer Settings is the only
   *  caller. */
  size?: "sm" | "md" | "lg";
  /** The offer's generated image. Absent/null/undecodable ⟹ the glyph. */
  imageUrl?: string | null;
}) {
  const [broken, setBroken] = useState(false);
  // A NEW image gets a fresh chance to decode. Without this the flag is sticky
  // for the mount, so an offer whose image failed once keeps the glyph even after
  // it is regenerated — which reads as the regeneration having done nothing.
  useEffect(() => setBroken(false), [imageUrl]);
  const tile =
    size === "lg" ? "h-16 w-16 rounded-xl" : size === "sm" ? "h-[18px] w-[18px] rounded" : "h-5 w-5 rounded";
  const glyph = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  if (imageUrl && !broken) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setBroken(true)}
        className={`${tile} flex-shrink-0 object-cover`}
      />
    );
  }

  return (
    <span
      className={`tone-tile ${tile} flex flex-shrink-0 items-center justify-center bg-purple-50 text-purple-600`}
    >
      <TagIcon weight="duotone" className={glyph} />
    </span>
  );
}
