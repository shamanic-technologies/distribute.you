"use client";

import { useEffect } from "react";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import {
  resolveBrandTint,
  TINT_ATTR,
  HUE_VAR,
  CHROMA_VAR,
  DELTA_VAR,
} from "@/lib/brand-tint";

/**
 * Repaint the dashboard's accent in the open brand's own colour.
 *
 * Mounted once on the dashboard shell beside BrandFavicon, and reading the same
 * `useTenantSwitcher()` brand it does — the tab mark and the accent must name
 * one brand or the two disagree while you switch.
 *
 * Only one kind of brand tints. A brand we have colours for AND
 * whose palette carries a real accent gets its hue; a brand with no colours,
 * or with a palette that is all logo-black and logo-white, keeps the charter
 * blue. That second case is common, not exceptional — measured on real
 * palettes, roughly a third of the brands logo.dev has indexed carry no
 * accent at all — so "no tint" is a normal answer and never an error state.
 *
 * The attribute is REMOVED rather than set to the charter values on the way
 * out, so an untinted dashboard renders through exactly the same rules it did
 * before this feature existed.
 *
 * This is the SECOND writer of those variables. The first is the pre-paint script
 * in the root layout (`lib/brand-tint-preload`), which paints the brand's
 * last-known tint before any JS of ours has run; this component is what keeps it
 * TRUE — it corrects a brand whose palette has changed, and tints a brand the
 * browser has never opened. Which is why it must not clear while the colours are
 * still unresolved: see the three states below.
 */
export function BrandTint() {
  const { brandId, displayBrand } = useTenantSwitcher();

  // Three states, and the middle one is what stops this component fighting the
  // pre-paint script.
  //
  //   UNRESOLVED — a brand is open and we have not read its colours yet (the
  //     cookie seed carries labels, never a palette). Leave whatever is painted
  //     alone. Clearing here is what would make the accent flash blue on every
  //     hydration, one beat after the script had already got it right.
  //   NO SCOPE   — no brand in the path at all (an org root, billing, the API
  //     key page). Definitely no tint, so clear. A client navigation off a brand
  //     must land where a hard load of that same URL lands.
  //   RESOLVED   — colours read. Set them, or clear when the palette carries no
  //     accent, which is a normal answer for roughly a third of brands.
  const colors = displayBrand?.colors;
  const resolved = colors ? resolveBrandTint(colors) : null;
  const unresolved = !!brandId && !colors;
  const hue = resolved?.hue ?? null;
  const chromaScale = resolved?.chromaScale ?? null;
  const hueDelta = resolved?.hueDelta ?? null;

  useEffect(() => {
    if (unresolved) return;

    const root = document.documentElement;

    const clear = () => {
      root.removeAttribute(TINT_ATTR);
      root.style.removeProperty(HUE_VAR);
      root.style.removeProperty(CHROMA_VAR);
      root.style.removeProperty(DELTA_VAR);
    };

    if (hue === null || chromaScale === null || hueDelta === null) {
      clear();
      return;
    }

    root.style.setProperty(HUE_VAR, String(hue));
    root.style.setProperty(CHROMA_VAR, String(chromaScale));
    root.style.setProperty(DELTA_VAR, String(hueDelta));
    root.setAttribute(TINT_ATTR, "");

    return clear;
    // Primitives, never the brand object: that object is rebuilt on every poll,
    // so depending on it would rewrite the same two values ~every 30 seconds.
  }, [unresolved, hue, chromaScale, hueDelta]);

  return null;
}
