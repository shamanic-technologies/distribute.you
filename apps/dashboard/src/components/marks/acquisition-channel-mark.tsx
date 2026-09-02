"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/csr/ChatCircleText";
import { ChatTeardropTextIcon } from "@phosphor-icons/react/dist/csr/ChatTeardropText";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import type { Icon } from "@phosphor-icons/react";
import type { AcquisitionChannelMark as ChannelMark, OwnChannelGlyph } from "@/lib/acquisition-channels";
import { BrandLogo } from "@/components/brand-logo";

// The tile that stands for one acquisition channel. It lives here rather than in
// the settings card because the Campaigns table renders the SAME mark for the
// channel a campaign runs on — two copies of the icon map is how the two
// surfaces end up disagreeing about what a channel looks like.

// Phosphor duotone for the channels that are ours: each mark carries a tinted
// fill under its stroke, so it fills its tile the way a real logo does. A
// channel on somebody else's platform wears that platform's logo instead.
//
// Keyed on the mark's own glyph token rather than on the channel's identity, so
// the catalogue stays a plain unit-testable module with no icon import and a new
// channel picks a glyph instead of editing a map over here.
const OWN_CHANNEL_ICONS: Record<OwnChannelGlyph, Icon> = {
  "envelope": EnvelopeSimpleIcon,
  "chat-circle": ChatCircleTextIcon,
  "chat-teardrop": ChatTeardropTextIcon,
  "calendar-plus": CalendarPlusIcon,
};

type MarkSize = "xs" | "sm" | "md";
// THREE sizes, and `xs` exists because the breadcrumb sits beside the offer's
// own mark: `OfferMark` renders 18px there, so a funnel or a channel drawn at
// `sm` (32px) next to it reads as two different vocabularies in one line. `xs`
// is byte-equal to that offer tile — 18px, `rounded`, a 12px glyph — so the
// crumbs line up by construction rather than by two hand-tuned numbers.

const TILE: Record<MarkSize, string> = {
  xs: "h-[18px] w-[18px] rounded",
  sm: "h-8 w-8 rounded-lg",
  md: "h-11 w-11 rounded-xl",
};
const GLYPH: Record<MarkSize, number> = { xs: 12, sm: 18, md: 26 };
const LOGO: Record<MarkSize, number> = { xs: 12, sm: 18, md: 24 };

export function AcquisitionChannelMark({
  def,
  size = "md",
  dimmed = false,
}: {
  // Structural on purpose: this renders whatever carries a mark without knowing
  // what it was handed. A NULL mark is a channel this app has not drawn yet, not
  // an error: features-service publishes the channels and only the tile is ours,
  // so a newly published one arrives markless and must still render its row.
  def: { mark: ChannelMark | null };
  size?: MarkSize;
  dimmed?: boolean;
}) {
  if (!def.mark) return null;

  if (def.mark.kind === "vendor") {
    // A real provider logo is never tinted: the tile stays white so the mark
    // reads as the vendor's own.
    return (
      <span
        className={`flex shrink-0 items-center justify-center border border-gray-200 bg-white ${
          TILE[size]
        } ${dimmed ? "opacity-60" : ""}`}
      >
        <BrandLogo
          domain={def.mark.domain}
          size={LOGO[size]}
          className="rounded"
          fallbackClassName="text-gray-300"
        />
      </span>
    );
  }

  const OwnIcon = OWN_CHANNEL_ICONS[def.mark.glyph];

  return (
    <span
      className={`tone-tile flex shrink-0 items-center justify-center ${TILE[size]} ${def.mark.tone.iconBg} ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <OwnIcon size={GLYPH[size]} weight="duotone" className={def.mark.tone.iconText} />
    </span>
  );
}
