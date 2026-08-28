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

/**
 * A funnel's tile wears the BRAND's primary colour, not a colour of its own.
 *
 * The catalogue still carries four distinct tones and they are still what the
 * onboarding step rows read — but the MARK is the one thing a customer sees on
 * every surface of their own dashboard, and it reads as ours rather than theirs
 * when four fixed accents walk down a page. `brand-50` / `brand-600` are the
 * ramp `:root[data-brand-tint]` re-declares at the brand's own hue, so this
 * rotates by construction: it needs none of the opt-in class the decorative
 * hues carry, because the whole ramp already IS the brand's.
 *
 * Consequence accepted: two funnels no longer read apart by colour. The GLYPH is
 * what tells them apart — four distinct ones, which is why the catalogue is keyed
 * on one — exactly as the twelve leg marks share a single tone for the same
 * reason.
 */
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
      className={`flex shrink-0 items-center justify-center ${TILE[size]} bg-brand-50 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <Glyph size={GLYPH[size]} weight="duotone" className="text-brand-600" />
    </span>
  );
}
