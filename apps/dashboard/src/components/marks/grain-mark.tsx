"use client";

/**
 * WHOSE EVIDENCE A FIGURE STANDS ON, as a mark you read at a glance.
 *
 * The Workflows table states the same three columns at three grains, and the rank beside
 * them is scored over a WIDER population than any one column shows — so a reader looking
 * at `#1 · $164.75` next to `#3 · $21.22` has no way to tell that the first one's
 * position rests on an audience. The mark is what makes the provenance visible without
 * reading a sentence: a globe for the fleet, the brand's own logo for the brand, a
 * target for this campaign, and the audience's own face for an audience.
 *
 * The brand wears its REAL logo on purpose. It is the one grain we can illustrate with
 * the thing itself rather than a glyph, and a reader recognises it instantly.
 *
 * Phosphor duotone for the two glyphs, per the repo's mark convention: a grain is a
 * SUBJECT (whose numbers are these), not a control. Imported per-icon from `dist/csr`
 * so the 190KB barrel never enters the bundle.
 *
 * Every tint here is remapped in `html.dark` (`bg-brand-50`, `text-brand-600`,
 * `bg-gray-100`, `text-gray-500`) — checked in `globals.css`, not assumed.
 */

import { CrosshairIcon } from "@phosphor-icons/react/dist/csr/Crosshair";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { BrandLogo } from "@/components/brand-logo";
import type { WorkflowGrain } from "@/lib/workflow-grains";

export function GrainMark({
  grain,
  brandDomain,
  brandLogoUrl,
  size = 18,
}: {
  grain: WorkflowGrain;
  brandDomain?: string | null;
  brandLogoUrl?: string | null;
  size?: number;
}) {
  if (grain === "brand") {
    return <BrandLogo domain={brandDomain ?? null} logoUrl={brandLogoUrl} size={size} />;
  }
  const Icon = grain === "campaign" ? CrosshairIcon : GlobeHemisphereWestIcon;
  const tone =
    grain === "campaign" ? "bg-brand-50 text-brand-600" : "bg-gray-100 text-gray-500";
  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded ${tone}`}
      aria-hidden
    >
      <Icon weight="duotone" size={Math.round(size * 0.72)} />
    </span>
  );
}
