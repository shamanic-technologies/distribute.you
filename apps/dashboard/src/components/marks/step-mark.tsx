"use client";

import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { CursorClickIcon } from "@phosphor-icons/react/dist/csr/CursorClick";
import { CalendarPlusIcon } from "@phosphor-icons/react/dist/csr/CalendarPlus";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { IdentificationBadgeIcon } from "@phosphor-icons/react/dist/csr/IdentificationBadge";
import { TextboxIcon } from "@phosphor-icons/react/dist/csr/Textbox";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { CurrencyDollarIcon } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { ShoppingBagOpenIcon } from "@phosphor-icons/react/dist/csr/ShoppingBagOpen";
import type { Icon } from "@phosphor-icons/react";
import {
  stepMarkFor,
  stepMarkForLeadStage,
  type StepGlyph,
} from "@/lib/step-marks";

// The tile that stands for ONE STEP, wherever a step is named. Keyed
// on the glyph token so the catalogue (`lib/step-marks.ts`) stays a plain
// unit-testable module with no icon import. Imported per-icon from `dist/csr/<Name>`:
// the package root is a ~190KB barrel.

const STEP_ICONS: Record<StepGlyph, Icon> = {
  "hand-waving": HandWavingIcon,
  "cursor-click": CursorClickIcon,
  "calendar-plus": CalendarPlusIcon,
  "users-three": UsersThreeIcon,
  "identification-badge": IdentificationBadgeIcon,
  textbox: TextboxIcon,
  clipboard: ClipboardTextIcon,
  "currency-dollar": CurrencyDollarIcon,
  "shopping-bag-open": ShoppingBagOpenIcon,
};

type MarkSize = "xs" | "sm" | "md";

// Byte-equal to the leg and channel marks, so a step drawn beside any of them
// reads as one vocabulary.
const TILE: Record<MarkSize, string> = {
  xs: "h-[18px] w-[18px] rounded",
  sm: "h-8 w-8 rounded-lg",
  md: "h-11 w-11 rounded-xl",
};
const GLYPH: Record<MarkSize, number> = { xs: 12, sm: 18, md: 26 };

export function StepMark({
  stepKey,
  stageKey,
  size = "sm",
  dimmed = false,
}: {
  /** The producer's step token. */
  stepKey?: string | null;
  /** A lead-panel stage key instead, mapped onto the step vocabulary. */
  stageKey?: string | null;
  size?: MarkSize;
  dimmed?: boolean;
}) {
  const mark = stepKey != null ? stepMarkFor(stepKey) : stepMarkForLeadStage(stageKey);
  // A step this app has not drawn renders NOTHING rather than borrowing a neighbour's.
  if (!mark) return null;
  const StepIcon = STEP_ICONS[mark.glyph];
  return (
    <span
      className={`tone-tile flex shrink-0 items-center justify-center ${TILE[size]} ${
        mark.tone.iconBg
      } ${dimmed ? "opacity-60" : ""}`}
    >
      <StepIcon size={GLYPH[size]} weight="duotone" className={mark.tone.iconText} />
    </span>
  );
}
