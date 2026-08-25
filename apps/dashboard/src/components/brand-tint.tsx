"use client";

import { useEffect } from "react";
import { useTenantSwitcher } from "@/lib/use-tenant-switcher";
import { resolveBrandTint } from "@/lib/brand-tint";

/** Marks <html> as tinted. Every override in globals.css hangs off this. */
const TINT_ATTR = "data-brand-tint";
const HUE_VAR = "--brand-hue";
const CHROMA_VAR = "--brand-chroma-scale";

/**
 * Repaint the dashboard's accent in the open brand's own colour.
 *
 * Mounted once on the dashboard shell beside BrandFavicon, and reading the same
 * `useTenantSwitcher()` brand it does — the tab mark and the accent must name
 * one brand or the two disagree while you switch.
 *
 * Three states, and only one of them tints. A brand we have colours for AND
 * whose palette carries a real accent gets its hue; a brand with no colours,
 * or with a palette that is all logo-black and logo-white, keeps the charter
 * blue. That second case is common, not exceptional — measured on real
 * palettes, roughly a third of the brands logo.dev has indexed carry no
 * accent at all — so "no tint" is a normal answer and never an error state.
 *
 * The attribute is REMOVED rather than set to the charter values on the way
 * out, so an untinted dashboard renders through exactly the same rules it did
 * before this feature existed.
 */
export function BrandTint() {
  const { displayBrand } = useTenantSwitcher();
  const tint = resolveBrandTint(displayBrand?.colors);
  const hue = tint?.hue ?? null;
  const chromaScale = tint?.chromaScale ?? null;

  useEffect(() => {
    const root = document.documentElement;

    if (hue === null || chromaScale === null) {
      root.removeAttribute(TINT_ATTR);
      root.style.removeProperty(HUE_VAR);
      root.style.removeProperty(CHROMA_VAR);
      return;
    }

    root.style.setProperty(HUE_VAR, String(hue));
    root.style.setProperty(CHROMA_VAR, String(chromaScale));
    root.setAttribute(TINT_ATTR, "");

    return () => {
      root.removeAttribute(TINT_ATTR);
      root.style.removeProperty(HUE_VAR);
      root.style.removeProperty(CHROMA_VAR);
    };
    // Primitives, never the brand object: that object is rebuilt on every poll,
    // so depending on it would rewrite the same two values ~every 30 seconds.
  }, [hue, chromaScale]);

  return null;
}
