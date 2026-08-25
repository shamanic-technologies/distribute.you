/**
 * Per-brand accent tint.
 *
 * The dashboard's `--color-brand-*` ramp is ten OKLCH steps that share one hue
 * (258, the blue charter) and carry a hand-tuned lightness/chroma curve. That
 * curve is what makes `brand-600` legible with white text and `brand-50` usable
 * as a surface, so re-tinting a brand must move the HUE and leave the curve
 * alone. Lightness is untouched at every step, which is why a brand tint cannot
 * break contrast the way a generated-from-scratch ramp would: `brand-600` sits
 * at 54% lightness whatever hue it wears.
 *
 * So the only question this module answers is "which hue, and how saturated" —
 * never "which of these colours is readable", because the ramp already decided.
 *
 * The colours come from logo.dev's Brand endpoint via brand-service. They are
 * the DOMINANT COLOURS OF THE LOGO, not a curated charter: two of the three are
 * routinely the logo's black and white. Measured 2026-08-25 — Stripe returns
 * `#000001 #ffffff #533afd`, Pressbeat returns three greys and no accent at all.
 * So a brand having colours does NOT mean it has a usable accent, and the
 * honest answer for a brand whose palette is entirely neutral is "no tint":
 * they keep the blue charter, which is what every brand looks like today.
 */

/** Chroma of `--color-brand-600`, the anchor step of the charter ramp. */
const REFERENCE_CHROMA = 0.16;

/**
 * Below this OKLCH chroma a colour carries no hue anyone would recognise as
 * theirs — it is the logo's black, white or grey. Tinting the whole dashboard
 * off a near-neutral produces a muddy ramp that reads as a rendering bug rather
 * than as a brand, so those are rejected outright.
 */
const NEUTRAL_CHROMA_CEILING = 0.04;

/**
 * A brand whose accent is genuinely muted should get a muted dashboard — that
 * IS their identity. But scaling the ramp's chroma all the way down to match
 * makes the accent vanish into the grey UI, so the scale has a floor: at worst
 * the tint is a little more saturated than the logo, never invisible.
 */
const MIN_CHROMA_SCALE = 0.6;

/**
 * What brand-service actually puts on the wire.
 *
 * It normalises logo.dev's own `[{r, g, b, hex}]` down to a plain list of hex
 * strings, so the producer's shape is `string[]` — verified against prod, not
 * assumed. The object form is still accepted because it is the shape the vendor
 * emits upstream, so a future producer that forwards it verbatim keeps working;
 * anything else is skipped rather than guessed at.
 */
export type BrandColor = string | { hex?: unknown };

/** The hex out of either wire form, or null for anything we can not read. */
export function colorHex(color: BrandColor): string | null {
  if (typeof color === "string") return color;
  if (color && typeof color.hex === "string") return color.hex;
  return null;
}

export interface BrandTint {
  /** OKLCH hue angle, degrees. */
  hue: number;
  /** Multiplier applied to every step's chroma in the charter ramp. */
  chromaScale: number;
  /** The colour this tint was derived from, for display and debugging. */
  sourceHex: string;
}

/** `#ce2e36` / `ce2e36` -> `{r,g,b}` in 0..255, or null if it is not a hex colour. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace(/^#/, "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

/** sRGB 0..255 -> linear-light 0..1. */
function toLinear(channel: number): number {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * sRGB -> OKLCH chroma + hue (Björn Ottosson's OKLab, the space the ramp is
 * already written in, so a hue read here lands where the ramp expects it).
 * Lightness is deliberately not returned: the ramp owns it.
 */
export function toOklchChromaHue(hex: string): { chroma: number; hue: number } | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(a * a + bb * bb);
  const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { chroma, hue };
}

/**
 * Pick the tint for a brand, or null when its palette carries no real accent.
 *
 * The most chromatic colour wins. Order is not trusted: logo.dev returns the
 * colours by dominance in the image, and the dominant colour of a logo is very
 * often its background, so `colors[0]` is the near-black more often than it is
 * the brand. Null means "keep the charter blue" and is a normal, common answer.
 */
export function resolveBrandTint(colors: readonly BrandColor[] | null | undefined): BrandTint | null {
  if (!colors || colors.length === 0) return null;

  let best: BrandTint | null = null;
  let bestChroma = 0;

  for (const color of colors) {
    const hex = colorHex(color);
    if (!hex) continue;
    const oklch = toOklchChromaHue(hex);
    if (!oklch) continue;
    if (oklch.chroma <= NEUTRAL_CHROMA_CEILING) continue;
    if (oklch.chroma <= bestChroma) continue;

    bestChroma = oklch.chroma;
    best = {
      hue: Math.round(oklch.hue * 10) / 10,
      chromaScale:
        Math.round(Math.min(1, Math.max(MIN_CHROMA_SCALE, oklch.chroma / REFERENCE_CHROMA)) * 1000) / 1000,
      sourceHex: hex,
    };
  }

  return best;
}
