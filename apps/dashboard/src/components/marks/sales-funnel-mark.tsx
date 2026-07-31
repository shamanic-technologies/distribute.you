"use client";

import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/csr/ShoppingCartSimple";
import { MagnetIcon } from "@phosphor-icons/react/dist/csr/Magnet";
import type { Icon } from "@phosphor-icons/react";
import type { SalesFunnelDef, SalesFunnelKey } from "@/lib/sales-funnels";

// The tile that stands for one sales funnel. Shared by the settings card and the
// Campaigns table's Goal column, so a funnel reads the same wherever it appears.

// Phosphor duotone rather than a single-weight utility set: each mark carries a
// tinted fill under its stroke, so it fills its tile instead of floating in it.
const FUNNEL_ICONS: Record<SalesFunnelKey, Icon> = {
  reply_meeting: ChatsCircleIcon,
  visit_meeting: CalendarCheckIcon,
  visit_signup: ShoppingCartSimpleIcon,
  visit_form: MagnetIcon,
};

type MarkSize = "sm" | "md";

const TILE: Record<MarkSize, string> = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl" };
const GLYPH: Record<MarkSize, number> = { sm: 18, md: 26 };

export function SalesFunnelMark({
  def,
  size = "md",
  dimmed = false,
}: {
  def: SalesFunnelDef;
  size?: MarkSize;
  dimmed?: boolean;
}) {
  const Glyph = FUNNEL_ICONS[def.key];
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${TILE[size]} ${def.tone.iconBg} ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <Glyph size={GLYPH[size]} weight="duotone" className={def.tone.iconText} />
    </span>
  );
}
