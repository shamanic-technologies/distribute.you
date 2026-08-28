"use client";

import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { NotePencilIcon } from "@phosphor-icons/react/dist/csr/NotePencil";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { CalendarCheckIcon } from "@phosphor-icons/react/dist/csr/CalendarCheck";
import { CalendarDotsIcon } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { VideoCameraIcon } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { HandshakeIcon } from "@phosphor-icons/react/dist/csr/Handshake";
import { CreditCardIcon } from "@phosphor-icons/react/dist/csr/CreditCard";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import type { Icon } from "@phosphor-icons/react";
import { funnelLegMarkFor, type FunnelLegGlyph } from "@/lib/funnel-leg-marks";

// The tile that stands for ONE LEG of a sales funnel — the arrow a campaign actually
// performs, which is what the row beside it is named for.
//
// Keyed on the mark's own glyph token rather than on the leg, so the catalogue
// (`lib/funnel-leg-marks.ts`) stays a plain unit-testable module with no icon import and
// a new leg picks a glyph instead of editing a map over here. Same split, same reason, as
// the acquisition-channel mark.
//
// Imported per-icon from `dist/csr/<Name>`: the package root is a ~190KB barrel.

const LEG_ICONS: Record<FunnelLegGlyph, Icon> = {
  chats: ChatsCircleIcon,
  "user-plus": UserPlusIcon,
  "note-pencil": NotePencilIcon,
  "cursor-click": CursorClickIcon,
  clipboard: ClipboardTextIcon,
  "calendar-plus": CalendarPlusIcon,
  "calendar-check": CalendarCheckIcon,
  "calendar-dots": CalendarDotsIcon,
  "video-camera": VideoCameraIcon,
  handshake: HandshakeIcon,
  "credit-card": CreditCardIcon,
  receipt: ReceiptIcon,
};

type MarkSize = "xs" | "sm" | "md";

// Byte-equal to the channel and funnel marks: `xs` is the 18px offer tile, `sm` the 32px
// row tile, `md` the 44px settings-card tile. A leg drawn at a different scale beside a
// channel would read as a different vocabulary in one line.
const TILE: Record<MarkSize, string> = {
  xs: "h-[18px] w-[18px] rounded",
  sm: "h-8 w-8 rounded-lg",
  md: "h-11 w-11 rounded-xl",
};
const GLYPH: Record<MarkSize, number> = { xs: 12, sm: 18, md: 26 };

export function FunnelLegMark({
  fromKey,
  toKey,
  size = "sm",
  dimmed = false,
}: {
  /** The step the leg moves a lead OUT of — null for a leg onto the funnel from nothing. */
  fromKey: string | null;
  /** The step the leg moves a lead TO. */
  toKey: string | null;
  size?: MarkSize;
  dimmed?: boolean;
}) {
  const mark = funnelLegMarkFor(fromKey, toKey);
  // A leg this app has not drawn renders NOTHING rather than borrowing another leg's
  // tile — the caller then falls back to whatever it states for an unmarked row.
  if (!mark) return null;

  const LegIcon = LEG_ICONS[mark.glyph];
  return (
    <span
      className={`tone-tile flex shrink-0 items-center justify-center ${TILE[size]} ${
        mark.tone.iconBg
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <LegIcon size={GLYPH[size]} weight="duotone" className={mark.tone.iconText} />
    </span>
  );
}
