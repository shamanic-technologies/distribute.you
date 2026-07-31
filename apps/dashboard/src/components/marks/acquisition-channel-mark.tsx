"use client";

import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/csr/EnvelopeSimple";
import { ChatTeardropTextIcon } from "@phosphor-icons/react/dist/csr/ChatTeardropText";
import type { Icon } from "@phosphor-icons/react";
import type { AcquisitionChannelDef, AcquisitionChannelKey } from "@/lib/acquisition-channels";
import { BrandLogo } from "@/components/brand-logo";

// The tile that stands for one acquisition channel. It lives here rather than in
// the settings card because the Campaigns table renders the SAME mark for the
// channel a campaign runs on — two copies of the icon map is how the two
// surfaces end up disagreeing about what a channel looks like.

// Phosphor duotone for the channels that are ours: each mark carries a tinted
// fill under its stroke, so it fills its tile the way a real logo does. A
// channel on somebody else's platform wears that platform's logo instead.
const OWN_CHANNEL_ICONS: Partial<Record<AcquisitionChannelKey, Icon>> = {
  cold_email: EnvelopeSimpleIcon,
  cold_sms: ChatTeardropTextIcon,
};

type MarkSize = "sm" | "md";

const TILE: Record<MarkSize, string> = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl" };
const GLYPH: Record<MarkSize, number> = { sm: 18, md: 26 };
const LOGO: Record<MarkSize, number> = { sm: 18, md: 24 };

export function AcquisitionChannelMark({
  def,
  size = "md",
  dimmed = false,
}: {
  def: AcquisitionChannelDef;
  size?: MarkSize;
  dimmed?: boolean;
}) {
  const OwnIcon = OWN_CHANNEL_ICONS[def.key];

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

  return (
    <span
      className={`flex shrink-0 items-center justify-center ${TILE[size]} ${def.mark.tone.iconBg} ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      {OwnIcon && (
        <OwnIcon size={GLYPH[size]} weight="duotone" className={def.mark.tone.iconText} />
      )}
    </span>
  );
}
